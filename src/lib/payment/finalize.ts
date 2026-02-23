/**
 * Finalización atómica e idempotente de booking pagado.
 *
 * Delega en la RPC PostgreSQL `finalize_booking_payment` que:
 * - Adquiere SELECT FOR UPDATE sobre el booking (evita concurrencia)
 * - Inserta booking_nights desde quote_payload snapshot
 * - Respeta el UNIQUE partial index (room_id, night) WHERE is_active = true
 * - Si hay conflicto de disponibilidad → cancela el booking y retorna error
 * - Si ya está confirmed → retorna early (idempotente)
 * - Marca payment_session como 'paid'
 */

import { createServiceClient } from '@/lib/supabase/server'
import { sendBookingConfirmation } from '@/lib/email'

export interface FinalizeResult {
  success?: boolean
  alreadyConfirmed?: boolean
  error?: string
}

export async function finalizeBookingPayment(
  bookingId: string,
  paymentSessionId: string | null = null,
): Promise<FinalizeResult> {
  const admin = createServiceClient()

  const { data, error } = await admin.rpc('finalize_booking_payment', {
    p_booking_id: bookingId,
    p_payment_session_id: paymentSessionId ?? null,
  })

  if (error) return { error: error.message }

  const result = data as { success?: boolean; already_confirmed?: boolean; error?: string }

  if (result.error)             return { error: result.error }
  if (result.already_confirmed) return { alreadyConfirmed: true }

  // Send confirmation email (non-blocking)
  sendConfirmationEmail(admin, bookingId).catch((err) =>
    console.error('[finalize] Email send failed:', err)
  )

  return { success: true }
}

async function sendConfirmationEmail(
  admin: ReturnType<typeof createServiceClient>,
  bookingId: string,
): Promise<void> {
  const { data: booking } = await admin
    .from('bookings')
    .select('id, guest_name, guest_email, check_in, check_out, adults, total_amount, currency, property_id')
    .eq('id', bookingId)
    .single()

  if (!booking?.guest_email) return

  const { data: property } = await admin
    .from('properties')
    .select('name')
    .eq('id', booking.property_id)
    .single()

  const checkIn = new Date(booking.check_in)
  const checkOut = new Date(booking.check_out)
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

  await sendBookingConfirmation(booking.guest_email, {
    guestName: booking.guest_name,
    propertyName: property?.name ?? 'Hotel',
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    nights,
    adults: booking.adults ?? 1,
    totalAmount: booking.total_amount ?? 0,
    currency: booking.currency ?? 'USD',
    bookingRef: booking.id,
    lang: 'es', // Default to Spanish; could be determined from booking metadata later
  })
}
