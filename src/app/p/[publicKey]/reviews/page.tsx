import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StarRating } from '@/features/reviews/components/StarRating'
import type { Review, ReviewAggregate } from '@/types/hotelero'

interface PageProps {
  params: Promise<{ publicKey: string }>
  searchParams: Promise<{ page?: string }>
}

const PAGE_SIZE = 20

export default async function PublicReviewsPage({ params, searchParams }: PageProps) {
  const { publicKey } = await params
  const { page: rawPage } = await searchParams
  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  // createClient() sin sesión → anon
  const supabase = await createClient()

  // Resolver propiedad
  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('public_key', publicKey)
    .maybeSingle()

  if (!property) notFound()

  // Aggregates
  const { data: agg } = await supabase
    .from('review_aggregates')
    .select('*')
    .eq('property_id', property.id)
    .maybeSingle()

  const aggregate = agg as ReviewAggregate | null
  const avgRating = aggregate ? Number(aggregate.average_rating) : 0
  const totalReviews = aggregate?.total_reviews ?? 0

  // Reviews paginadas
  const { data: rows } = await supabase
    .from('reviews')
    .select('id, rating, reviewer_name, reviewer_country, comment, title, featured, reviewed_at')
    .eq('property_id', property.id)
    .eq('status', 'published')
    .order('featured', { ascending: false })
    .order('reviewed_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const reviews = (rows ?? []) as Pick<
    Review,
    'id' | 'rating' | 'reviewer_name' | 'reviewer_country' | 'comment' | 'title' | 'featured' | 'reviewed_at'
  >[]

  const totalPages = Math.max(1, Math.ceil(totalReviews / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground">{property.name}</h1>
          <p className="mt-1 text-foreground-secondary">Reseñas de huéspedes</p>
        </div>

        {/* Summary */}
        {aggregate && (
          <div className="flex items-center gap-6 p-6 rounded-2xl bg-white border border-border shadow-card mb-8">
            <div className="text-center">
              <div className="text-5xl font-heading font-bold text-foreground">
                {avgRating.toFixed(1)}
              </div>
              <div className="mt-2">
                <StarRating rating={Math.round(avgRating)} size="md" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground-secondary">
                Basado en <strong className="text-foreground">{totalReviews}</strong>{' '}
                {totalReviews === 1 ? 'reseña' : 'reseñas'}
              </p>

              {/* Distribución */}
              <div className="mt-3 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = (aggregate.rating_distribution[String(star)] ?? 0) as number
                  const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-xs text-foreground-muted w-4 text-right">{star}</span>
                      <svg className="w-3 h-3 text-secondary-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-secondary-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-foreground-muted w-8">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        {reviews.length === 0 ? (
          <div className="text-center py-12 text-foreground-secondary">
            Aún no hay reseñas publicadas.
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className={`p-5 rounded-2xl border shadow-card ${
                  review.featured
                    ? 'bg-secondary-50 border-secondary-200'
                    : 'bg-white border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">
                        {review.reviewer_name ?? 'Huésped anónimo'}
                      </span>
                      {review.reviewer_country && (
                        <span className="text-xs text-foreground-muted">· {review.reviewer_country}</span>
                      )}
                      {review.featured && (
                        <span className="text-xs bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full font-medium">
                          Destacada
                        </span>
                      )}
                    </div>
                    {review.title && (
                      <p className="text-sm font-medium text-foreground mb-1">{review.title}</p>
                    )}
                    {review.comment && (
                      <p className="text-sm text-foreground-secondary leading-relaxed">
                        {review.comment}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <StarRating rating={review.rating} size="sm" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-foreground-muted">
                  {new Date(review.reviewed_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            {page > 1 && (
              <a
                href={`/p/${publicKey}/reviews?page=${page - 1}`}
                className="px-4 py-2 text-sm font-medium border border-border rounded-xl bg-white text-foreground hover:bg-surface transition-colors"
              >
                ← Anterior
              </a>
            )}
            <span className="text-sm text-foreground-secondary">
              Página {page} de {totalPages}
            </span>
            {page < totalPages && (
              <a
                href={`/p/${publicKey}/reviews?page=${page + 1}`}
                className="px-4 py-2 text-sm font-medium border border-border rounded-xl bg-white text-foreground hover:bg-surface transition-colors"
              >
                Siguiente →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
