'use server'

/**
 * Server Actions — Búsqueda pública de habitaciones (Sprint 3A)
 *
 * searchPublicRoomTypes: resuelve propiedad por public_key,
 * valida input y delega a searchAvailableRoomTypes.
 *
 * Reglas:
 * - No requiere autenticación (flujo público)
 * - Usa service client para resolver propiedad
 * - Valida fechas y ocupación antes de llamar al engine
 */

import { createServiceClient } from '@/lib/supabase/server'
import { searchAvailableRoomTypes } from '@/lib/public/search'
import type { PublicRoomTypeSearchResult } from '@/lib/public/search'
import type { PublicLang } from '@/types/hotelero'

export interface SearchPublicRoomTypesInput {
  publicKey: string
  checkIn: string       // YYYY-MM-DD
  checkOut: string      // YYYY-MM-DD
  adults: number
  childrenAges: number[]
  lang?: PublicLang
}

export async function searchPublicRoomTypes(
  input: SearchPublicRoomTypesInput,
): Promise<{ results?: PublicRoomTypeSearchResult[]; error?: string }> {
  const { publicKey, checkIn, checkOut, adults, childrenAges } = input

  // Validar fechas
  const ci = new Date(checkIn)
  const co = new Date(checkOut)
  if (isNaN(ci.getTime()) || isNaN(co.getTime())) {
    return { error: 'Fechas inválidas' }
  }
  if (ci >= co) {
    return { error: 'La fecha de salida debe ser posterior a la entrada' }
  }
  const nights = Math.round((co.getTime() - ci.getTime()) / 86_400_000)
  if (nights > 365) {
    return { error: 'La estancia no puede superar 365 noches' }
  }

  // Validar ocupación
  if (adults < 1) {
    return { error: 'Se requiere al menos 1 adulto' }
  }

  // Resolver propiedad por public_key
  const admin = createServiceClient()
  const { data: property } = await admin
    .from('properties')
    .select('id')
    .eq('public_key', publicKey)
    .maybeSingle()

  if (!property) return { error: 'Propiedad no encontrada' }

  try {
    const results = await searchAvailableRoomTypes({
      propertyId: property.id,
      checkIn,
      checkOut,
      adults,
      childrenAges,
    })
    return { results }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al buscar disponibilidad' }
  }
}
