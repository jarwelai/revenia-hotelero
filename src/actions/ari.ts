'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveNightRate } from '@/lib/ari'
import type { AriGrid, AriCell, BulkAriUpdate, RatePlan, RatePlanInterval } from '@/types/hotelero'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Genera array de fechas YYYY-MM-DD para [dateFrom, dateTo) (exclusive).
 */
function getDaysInRange(dateFrom: string, dateTo: string): string[] {
  const days: string[] = []
  let cursor = new Date(dateFrom + 'T00:00:00Z')
  const end = new Date(dateTo + 'T00:00:00Z')
  while (cursor.getTime() < end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return days
}

/**
 * Busca el plan BAR de la propiedad. Si no existe, lo crea.
 */
async function getOrCreateBarRatePlan(
  propertyId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<RatePlan | null> {
  const { data: existing } = await supabase
    .from('rate_plans')
    .select('*')
    .eq('property_id', propertyId)
    .eq('code', 'BAR')
    .maybeSingle()

  if (existing) return existing as RatePlan

  const { data: created, error } = await supabase
    .from('rate_plans')
    .insert({ property_id: propertyId, code: 'BAR', name: 'Best Available Rate', is_active: true })
    .select()
    .single()

  if (error) return null
  return created as RatePlan
}

// ─── getAriGrid ───────────────────────────────────────────────────────────────

/**
 * Retorna el grid ARI para la propiedad en el rango dado.
 * Usa el plan BAR (lo crea si no existe).
 *
 * @param propertyId UUID de la propiedad
 * @param dateFrom   YYYY-MM-DD — primer día
 * @param dateTo     YYYY-MM-DD — último día (exclusive)
 */
export async function getAriGrid(
  propertyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<AriGrid> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const barPlan = await getOrCreateBarRatePlan(propertyId, supabase)

  // Room types de la propiedad
  const { data: rawRoomTypes } = await supabase
    .from('room_types')
    .select('id, name')
    .eq('property_id', propertyId)
    .order('name')

  const roomTypes = (rawRoomTypes ?? []) as { id: string; name: string }[]

  if (!barPlan || roomTypes.length === 0) {
    return { grid: {}, ratePlanId: barPlan?.id ?? null, dateFrom, dateTo, roomTypes }
  }

  // Todos los intervalos del plan BAR que se solapan con el rango
  const { data: rawIntervals } = await supabase
    .from('rate_plan_intervals')
    .select('id, property_id, room_type_id, rate_plan_id, start_date, end_date, dow_mask, base_rate, min_los, closed, priority')
    .eq('rate_plan_id', barPlan.id)
    .lt('start_date', dateTo)
    .gt('end_date', dateFrom)

  const allIntervals = (rawIntervals ?? []) as RatePlanInterval[]

  // Construir grid: roomTypeId → dateStr → AriCell
  const days = getDaysInRange(dateFrom, dateTo)
  const grid: Record<string, Record<string, AriCell>> = {}

  for (const rt of roomTypes) {
    grid[rt.id] = {}
    for (const day of days) {
      // Buscar intervalo aplicable (incluyendo closed=true para mostrar en grid)
      const dowBit = 1 << ((new Date(day + 'T00:00:00Z').getDay() + 6) % 7)
      const candidates = allIntervals
        .filter((iv) =>
          iv.room_type_id === rt.id &&
          iv.start_date <= day &&
          iv.end_date > day &&
          (iv.dow_mask & dowBit) !== 0,
        )
        .sort((a, b) => b.priority - a.priority)

      if (candidates.length === 0) {
        grid[rt.id][day] = { base_rate: null, min_los: null, closed: false }
      } else {
        const best = candidates[0]
        grid[rt.id][day] = {
          base_rate: best.closed ? null : best.base_rate,
          min_los: best.min_los,
          closed: best.closed,
        }
      }
    }
  }

  return { grid, ratePlanId: barPlan.id, dateFrom, dateTo, roomTypes }
}

// ─── previewBulkAriUpdate ─────────────────────────────────────────────────────

export interface BulkPreviewItem {
  room_type_id: string
  room_type_name: string
  start_date: string
  end_date: string
  base_rate: number | null
  min_los: number | null
  closed: boolean
}

export interface PreviewBulkAriResult {
  items?: BulkPreviewItem[]
  error?: string
}

/**
 * Previsualiza los intervalos que se crearían con commitBulkAriUpdate.
 * NO modifica la DB.
 */
export async function previewBulkAriUpdate(input: BulkAriUpdate): Promise<PreviewBulkAriResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { property_id, room_type_ids, start_date, end_date } = input
  if (!start_date || !end_date || end_date <= start_date) {
    return { error: 'Rango de fechas inválido' }
  }
  if (!room_type_ids.length) return { error: 'Selecciona al menos un tipo de habitación' }

  // Validar que room_type_ids pertenecen a la propiedad (RLS cubre esto automáticamente)
  const { data: roomTypes } = await supabase
    .from('room_types')
    .select('id, name')
    .eq('property_id', property_id)
    .in('id', room_type_ids)

  if (!roomTypes?.length) return { error: 'Tipos de habitación no encontrados o sin acceso' }

  const items: BulkPreviewItem[] = roomTypes.map((rt) => ({
    room_type_id: rt.id as string,
    room_type_name: rt.name as string,
    start_date,
    end_date,
    base_rate: input.base_rate ?? null,
    min_los: input.min_los ?? null,
    closed: input.closed ?? false,
  }))

  return { items }
}

// ─── commitBulkAriUpdate ──────────────────────────────────────────────────────

export interface CommitBulkAriResult {
  error?: string
}

/**
 * Aplica el bulk update de tarifas ARI.
 * Para cada room_type_id:
 *   1. DELETE intervalos existentes en el rango (evita solapamientos)
 *   2. INSERT nuevo intervalo con los valores dados
 */
export async function commitBulkAriUpdate(input: BulkAriUpdate): Promise<CommitBulkAriResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const {
    property_id,
    room_type_ids,
    rate_plan_id,
    start_date,
    end_date,
    dow_mask = 127,
    base_rate,
    min_los,
    closed,
  } = input

  if (!start_date || !end_date || end_date <= start_date) {
    return { error: 'Rango de fechas inválido' }
  }
  if (!room_type_ids.length) return { error: 'Selecciona al menos un tipo de habitación' }
  if (base_rate == null && closed == null) {
    return { error: 'Debes especificar al menos base_rate o closed' }
  }

  // Validar rate_plan pertenece a property
  const { data: ratePlan } = await supabase
    .from('rate_plans')
    .select('id')
    .eq('id', rate_plan_id)
    .eq('property_id', property_id)
    .maybeSingle()

  if (!ratePlan) return { error: 'Plan de tarifas no encontrado o sin acceso' }

  for (const roomTypeId of room_type_ids) {
    // 1. DELETE intervalos que se solapan con el rango para este tipo
    const { error: deleteError } = await supabase
      .from('rate_plan_intervals')
      .delete()
      .eq('property_id', property_id)
      .eq('room_type_id', roomTypeId)
      .eq('rate_plan_id', rate_plan_id)
      .lt('start_date', end_date)
      .gt('end_date', start_date)

    if (deleteError) return { error: `Error al limpiar tarifas: ${deleteError.message}` }

    // 2. INSERT nuevo intervalo (solo si hay base_rate o closed definido)
    const intervalData = {
      property_id,
      room_type_id: roomTypeId,
      rate_plan_id,
      start_date,
      end_date,
      dow_mask,
      base_rate: base_rate ?? 0,
      min_los: min_los ?? null,
      closed: closed ?? false,
      priority: 0,
    }

    const { error: insertError } = await supabase
      .from('rate_plan_intervals')
      .insert(intervalData)

    if (insertError) return { error: `Error al guardar tarifas: ${insertError.message}` }
  }

  revalidatePath('/dashboard/rates')
  return {}
}
