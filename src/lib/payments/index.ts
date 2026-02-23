/**
 * Payment Service Layer — Punto de entrada público
 *
 * Expone createPaymentSession() como interfaz unificada.
 * Determina el proveedor vía resolvePaymentProvider y delega al driver correcto.
 *
 * Nota: El flujo principal de checkout (src/actions/payment.ts) importa los
 * drivers directamente. Esta capa existe como interfaz genérica para otros
 * consumidores que necesiten crear sesiones de pago sin orquestar booking.
 */

import type { PaymentSessionInput, PaymentSessionResponse } from './types'
import { resolvePaymentProvider } from './provider-registry'
import { createStripeCheckout } from '@/lib/payment/stripe-driver'
import { createRecurrenteCheckout } from '@/lib/payment/recurrente'

// ─── Drivers reales ─────────────────────────────────────────────────────────

async function createStripeSession(
  input: PaymentSessionInput,
): Promise<PaymentSessionResponse> {
  const result = await createStripeCheckout({
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    paymentSessionId: input.referenceId,
  })
  return {
    provider: 'stripe',
    sessionId: result.sessionId,
    checkoutUrl: result.checkoutUrl,
    isMock: false,
  }
}

async function createRecurrenteSession(
  input: PaymentSessionInput,
): Promise<PaymentSessionResponse> {
  const result = await createRecurrenteCheckout({
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    description: input.description,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    referenceId: input.referenceId,
  })
  return {
    provider: 'recurrente',
    sessionId: result.checkoutId,
    checkoutUrl: result.checkoutUrl,
    isMock: false,
  }
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Crea una sesión de pago con el proveedor adecuado según el país del huésped.
 *
 * @param input - Datos de la sesión (monto, divisa, país, URLs)
 * @returns PaymentSessionResponse con provider, sessionId y checkoutUrl
 */
export async function createPaymentSession(
  input: PaymentSessionInput,
): Promise<PaymentSessionResponse> {
  const provider = resolvePaymentProvider(input.countryCode)

  switch (provider) {
    case 'stripe':
      return createStripeSession(input)
    case 'recurrente':
      return createRecurrenteSession(input)
  }
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export {
  resolvePaymentProvider,
  resolveFromEnabledProviders,
} from './provider-registry'
export {
  resolvePaymentProviderForProperty,
} from './provider-registry.server'
export type {
  PaymentProvider,
  PaymentIntentResult,
  PaymentSessionInput,
  PaymentSessionResponse,
} from './types'
