/**
 * Public helpers — Phase 2D
 *
 * resolvePublicLang: determina el idioma para el flujo público.
 * getPublicText: obtiene texto de contenido público (traducción aprobada o fallback).
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { PublicLang } from '@/types/hotelero'

// ─── Fallbacks ─────────────────────────────────────────────────────────────────

const CONTENT_FALLBACKS: Record<string, Record<PublicLang, string>> = {
  'booking.title': {
    es: 'Reserva tu estancia',
    en: 'Book your stay',
  },
  'booking.cta': {
    es: 'Ver disponibilidad',
    en: 'Check availability',
  },
  'checkout.title': {
    es: 'Confirma tu reserva',
    en: 'Confirm your booking',
  },
  'checkout.cta': {
    es: 'Confirmar reserva',
    en: 'Confirm booking',
  },
  'confirmed.title': {
    es: '¡Reserva confirmada!',
    en: 'Booking confirmed!',
  },
  'policies.cancellation': {
    es: 'Consulta las políticas de cancelación con el establecimiento.',
    en: 'Please contact the property for cancellation policies.',
  },
}

// ─── resolvePublicLang ─────────────────────────────────────────────────────────

/**
 * Determina el idioma a usar en el flujo público.
 * Prioridad: queryLang → defaultLang → 'es'
 */
export function resolvePublicLang(
  defaultLang: PublicLang,
  queryLang?: string | null,
): PublicLang {
  if (queryLang === 'es' || queryLang === 'en') return queryLang
  return defaultLang
}

// ─── getPublicText ─────────────────────────────────────────────────────────────

/**
 * Obtiene el texto de un slot de contenido público para una propiedad e idioma.
 *
 * 1. Busca traducción aprobada en public_content_translations (via service client)
 * 2. Si no hay → retorna el fallback del CONTENT_FALLBACKS map
 * 3. Si tampoco hay fallback → retorna cadena vacía
 */
export async function getPublicText(
  propertyId: string,
  key: string,
  lang: PublicLang,
): Promise<string> {
  try {
    const supabase = createServiceClient()

    // Paso 1: obtener el slot_id para esta propiedad + key
    const { data: slot } = await supabase
      .from('public_content_slots')
      .select('id')
      .eq('property_id', propertyId)
      .eq('key', key)
      .maybeSingle()

    if (!slot) return CONTENT_FALLBACKS[key]?.[lang] ?? ''

    // Paso 2: obtener la traducción aprobada
    const { data } = await supabase
      .from('public_content_translations')
      .select('text')
      .eq('slot_id', slot.id)
      .eq('lang', lang)
      .eq('status', 'approved')
      .maybeSingle()

    if (data?.text) return data.text
  } catch {
    // DB no disponible — caer al fallback
  }

  return CONTENT_FALLBACKS[key]?.[lang] ?? ''
}
