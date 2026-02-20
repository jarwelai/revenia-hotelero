/**
 * Public Search — Sprint 3A
 *
 * searchAvailableRoomTypes: busca tipos de habitación disponibles para un rango de fechas
 * y calcula el precio total por estancia usando el motor de cotización público.
 *
 * Reglas:
 * - Solo server-side (usa service client + getAvailability)
 * - safeMode: false (flujo público, no hay canal externo que bloquee)
 * - Una cotización de muestra por tipo (primera room disponible)
 * - Errores de cotización por tipo se omiten silenciosamente (no bloquean otros tipos)
 */

import { getAvailability } from '@/lib/availability'
import { computeQuotePublic } from '@/lib/quote'
import { createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublicRoomTypeSearchResult {
  room_type_id: string
  name: string
  description?: string | null
  amenities?: string[]
  images?: string[]
  available_units: number
  total_for_stay: number
  currency: string
  sample_nightly_breakdown?: { night: string; base_rate?: number | null; total_rate: number }[]
}

export interface SearchAvailableRoomTypesParams {
  propertyId: string
  checkIn: string       // YYYY-MM-DD
  checkOut: string      // YYYY-MM-DD
  adults: number
  childrenAges: number[]
}

// ─── searchAvailableRoomTypes ─────────────────────────────────────────────────

/**
 * Retorna los tipos de habitación disponibles para el rango dado,
 * enriquecidos con precio total por estancia y metadata.
 *
 * @param params  SearchAvailableRoomTypesParams
 * @returns       Array ordenado por available_units desc, luego por nombre
 */
export async function searchAvailableRoomTypes(
  params: SearchAvailableRoomTypesParams,
): Promise<PublicRoomTypeSearchResult[]> {
  const { propertyId, checkIn, checkOut, adults, childrenAges } = params

  // 1. Disponibilidad para el rango exacto (safeMode false — flujo público)
  const availability = await getAvailability(propertyId, checkIn, checkOut, { safeMode: false })

  const typesWithRooms = availability.byType.filter(
    (g) => g.roomTypeId !== null && g.rooms.length > 0,
  )

  if (typesWithRooms.length === 0) return []

  // 2. Metadata de room_types (name, description, amenities_json)
  const admin = createServiceClient()
  const typeIds = typesWithRooms.map((g) => g.roomTypeId as string)

  const { data: roomTypeData } = await admin
    .from('room_types')
    .select('id, name, description, amenities_json')
    .in('id', typeIds)

  const rtMap = new Map<string, { name: string; description: string | null; amenities_json: string[] }>()
  for (const rt of roomTypeData ?? []) {
    rtMap.set(rt.id, {
      name: rt.name as string,
      description: (rt.description as string | null) ?? null,
      amenities_json: (rt.amenities_json as string[]) ?? [],
    })
  }

  // 3. Cotización concurrente por tipo (muestra: primera room disponible)
  const settled = await Promise.allSettled(
    typesWithRooms.map(async (group): Promise<PublicRoomTypeSearchResult | null> => {
      const roomTypeId = group.roomTypeId as string
      const sampleRoomId = group.rooms[0].id
      const meta = rtMap.get(roomTypeId)

      const quote = await computeQuotePublic({
        propertyId,
        roomId: sampleRoomId,
        checkIn,
        checkOut,
        adults,
        childrenAges,
      })

      if (quote.error) return null

      const breakdown = quote.nights.map((n) => ({
        night: n.night,
        base_rate: n.base_rate,
        total_rate: n.total_rate,
      }))

      return {
        room_type_id: roomTypeId,
        name: meta?.name ?? group.roomTypeName,
        description: meta?.description ?? null,
        amenities: meta?.amenities_json ?? [],
        images: [],
        available_units: group.rooms.length,
        total_for_stay: quote.grand_total,
        currency: quote.currency,
        sample_nightly_breakdown: breakdown,
      }
    }),
  )

  const results = settled
    .filter((r): r is PromiseFulfilledResult<PublicRoomTypeSearchResult | null> =>
      r.status === 'fulfilled',
    )
    .map((r) => r.value)
    .filter((v): v is PublicRoomTypeSearchResult => v !== null)

  // Ordenar: más disponibles primero, luego por nombre
  results.sort((a, b) => {
    if (b.available_units !== a.available_units) return b.available_units - a.available_units
    return a.name.localeCompare(b.name)
  })

  return results
}
