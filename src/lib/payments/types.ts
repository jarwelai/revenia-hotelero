/**
 * Payment Abstraction Layer — Tipos unificados
 *
 * Esta capa abstrae múltiples pasarelas de pago bajo una interfaz común.
 * Los drivers específicos (Stripe, Recurrente) viven en src/lib/payment/.
 * Esta capa sirve para routing, config y expansión futura multi-proveedor.
 */

/** Proveedores de pago soportados actualmente */
export type PaymentProvider = 'stripe' | 'recurrente'

/** Resultado unificado de una intención de pago */
export interface PaymentIntentResult {
  provider: PaymentProvider
  /** ID externo de la sesión en el proveedor (stripe session_id, recurrente checkout_id) */
  sessionId: string
  /** URL de checkout para redirigir al huésped */
  checkoutUrl: string
  /** Estado de la sesión creada */
  status: 'created' | 'pending' | 'failed'
}

/** Input para crear una sesión de pago */
export interface PaymentSessionInput {
  /** Monto en unidades menores (cents / centavos) */
  amount: number
  /** Código de divisa ISO 4217 (ej. 'GTQ', 'USD') */
  currency: string
  /** Descripción visible al huésped en el checkout */
  description: string
  /** URL de redirección tras pago exitoso */
  successUrl: string
  /** URL de redirección tras cancelación */
  cancelUrl: string
  /** ID interno de la payment_session (para correlación con webhook) */
  referenceId: string
  /** ISO 3166-1 alpha-2 del país del huésped (ej. 'GT', 'US') */
  countryCode: string
}

/** Respuesta de createPaymentSession */
export interface PaymentSessionResponse {
  provider: PaymentProvider
  /** ID externo en el proveedor */
  sessionId: string
  /** URL para redirigir al huésped */
  checkoutUrl: string
  /** true cuando la sesión es simulada (sin llamada real a la API) */
  isMock: boolean
}
