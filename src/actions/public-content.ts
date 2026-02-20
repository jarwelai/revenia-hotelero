'use server'

/**
 * Server Actions — Contenido público (Phase 2D)
 *
 * Flujo público (sin auth):
 *   getPublicPropertySettings — lee config de propiedad pública via service client
 *
 * Flujo admin (requiere auth + owner/manager):
 *   savePublicSettings       — UPSERT property_public_settings
 *   upsertContentSlot        — UPSERT slot + traducción en un idioma
 *   approveContentSlot       — aprueba slot y su traducción
 *   initDefaultContentSlots  — crea los 6 slots predefinidos para una propiedad
 *
 * Sprint 2B:
 *   approveContentSlot — si se aprueba ES y no existe EN, auto-crea draft EN via IA
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { PublicLang, PropertyPublicSettings, PublicContentSlot } from '@/types/hotelero'
import { translatePublicCopy } from '@/actions/public-ai'

const CONTENT_REVALIDATE_PATH = '/dashboard/settings/content'

const DEFAULT_SLOT_KEYS = [
  'booking.title',
  'booking.cta',
  'checkout.title',
  'checkout.cta',
  'confirmed.title',
  'policies.cancellation',
] as const

// ─── Flujo público ─────────────────────────────────────────────────────────────

/**
 * Obtiene la configuración pública de una propiedad por su public_key.
 * Usa service client — no requiere sesión.
 */
export async function getPublicPropertySettings(
  publicKey: string,
): Promise<PropertyPublicSettings | null> {
  const admin = createServiceClient()

  const { data: property } = await admin
    .from('properties')
    .select('id')
    .eq('public_key', publicKey)
    .maybeSingle()

  if (!property) return null

  const { data } = await admin
    .from('property_public_settings')
    .select('*')
    .eq('property_id', property.id)
    .maybeSingle()

  return data as PropertyPublicSettings | null
}

// ─── Flujo admin ───────────────────────────────────────────────────────────────

/**
 * Guarda/actualiza la configuración pública de la propiedad.
 * Requiere role owner o manager.
 */
export async function savePublicSettings(
  propertyId: string,
  input: { default_lang: PublicLang; public_brand_name?: string | null },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('property_public_settings')
    .upsert({
      property_id: propertyId,
      default_lang: input.default_lang,
      public_brand_name: input.public_brand_name ?? null,
    })

  if (error) return { error: error.message }

  revalidatePath(CONTENT_REVALIDATE_PATH)
  return {}
}

/**
 * Crea o actualiza un slot de contenido y su traducción para el idioma dado.
 * Requiere role owner o manager.
 */
export async function upsertContentSlot(
  propertyId: string,
  key: string,
  lang: PublicLang,
  text: string,
): Promise<{ slotId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!text.trim()) return { error: 'El texto no puede estar vacío' }

  // Upsert slot (UNIQUE property_id + key)
  const { data: slot, error: slotError } = await supabase
    .from('public_content_slots')
    .upsert(
      { property_id: propertyId, key, source_lang: lang },
      { onConflict: 'property_id,key' },
    )
    .select('id')
    .single()

  if (slotError || !slot) return { error: slotError?.message ?? 'Error al crear slot' }

  // Upsert traducción — al guardar queda en draft
  const { error: tranError } = await supabase
    .from('public_content_translations')
    .upsert(
      { slot_id: slot.id, lang, text: text.trim(), status: 'draft', approved_at: null, approved_by: null },
      { onConflict: 'slot_id,lang' },
    )

  if (tranError) return { error: tranError.message }

  revalidatePath(CONTENT_REVALIDATE_PATH)
  return { slotId: slot.id }
}

/**
 * Aprueba un slot y su traducción para el idioma dado.
 * Requiere role owner o manager.
 *
 * Sprint 2B: si se aprueba ES y no existe traducción EN,
 * dispara auto-traducción a EN (best-effort, draft, nunca auto-aprueba).
 */
export async function approveContentSlot(
  slotId: string,
  lang: PublicLang,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('public_content_translations')
    .update({ status: 'approved', approved_at: now, approved_by: user.id })
    .eq('slot_id', slotId)
    .eq('lang', lang)

  if (error) return { error: error.message }

  // Sprint 2B: al aprobar ES, auto-crear draft EN si no existe ninguna traducción EN
  if (lang === 'es') {
    const { data: enTran } = await supabase
      .from('public_content_translations')
      .select('id')
      .eq('slot_id', slotId)
      .eq('lang', 'en')
      .maybeSingle()

    if (!enTran) {
      // Best-effort — errores se ignoran silenciosamente
      await translatePublicCopy(slotId, 'es', 'en').catch(() => {})
    }
  }

  revalidatePath(CONTENT_REVALIDATE_PATH)
  return {}
}

/**
 * Inicializa los 6 slots de contenido predefinidos para una propiedad.
 * No sobreescribe slots que ya existen.
 * Requiere role owner o manager.
 */
export async function initDefaultContentSlots(
  propertyId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const slotsToInsert = DEFAULT_SLOT_KEYS.map((key) => ({
    property_id: propertyId,
    key,
    source_lang: 'es' as PublicLang,
    status: 'draft',
  }))

  const { error } = await supabase
    .from('public_content_slots')
    .upsert(slotsToInsert, { onConflict: 'property_id,key', ignoreDuplicates: true })

  if (error) return { error: error.message }

  revalidatePath(CONTENT_REVALIDATE_PATH)
  return {}
}

/**
 * Carga todos los slots de una propiedad con sus traducciones (para admin).
 */
export async function getContentSlots(
  propertyId: string,
): Promise<{ slots: PublicContentSlot[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { slots: [], error: 'No autenticado' }

  const { data, error } = await supabase
    .from('public_content_slots')
    .select('*, translations:public_content_translations(*)')
    .eq('property_id', propertyId)
    .order('key')

  if (error) return { slots: [], error: error.message }

  return { slots: (data ?? []) as PublicContentSlot[] }
}
