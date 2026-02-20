/**
 * Quote Engine — Sprint 2A
 *
 * computeQuote: calcula el desglose financiero por noche para una reserva.
 * Valida disponibilidad, aplica tarifas BAR, extras de adultos,
 * fees de niños por rango de edad, e impuestos (inclusive/exclusive).
 *
 * Diseño:
 * - Función async (requiere DB para settings, reglas y tarifas)
 * - Crea su propio createClient() — sigue el patrón de getAvailability()
 * - Retorna QuoteResult con desglose por noche y totales
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAvailability } from '@/lib/availability'
import { resolveNightRate } from '@/lib/ari'
import type {
  PropertyCommercialSettings,
  ChildPricingRule,
  TaxRule,
  RatePlanInterval,
  NightQuote,
  QuoteResult,
} from '@/types/hotelero'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateNights(checkIn: string, checkOut: string): string[] {
  const nights: string[] = []
  let cursor = new Date(checkIn + 'T00:00:00Z')
  const end = new Date(checkOut + 'T00:00:00Z')
  while (cursor.getTime() < end.getTime()) {
    nights.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return nights
}

const DEFAULT_SETTINGS = {
  base_occupancy: 2,
  extra_adult_fee: 0,
  prices_include_taxes: false,
  currency: 'USD',
} as const

// ─── computeQuote ─────────────────────────────────────────────────────────────

export interface ComputeQuoteInput {
  propertyId: string
  roomId: string
  checkIn: string         // YYYY-MM-DD
  checkOut: string        // YYYY-MM-DD
  adults: number          // >= 1
  childrenAges: number[]  // array de edades, puede ser vacío
}

/**
 * Calcula la cotización completa para una reserva.
 *
 * Valida disponibilidad antes de calcular tarifas.
 * Retorna QuoteResult con breakdown por noche y totales.
 * Si hay un error, retorna QuoteResult con campo `error` poblado.
 */
