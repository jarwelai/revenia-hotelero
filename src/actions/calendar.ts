'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAvailability } from '@/lib/availability'
import { resolveNightRate } from '@/lib/ari'
import type { TapeChartData, TapeChartRoom, TapeChartBooking, TapeChartBlock, RatePlanInterval } from '@/types/hotelero'

// ─── getTapeChart ─────────────────────────────────────────────────────────────

/**
 * Retorna todos los datos necesarios para renderizar el Tape Chart.
 * Rooms agrupadas por tipo, bookings activos y blocks para el rango dado.
 * Usa createClient() (RLS) para garantizar aislamiento multi-tenant.
 *
 * @param propertyId UUID de la propiedad
 * @param dateFrom   YYYY-MM-DD — primer día del viewport
 * @param dateTo     YYYY-MM-DD — último día del viewport (exclusive)
 */
export async function getTapeChart(
  propertyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<TapeChartData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Rooms con join room_type (RLS scope al tenant del usuario)
  const { data: rawRooms } = await supabase
    .from('rooms')
    .select('id, name, room_type_id, room_type:room_types(id, name)')
    .eq('property_id', propertyId)
    .order('name')

  const rooms: TapeChartRoom[] = (rawRooms ?? []).map((r) => {
    const rt = r.room_type as { id: string; name: string } | { id: string; name: string }[] | null
    const rtName = (Array.isArray(rt) ? rt[0]?.name : rt?.name) ?? 'Sin tipo'
    return {
      id: r.id as string,
      name: r.name as string,
      room_type_id: r.room_type_id as string | null,
      room_type_name: rtName,
    }
  })

  // Bookings confirmados y en hold que se solapan con el rango (RLS scope)
  const { data: rawBookings } = await supabase
    .from('bookings')
    .select('id, room_id, guest_name, check_in, check_out, status')
    .eq('property_id', propertyId)
    .in('status', ['confirmed', 'hold'])
    .lt('check_in', dateTo)
    .gt('check_out', dateFrom)

  const bookings: TapeChartBooking[] = (rawBookings ?? []).filter((b) => b.room_id !== null).map((b) => ({
    id: b.id as string,
    room_id: b.room_id as string,
    guest_name: b.guest_name as string,
    check_in: b.check_in as string,
    check_out: b.check_out as string,
    status: b.status as TapeChartBooking['status'],
  }))

  // Blocks que se solapan con el rango (RLS scope)
  const { data: rawBlocks } = await supabase
    .from('blocks')
    .select('id, room_id, start_date, end_date, reason')
    .eq('property_id', propertyId)
    .lt('start_date', dateTo)
    .gt('end_date', dateFrom)

  const blocks: TapeChartBlock[] = (rawBlocks ?? []).map((b) => ({
    id: b.id as string,
    room_id: b.room_id as string,
    start_date: b.start_date as string,
    end_date: b.end_date as string,
    reason: b.reason as string | null,
  }))

  return { rooms, bookings, blocks, dateFrom, dateTo }
}

// ─── createBlock ──────────────────────────────────────────────────────────────

export interface CreateBlockInput {
  property_id: string
  room_id: string
  start_date: string  // YYYY-MM-DD
  end_date: string    // YYYY-MM-DD (exclusive)
  reason?: string | null
}

export interface CreateBlockResult {
  error?: string
}

/**
 * Crea un bloqueo manual de una habitación para un rango de fechas.
 */
export async function createBlock(input: CreateBlockInput): Promise<CreateBlockResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { property_id, room_id, start_date, end_date, reason } = input

  if (!start_date || !end_date) return { error: 'Las fechas son requeridas' }
  if (end_date <= start_date) return { error: 'La fecha de fin debe ser posterior a la de inicio' }

  // Validar que room pertenece a property (RLS + check explícito)
  const { data: room } = await supabase
    .from('rooms')
    .select('id')
    .eq('id', room_id)
    .eq('property_id', property_id)
    .maybeSingle()

  if (!room) return { error: 'La unidad no pertenece a esta propiedad o no tienes acceso' }

  const { error: insertError } = await supabase
    .from('blocks')
    .insert({ property_id, room_id, start_date, end_date, reason: reason ?? null })

  if (insertError) return { error: insertError.message }

  revalidatePath('/dashboard/calendar')
  return {}
}

// ─── deleteBlock ──────────────────────────────────────────────────────────────

export interface DeleteBlockResult {
  error?: string
}

/**
 * Elimina un bloqueo. RLS garantiza que solo el dueño puede borrarlo.
 */
export async function deleteBlock(blockId: string): Promise<DeleteBlockResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!blockId) return { error: 'ID de bloqueo no especificado' }

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('id', blockId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/calendar')
  return {}
}

// ─── moveBooking ──────────────────────────────────────────────────────────────

export interface MoveBookingInput {
  booking_id: string
  new_room_id: string
  new_check_in: string
  new_check_out: string
}

export interface MoveBookingResult {
  error?: string
}

