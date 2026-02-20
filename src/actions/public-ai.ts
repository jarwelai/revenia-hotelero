'use server'

/**
 * Server Actions — IA para contenido público (Sprint 2B)
 *
 * generatePublicCopy — genera borrador con OpenRouter para un slot+idioma
 * translatePublicCopy — traduce texto aprobado a otro idioma via OpenRouter
 *
 * Reglas:
 *  - Solo owner/manager pueden llamar estas acciones
 *  - Todos los textos generados se guardan como 'draft'
 *  - NUNCA se auto-aprueba
 *  - NUNCA se sobreescribe una traducción aprobada
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PublicLang } from '@/types/hotelero'

const CONTENT_REVALIDATE_PATH = '/dashboard/settings/content'

const KEY_CONTEXT: Record<string, { es: string; en: string }> = {
  'booking.title': {
    es: 'título principal de la página de reservas del hotel',
    en: 'main headline of the hotel booking page',
  },
  'booking.cta': {
    es: 'texto del botón de llamada a la acción para ver disponibilidad',
    en: 'call-to-action button text to check availability',
  },
  'checkout.title': {
    es: 'título de la página de confirmación de reserva',
    en: 'title of the booking confirmation page',
  },
  'checkout.cta': {
    es: 'texto del botón para confirmar la reserva',
    en: 'button text to confirm the booking',
  },
  'confirmed.title': {
    es: 'mensaje de éxito cuando la reserva es confirmada',
    en: 'success message when booking is confirmed',
  },
  'policies.cancellation': {
    es: 'texto de la política de cancelación del hotel (2-3 oraciones)',
    en: 'hotel cancellation policy text (2-3 sentences)',
  },
}

type DbClient = Awaited<ReturnType<typeof createClient>>

async function checkOwnerOrManager(
  supabase: DbClient,
  propertyId: string,
  userId: string,
): Promise<string | null> {
  const { data: property } = await supabase
    .from('properties')
    .select('org_id')
    .eq('id', propertyId)
    .maybeSingle()

  if (!property) return 'Propiedad no encontrada'

  const { data: membership } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', property.org_id)
    .eq('user_id', userId)
    .in('role', ['owner', 'manager'])
    .maybeSingle()

  if (!membership) return 'Sin permisos. Solo owner o manager pueden usar esta función.'
  return null
}

async function callOpenRouter(
  messages: { role: string; content: string }[],
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini'

  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`OpenRouter ${res.status}: ${body}`)
  }

  type OpenRouterResponse = {
    choices: { message: { content: string } }[]
  }
  const data = await res.json() as OpenRouterResponse
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

// ─── generatePublicCopy ────────────────────────────────────────────────────────

/**
 * Genera copy hotelero con IA para un slot de contenido público.
 * Requiere role owner o manager.
 * Guarda como draft — nunca auto-aprueba.
 * No sobreescribe traducción aprobada.
 */
