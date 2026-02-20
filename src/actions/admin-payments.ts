'use server'

/**
 * Server Actions: Payment provider configuration (Admin)
 *
 * CRUD sobre property_payment_providers.
 * Solo accesible por admins autenticados (owners/managers de la org).
 * La RLS de Supabase garantiza aislamiento multi-tenant.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PropertyPaymentProvider, GatewayProvider } from '@/types/hotelero'

// ─── getPropertyPaymentProviders ─────────────────────────────────────────────

export interface GetPaymentProvidersResult {
  providers: PropertyPaymentProvider[]
  error?: string
}

export async function getPropertyPaymentProviders(
  propertyId: string,
): Promise<GetPaymentProvidersResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { providers: [], error: 'No autenticado' }

  const { data, error } = await supabase
    .from('property_payment_providers')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at')

  if (error) return { providers: [], error: error.message }

  return { providers: (data ?? []) as PropertyPaymentProvider[] }
}

// ─── savePropertyPaymentProvider ─────────────────────────────────────────────

export interface SavePaymentProviderInput {
  property_id: string
  provider: GatewayProvider
  is_enabled: boolean
  is_default: boolean
  config_json?: Record<string, unknown>
}

export async function savePropertyPaymentProvider(
  input: SavePaymentProviderInput,
): Promise<{ provider?: PropertyPaymentProvider; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Si se marca como default, quitar default de los demás
  if (input.is_default) {
    await supabase
      .from('property_payment_providers')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('property_id', input.property_id)
      .neq('provider', input.provider)
  }

  const { data, error } = await supabase
    .from('property_payment_providers')
    .upsert(
      {
        property_id: input.property_id,
        provider:    input.provider,
        is_enabled:  input.is_enabled,
        is_default:  input.is_default,
        config_json: input.config_json ?? {},
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'property_id,provider' },
    )
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return { provider: data as PropertyPaymentProvider }
}

// ─── deletePropertyPaymentProvider ───────────────────────────────────────────

export async function deletePropertyPaymentProvider(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('property_payment_providers')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return {}
}