/**
 * Mueve una reserva a otra habitación y/o rango de fechas.
 * Valida disponibilidad excluyendo la reserva actual del cálculo.
 * Re-genera booking_nights con nuevo snapshot de tarifas.
 *
 * Nota: Sin exposición en UI en este sprint (server action para uso futuro).
 */
export async function moveBooking(input: MoveBookingInput): Promise<MoveBookingResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { booking_id, new_room_id, new_check_in, new_check_out } = input

  if (!new_check_in || !new_check_out) return { error: 'Las fechas son requeridas' }
  if (new_check_out <= new_check_in) return { error: 'La fecha de salida debe ser posterior a la de entrada' }

  // Obtener booking actual (RLS valida tenant)
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, property_id, room_id, status')
    .eq('id', booking_id)
    .maybeSingle()

  if (!booking) return { error: 'Reserva no encontrada o sin acceso' }
  if (booking.status === 'cancelled') return { error: 'No se puede mover una reserva cancelada' }

  const property_id = booking.property_id as string

  // Verificar disponibilidad (sin safeMode, excluyendo el booking actual)
  // Para excluir el booking actual, temporalmente lo cancelamos del cálculo:
  // getAvailability busca bookings con status != 'cancelled'.
  // Hacemos UPDATE a 'hold' → consulta → revertimos si falla
  const originalStatus = booking.status as string

  // Cancelar temporalmente para liberar las noches en el cálculo de disponibilidad
  await supabase.from('booking_nights').update({ is_active: false }).eq('booking_id', booking_id)

  let availability
  try {
    availability = await getAvailability(property_id, new_check_in, new_check_out, { safeMode: false })
  } catch (err) {
    // Revertir
    await supabase.from('booking_nights').update({ is_active: true }).eq('booking_id', booking_id)
    return { error: `Error al consultar disponibilidad: ${err instanceof Error ? err.message : String(err)}` }
  }

  const isAvailable = availability.byType.some((group) =>
    group.rooms.some((r) => r.id === new_room_id),
  )

  if (!isAvailable) {
    // Revertir
    await supabase.from('booking_nights').update({ is_active: true }).eq('booking_id', booking_id)
    return { error: 'La unidad no está disponible para el nuevo rango de fechas' }
  }

  // Obtener room_type_id del nuevo room
  const { data: newRoom } = await supabase
    .from('rooms')
    .select('id, room_type_id')
    .eq('id', new_room_id)
    .eq('property_id', property_id)
    .maybeSingle()

  if (!newRoom) {
    await supabase.from('booking_nights').update({ is_active: true }).eq('booking_id', booking_id)
    return { error: 'La unidad destino no pertenece a esta propiedad' }
  }

  // Pre-fetch tarifas para snapshot
  let allIntervals: RatePlanInterval[] = []
  const newRoomTypeId = (newRoom as { room_type_id: string | null }).room_type_id
  if (newRoomTypeId) {
    const { data: barPlan } = await supabase
      .from('rate_plans')
      .select('id')
      .eq('property_id', property_id)
      .eq('code', 'BAR')
      .maybeSingle()

    if (barPlan) {
      const { data: intervals } = await supabase
        .from('rate_plan_intervals')
        .select('id, property_id, room_type_id, rate_plan_id, start_date, end_date, dow_mask, base_rate, min_los, closed, priority')
        .eq('rate_plan_id', barPlan.id)
        .eq('room_type_id', newRoomTypeId)
        .lte('start_date', new_check_out)
        .gt('end_date', new_check_in)
        .eq('closed', false)
      allIntervals = (intervals ?? []) as RatePlanInterval[]
    }
  }

  // Eliminar noches antiguas (ya marcadas is_active=false) y luego borrarlas físicamente
  await supabase.from('booking_nights').delete().eq('booking_id', booking_id)

  // UPDATE booking
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      room_id: new_room_id,
      check_in: new_check_in,
      check_out: new_check_out,
      status: originalStatus,
    })
    .eq('id', booking_id)

  if (updateError) return { error: updateError.message }

  // Insertar nuevas noches
  const nights: string[] = []
  let cursor = new Date(new_check_in + 'T00:00:00Z')
  const end = new Date(new_check_out + 'T00:00:00Z')
  while (cursor.getTime() < end.getTime()) {
    nights.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(cursor.getTime() + 86_400_000)
  }

  if (nights.length > 0) {
    const { error: nightsError } = await supabase
      .from('booking_nights')
      .insert(
        nights.map((night) => {
          const rates = resolveNightRate(newRoomTypeId, night, allIntervals)
          return {
            booking_id,
            room_id: new_room_id,
            night,
            is_active: true,
            base_rate: rates.base_rate,
            total_rate: rates.total_rate,
          }
        }),
      )

    if (nightsError) return { error: nightsError.message }
  }

  revalidatePath('/dashboard/calendar')
  revalidatePath('/dashboard/bookings')
  return {}
}
