/**
 * Payment Service Layer — Punto de entrada público
 *
 * Expone createPaymentSession() como interfaz unificada.
 * Determina el proveedor vía resolvePaymentProvider y delega al handler correcto.
 *
 * Estado actual: MOCK — no llama APIs reales.
 * Cuando se active cada proveedor, reemplazar el mock con el driver correspondiente
 * de src/lib/payment/ (stripe-driver.ts, recurrente.ts).
 */

import type { PaymentSessionInput, PaymentSessionResponse } from './types'
import { resolvePaymentProvider } from './provider-registry'

// ─── Mocks internos ──────────────────────────────────────────────────────────

async function createStripeSession(
  input: PaymentSessionInput,
): Promise<PaymentSessionResponse> {
  // TODO: Reemplazar con createStripeCheckout() de src/lib/payment/stripe-driver.ts
  // cuando se active Stripe en producción.
  return {
    provider: 'stripe',
    sessionId: `mock_stripe_${Date.now()}_${input.referenceId.slice(0, 8)}`,
    checkoutUrl: input.successUrl,
    isMock: true,
  }
}

async function createRecurrenteSession(
  input: PaymentSessionInput,
): Promise<PaymentSessionResponse> {
  // TODO: Reemplazar con createRecurrenteCheckout() de src/lib/payment/recurrente.ts
  // cuando se active Recurrente en producción.
  return {
    provider: 'recurrente',
    sessionId: `mock_recurrente_${Date.now()}_${input.referenceId.slice(0, 8)}`,
    checkoutUrl: input.successUrl,
    isMock: true,
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
