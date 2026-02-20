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

  if (result.error)            return { error: result.error }
  if (result.already_confirmed) return { alreadyConfirmed: true }
  return { success: true }
}
