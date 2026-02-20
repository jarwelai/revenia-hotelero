import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Review, ReviewAggregate } from '@/types/hotelero'

interface PageProps {
  params: Promise<{ publicKey: string }>
}

// ─── Helpers visuales ─────────────────────────────────────────────────────────

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill={s <= rating ? '#D4A853' : '#E5E7EB'}
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReviewEmbedPage({ params }: PageProps) {
  const { publicKey } = await params

  // createClient() sin sesión → actúa como anon → RLS anon aplica
  const supabase = await createClient()

  // Resolver propiedad por public_key
  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('public_key', publicKey)
    .maybeSingle()

  if (!property) notFound()

  // Aggregates (anon policy: true)
  const { data: agg } = await supabase
    .from('review_aggregates')
    .select('*')
    .eq('property_id', property.id)
    .maybeSingle()

  const aggregate = agg as ReviewAggregate | null

  // Últimas 10 reviews publicadas, destacadas primero
  const { data: rows } = await supabase
    .from('reviews')
    .select('id, rating, reviewer_name, reviewer_country, comment, featured, reviewed_at')
    .eq('property_id', property.id)
    .eq('status', 'published')
    .order('featured', { ascending: false })
    .order('reviewed_at', { ascending: false })
    .limit(10)

  const reviews = (rows ?? []) as Pick<
    Review,
    'id' | 'rating' | 'reviewer_name' | 'reviewer_country' | 'comment' | 'featured' | 'reviewed_at'
  >[]

  const avgRating = aggregate ? Number(aggregate.average_rating) : 0
  const totalReviews = aggregate?.total_reviews ?? 0
  const distribution = (aggregate?.rating_distribution ?? {}) as Record<string, number>

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#fff',
        padding: '20px',
        maxWidth: '600px',
        margin: '0 auto',
        color: '#1a1a2e',
      }}
    >
      {/* Header: promedio + estrellas + total */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1, color: '#1E3A5F' }}>
            {avgRating.toFixed(1)}
          </div>
          <Stars rating={Math.round(avgRating)} size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1E3A5F' }}>
            {property.name}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#64748B', marginTop: '2px' }}>
            {totalReviews} {totalReviews === 1 ? 'reseña' : 'reseñas'}
          </div>
          <a
            href={`/p/${publicKey}/reviews`}
            style={{ fontSize: '0.75rem', color: '#2563EB', marginTop: '4px', display: 'block' }}
          >
            Ver todas →
          </a>
        </div>
      </div>

      {/* Distribución de ratings */}
      {totalReviews > 0 && (
        <div style={{ marginBottom: '20px' }}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[String(star)] ?? 0
            const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0
            return (
              <div
                key={star}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}
              >
                <span style={{ fontSize: '0.75rem', color: '#64748B', width: '12px', textAlign: 'right' }}>
                  {star}
                </span>
                <svg width={12} height={12} viewBox="0 0 20 20" fill="#D4A853">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <div
                  style={{
                    flex: 1,
                    height: '8px',
                    background: '#F1F5F9',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: '#D4A853',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748B', width: '28px' }}>
                  {pct}%
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Divisor */}
      {reviews.length > 0 && (
        <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '16px 0' }} />
      )}

      {/* Lista de reviews */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {reviews.map((review) => (
          <div
            key={review.id}
            style={{
              padding: '12px',
              background: review.featured ? '#FBF8F0' : '#F8FAFC',
              borderRadius: '10px',
              border: review.featured ? '1px solid #E7D5A5' : '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1a1a2e' }}>
                  {review.reviewer_name ?? 'Huésped anónimo'}
                </span>
                {review.reviewer_country && (
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: '6px' }}>
                    {review.reviewer_country}
                  </span>
                )}
              </div>
              <Stars rating={review.rating} size={14} />
            </div>
            {review.comment && (
              <p style={{ fontSize: '0.8125rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                {review.comment}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      {reviews.length === 0 && totalReviews === 0 && (
        <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.875rem', margin: '20px 0' }}>
          Aún no hay reseñas publicadas.
        </p>
      )}

      {reviews.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <a
            href={`/p/${publicKey}/reviews`}
            style={{ fontSize: '0.8125rem', color: '#2563EB', textDecoration: 'none' }}
          >
            Ver todas las reseñas →
          </a>
        </div>
      )}
    </div>
  )
}