export async function generatePublicCopy(
  propertyId: string,
  key: string,
  lang: PublicLang,
): Promise<{ text?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const permError = await checkOwnerOrManager(supabase, propertyId, user.id)
  if (permError) return { error: permError }

  // Nunca sobreescribir traducción aprobada
  const { data: existingSlot } = await supabase
    .from('public_content_slots')
    .select('id')
    .eq('property_id', propertyId)
    .eq('key', key)
    .maybeSingle()

  if (existingSlot) {
    const { data: existingTran } = await supabase
      .from('public_content_translations')
      .select('status')
      .eq('slot_id', existingSlot.id)
      .eq('lang', lang)
      .maybeSingle()

    if (existingTran?.status === 'approved') {
      return { error: 'Ya existe texto aprobado. Edítalo manualmente y apruébalo de nuevo.' }
    }
  }

  const { data: property } = await supabase
    .from('properties')
    .select('name')
    .eq('id', propertyId)
    .maybeSingle()

  const hotelName = property?.name ?? 'el hotel'
  const keyCtx = KEY_CONTEXT[key]

  const systemPrompt =
    lang === 'es'
      ? `Eres un experto en marketing hotelero para ${hotelName}. Responde SOLO con el texto solicitado, sin comillas, sin explicaciones, sin formato extra.`
      : `You are a hotel marketing expert for ${hotelName}. Respond ONLY with the requested text, no quotes, no explanations, no extra formatting.`

  const userPrompt =
    lang === 'es'
      ? `Genera el ${keyCtx?.es ?? key}. Debe ser claro, confiable y orientado a la conversión. Máximo 2 oraciones.`
      : `Generate the ${keyCtx?.en ?? key}. It must be clear, trustworthy and conversion-friendly. Maximum 2 sentences.`

  let generatedText: string
  try {
    generatedText = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al contactar la IA' }
  }

  if (!generatedText) return { error: 'La IA no generó ningún texto' }

  // Upsert slot
  const { data: slot, error: slotError } = await supabase
    .from('public_content_slots')
    .upsert(
      { property_id: propertyId, key, source_lang: lang },
      { onConflict: 'property_id,key' },
    )
    .select('id')
    .single()

  if (slotError || !slot) return { error: slotError?.message ?? 'Error al crear slot' }

  // Guardar como draft — NUNCA auto-aprobar
  const { error: tranError } = await supabase
    .from('public_content_translations')
    .upsert(
      {
        slot_id: slot.id,
        lang,
        text: generatedText,
        status: 'draft',
        approved_at: null,
        approved_by: null,
      },
      { onConflict: 'slot_id,lang' },
    )

  if (tranError) return { error: tranError.message }

  revalidatePath(CONTENT_REVALIDATE_PATH)
  return { text: generatedText }
}

// ─── translatePublicCopy ───────────────────────────────────────────────────────

/**
 * Traduce el texto aprobado de un slot a otro idioma via OpenRouter.
 * Requiere role owner o manager.
 * Guarda como draft — nunca auto-aprueba.
 * No sobreescribe traducción aprobada en el idioma destino.
 */
export async function translatePublicCopy(
  slotId: string,
  fromLang: PublicLang = 'es',
  toLang: PublicLang = 'en',
): Promise<{ text?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: slot } = await supabase
    .from('public_content_slots')
    .select('id, property_id')
    .eq('id', slotId)
    .maybeSingle()

  if (!slot) return { error: 'Slot no encontrado' }

  const permError = await checkOwnerOrManager(supabase, slot.property_id, user.id)
  if (permError) return { error: permError }

  // Cargar texto aprobado en idioma origen
  const { data: sourceTran } = await supabase
    .from('public_content_translations')
    .select('text')
    .eq('slot_id', slotId)
    .eq('lang', fromLang)
    .eq('status', 'approved')
    .maybeSingle()

  if (!sourceTran?.text) {
    return { error: `No hay texto aprobado en ${fromLang.toUpperCase()} para traducir` }
  }

  // Nunca sobreescribir traducción aprobada en idioma destino
  const { data: existingTarget } = await supabase
    .from('public_content_translations')
    .select('status')
    .eq('slot_id', slotId)
    .eq('lang', toLang)
    .maybeSingle()

  if (existingTarget?.status === 'approved') {
    return {}
  }

  const systemPrompt =
    toLang === 'en'
      ? 'You are a professional hotel content translator (Spanish to English). Respond ONLY with the translation, no explanations, no quotes.'
      : 'Eres un traductor profesional de contenido hotelero (inglés a español). Responde SOLO con la traducción, sin explicaciones, sin comillas.'

  let translatedText: string
  try {
    translatedText = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sourceTran.text },
    ])
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al traducir' }
  }

  if (!translatedText) return { error: 'La IA no generó ninguna traducción' }

  // Guardar como draft — NUNCA auto-aprobar
  const { error: tranError } = await supabase
    .from('public_content_translations')
    .upsert(
      {
        slot_id: slotId,
        lang: toLang,
        text: translatedText,
        status: 'draft',
        approved_at: null,
        approved_by: null,
      },
      { onConflict: 'slot_id,lang' },
    )

  if (tranError) return { error: tranError.message }

  revalidatePath(CONTENT_REVALIDATE_PATH)
  return { text: translatedText }
}