export async function computeQuote(input: ComputeQuoteInput): Promise<QuoteResult> {
  const { propertyId, roomId, checkIn, checkOut, adults, childrenAges } = input

  const emptyResult: Omit<QuoteResult, 'error'> = {
    nights: [],
    subtotal: 0,
    taxes_total: 0,
    grand_total: 0,
    currency: 'USD',
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ...emptyResult, error: 'No autenticado' }

  // 1. Validar que room pertenece a property (RLS + query explícita)
  const { data: room } = await supabase
    .from('rooms')
    .select('id, property_id, room_type_id')
    .eq('id', roomId)
    .eq('property_id', propertyId)
    .maybeSingle()

  if (!room) return { ...emptyResult, error: 'La unidad no pertenece a esta propiedad' }

  const roomTypeId = (room as { room_type_id: string | null }).room_type_id

  // 2. Verificar disponibilidad (half-open [checkIn, checkOut))
  let availability
  try {
    availability = await getAvailability(propertyId, checkIn, checkOut, { safeMode: false })
  } catch (err) {
    return { ...emptyResult, error: `Error al consultar disponibilidad: ${err instanceof Error ? err.message : String(err)}` }
  }

  const isAvailable = availability.byType.some((group) =>
    group.rooms.some((r) => r.id === roomId),
  )
  if (!isAvailable) {
    return { ...emptyResult, error: 'La unidad no está disponible para el rango de fechas seleccionado' }
  }

  // 3. Fetch config comercial (o usar defaults si no configurado)
  const { data: rawSettings } = await supabase
    .from('property_commercial_settings')
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle()

  const settings = rawSettings as PropertyCommercialSettings | null
  const baseOccupancy = settings?.base_occupancy ?? DEFAULT_SETTINGS.base_occupancy
  const extraAdultFee = Number(settings?.extra_adult_fee ?? DEFAULT_SETTINGS.extra_adult_fee)
  const pricesIncludeTaxes = settings?.prices_include_taxes ?? DEFAULT_SETTINGS.prices_include_taxes
  const currency = settings?.currency ?? DEFAULT_SETTINGS.currency

  // 4. Fetch plan BAR (get or create)
  const { data: existingPlan } = await supabase
    .from('rate_plans')
    .select('id')
    .eq('property_id', propertyId)
    .eq('code', 'BAR')
    .maybeSingle()

  let ratePlanId: string | null = existingPlan?.id ?? null

  if (!ratePlanId) {
    const { data: newPlan } = await supabase
      .from('rate_plans')
      .insert({ property_id: propertyId, code: 'BAR', name: 'Best Available Rate', is_active: true })
      .select('id')
      .single()
    ratePlanId = newPlan?.id ?? null
  }

  // 5. Fetch rate_plan_intervals para el rango (O(1) por noche en JS)
  let allIntervals: RatePlanInterval[] = []
  if (ratePlanId && roomTypeId) {
    const { data: intervals } = await supabase
      .from('rate_plan_intervals')
      .select('id, property_id, room_type_id, rate_plan_id, start_date, end_date, dow_mask, base_rate, min_los, closed, priority')
      .eq('rate_plan_id', ratePlanId)
      .eq('room_type_id', roomTypeId)
      .lte('start_date', checkOut)
      .gt('end_date', checkIn)
      .eq('closed', false)
    allIntervals = (intervals ?? []) as RatePlanInterval[]
  }

  // 6. Fetch child_pricing_rules
  const { data: childRulesData } = await supabase
    .from('child_pricing_rules')
    .select('*')
    .eq('property_id', propertyId)
  const childRules = (childRulesData ?? []) as ChildPricingRule[]

  // 7. Fetch tax_rules activas (solo percent, solo total — MVP)
  const { data: taxRulesData } = await supabase
    .from('tax_rules')
    .select('*')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .eq('type', 'percent')
  const taxRules = (taxRulesData ?? []) as TaxRule[]

  // 8. Calcular desglose por noche
  const nights = generateNights(checkIn, checkOut)
  const taxRate = taxRules.reduce((sum, r) => sum + Number(r.value) / 100, 0)

  const nightQuotes: NightQuote[] = nights.map((night) => {
    const { base_rate } = resolveNightRate(roomTypeId, night, allIntervals)

    // Extra adultos: por cada adulto que supere la ocupación base
    const extraAdults = Math.max(0, adults - baseOccupancy)
    const extras_adults = extraAdults * extraAdultFee

    // Child fees: suma del fee_value de las reglas que aplican a cada niño
    let extras_children = 0
    for (const childAge of childrenAges) {
      for (const rule of childRules) {
        if (childAge >= rule.min_age && childAge <= rule.max_age) {
          extras_children += Number(rule.fee_value)
          break // una sola regla por niño (primera que coincide)
        }
      }
    }

    const raw_subtotal = (base_rate ?? 0) + extras_adults + extras_children
    let taxes: number
    let total_rate: number

    if (pricesIncludeTaxes) {
      // Inclusive: los precios ya incluyen el impuesto
      // taxes = gross * rate / (1 + rate)
      taxes = taxRate > 0 ? raw_subtotal * taxRate / (1 + taxRate) : 0
      total_rate = raw_subtotal
    } else {
      // Exclusive: impuestos se agregan al total
      taxes = raw_subtotal * taxRate
      total_rate = raw_subtotal + taxes
    }

    return {
      night,
      base_rate,
      extras_adults,
      extras_children,
      subtotal: raw_subtotal,
      taxes,
      total_rate,
    }
  })

  // 9. Totales
  const subtotal = nightQuotes.reduce((sum, n) => sum + n.subtotal, 0)
  const taxes_total = nightQuotes.reduce((sum, n) => sum + n.taxes, 0)
  const grand_total = pricesIncludeTaxes ? subtotal : subtotal + taxes_total

  return {
    nights: nightQuotes,
    subtotal,
    taxes_total,
    grand_total,
    currency,
  }
}

// ─── computeQuotePublic ───────────────────────────────────────────────────────

/**
 * Variante pública de computeQuote para flujos sin sesión de usuario.
 *
 * Diferencias con computeQuote():
 * - Usa createServiceClient() (bypasses RLS) en lugar de createClient()
 * - No valida auth.getUser() — el caller ya validó propiedad via public_key
 * - El algoritmo de cálculo es idéntico.
 */
