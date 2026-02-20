/**
 * Driver Stripe — pagos internacionales.
 *
 * Variables de entorno requeridas:
 *   STRIPE_SECRET_KEY       → sk_test_... o sk_live_...
 *   STRIPE_WEBHOOK_SECRET   → whsec_...
 *
 * Docs: https://stripe.com/docs/api/checkout/sessions
 */

import Stripe from 'stripe'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY no configurada')
  return new Stripe(key, { apiVersion: '2026-01-28.clover' })
}

export interface StripeCheckoutInput {
  amount: number        // En unidades menores (cents USD)
  currency: string      // 'usd' | 'gtq' etc. (lowercase ISO)
  description: string
  successUrl: string
  cancelUrl: string
  /** Referencia interna — guardada en metadata para lookup en webhook */
  paymentSessionId: string
}

export interface StripeCheckoutResult {
  sessionId: string
  checkoutUrl: string
}

/** Crea una Stripe Checkout Session y devuelve la URL de pago. */
export async function createStripeCheckout(
  input: StripeCheckoutInput,
): Promise<StripeCheckoutResult> {
  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: input.amount,
          product_data: { name: input.description },
        },
      },
    ],
    success_url: input.successUrl,
    cancel_url:  input.cancelUrl,
    metadata: { payment_session_id: input.paymentSessionId },
  })

  if (!session.url) throw new Error('Stripe no devolvió checkout URL')

  return { sessionId: session.id, checkoutUrl: session.url }
}

/**
 * Valida la firma del webhook de Stripe.
 * Lanza error si la firma no es válida.
 */
export function constructStripeEvent(
  rawBody: Buffer,
  signature: string,
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET no configurada')
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}

export type { Stripe }
