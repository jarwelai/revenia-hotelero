/**
 * Driver Recurrente — proveedor de pagos guatemalteco.
 *
 * Variables de entorno requeridas:
 *   RECURRENTE_API_KEY          → API key privada
 *   RECURRENTE_WEBHOOK_SECRET   → Secreto para validar firmas HMAC-SHA256
 *   RECURRENTE_API_URL          → (opcional) URL base, default: https://app.recurrente.com/api
 *
 * Docs: https://developers.recurrente.com
 */

import crypto from 'crypto'

const BASE_URL = process.env.RECURRENTE_API_URL ?? 'https://app.recurrente.com/api'
const API_KEY  = process.env.RECURRENTE_API_KEY ?? ''

export interface RecurrenteCheckoutInput {
  amount: number        // En unidades menores (centavos GTQ)
  currency: string      // 'GTQ' | 'USD'
  description: string
  successUrl: string
  cancelUrl: string
  /** Referencia interna para idempotencia / lookup */
  referenceId: string
}

export interface RecurrenteCheckoutResult {
  checkoutId: string
  checkoutUrl: string
}

/** Crea un checkout en Recurrente y devuelve la URL de pago. */
export async function createRecurrenteCheckout(
  input: RecurrenteCheckoutInput,
): Promise<RecurrenteCheckoutResult> {
  if (!API_KEY) throw new Error('RECURRENTE_API_KEY no configurada')

  const body = {
    items: [
      {
        name: input.description,
        amount: input.amount,            // centavos
        currency: input.currency,
        quantity: 1,
      },
    ],
    success_url: input.successUrl,
    cancel_url:  input.cancelUrl,
    metadata: { reference_id: input.referenceId },
  }

  const res = await fetch(`${BASE_URL}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PUBLIC-KEY': API_KEY,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Recurrente API error ${res.status}: ${text}`)
  }

  const data = await res.json() as { id: string; url: string }
  return { checkoutId: data.id, checkoutUrl: data.url }
}

/**
 * Valida la firma HMAC-SHA256 del webhook de Recurrente.
 * Recurrente envía: X-Recurrente-Signature: sha256=<hex>
 */
export function verifyRecurrenteSignature(
  rawBody: string,
  signatureHeader: string,
): boolean {
  const secret = process.env.RECURRENTE_WEBHOOK_SECRET ?? ''
  if (!secret) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')

  const received = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(received, 'hex'),
    )
  } catch {
    return false
  }
}

/** Parsea el payload del webhook de Recurrente. */
export interface RecurrenteWebhookPayload {
  id: string          // checkout ID
  status: string      // 'paid' | 'expired' | 'cancelled'
  metadata?: { reference_id?: string }
}

export function parseRecurrenteWebhook(body: unknown): RecurrenteWebhookPayload | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (typeof b.id !== 'string' || typeof b.status !== 'string') return null
  return {
    id: b.id,
    status: b.status,
    metadata: typeof b.metadata === 'object' && b.metadata !== null
      ? b.metadata as { reference_id?: string }
      : undefined,
  }
}
