import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActivePropertyWithRole } from '@/lib/property-context'
import { isAiReviewResponsesEnabled } from '@/lib/feature-flags'
import { StarRating } from '@/features/reviews/components/StarRating'
import { ReviewActions } from '@/features/reviews/components/ReviewActions'
import { ReviewReplyEditor } from '@/features/reviews/components/ReviewReplyEditor'
import type { Review, GoogleConnection, ReviewSource, ReviewStatus } from '@/types/hotelero'

export const metadata = { title: 'Detalle de Resena | Revenia' }

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<ReviewSource, string> = {
  manual:      'Manual',
  internal:    'Interno',
  google:      'Google',
  booking:     'Booking',
  airbnb:      'Airbnb',
  expedia:     'Expedia',
  facebook:    'Facebook',
  tripadvisor: 'TripAdvisor',
  other:       'Otro',
}

const SOURCE_BADGE_CLASSES: Partial<Record<ReviewSource, string>> = {
  google:      'bg-blue-50 text-blue-700 border-blue-200',
  tripadvisor: 'bg-green-50 text-green-700 border-green-200',
  booking:     'bg-sky-50 text-sky-700 border-sky-200',
  airbnb:      'bg-rose-50 text-rose-700 border-rose-200',
  expedia:     'bg-yellow-50 text-yellow-700 border-yellow-200',
  facebook:    'bg-indigo-50 text-indigo-700 border-indigo-200',
}

const STATUS_BADGE: Record<ReviewStatus, { label: string; classes: string }> = {
  published: { label: 'Publicada', classes: 'bg-success-100 text-success-700 border-success-200' },
  hidden:    { label: 'Oculta',    classes: 'bg-gray-100 text-gray-500 border-gray-200' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: ReviewSource }) {
  const classes =
    SOURCE_BADGE_CLASSES[source] ?? 'bg-gray-100 text-gray-600 border-gray-200'

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${classes}`}
    >
      {SOURCE_LABELS[source]}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReviewDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const canEdit = role === 'owner' || role === 'manager'

  // Load review — RLS ensures the user can only see reviews for their org
  const { data: reviewData, error: reviewError } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', id)
    .eq('property_id', property.id)
    .maybeSingle()

  if (reviewError || !reviewData) {
    notFound()
  }

  const review = reviewData as Review

  // Load Google connection and AI flag in parallel
  const [googleConnResult, aiEnabled] = await Promise.all([
    supabase
      .from('google_connections')
      .select('*')
      .eq('property_id', property.id)
      .maybeSingle(),
    isAiReviewResponsesEnabled(property.id),
  ])

  const googleConnection = (googleConnResult.data ?? null) as GoogleConnection | null
  const hasGoogleConnection = googleConnection !== null

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-foreground-secondary" aria-label="Navegacion">
        <Link href="/dashboard/reviews" className="hover:text-foreground transition-colors">
          Resenas
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">Detalle</span>
      </nav>

      {/* Review card */}
      <article className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-5">
        {/* Header row: name + actions */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-lg font-heading font-semibold text-foreground">
              {review.reviewer_name ?? 'Huesped anonimo'}
            </h1>

            {review.reviewer_country && (
              <p className="text-sm text-foreground-secondary">{review.reviewer_country}</p>
            )}
          </div>

          {canEdit && (
            <ReviewActions
              reviewId={review.id}
              currentStatus={review.status}
              currentFeatured={review.featured}
              reviewerName={review.reviewer_name}
            />
          )}
        </div>

        {/* Rating + badges row */}
        <div className="flex flex-wrap items-center gap-3">
          <StarRating rating={review.rating} size="md" showNumber />
          <SourceBadge source={review.source} />

          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[review.status].classes}`}
          >
            {STATUS_BADGE[review.status].label}
          </span>

          {review.featured && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-50 text-secondary-700 border border-secondary-200"
              title="Resena destacada"
            >
              <span aria-hidden="true">★</span>
              Destacada
            </span>
          )}
        </div>

        {/* Title */}
        {review.title && (
          <p className="text-base font-medium text-foreground">{review.title}</p>
        )}

        {/* Comment */}
        {review.comment ? (
          <p className="text-sm text-foreground-secondary leading-relaxed whitespace-pre-wrap">
            {review.comment}
          </p>
        ) : (
          <p className="text-sm text-foreground-muted italic">Sin comentario.</p>
        )}

        {/* Metadata footer */}
        <div className="pt-2 border-t border-border flex flex-wrap gap-x-6 gap-y-1">
          <dl className="flex items-center gap-1.5">
            <dt className="text-xs text-foreground-muted">Fecha:</dt>
            <dd className="text-xs text-foreground-secondary">{formatDate(review.reviewed_at)}</dd>
          </dl>

          {review.reviewer_email && (
            <dl className="flex items-center gap-1.5">
              <dt className="text-xs text-foreground-muted">Email:</dt>
              <dd className="text-xs text-foreground-secondary">{review.reviewer_email}</dd>
            </dl>
          )}

          {review.stay_start && (
            <dl className="flex items-center gap-1.5">
              <dt className="text-xs text-foreground-muted">Estancia:</dt>
              <dd className="text-xs text-foreground-secondary">
                {formatDate(review.stay_start)}
                {review.stay_end && ` — ${formatDate(review.stay_end)}`}
              </dd>
            </dl>
          )}

          {review.language && (
            <dl className="flex items-center gap-1.5">
              <dt className="text-xs text-foreground-muted">Idioma:</dt>
              <dd className="text-xs text-foreground-secondary uppercase">{review.language}</dd>
            </dl>
          )}
        </div>
      </article>

      {/* Reply section — only for owner/manager */}
      {canEdit && (
        <section className="bg-white rounded-2xl border border-border shadow-card p-6">
          <div className="mb-4">
            <h2 className="text-base font-heading font-semibold text-foreground">
              Responder a la resena
            </h2>
            <p className="mt-1 text-sm text-foreground-secondary">
              {review.reply_text
                ? 'Edita o actualiza tu respuesta.'
                : 'Escribe una respuesta para este huesped.'}
            </p>
          </div>

          <ReviewReplyEditor
            reviewId={review.id}
            source={review.source}
            existingReply={review.reply_text}
            replySyncedToSource={review.reply_synced_to_source}
            replySyncError={review.reply_sync_error}
            hasGoogleConnection={hasGoogleConnection}
            aiEnabled={aiEnabled}
          />
        </section>
      )}
    </div>
  )
}
