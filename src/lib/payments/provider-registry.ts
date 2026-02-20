/**
 * Payment Provider Registry
 *
 * Dos modos de resolución:
 *
 * 1. resolvePaymentProvider(countryCode)
 *    Función pura — sin DB, usable en cliente y servidor.
 *    Aplica reglas hardcoded (útil como fallback o cuando no hay config en DB).
 *
 * 2. resolvePaymentProviderForProperty(propertyId, countryCode)
 *    Función de servidor — consulta property_payment_providers en DB.
 *    Aplica reglas por país sobre los proveedores habilitados para la property.
 *    Retorna null si no hay proveedores configurados (el caller decide qué hacer).
 *
 * Reglas de país (ambas variantes):
 *   GT  → Recurrente (proveedor guatemalteco)
 *   *   → Stripe (internacional)
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { PaymentProvider } from './types'
import type { GatewayProvider } from '@/types/hotelero'

/** País(es) asignados a Recurrente */
const RECURRENTE_COUNTRIES = new Set<string>(['GT'])

// ─── Resolución pura (sin DB) ─────────────────────────────────────────────────

/**
 * Determina el proveedor según el código de país — función pura, sin DB.
 * Útil como fallback o para display inmediato en cliente.
 */
export function resolvePaymentProvider(countryCode: string): PaymentProvider {
  const normalized = countryCode.trim().toUpperCase()
  return RECURRENTE_COUNTRIES.has(normalized) ? 'recurrente' : 'stripe'
}

// ─── Resolución con config de propiedad (server-only) ────────────────────────

interface EnabledProvider {
  provider: GatewayProvider
  is_default: boolean
}

/**
 * Determina el proveedor de pago según la configuración específica de la propiedad.
 *
 * Flujo:
 * 1. Consulta los proveedores habilitados en property_payment_providers
 * 2. Si ninguno habilitado → retorna null
 * 3. Aplica regla de país (GT → recurrente, resto → stripe)
 * 4. Si la regla de país no tiene match → usa el provider marcado como default
 * 5. Si no hay default → usa el primero habilitado
 *
 * @returns PaymentProvider a usar, o null si no hay proveedores configurados
 */
export async function resolvePaymentProviderForProperty(
  propertyId: string,
  countryCode: string,
): Promise<PaymentProvider | null> {
  const admin = createServiceClient()

  const { data, error } = await admin
    .from('property_payment_providers')
    .select('provider, is_default')
    .eq('property_id', propertyId)
    .eq('is_enabled', true)
    .order('is_default', { ascending: false })

  if (error || !data || data.length === 0) return null

  const enabled = data as EnabledProvider[]
  const normalized = countryCode.trim().toUpperCase()

  // Regla de país: GT → recurrente, resto → stripe
  if (RECURRENTE_COUNTRIES.has(normalized)) {
    const rec = enabled.find((p) => p.provider === 'recurrente')
    if (rec) return 'recurrente'
  } else {
    const str = enabled.find((p) => p.provider === 'stripe')
    if (str) return 'stripe'
  }

  // Fallback: proveedor marcado como default
  const defaultProvider = enabled.find((p) => p.is_default)
  if (defaultProvider) return defaultProvider.provider

  // Último recurso: primer habilitado
  return enabled[0].provider
}

// ─── Helper puro para resolución client-side desde lista pre-cargada ─────────

/**
 * Versión pura para uso en componentes cliente.
 * Recibe la lista de proveedores ya cargados (no consulta DB).
 * Aplica las mismas reglas que resolvePaymentProviderForProperty.
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
