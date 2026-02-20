/**
 * Availability Engine — Fase 2B / Hotfix 2B.1
 * getAvailability: consulta disponibilidad por rango de fechas (unit-based).
 * Solo server-side. Usa service client para queries cross-table sin problemas de RLS.
 *
 * Regla de overlap (half-open intervals):
 *   Una reserva bloquea si: check_in < dateTo AND check_out > dateFrom
 *
 * SAFE_MODE (default: true):
 *   Rooms con sync_status in ('never', 'stale', 'error') se excluyen de disponibles
 *   para evitar overbooking cuando el feed iCal no está sincronizado.
 */

import { createServiceClient, createClient } from '@/lib/supabase/server'

// ─── Config ──────────────────────────────────────────────────────────────────

const SYNC_STALE_MS = 15 * 60 * 1000  // 15 minutos

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AvailableRoom {
  id: string
  name: string
  room_type_id: string | null
}

export interface StopSellRoom {
  id: string
  name: string
  reason: 'error' | 'stale' | 'never'
}

export interface AvailabilityByType {
  roomTypeId: string | null
  roomTypeName: string
  totalUnits: number
  availableUnits: number
  rooms: AvailableRoom[]
}

export interface AvailabilityResult {
  dateFrom: string
  dateTo: string
  byType: AvailabilityByType[]
  totalRooms: number
  totalAvailable: number
  stopSellRooms: StopSellRoom[]  // rooms excluidas por safe mode
  safeMode: boolean
}

export interface AvailabilityOptions {
  safeMode?: boolean  // default true
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type RawSyncStatus = 'ok' | 'error' | 'stale' | 'never'

function computeEffectiveSyncStatus(
  syncStatus: string,
  lastSyncedAt: string | null,
): RawSyncStatus {
  if (!lastSyncedAt) return 'never'
  if (syncStatus === 'error') return 'error'
  const ageMs = Date.now() - new Date(lastSyncedAt).getTime()
  if (ageMs > SYNC_STALE_MS) return 'stale'
  return 'ok'
}

// ─── getAvailability ─────────────────────────────────────────────────────────

/**
 * Retorna disponibilidad de todas las unidades de una propiedad para el rango dado.
 *
 * @param propertyId  UUID de la propiedad
 * @param dateFrom    YYYY-MM-DD — primer día del rango (check-in)
 * @param dateTo      YYYY-MM-DD — último día del rango (check-out, exclusive)
 * @param options     AvailabilityOptions (safeMode default: true)
 */
export async function getAvailability(
  propertyId: string,
  dateFrom: string,
  dateTo: string,
  options: AvailabilityOptions = {},
): Promise<AvailabilityResult> {
  const safeMode = options.safeMode !== false  // default true

  const admin = createServiceClient()
  // client autenticado: RLS restringe rooms y bookings al tenant del caller.
  // Si propertyId no pertenece al org del usuario, las queries retornan 0 filas.
  const client = await createClient()

  // 1. Todas las unidades de la propiedad con su room_type + sync state
  // Usa cliente autenticado (RLS garantiza aislamiento por tenant)
  const { data: rooms, error: roomsError } = await client
    .from('rooms')
    .select('id, name, room_type_id, sync_status, last_synced_at, room_type:room_types(name)')
    .eq('property_id', propertyId)
    .order('name')

  if (roomsError) throw new Error(`Error al obtener unidades: ${roomsError.message}`)
  if (!rooms?.length) {
    return { dateFrom, dateTo, byType: [], totalRooms: 0, totalAvailable: 0, stopSellRooms: [], safeMode }
  }

  const roomIds = rooms.map((r) => r.id)

  // 2. Unidades bloqueadas por external_reservations (status != 'cancelled')
  //    Overlap: check_in < dateTo AND check_out > dateFrom
  const { data: extBlocked, error: extError } = await admin
    .from('external_reservations')
    .select('room_id')
    .in('room_id', roomIds)
    .neq('status', 'cancelled')
    .lt('check_in', dateTo)
    .gt('check_out', dateFrom)

  if (extError) throw new Error(`Error al consultar bloqueos externos: ${extError.message}`)

  // 3. Unidades bloqueadas por bookings internos (status NOT IN ['cancelled'])
  // Usa cliente autenticado (RLS garantiza aislamiento por tenant)
  const { data: intBlocked, error: intError } = await client
    .from('bookings')
    .select('room_id')
    .eq('property_id', propertyId)
    .in('room_id', roomIds)
    .not('status', 'in', '(cancelled)')
    .lt('check_in', dateTo)
    .gt('check_out', dateFrom)

  if (intError) throw new Error(`Error al consultar reservas internas: ${intError.message}`)

  // 4. Conjunto de room_ids bloqueados por reservas (union de ambas fuentes)
  const reservationBlockedSet = new Set<string>()
  for (const row of extBlocked ?? []) reservationBlockedSet.add(row.room_id)
  for (const row of (intBlocked ?? []).filter((r) => r.room_id !== null)) {
    reservationBlockedSet.add(row.room_id!)
  }

  // 5. SAFE_MODE: identificar rooms excluidas por estado de sync inseguro
  const stopSellRooms: StopSellRoom[] = []
  const stopSellSet = new Set<string>()

  if (safeMode) {
    for (const room of rooms) {
      const effectiveStatus = computeEffectiveSyncStatus(room.sync_status, room.last_synced_at)
      if (effectiveStatus !== 'ok') {
        stopSellRooms.push({ id: room.id, name: room.name, reason: effectiveStatus })
        stopSellSet.add(room.id)
      }
    }
  }

  // 6. Agrupar por room_type
  const typeMap = new Map<string | null, AvailabilityByType>()

  for (const room of rooms) {
    const typeId = room.room_type_id ?? null
    const rt = room.room_type as { name: string } | { name: string }[] | null
    const typeName = (Array.isArray(rt) ? rt[0]?.name : rt?.name) ?? 'Sin tipo'

    if (!typeMap.has(typeId)) {
      typeMap.set(typeId, {
        roomTypeId: typeId,
        roomTypeName: typeName,
        totalUnits: 0,
        availableUnits: 0,
        rooms: [],
      })
    }

    const group = typeMap.get(typeId)!
    group.totalUnits++

    // Una room está disponible solo si:
    // - No tiene reservas en overlap
    // - NO está en stop-sell por safe mode
    if (!reservationBlockedSet.has(room.id) && !stopSellSet.has(room.id)) {
      group.availableUnits++
      group.rooms.push({ id: room.id, name: room.name, room_type_id: typeId })
    }
  }

  const byType = [...typeMap.values()]
  const totalRooms = rooms.length
  const totalAvailable = byType.reduce((sum, g) => sum + g.availableUnits, 0)

  return { dateFrom, dateTo, byType, totalRooms, totalAvailable, stopSellRooms, safeMode }
}
