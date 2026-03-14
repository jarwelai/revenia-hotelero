/**
 * Vercel Cron — Review Sync automático
 *
 * Schedule: cada 6 horas → "0 *\/6 * * *"
 *
 * Auth: Bearer CRON_SECRET (set in Vercel env vars)
 *
 * Env vars requeridas:
 *   CRON_SECRET              — secreto compartido con Vercel Cron
 *   SERPAPI_KEY              — API key de SerpAPI
 *   SUPABASE_SERVICE_ROLE_KEY — necesario para createServiceClient
 *   NEXT_PUBLIC_SUPABASE_URL  — URL de Supabase
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getConfigValue } from '@/lib/config'
import { fetchGoogleMapsReviews, fetchTripAdvisorReviews } from '@/lib/serpapi/client'
import { mapGoogleReview, mapTripAdvisorReview } from '@/lib/serpapi/mapper'
import type { DiscoveredReview } from '@/lib/serpapi/types'

export const runtime = 'nodejs'
export const maxDuration = 60 // segundos — límite para cron jobs en Vercel

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReviewSourceConnection {
  id: string
  property_id: string
  source: string
  external_place_id: string
}

interface PublishRules {
  auto_publish_enabled: boolean
  min_rating: number
  auto_publish_sources: string[] | null
}

interface RatingRow {
  rating: number
  reviewed_at: string
}

interface CronResponse {
  synced: number
  imported: number
  skipped: number
  errors: number
  timestamp: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function determineStatus(
  review: DiscoveredReview,
  rules: PublishRules | null,
): 'published' | 'hidden' {
  if (!rules?.auto_publish_enabled) return 'hidden'
  const allowedSources = rules.auto_publish_sources ?? []
  if (allowedSources.includes(review.source) && review.rating >= rules.min_rating) {
    return 'published'
  }
  return 'hidden'
}

async function computeAggregates(
  rows: RatingRow[],
): Promise<{
  totalReviews: number
  averageRating: number
  distribution: Record<string, number>
  lastReviewedAt: string | null
}> {
  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  let totalRating = 0
  let lastReviewedAt: string | null = null

  for (const r of rows) {
    const key = String(r.rating)
    distribution[key] = (distribution[key] ?? 0) + 1
    totalRating += r.rating
    if (!lastReviewedAt || r.reviewed_at > lastReviewedAt) {
      lastReviewedAt = r.reviewed_at
    }
  }

  const totalReviews = rows.length
  const averageRating =
    totalReviews > 0 ? Math.round((totalRating / totalReviews) * 100) / 100 : 0

  return { totalReviews, averageRating, distribution, lastReviewedAt }
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = await getConfigValue('CRON_SECRET')
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cron/sync-reviews] Unauthorized request — header mismatch')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[cron/sync-reviews] Starting review sync run')

  const admin = createServiceClient()

  // 2. Cargar todas las review_source_connections
  const { data: connections, error: connError } = await admin
    .from('review_source_connections')
    .select('id, property_id, source, external_place_id')

  if (connError) {
    console.error('[cron/sync-reviews] Failed to fetch connections:', connError.message)
    return NextResponse.json({ error: connError.message }, { status: 500 })
  }

  if (!connections || connections.length === 0) {
    console.log('[cron/sync-reviews] No connections to sync')
    return NextResponse.json({
      message: 'No connections to sync',
      synced: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      timestamp: new Date().toISOString(),
    } satisfies CronResponse & { message: string })
  }

  console.log(`[cron/sync-reviews] Processing ${connections.length} connection(s)`)

  let totalImported = 0
  let totalSkipped = 0
  let totalErrors = 0

  // 3. Procesar cada conexión de forma secuencial para no saturar SerpAPI
  for (const conn of connections as ReviewSourceConnection[]) {
    try {
      // 3a. Fetch desde SerpAPI según la fuente
      let discovered: DiscoveredReview[] = []

      if (conn.source === 'google') {
        const result = await fetchGoogleMapsReviews(conn.external_place_id)
        discovered = result.reviews.map(mapGoogleReview)
      } else if (conn.source === 'tripadvisor') {
        const raw = await fetchTripAdvisorReviews(conn.external_place_id)
        discovered = raw.map(mapTripAdvisorReview)
      } else {
        console.warn(`[cron/sync-reviews] Unknown source "${conn.source}" for connection ${conn.id}`)
      }

      if (discovered.length === 0) {
        console.log(`[cron/sync-reviews] Connection ${conn.id} — no reviews found`)
        await admin
          .from('review_source_connections')
          .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
          .eq('id', conn.id)
        continue
      }

      // 3b. Detectar cuáles ya existen por external_uid
      const uids = discovered.map((r) => r.external_uid)
      const { data: existing } = await admin
        .from('reviews')
        .select('external_uid')
        .eq('property_id', conn.property_id)
        .in('external_uid', uids)

      const existingSet = new Set(
        (existing ?? []).map((r) => r.external_uid as string),
      )

      // 3c. Obtener org_id de la propiedad
      const { data: prop } = await admin
        .from('properties')
        .select('org_id')
        .eq('id', conn.property_id)
        .single()

      if (!prop) {
        console.warn(`[cron/sync-reviews] Property ${conn.property_id} not found — skipping connection ${conn.id}`)
        continue
      }

      const orgId = prop.org_id as string

      // 3d. Obtener reglas de publicación automática
      const { data: rulesRow } = await admin
        .from('review_publish_rules')
        .select('auto_publish_enabled, min_rating, auto_publish_sources')
        .eq('property_id', conn.property_id)
        .maybeSingle()

      const rules: PublishRules | null = rulesRow
        ? {
            auto_publish_enabled: rulesRow.auto_publish_enabled as boolean,
            min_rating: rulesRow.min_rating as number,
            auto_publish_sources: rulesRow.auto_publish_sources as string[] | null,
          }
        : null

      let imported = 0
      let skipped = 0

      // 3e. Insertar reseñas nuevas
      for (const review of discovered) {
        if (existingSet.has(review.external_uid)) {
          skipped++
          continue
        }

        const status = determineStatus(review, rules)

        const { error: insertError } = await admin.from('reviews').insert({
          org_id: orgId,
          property_id: conn.property_id,
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
          // Probable duplicado por race condition — tratar como skip
          console.warn(
            `[cron/sync-reviews] Insert skipped for uid "${review.external_uid}":`,
            insertError.message,
          )
          skipped++
        } else {
          imported++
        }
      }

      totalImported += imported
      totalSkipped += skipped

      console.log(
        `[cron/sync-reviews] Connection ${conn.id} (${conn.source}) — imported: ${imported}, skipped: ${skipped}`,
      )

      // 3f. Recalcular agregados si se importaron reseñas nuevas
      if (imported > 0) {
        const { data: publishedRows } = await admin
          .from('reviews')
          .select('rating, reviewed_at')
          .eq('property_id', conn.property_id)
          .eq('status', 'published')

        const { totalReviews, averageRating, distribution, lastReviewedAt } =
          await computeAggregates((publishedRows ?? []) as RatingRow[])

        await admin.from('review_aggregates').upsert(
          {
            property_id: conn.property_id,
            org_id: orgId,
            total_reviews: totalReviews,
            average_rating: averageRating,
            rating_distribution: distribution,
            last_reviewed_at: lastReviewedAt,
          },
          { onConflict: 'property_id' },
        )

        console.log(
          `[cron/sync-reviews] Aggregates updated for property ${conn.property_id} — total: ${totalReviews}, avg: ${averageRating}`,
        )
      }

      // 3g. Actualizar última sincronización exitosa
      await admin
        .from('review_source_connections')
        .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
        .eq('id', conn.id)
    } catch (err) {
      totalErrors++
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`[cron/sync-reviews] Connection ${conn.id} failed:`, errorMsg)

      await admin
        .from('review_source_connections')
        .update({ last_sync_error: errorMsg })
        .eq('id', conn.id)
    }
  }

  console.log(
    `[cron/sync-reviews] Run complete — connections: ${connections.length}, imported: ${totalImported}, skipped: ${totalSkipped}, errors: ${totalErrors}`,
  )

  const response: CronResponse = {
    synced: connections.length,
    imported: totalImported,
    skipped: totalSkipped,
    errors: totalErrors,
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
