/**
 * Webhook: Recurrente
 *
 * Recurrente envía un POST con el estado del pago.
 * Validamos la firma HMAC-SHA256 antes de procesar.
 *
 * Env vars: RECURRENTE_WEBHOOK_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyRecurrenteSignature, parseRecurrenteWebhook } from '@/lib/payment/recurrente'
import { finalizeBookingPayment } from '@/lib/payment/finalize'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Leer body raw (necesario para validar firma)
  const rawBody = await req.text()
  const signature = req.headers.get('x-recurrente-signature') ?? ''

  // 2. Verificar firma
  if (!verifyRecurrenteSignature(rawBody, signature)) {
    console.error('[webhook/recurrente] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 3. Parsear payload
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = parseRecurrenteWebhook(body)
  if (!payload) {
    return NextResponse.json({ error: 'Unrecognized payload shape' }, { status: 400 })
  }

  // Solo procesar evento 'paid'
  if (payload.status !== 'paid') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const admin = createServiceClient()

  // 4. Buscar payment_session por provider_reference (checkoutId de Recurrente)
  const { data: ps } = await admin
    .from('payment_sessions')
    .select('id, booking_id, status')
    .eq('provider', 'recurrente')
    .eq('provider_reference', payload.id)
    .maybeSingle()

  if (!ps) {
    console.error('[webhook/recurrente] payment_session not found for id:', payload.id)
    return NextResponse.json({ error: 'Payment session not found' }, { status: 404 })
  }

  // 5. Idempotencia: si ya está paid, responder 200
  if (ps.status === 'paid') {
    return NextResponse.json({ ok: true, alreadyProcessed: true })
  }

  // 6. Finalizar booking de forma atómica
  const result = await finalizeBookingPayment(ps.booking_id, ps.id)

  if (result.error && !result.alreadyConfirmed) {
    console.error('[webhook/recurrente] finalize error:', result.error)
    // Retornar 200 igual para que Recurrente no reintente indefinidamente
    // El estado del booking quedará como cancelled — admin debe revisar
    return NextResponse.json({ ok: false, error: result.error })
  }

  console.log('[webhook/recurrente] Booking confirmed:', ps.booking_id)
  return NextResponse.json({ ok: true })
}