export async function computeQuotePublic(input: ComputeQuoteInput): Promise<QuoteResult> {
  const { propertyId, roomId, checkIn, checkOut, adults, childrenAges } = input

  const emptyResult: Omit<QuoteResult, 'error'> = {
    nights: [],
    subtotal: 0,
    taxes_total: 0,
    grand_total: 0,
    currency: 'USD',
  }

  // Service client — no auth.getUser() check
  const supabase = createServiceClient()

  // 1. Validar que room pertenece a property
  const { data: room } = await supabase
    .from('rooms')
    .select('id, property_id, room_type_id')
    .eq('id', roomId)
    .eq('property_id', propertyId)
    .maybeSingle()

  if (!room) return { ...emptyResult, error: 'La unidad no pertenece a esta propiedad' }

  const roomTypeId = (room as { room_type_id: string | null }).room_type_id

  // 2. Verificar disponibilidad (getAvailability usa service client internamente)
  let availability
  try {
    availability = await getAvailability(propertyId, checkIn, checkOut, { safeMode: false })
  } catch (err) {
    return { ...emptyResult, error: `Error al consultar disponibilidad: ${err instanceof Error ? err.message : String(err)}` }
  }

  const isAvailable = availability.byType.some((group) =>
    group.rooms.some((r) => r.id === roomId),
  )
  if (!isAvailable) {
    return { ...emptyResult, error: 'La unidad no está disponible para el rango de fechas seleccionado' }
  }

  // 3. Fetch config comercial (o usar defaults si no configurado)
  const { data: rawSettings } = await supabase
    .from('property_commercial_settings')
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle()

  const settings = rawSettings as PropertyCommercialSettings | null
  const baseOccupancy = settings?.base_occupancy ?? DEFAULT_SETTINGS.base_occupancy
  const extraAdultFee = Number(settings?.extra_adult_fee ?? DEFAULT_SETTINGS.extra_adult_fee)
  const pricesIncludeTaxes = settings?.prices_include_taxes ?? DEFAULT_SETTINGS.prices_include_taxes
  const currency = settings?.currency ?? DEFAULT_SETTINGS.currency

  // 4. Fetch plan BAR
  const { data: existingPlan } = await supabase
    .from('rate_plans')
    .select('id')
    .eq('property_id', propertyId)
    .eq('code', 'BAR')
    .maybeSingle()

  let ratePlanId: string | null = existingPlan?.id ?? null

  if (!ratePlanId) {
    const { data: newPlan } = await supabase
      .from('rate_plans')
      .insert({ property_id: propertyId, code: 'BAR', name: 'Best Available Rate', is_active: true })
      .select('id')
      .single()
    ratePlanId = newPlan?.id ?? null
  }

  // 5. Fetch rate_plan_intervals para el rango
  let allIntervals: RatePlanInterval[] = []
  if (ratePlanId && roomTypeId) {
    const { data: intervals } = await supabase
      .from('rate_plan_intervals')
      .select('id, property_id, room_type_id, rate_plan_id, start_date, end_date, dow_mask, base_rate, min_los, closed, priority')
      .eq('rate_plan_id', ratePlanId)
      .eq('room_type_id', roomTypeId)
      .lte('start_date', checkOut)
      .gt('end_date', checkIn)
      .eq('closed', false)
    allIntervals = (intervals ?? []) as RatePlanInterval[]
  }

  // 6. Fetch child_pricing_rules
  const { data: childRulesData } = await supabase
    .from('child_pricing_rules')
    .select('*')
    .eq('property_id', propertyId)
  const childRules = (childRulesData ?? []) as ChildPricingRule[]

  // 7. Fetch tax_rules activas
  const { data: taxRulesData } = await supabase
    .from('tax_rules')
    .select('*')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .eq('type', 'percent')
  const taxRules = (taxRulesData ?? []) as TaxRule[]

  // 8. Calcular desglose por noche
  const nights = generateNights(checkIn, checkOut)
  const taxRate = taxRules.reduce((sum, r) => sum + Number(r.value) / 100, 0)

  const nightQuotes: NightQuote[] = nights.map((night) => {
    const { base_rate } = resolveNightRate(roomTypeId, night, allIntervals)

    const extraAdults = Math.max(0, adults - baseOccupancy)
    const extras_adults = extraAdults * extraAdultFee

    let extras_children = 0
    for (const childAge of childrenAges) {
      for (const rule of childRules) {
        if (childAge >= rule.min_age && childAge <= rule.max_age) {
          extras_children += Number(rule.fee_value)
          break
        }
      }
    }

    const raw_subtotal = (base_rate ?? 0) + extras_adults + extras_children
    let taxes: number
    let total_rate: number

    if (pricesIncludeTaxes) {
      taxes = taxRate > 0 ? raw_subtotal * taxRate / (1 + taxRate) : 0
      total_rate = raw_subtotal
    } else {
      taxes = raw_subtotal * taxRate
      total_rate = raw_subtotal + taxes
    }

    return {
      night,
      base_rate,
      extras_adults,
      extras_children,
      subtotal: raw_subtotal,
      taxes,
      total_rate,
    }
  })

  // 9. Totales
  const subtotal = nightQuotes.reduce((sum, n) => sum + n.subtotal, 0)
  const taxes_total = nightQuotes.reduce((sum, n) => sum + n.taxes, 0)
  const grand_total = pricesIncludeTaxes ? subtotal : subtotal + taxes_total

  return {
    nights: nightQuotes,
    subtotal,
    taxes_total,
    grand_total,
    currency,
  }
}
