'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  PropertyCommercialSettings,
  ChildPricingRule,
  TaxRule,
  ChargeMode,
} from '@/types/hotelero'

// ─── getPropertySettings ──────────────────────────────────────────────────────

export interface PropertySettingsResult {
  commercialSettings: PropertyCommercialSettings | null
  childRules: ChildPricingRule[]
  taxRules: TaxRule[]
  error?: string
}

export async function getPropertySettings(propertyId: string): Promise<PropertySettingsResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { commercialSettings: null, childRules: [], taxRules: [], error: 'No autenticado' }

  const [settingsRes, childRes, taxRes] = await Promise.all([
    supabase
      .from('property_commercial_settings')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle(),
    supabase
      .from('child_pricing_rules')
      .select('*')
      .eq('property_id', propertyId)
      .order('min_age'),
    supabase
      .from('tax_rules')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at'),
  ])

  return {
    commercialSettings: (settingsRes.data as PropertyCommercialSettings | null),
    childRules: (childRes.data ?? []) as ChildPricingRule[],
    taxRules: (taxRes.data ?? []) as TaxRule[],
  }
}

// ─── saveCommercialSettings ───────────────────────────────────────────────────

export interface SaveCommercialSettingsInput {
  property_id: string
  currency: string
  prices_include_taxes: boolean
  charge_mode: ChargeMode
  base_occupancy: number
  extra_adult_fee: number
  child_policy_enabled: boolean
}

export async function saveCommercialSettings(
  input: SaveCommercialSettingsInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Validaciones básicas
  if (input.base_occupancy < 1) return { error: 'La ocupación base debe ser al menos 1' }
  if (input.extra_adult_fee < 0) return { error: 'La tarifa de adulto extra no puede ser negativa' }

  const { error } = await supabase
    .from('property_commercial_settings')
    .upsert(
      {
        property_id: input.property_id,
        currency: input.currency,
        prices_include_taxes: input.prices_include_taxes,
        charge_mode: input.charge_mode,
        base_occupancy: input.base_occupancy,
        extra_adult_fee: input.extra_adult_fee,
        child_policy_enabled: input.child_policy_enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'property_id' },
    )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return {}
}

// ─── createChildRule ──────────────────────────────────────────────────────────

export interface CreateChildRuleInput {
  property_id: string
  min_age: number
  max_age: number
  fee_value: number
  applies_per_night: boolean
}

export async function createChildRule(
  input: CreateChildRuleInput,
): Promise<{ rule?: ChildPricingRule; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (input.min_age > input.max_age) return { error: 'La edad mínima no puede ser mayor a la máxima' }
  if (input.fee_value < 0) return { error: 'El fee no puede ser negativo' }
  if (input.min_age < 0 || input.max_age < 0) return { error: 'Las edades deben ser >= 0' }

  const { data, error } = await supabase
    .from('child_pricing_rules')
    .insert({
      property_id: input.property_id,
      min_age: input.min_age,
      max_age: input.max_age,
      fee_type: 'fixed',
      fee_value: input.fee_value,
      applies_per_night: input.applies_per_night,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return { rule: data as ChildPricingRule }
}

// ─── deleteChildRule ──────────────────────────────────────────────────────────

export async function deleteChildRule(ruleId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('child_pricing_rules')
    .delete()
    .eq('id', ruleId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return {}
}

// ─── createTaxRule ────────────────────────────────────────────────────────────

export interface CreateTaxRuleInput {
  property_id: string
  name: string
  value: number
}

export async function createTaxRule(
  input: CreateTaxRuleInput,
): Promise<{ rule?: TaxRule; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.name?.trim()) return { error: 'El nombre del impuesto es requerido' }
  if (input.value <= 0) return { error: 'El porcentaje debe ser mayor a 0' }
  if (input.value > 100) return { error: 'El porcentaje no puede ser mayor a 100' }

  const { data, error } = await supabase
    .from('tax_rules')
    .insert({
      property_id: input.property_id,
      name: input.name.trim(),
      type: 'percent',
      value: input.value,
      applies_to: 'total',
      is_active: true,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return { rule: data as TaxRule }
}

// ─── toggleTaxRule ────────────────────────────────────────────────────────────

export async function toggleTaxRule(
  ruleId: string,
  is_active: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('tax_rules')
    .update({ is_active })
    .eq('id', ruleId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return {}
}

// ─── deleteTaxRule ────────────────────────────────────────────────────────────

export async function deleteTaxRule(ruleId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('tax_rules')
    .delete()
    .eq('id', ruleId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return {}
}
