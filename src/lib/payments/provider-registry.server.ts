/**
 * Payment Provider Registry — Server-only (requires DB access)
 *
 * resolvePaymentProviderForProperty(propertyId, countryCode)
 *   Consulta property_payment_providers en DB.
 *   Aplica reglas por país sobre los proveedores habilitados.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { RECURRENTE_COUNTRIES, type EnabledProvider } from './provider-registry'
import type { PaymentProvider } from './types'

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
