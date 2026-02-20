'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Review, ReviewStatus, ReviewSource } from '@/types/hotelero'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateReviewInput {
  property_id: string
  rating: number
  reviewer_name?: string | null
  reviewer_email?: string | null
  reviewer_country?: string | null
  title?: string | null
  comment?: string | null
  source?: ReviewSource
  status?: ReviewStatus
  featured?: boolean
  stay_start?: string | null
  stay_end?: string | null
  reviewed_at?: string | null
}

export interface UpdateReviewInput {
  status?: ReviewStatus
  featured?: boolean
  rating?: number
  title?: string | null
  comment?: string | null
  reviewer_name?: string | null
  reviewed_at?: string | null
}

export interface ReviewActionResult {
  review?: Review
  error?: string
}

export interface ReviewDeleteResult {
  error?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recalcula review_aggregates para una property, contando SOLO published.
 * Debe llamarse con el mismo supabase client authed (manager/owner).
 */
async function recomputeReviewAggregates(
  propertyId: string,
  orgId: string,
  supabase: SupabaseClient,
): Promise<void> {
  // Cargar todas las reviews published de la property
  const { data: rows, error } = await supabase
    .from('reviews')
    .select('rating, reviewed_at')
    .eq('property_id', propertyId)
    .eq('status', 'published')

  if (error) {
    // No bloqueamos el flujo principal si falla; los aggregates quedarán stale
    console.error('[recomputeReviewAggregates] error al cargar reviews:', error.message)
    return
  }

  const totalReviews = rows?.length ?? 0
  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  let totalRating = 0
  let lastReviewedAt: string | null = null

  for (const r of rows ?? []) {
    distribution[String(r.rating)] = (distribution[String(r.rating)] ?? 0) + 1
    totalRating += r.rating
    if (!lastReviewedAt || r.reviewed_at > lastReviewedAt) {
      lastReviewedAt = r.reviewed_at
    }
  }

  const averageRating =
    totalReviews > 0
      ? Math.round((totalRating / totalReviews) * 100) / 100
      : 0

  const { error: upsertError } = await supabase
    .from('review_aggregates')
    .upsert(
      {
        property_id: propertyId,
        org_id: orgId,
        total_reviews: totalReviews,
        average_rating: averageRating,
        rating_distribution: distribution,
        last_reviewed_at: lastReviewedAt,
      },
      { onConflict: 'property_id' },
    )

  if (upsertError) {
    console.error('[recomputeReviewAggregates] error al upsert:', upsertError.message)
  }
}

// ─── createReview ─────────────────────────────────────────────────────────────

export async function createReview(
  input: CreateReviewInput,
): Promise<ReviewActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Validaciones básicas
  if (!input.property_id) return { error: 'property_id es requerido' }
  if (!input.rating || input.rating < 1 || input.rating > 5) {
    return { error: 'La valoración debe estar entre 1 y 5' }
  }
  if (!Number.isInteger(input.rating)) {
    return { error: 'La valoración debe ser un número entero' }
  }

  // Obtener org_member (valida pertenencia + rol)
  const { data: member, error: memberError } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) return { error: `Error de membresía: ${memberError.message}` }
  if (!member) return { error: 'No perteneces a ninguna organización' }
  if (!['owner', 'manager'].includes(member.role)) {
    return { error: 'Se requiere rol owner o manager para crear reseñas' }
  }

  // Validar que la property pertenece a la org (RLS + query explícita)
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', input.property_id)
    .eq('org_id', member.org_id)
    .maybeSingle()

  if (propError) return { error: `Error al validar propiedad: ${propError.message}` }
  if (!property) return { error: 'La propiedad no existe o no tienes acceso' }

  // Insertar review
  const { data: review, error: insertError } = await supabase
    .from('reviews')
    .insert({
      org_id: member.org_id,
      property_id: input.property_id,
      source: input.source ?? 'manual',
      rating: input.rating,
      reviewer_name: input.reviewer_name?.trim() || null,
      reviewer_email: input.reviewer_email?.trim() || null,
      reviewer_country: input.reviewer_country?.trim() || null,
      title: input.title?.trim() || null,
      comment: input.comment?.trim() || null,
      status: input.status ?? 'published',
      featured: input.featured ?? false,
      stay_start: input.stay_start || null,
      stay_end: input.stay_end || null,
      reviewed_at: input.reviewed_at || undefined,
    })
    .select()
    .single()

  if (insertError || !review) {
    return { error: insertError?.message ?? 'Error al crear la reseña' }
  }

  await recomputeReviewAggregates(input.property_id, member.org_id, supabase)

  revalidatePath('/dashboard/reviews')
  return { review: review as Review }
}

// ─── updateReview ─────────────────────────────────────────────────────────────

export async function updateReview(
  reviewId: string,
  patch: UpdateReviewInput,
): Promise<ReviewActionResult> {
  if (!reviewId) return { error: 'reviewId es requerido' }
  if (patch.rating !== undefined && (patch.rating < 1 || patch.rating > 5)) {
    return { error: 'La valoración debe estar entre 1 y 5' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Leer review actual para obtener property_id y org_id (necesarios para recompute)
  const { data: existing, error: readError } = await supabase
    .from('reviews')
    .select('property_id, org_id')
    .eq('id', reviewId)
    .maybeSingle()

  if (readError) return { error: `Error al leer reseña: ${readError.message}` }
  if (!existing) return { error: 'Reseña no encontrada o sin acceso' }

  // Construir patch limpio (solo campos permitidos)
  const updatePayload: Record<string, unknown> = {}
  if (patch.status !== undefined) updatePayload.status = patch.status
  if (patch.featured !== undefined) updatePayload.featured = patch.featured
  if (patch.rating !== undefined) updatePayload.rating = patch.rating
  if (patch.title !== undefined) updatePayload.title = patch.title?.trim() || null
  if (patch.comment !== undefined) updatePayload.comment = patch.comment?.trim() || null
  if (patch.reviewer_name !== undefined) updatePayload.reviewer_name = patch.reviewer_name?.trim() || null
  if (patch.reviewed_at !== undefined) updatePayload.reviewed_at = patch.reviewed_at

  if (Object.keys(updatePayload).length === 0) {
    return { error: 'No hay cambios que aplicar' }
  }

  const { data: review, error: updateError } = await supabase
    .from('reviews')
    .update(updatePayload)
    .eq('id', reviewId)
    .select()
    .single()

  if (updateError || !review) {
    return { error: updateError?.message ?? 'Error al actualizar la reseña' }
  }

  // Recompute si status o rating cambiaron (afectan los aggregates)
  const needsRecompute = patch.status !== undefined || patch.rating !== undefined
  if (needsRecompute) {
    await recomputeReviewAggregates(existing.property_id, existing.org_id, supabase)
  }

  revalidatePath('/dashboard/reviews')
  return { review: review as Review }
}

// ─── deleteReview ─────────────────────────────────────────────────────────────

export async function deleteReview(reviewId: string): Promise<ReviewDeleteResult> {
  if (!reviewId) return { error: 'reviewId es requerido' }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Leer antes de borrar para tener property_id y org_id
  const { data: existing, error: readError } = await supabase
    .from('reviews')
    .select('property_id, org_id')
    .eq('id', reviewId)
    .maybeSingle()

  if (readError) return { error: `Error al leer reseña: ${readError.message}` }
  if (!existing) return { error: 'Reseña no encontrada o sin acceso' }

  const { error: deleteError } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)

  if (deleteError) return { error: deleteError.message }

  await recomputeReviewAggregates(existing.property_id, existing.org_id, supabase)

  revalidatePath('/dashboard/reviews')
  return {}
}
