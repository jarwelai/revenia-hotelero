'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActivePropertyWithRole } from '@/lib/property-context'
import {
  searchGoogleMaps,
  searchTripAdvisor,
  fetchGoogleMapsReviews,
  fetchTripAdvisorReviews,
} from '@/lib/serpapi/client'
import {
  mapGooglePlace,
  mapTripAdvisorPlace,
  mapGoogleReview,
  mapTripAdvisorReview,
} from '@/lib/serpapi/mapper'
import type { SearchPlaceResult, DiscoveredReview } from '@/lib/serpapi/types'
import type { ReviewSourceConnection } from '@/types/hotelero'

// ─── Search for places ────────────────────────────────────────────────────────

export async function searchPlacesForProperty(
  query: string,
  source: 'google' | 'tripadvisor',
): Promise<{ places?: SearchPlaceResult[]; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { role } = await getActivePropertyWithRole(supabase, user.id)
  if (!role || !['owner', 'manager'].includes(role)) return { error: 'Sin permisos' }

  try {
    if (source === 'google') {
      const raw = await searchGoogleMaps(query)
      return { places: raw.map(mapGooglePlace) }
    } else {
      const raw = await searchTripAdvisor(query)
      return { places: raw.map(mapTripAdvisorPlace) }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al buscar' }
  }
}

// ─── Connect / disconnect source ─────────────────────────────────────────────

export async function connectSource(input: {
  propertyId: string
  source: 'google' | 'tripadvisor'
  externalPlaceId: string
  placeName: string
  placeUrl?: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property || !role || !['owner', 'manager'].includes(role)) return { error: 'Sin permisos' }

  // Fetch org_id for the given property
  const { data: prop } = await supabase
    .from('properties')
    .select('org_id')
    .eq('id', input.propertyId)
    .maybeSingle()

  if (!prop) return { error: 'Propiedad no encontrada' }

  const { error } = await supabase
    .from('review_source_connections')
    .upsert(
      {
        property_id: input.propertyId,
        org_id: prop.org_id,
        source: input.source,
        external_place_id: input.externalPlaceId,
        place_name: input.placeName,
        place_url: input.placeUrl ?? null,
      },
      { onConflict: 'property_id,source' },
    )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/reviews/discover')
  return {}
}

export async function disconnectSource(
  propertyId: string,
  source: 'google' | 'tripadvisor',
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('review_source_connections')
    .delete()
    .eq('property_id', propertyId)
    .eq('source', source)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/reviews/discover')
  return {}
}

export async function getSourceConnections(
  propertyId: string,
): Promise<{ connections?: ReviewSourceConnection[]; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('review_source_connections')
    .select('*')
    .eq('property_id', propertyId)

  if (error) return { error: error.message }
  return { connections: (data ?? []) as ReviewSourceConnection[] }
}

// ─── Fetch discovered reviews from connected sources ──────────────────────────

export async function fetchDiscoveredReviews(
  propertyId: string,
  source: 'google' | 'tripadvisor',
): Promise<{ reviews?: DiscoveredReview[]; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Get the source connection for this property
  const { data: conn } = await supabase
    .from('review_source_connections')
    .select('external_place_id')
    .eq('property_id', propertyId)
    .eq('source', source)
    .maybeSingle()

  if (!conn) return { error: `No hay conexion ${source} configurada` }

  try {
    let discovered: DiscoveredReview[]

    if (source === 'google') {
      const result = await fetchGoogleMapsReviews(conn.external_place_id)
      discovered = result.reviews.map(mapGoogleReview)
    } else {
      const raw = await fetchTripAdvisorReviews(conn.external_place_id)
      discovered = raw.map(mapTripAdvisorReview)
    }

    // Mark already-imported reviews
    if (discovered.length > 0) {
      const uids = discovered.map((r) => r.external_uid)
      const { data: existing } = await supabase
        .from('reviews')
        .select('external_uid')
        .eq('property_id', propertyId)
        .in('external_uid', uids)

      const existingSet = new Set((existing ?? []).map((r) => r.external_uid as string))
      for (const review of discovered) {
        review.already_imported = existingSet.has(review.external_uid)
      }
    }

    return { reviews: discovered }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al obtener resenas' }
  }
}

// ─── Import selected reviews ──────────────────────────────────────────────────

export async function importSelectedReviews(
  propertyId: string,
  reviews: DiscoveredReview[],
): Promise<{ imported: number; skipped: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { imported: 0, skipped: 0, error: 'No autenticado' }

  // Verify org membership and role
  const { data: member } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['owner', 'manager'].includes(member.role as string)) {
    return { imported: 0, skipped: 0, error: 'Sin permisos' }
  }

  // Get publish rules for auto-publish logic
  const { data: rules } = await supabase
    .from('review_publish_rules')
    .select('auto_publish_enabled, min_rating, auto_publish_sources')
    .eq('property_id', propertyId)
    .maybeSingle()

  let imported = 0
  let skipped = 0

  for (const review of reviews) {
    if (review.already_imported) {
      skipped++
      continue
    }

    // Determine publish status based on rules
    let status: 'published' | 'hidden' = 'hidden'
    if (rules?.auto_publish_enabled) {
      const allowedSources = (rules.auto_publish_sources as string[] | null) ?? []
      if (allowedSources.includes(review.source) && review.rating >= (rules.min_rating as number)) {
        status = 'published'
      }
    }

    const { error: insertError } = await supabase.from('reviews').insert({
      org_id: member.org_id,
      property_id: propertyId,
      source: review.source,
      external_uid: review.external_uid,
      rating: review.rating,
      reviewer_name: review.reviewer_name,
      comment: review.comment,
      title: review.title,
      reviewed_at: review.reviewed_at,
      language: review.language,
      status,
      featured: false,
    })

    if (insertError) {
      // Silently skip duplicates (unique constraint on external_uid+source)
      skipped++
    } else {
      imported++
    }
  }

  // Recompute aggregates inline (mirrors recomputeReviewAggregates from reviews.ts)
  const { data: rows } = await supabase
    .from('reviews')
    .select('rating, reviewed_at')
    .eq('property_id', propertyId)
    .eq('status', 'published')

  const totalReviews = rows?.length ?? 0
  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  let totalRating = 0
  let lastReviewedAt: string | null = null

  for (const r of rows ?? []) {
    distribution[String(r.rating)] = (distribution[String(r.rating)] ?? 0) + 1
    totalRating += r.rating as number
    const rAt = r.reviewed_at as string
    if (!lastReviewedAt || rAt > lastReviewedAt) lastReviewedAt = rAt
  }

  const averageRating =
    totalReviews > 0 ? Math.round((totalRating / totalReviews) * 100) / 100 : 0

  await supabase.from('review_aggregates').upsert(
    {
      property_id: propertyId,
      org_id: member.org_id,
      total_reviews: totalReviews,
      average_rating: averageRating,
      rating_distribution: distribution,
      last_reviewed_at: lastReviewedAt,
    },
    { onConflict: 'property_id' },
  )

  revalidatePath('/dashboard/reviews')
  return { imported, skipped }
}
