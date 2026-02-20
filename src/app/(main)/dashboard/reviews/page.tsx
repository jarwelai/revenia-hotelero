import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StarRating } from '@/features/reviews/components/StarRating'
import { ReviewActions } from '@/features/reviews/components/ReviewActions'
import { getActivePropertyWithRole } from '@/lib/property-context'
import type { Review, ReviewStatus, ReviewSource } from '@/types/hotelero'

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['all', 'published', 'hidden'] as const
type FilterStatus = typeof VALID_STATUSES[number]

const VALID_SOURCES: ReviewSource[] = [
  'manual', 'internal', 'google', 'booking', 'airbnb',
  'expedia', 'facebook', 'tripadvisor', 'other',
]

const STATUS_LABELS: Record<ReviewStatus, { label: string; classes: string }> = {
  published: { label: 'Publicada', classes: 'bg-success-100 text-success-700' },
  hidden:    { label: 'Oculta',    classes: 'bg-gray-100 text-gray-500' },
}

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

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{
    status?: string
    source?: string
    rating?: string
  }>
}

export default async function ReviewsPage({ searchParams }: PageProps) {
  const params = await searchParams

  // Validar filtros
  const rawStatus = params.status ?? 'all'
  const filterStatus: FilterStatus = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as FilterStatus)
    : 'all'

  const rawSource = params.source ?? 'all'
  const filterSource: ReviewSource | 'all' = (VALID_SOURCES as string[]).includes(rawSource)
    ? (rawSource as ReviewSource)
    : 'all'

  const rawRating = params.rating ?? 'all'
  const filterRating =
    rawRating !== 'all' && ['1', '2', '3', '4', '5'].includes(rawRating)
      ? parseInt(rawRating, 10)
      : null

  const supabase = await createClient()

  // Autenticación
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const canEdit = role === 'owner' || role === 'manager'

  // Aggregates
  const { data: aggregate } = await supabase
    .from('review_aggregates')
    .select('total_reviews, average_rating')
    .eq('property_id', property.id)
    .maybeSingle()

  // Reviews con filtros
  let query = supabase
    .from('reviews')
    .select('*')
    .eq('property_id', property.id)
    .order('featured', { ascending: false })
    .order('reviewed_at', { ascending: false })

  if (filterStatus !== 'all') {
    query = query.eq('status', filterStatus)
  }
  if (filterSource !== 'all') {
    query = query.eq('source', filterSource)
  }
  if (filterRating !== null) {
    query = query.eq('rating', filterRating)
  }

  const { data: reviews } = await query
  const reviewList = (reviews ?? []) as Review[]

  // URL builder para filtros (mantiene los otros filtros activos)
  function buildFilterUrl(key: string, value: string) {
    const p = new URLSearchParams({
      status: filterStatus,
      source: filterSource,
      rating: filterRating !== null ? String(filterRating) : 'all',
    })
    p.set(key, value)
    return `/dashboard/reviews?${p.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">Reseñas</h1>
          <p className="mt-1 text-sm text-foreground-secondary">{property.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Widget público */}
          <a
            href={`/embed/reviews/${property.public_key}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm font-medium text-foreground-secondary border border-border rounded-xl hover:bg-surface transition-colors"
          >
            Ver widget
          </a>
          {canEdit && (
            <Link
              href="/dashboard/reviews/new"
              className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 transition-colors"
            >
              + Nueva reseña
            </Link>
          )}
        </div>
      </div>

      {/* Aggregates summary */}
      {aggregate && (
        <div className="flex items-center gap-6 p-4 rounded-xl bg-surface border border-border shadow-card">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-heading font-bold text-foreground">
              {Number(aggregate.average_rating).toFixed(1)}
            </span>
            <StarRating rating={Math.round(Number(aggregate.average_rating))} size="md" />
          </div>
          <div className="text-sm text-foreground-secondary">
            Basado en <strong className="text-foreground">{aggregate.total_reviews}</strong>{' '}
            {aggregate.total_reviews === 1 ? 'reseña publicada' : 'reseñas publicadas'}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="space-y-3">
        {/* Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider w-16">Estado</span>
          {VALID_STATUSES.map((s) => (
            <Link
              key={s}
              href={buildFilterUrl('status', s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                filterStatus === s
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white border-border text-foreground-secondary hover:bg-surface'
              }`}
            >
              {s === 'all' ? 'Todas' : s === 'published' ? 'Publicadas' : 'Ocultas'}
            </Link>
          ))}
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider w-16">Rating</span>
          <Link
            href={buildFilterUrl('rating', 'all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filterRating === null
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white border-border text-foreground-secondary hover:bg-surface'
            }`}
          >
            Todos
          </Link>
          {[5, 4, 3, 2, 1].map((r) => (
            <Link
              key={r}
              href={buildFilterUrl('rating', String(r))}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 ${
                filterRating === r
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white border-border text-foreground-secondary hover:bg-surface'
              }`}
            >
              {r}★
            </Link>
          ))}
        </div>

        {/* Source */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider w-16">Origen</span>
          <Link
            href={buildFilterUrl('source', 'all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filterSource === 'all'
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white border-border text-foreground-secondary hover:bg-surface'
            }`}
          >
            Todos
          </Link>
          {VALID_SOURCES.map((s) => (
            <Link
              key={s}
              href={buildFilterUrl('source', s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                filterSource === s
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white border-border text-foreground-secondary hover:bg-surface'
              }`}
            >
              {SOURCE_LABELS[s]}
            </Link>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {reviewList.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center">
          <p className="text-foreground-secondary">No hay reseñas con los filtros seleccionados.</p>
          {canEdit && filterStatus === 'all' && filterSource === 'all' && filterRating === null && (
            <Link
              href="/dashboard/reviews/new"
              className="mt-4 inline-block text-sm font-medium text-primary-500 hover:text-primary-600"
            >
              Crear primera reseña →
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Huésped</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Valoración</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider hidden md:table-cell">Comentario</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider hidden lg:table-cell">Origen</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Estado</th>
                {canEdit && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reviewList.map((review) => (
                <tr
                  key={review.id}
                  className={review.status === 'hidden' ? 'opacity-60' : ''}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {review.reviewer_name ?? '—'}
                        {review.featured && (
                          <span className="ml-1.5 text-secondary-500" title="Destacada">★</span>
                        )}
                      </span>
                      {review.reviewer_country && (
                        <span className="text-xs text-foreground-muted">{review.reviewer_country}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StarRating rating={review.rating} size="sm" />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell max-w-xs">
                    <p className="text-sm text-foreground-secondary truncate">
                      {review.comment ?? <span className="italic text-foreground-muted">Sin comentario</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-foreground-secondary">
                      {SOURCE_LABELS[review.source]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[review.status].classes}`}>
                      {STATUS_LABELS[review.status].label}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <ReviewActions
                        reviewId={review.id}
                        currentStatus={review.status}
                        currentFeatured={review.featured}
                        reviewerName={review.reviewer_name}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
