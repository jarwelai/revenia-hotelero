'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveProperty } from '@/lib/property-context'
import type { Season } from '@/types/hotelero'
import { CreateSeasonSchema, UpdateSeasonSchema, formatZodError } from '@/features/property-setup/schemas/validation'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateSeasonInput {
  name: string
  start_date: string
  end_date: string
  color?: string
  pricing_overrides?: { rates?: Record<string, number> }
  restrictions?: { min_los?: number; closed_room_types?: string[] }
  priority?: number
}

export interface SeasonResult {
  season?: Season
  error?: string
  warnings?: string[]
}

export interface SeasonsResult {
  seasons?: Season[]
  error?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds rate_plan_interval rows for each room_type under the BAR rate plan.
 * Falls back to the lowest-priority existing BAR interval's base_rate when no
 * season-specific override is provided.
 */
async function buildIntervals(
  propertyId: string,
  season: Pick<Season, 'id' | 'start_date' | 'end_date' | 'priority' | 'pricing_overrides' | 'restrictions'>,
) {
  const service = createServiceClient()

  // Fetch BAR rate plan
  const { data: barPlan, error: barError } = await service
    .from('rate_plans')
    .select('id')
    .eq('property_id', propertyId)
    .eq('code', 'BAR')
    .eq('is_active', true)
    .maybeSingle()

  if (barError) throw new Error(`BAR rate plan query failed: ${barError.message}`)
  if (!barPlan) throw new Error('BAR rate plan not found for this property')

  // Fetch all room types
  const { data: roomTypes, error: rtError } = await service
    .from('room_types')
    .select('id')
    .eq('property_id', propertyId)

  if (rtError) throw new Error(`room_types query failed: ${rtError.message}`)
  if (!roomTypes?.length) return []

  const rates = season.pricing_overrides?.rates ?? {}
  const minLos = season.restrictions?.min_los ?? null
  const closedRoomTypes = new Set(season.restrictions?.closed_room_types ?? [])

  // Build intervals — for room types without an explicit rate, look up the
  // current lowest-priority BAR interval to use as base_rate.
  const intervals = await Promise.all(
    roomTypes.map(async (rt) => {
      let baseRate: number = 0

      if (rates[rt.id] !== undefined) {
        baseRate = rates[rt.id]
      } else {
        // Fallback: lowest-priority (highest number) existing BAR interval for this room type
        const { data: fallback } = await service
          .from('rate_plan_intervals')
          .select('base_rate')
          .eq('property_id', propertyId)
          .eq('room_type_id', rt.id)
          .eq('rate_plan_id', barPlan.id)
          .is('season_id', null)
          .order('priority', { ascending: false })
          .limit(1)
          .maybeSingle()

        baseRate = fallback?.base_rate ?? 0
      }

      return {
        property_id: propertyId,
        room_type_id: rt.id,
        rate_plan_id: barPlan.id,
        season_id: season.id,
        start_date: season.start_date,
        end_date: season.end_date,
        dow_mask: 127,
        base_rate: baseRate,
        min_los: minLos,
        closed: closedRoomTypes.has(rt.id),
        priority: season.priority,
      }
    }),
  )

  return intervals
}

// ─── detectOverlaps ───────────────────────────────────────────────────────────

/**
 * Returns human-readable warnings for any existing seasons at the same
 * priority level whose date range overlaps the given range.
 * Excludes the season identified by `seasonId` (pass null for new seasons).
 */
async function detectOverlaps(
  propertyId: string,
  seasonId: string | null,
  startDate: string,
  endDate: string,
  priority: number,
): Promise<string[]> {
  const service = createServiceClient()
  let query = service
    .from('seasons')
    .select('id, name, start_date, end_date, priority')
    .eq('property_id', propertyId)
    .eq('priority', priority)
    .lte('start_date', endDate)
    .gte('end_date', startDate)

  if (seasonId) {
    query = query.neq('id', seasonId)
  }

  const { data } = await query
  return (data ?? []).map(
    (s) => `"${s.name}" (${s.start_date} — ${s.end_date})`
  )
}

// ─── getSeasons ───────────────────────────────────────────────────────────────

export async function getSeasons(): Promise<SeasonsResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'Propiedad activa no encontrada' }

  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('property_id', property.id)
    .order('start_date', { ascending: true })

  if (error) return { error: error.message }

  return { seasons: (data ?? []) as Season[] }
}

// ─── createSeason ─────────────────────────────────────────────────────────────

export async function createSeason(input: CreateSeasonInput): Promise<SeasonResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = CreateSeasonSchema.safeParse(input)
  if (!parsed.success) return { error: formatZodError(parsed.error) }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'Propiedad activa no encontrada' }

  // Check for overlapping seasons at the same priority (warn, don't block)
  const overlapWarnings = await detectOverlaps(
    property.id,
    null,
    parsed.data.start_date,
    parsed.data.end_date,
    parsed.data.priority ?? 10,
  )

  // a. INSERT season
  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .insert({
      property_id: property.id,
      name: parsed.data.name,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      color: parsed.data.color ?? '#3b82f6',
      pricing_overrides: parsed.data.pricing_overrides ?? {},
      restrictions: parsed.data.restrictions ?? {},
      priority: parsed.data.priority ?? 10,
    })
    .select()
    .single()

  if (seasonError) return { error: seasonError.message }
  if (!season) return { error: 'Error al crear la temporada' }

  // b–d. Auto-generate rate_plan_intervals for each room type
  try {
    const intervals = await buildIntervals(property.id, season as Season)

    if (intervals.length > 0) {
      const service = createServiceClient()
      const { error: intervalsError } = await service
        .from('rate_plan_intervals')
        .insert(intervals)

      if (intervalsError) {
        // Rollback season if intervals fail
        await supabase.from('seasons').delete().eq('id', season.id)
        return { error: `Error al generar intervalos de tarifa: ${intervalsError.message}` }
      }
    }
  } catch (err) {
    await supabase.from('seasons').delete().eq('id', season.id)
    return { error: err instanceof Error ? err.message : 'Error al generar intervalos de tarifa' }
  }

  revalidatePath('/dashboard/setup/rates')
  return {
    season: season as Season,
    ...(overlapWarnings.length > 0 ? { warnings: overlapWarnings } : {}),
  }
}

