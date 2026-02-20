'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { computeQuote } from '@/lib/quote'
import type { Booking } from '@/types/hotelero'

// ─── createInternalBooking ────────────────────────────────────────────────────

export interface CreateInternalBookingInput {
  property_id: string
  room_id: string
  check_in: string    // YYYY-MM-DD
  check_out: string   // YYYY-MM-DD
  guest_name: string
  guest_email?: string | null
  guest_phone?: string | null
  adults?: number          // default 1 — backwards compatible
  children_ages?: number[] // default [] — backwards compatible
}

export interface BookingResult {
  booking?: Booking
  error?: string
}

/**
 * Crea una reserva interna en Revenia.
 *
 * Sprint 2A: integra computeQuote() para validar disponibilidad y
 * calcular el snapshot financiero completo por noche (adults, extras, taxes).
 *
 * Flujo:
 * 1. Validar fechas y nombre del huésped
 * 2. Validar que room pertenece a property (guard de seguridad explícito)
 * 3. computeQuote() → disponibilidad + desglose financiero por noche
 * 4. INSERT booking (status=hold) con totales del quote
 * 5. INSERT booking_nights con snapshot completo
 * 6. UPDATE booking (status=confirmed)
 */
export async function createInternalBooking(
  input: CreateInternalBookingInput,
): Promise<BookingResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const {
    property_id,
    room_id,
    check_in,
    check_out,
    guest_name,
    guest_email,
    guest_phone,
  } = input

  const adults = input.adults ?? 1
  const children_ages = input.children_ages ?? []

  // ── 1. Validar fechas y nombre ────────────────────────────────────────────
  if (!check_in || !check_out) return { error: 'Las fechas son requeridas' }
  if (check_out <= check_in) {
    return { error: 'La fecha de salida debe ser posterior a la de entrada' }
  }
  if (!guest_name?.trim()) return { error: 'El nombre del huésped es requerido' }
  if (adults < 1) return { error: 'Debe haber al menos 1 adulto' }

  // ── 2. Validar que room pertenece a property (RLS + query explícita) ──────
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, property_id')
    .eq('id', room_id)
    .eq('property_id', property_id)
    .maybeSingle()

  if (roomError) return { error: `Error al validar unidad: ${roomError.message}` }
  if (!room) return { error: 'La unidad no pertenece a esta propiedad o no tienes acceso' }

  // ── 3. computeQuote: disponibilidad + snapshot financiero ─────────────────
  const quoteResult = await computeQuote({
    propertyId: property_id,
    roomId: room_id,
    checkIn: check_in,
    checkOut: check_out,
    adults,
    childrenAges: children_ages,
  })

  if (quoteResult.error) return { error: quoteResult.error }

  // ── 4. INSERT booking con status='hold' ───────────────────────────────────
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      property_id,
      room_id,
      guest_name: guest_name.trim(),
      guest_email: guest_email?.trim() || null,
      guest_phone: guest_phone?.trim() || null,
      check_in,
      check_out,
      status: 'hold',
      source: 'internal',
      currency: quoteResult.currency,
      adults,
      children_count: children_ages.length,
      subtotal: quoteResult.subtotal,
      taxes_total: quoteResult.taxes_total,
      total_amount: quoteResult.grand_total,
    })
    .select()
    .single()

  if (bookingError || !booking) {
    return { error: bookingError?.message ?? 'Error al crear la reserva' }
  }

  // ── 5. INSERT booking_nights con snapshot completo ────────────────────────
  if (quoteResult.nights.length > 0) {
    const { error: nightsError } = await supabase
      .from('booking_nights')
      .insert(
        quoteResult.nights.map((nq) => ({
          booking_id: booking.id,
          room_id,
          night: nq.night,
          is_active: true,
          adults,
          children_count: children_ages.length,
          base_rate: nq.base_rate,
          extras_adults: nq.extras_adults,
          extras_children: nq.extras_children,
          taxes: nq.taxes,
          total_rate: nq.total_rate,
        })),
      )

    if (nightsError) {
      // Rollback: eliminar booking (cascade elimina booking_nights)
      await supabase.from('bookings').delete().eq('id', booking.id)
      return { error: `Error al registrar noches (posible conflicto): ${nightsError.message}` }
    }
  }

  // ── 6. Confirmar booking ──────────────────────────────────────────────────
  const { error: confirmError } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', booking.id)

  if (confirmError) {
    await supabase.from('bookings').delete().eq('id', booking.id)
    return { error: `Error al confirmar reserva: ${confirmError.message}` }
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard/calendar')
  return { booking: { ...booking, status: 'confirmed' } as Booking }
}

// ─── cancelBooking ────────────────────────────────────────────────────────────

export interface CancelBookingResult {
  error?: string
}

/**
 * Cancela una reserva interna.
 *
 * - UPDATE bookings SET status='cancelled'
 * - UPDATE booking_nights SET is_active=false (preserva snapshot histórico)
 *
 * El índice parcial UNIQUE(room_id, night) WHERE is_active=true garantiza que
 * las noches canceladas liberen el inventario para nuevas reservas.
 */
export async function cancelBooking(bookingId: string): Promise<CancelBookingResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!bookingId) return { error: 'ID de reserva no especificado' }

  // UPDATE status (RLS valida que el booking pertenece al usuario)
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .neq('status', 'cancelled') // idempotente

  if (updateError) return { error: updateError.message }

  // Marcar noches como inactivas (preserva snapshot, libera inventario)
  const { error: nightsError } = await supabase
    .from('booking_nights')
    .update({ is_active: false })
    .eq('booking_id', bookingId)

  if (nightsError) return { error: nightsError.message }

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard/calendar')
  return {}
}
