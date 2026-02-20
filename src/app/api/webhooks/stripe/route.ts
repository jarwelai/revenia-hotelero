/**
 * Webhook: Stripe
 *
 * Escucha el evento `checkout.session.completed`.
 * Stripe firma el payload con STRIPE_WEBHOOK_SECRET.
 *
 * Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { constructStripeEvent } from '@/lib/payment/stripe-driver'
import { finalizeBookingPayment } from '@/lib/payment/finalize'
import type Stripe from 'stripe'

// Necesario para leer body como Buffer (Stripe requiere el raw body)
export const config = { api: { bodyParser: false } }

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = Buffer.from(await req.arrayBuffer())
  const signature = req.headers.get('stripe-signature') ?? ''

  // 1. Verificar firma Stripe
  let event: Stripe.Event
  try {
    event = constructStripeEvent(rawBody, signature)
  } catch (err) {
    console.error('[webhook/stripe] Invalid signature:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 2. Solo procesar checkout.session.completed
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // 3. Si el pago no está efectivamente pagado (puede ser pago deferido), ignorar
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const admin = createServiceClient()

  // 4. Buscar payment_session por provider_reference (Stripe session.id)
  const { data: ps } = await admin
    .from('payment_sessions')
    .select('id, booking_id, status')
    .eq('provider', 'stripe')
    .eq('provider_reference', session.id)
    .maybeSingle()

  if (!ps) {
    console.error('[webhook/stripe] payment_session not found for session:', session.id)
    return NextResponse.json({ error: 'Payment session not found' }, { status: 404 })
  }

  // 5. Idempotencia
  if (ps.status === 'paid') {
    return NextResponse.json({ ok: true, alreadyProcessed: true })
  }

  // 6. Finalización atómica
  const result = await finalizeBookingPayment(ps.booking_id, ps.id)

  if (result.error && !result.alreadyConfirmed) {
    console.error('[webhook/stripe] finalize error:', result.error)
    return NextResponse.json({ ok: false, error: result.error })
  }

  console.log('[webhook/stripe] Booking confirmed:', ps.booking_id)
  return NextResponse.json({ ok: true })
}