// ─── updateSeason ─────────────────────────────────────────────────────────────

export async function updateSeason(
  seasonId: string,
  data: Partial<{
    name: string
    start_date: string
    end_date: string
    color: string
    pricing_overrides: { rates?: Record<string, number> }
    restrictions: { min_los?: number; closed_room_types?: string[] }
    priority: number
    is_active: boolean
  }>,
): Promise<SeasonResult> {
  if (!seasonId) return { error: 'ID de temporada no especificado' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'Propiedad activa no encontrada' }

  const parsed = UpdateSeasonSchema.safeParse(data)
  if (!parsed.success) return { error: formatZodError(parsed.error) }

  const { data: existing, error: fetchError } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', seasonId)
    .eq('property_id', property.id)
    .maybeSingle()

  if (fetchError) return { error: fetchError.message }
  if (!existing) return { error: 'Temporada no encontrada o sin acceso' }

  // Check for overlapping seasons when dates or priority change (warn, don't block)
  const effectiveStart = parsed.data.start_date ?? existing.start_date
  const effectiveEnd = parsed.data.end_date ?? existing.end_date
  const effectivePriority = parsed.data.priority ?? existing.priority
  const overlapWarnings =
    'start_date' in parsed.data || 'end_date' in parsed.data || 'priority' in parsed.data
      ? await detectOverlaps(
          property.id,
          seasonId,
          effectiveStart,
          effectiveEnd,
          effectivePriority,
        )
      : []

  const { data: updated, error: updateError } = await supabase
    .from('seasons')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', seasonId)
    .eq('property_id', property.id)
    .select()
    .single()

  if (updateError) return { error: updateError.message }
  if (!updated) return { error: 'Error al actualizar la temporada' }

  // ── Handle is_active toggle first (takes priority over general rebuild) ──
  if ('is_active' in parsed.data) {
    const service = createServiceClient()
    if (parsed.data.is_active === false) {
      // Deactivate: remove all seasonal intervals so the quote engine ignores them
      await service.from('rate_plan_intervals').delete().eq('season_id', seasonId)
      revalidatePath('/dashboard/setup/rates')
      return { season: updated as Season }
    } else if (parsed.data.is_active === true) {
      // Reactivate: delete stale intervals then rebuild from current season data
      await service.from('rate_plan_intervals').delete().eq('season_id', seasonId)
      try {
        const intervals = await buildIntervals(property.id, updated as Season)
        if (intervals.length > 0) {
          await service.from('rate_plan_intervals').insert(intervals)
        }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error al regenerar intervalos' }
      }
      revalidatePath('/dashboard/setup/rates')
      return { season: updated as Season }
    }
  }

  // Rebuild rate_plan_intervals when pricing or restrictions changed
  const rebuildTriggers = ['pricing_overrides', 'restrictions', 'start_date', 'end_date', 'priority'] as const
  const needsRebuild = rebuildTriggers.some((k) => k in parsed.data)

  if (needsRebuild) {
    const service = createServiceClient()

    // Delete existing intervals for this season
    const { error: deleteError } = await service
      .from('rate_plan_intervals')
      .delete()
      .eq('season_id', seasonId)

    if (deleteError) return { error: `Error al limpiar intervalos previos: ${deleteError.message}` }

    // Re-create with updated season data
    try {
      const intervals = await buildIntervals(property.id, updated as Season)

      if (intervals.length > 0) {
        const { error: intervalsError } = await service
          .from('rate_plan_intervals')
          .insert(intervals)

        if (intervalsError) {
          return { error: `Error al regenerar intervalos de tarifa: ${intervalsError.message}` }
        }
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Error al regenerar intervalos de tarifa' }
    }
  }

  revalidatePath('/dashboard/setup/rates')
  return {
    season: updated as Season,
    ...(overlapWarnings.length > 0 ? { warnings: overlapWarnings } : {}),
  }
}

// ─── deleteSeason ─────────────────────────────────────────────────────────────

export async function deleteSeason(seasonId: string): Promise<{ error?: string }> {
  if (!seasonId) return { error: 'ID de temporada no especificado' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'Propiedad activa no encontrada' }

  // Verify season belongs to the active property (ownership guard)
  const { data: existing, error: fetchError } = await supabase
    .from('seasons')
    .select('id')
    .eq('id', seasonId)
    .eq('property_id', property.id)
    .maybeSingle()

  if (fetchError) return { error: fetchError.message }
  if (!existing) return { error: 'Temporada no encontrada o sin acceso' }

  // Explicitly delete associated rate_plan_intervals (cleanliness over FK SET NULL)
  const service = createServiceClient()
  const { error: intervalsError } = await service
    .from('rate_plan_intervals')
    .delete()
    .eq('season_id', seasonId)

  if (intervalsError) {
    return { error: `Error al eliminar intervalos de tarifa: ${intervalsError.message}` }
  }

  const { error: deleteError } = await supabase
    .from('seasons')
    .delete()
    .eq('id', seasonId)
    .eq('property_id', property.id)

  if (deleteError) return { error: deleteError.message }

  revalidatePath('/dashboard/setup/rates')
  return {}
}
