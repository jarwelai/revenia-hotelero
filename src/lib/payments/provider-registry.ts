/**
 * Payment Provider Registry — Pure functions (client + server safe)
 *
 * 1. resolvePaymentProvider(countryCode)
 *    Función pura — sin DB, usable en cliente y servidor.
 *
 * 2. resolveFromEnabledProviders(providers, countryCode)
 *    Función pura para uso en componentes cliente.
 *
 * Reglas de país:
 *   GT  → Recurrente (proveedor guatemalteco)
 *   *   → Stripe (internacional)
 *
 * Para la versión server-only con DB, ver provider-registry.server.ts
 */

import type { PaymentProvider } from './types'
import type { GatewayProvider } from '@/types/hotelero'

/** País(es) asignados a Recurrente */
export const RECURRENTE_COUNTRIES = new Set<string>(['GT'])

export interface EnabledProvider {
  provider: GatewayProvider
  is_default: boolean
}

// ─── Resolución pura (sin DB) ─────────────────────────────────────────────────

/**
 * Determina el proveedor según el código de país — función pura, sin DB.
 * Útil como fallback o para display inmediato en cliente.
 */
export function resolvePaymentProvider(countryCode: string): PaymentProvider {
  const normalized = countryCode.trim().toUpperCase()
  return RECURRENTE_COUNTRIES.has(normalized) ? 'recurrente' : 'stripe'
}

// ─── Helper puro para resolución client-side desde lista pre-cargada ─────────

/**
 * Versión pura para uso en componentes cliente.
 * Recibe la lista de proveedores ya cargados (no consulta DB).
 *
 * @returns PaymentProvider, o null si la lista está vacía
 */
export function resolveFromEnabledProviders(
  providers: EnabledProvider[],
  countryCode: string,
): PaymentProvider | null {
  const enabled = providers.filter(
    (p): p is EnabledProvider => p.provider === 'stripe' || p.provider === 'recurrente',
  )
  if (enabled.length === 0) return null

  const normalized = countryCode.trim().toUpperCase()

  if (RECURRENTE_COUNTRIES.has(normalized)) {
    const rec = enabled.find((p) => p.provider === 'recurrente')
    if (rec) return 'recurrente'
  } else {
    const str = enabled.find((p) => p.provider === 'stripe')
    if (str) return 'stripe'
  }

  const defaultProvider = enabled.find((p) => p.is_default)
  if (defaultProvider) return defaultProvider.provider

  return enabled[0].provider
}
