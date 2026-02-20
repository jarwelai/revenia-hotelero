'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createReview } from '@/actions/reviews'
import { StarRating } from './StarRating'
import type { ReviewStatus } from '@/types/hotelero'

interface ReviewFormProps {
  propertyId: string
}

const RATING_LABELS: Record<number, string> = {
  1: 'Muy malo',
  2: 'Malo',
  3: 'Regular',
  4: 'Bueno',
  5: 'Excelente',
}

export function ReviewForm({ propertyId }: ReviewFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const displayRating = hoverRating || rating

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const form = e.currentTarget
    const data = new FormData(form)

    const input = {
      property_id: propertyId,
      rating,
      reviewer_name: (data.get('reviewer_name') as string)?.trim() || null,
      reviewer_email: (data.get('reviewer_email') as string)?.trim() || null,
      reviewer_country: (data.get('reviewer_country') as string)?.trim() || null,
      title: (data.get('title') as string)?.trim() || null,
      comment: (data.get('comment') as string)?.trim() || null,
      status: (data.get('status') as ReviewStatus) || 'published',
      featured: data.get('featured') === 'true',
    }

    startTransition(async () => {
      const result = await createReview(input)
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/dashboard/reviews'), 1200)
    })
  }

  if (success) {
    return (
      <div className="rounded-xl border border-success-200 bg-success-50 p-6 flex items-center gap-3">
        <svg className="w-5 h-5 text-success-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        <p className="text-sm font-medium text-success-700">Reseña creada correctamente. Redirigiendo…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-error-200 bg-error-50 p-4">
          <p className="text-sm text-error-700">{error}</p>
        </div>
      )}

      {/* Valoración */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Valoración <span className="text-error-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none"
                aria-label={`${star} estrella${star !== 1 ? 's' : ''}`}
              >
                <svg
                  className={`w-8 h-8 transition-colors ${
                    star <= displayRating ? 'text-secondary-500' : 'text-gray-200'
                  } hover:text-secondary-400`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
          </div>
          <span className="text-sm text-foreground-secondary">{RATING_LABELS[displayRating]}</span>
        </div>
      </div>

      {/* Nombre del reseñador */}
      <div>
        <label htmlFor="reviewer_name" className="block text-sm font-medium text-foreground mb-1.5">
          Nombre del huésped
        </label>
        <input
          id="reviewer_name"
          name="reviewer_name"
          type="text"
          placeholder="Ej: María García"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="reviewer_email" className="block text-sm font-medium text-foreground mb-1.5">
          Email <span className="text-foreground-muted font-normal">(opcional)</span>
        </label>
        <input
          id="reviewer_email"
          name="reviewer_email"
          type="email"
          placeholder="huesped@ejemplo.com"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
      </div>

      {/* País */}
      <div>
        <label htmlFor="reviewer_country" className="block text-sm font-medium text-foreground mb-1.5">
          País <span className="text-foreground-muted font-normal">(opcional)</span>
        </label>
        <input
          id="reviewer_country"
          name="reviewer_country"
          type="text"
          placeholder="España"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
      </div>

      {/* Título */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1.5">
          Título <span className="text-foreground-muted font-normal">(opcional)</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          placeholder="Resumen breve de la experiencia"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
      </div>

      {/* Comentario */}
      <div>
        <label htmlFor="comment" className="block text-sm font-medium text-foreground mb-1.5">
          Comentario
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={4}
          placeholder="Describe la experiencia del huésped…"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
        />
      </div>

      {/* Estado */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Estado</label>
        <div className="flex gap-4">
          {(['published', 'hidden'] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value={s}
                defaultChecked={s === 'published'}
                className="accent-primary-500"
              />
              <span className="text-sm text-foreground capitalize">
                {s === 'published' ? 'Publicada' : 'Oculta'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Destacada */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="hidden"
            name="featured"
            value="false"
          />
          <input
            type="checkbox"
            name="featured"
            value="true"
            className="w-4 h-4 rounded accent-primary-500"
          />
          <span className="text-sm font-medium text-foreground">Marcar como destacada</span>
        </label>
        <p className="mt-1 text-xs text-foreground-muted pl-7">
          Las reseñas destacadas aparecen primero en el widget público.
        </p>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Guardando…' : 'Crear reseña'}
        </button>
        <a
          href="/dashboard/reviews"
          className="text-sm font-medium text-foreground-secondary hover:text-foreground transition-colors"
        >
          Cancelar
        </a>
      </div>
    </form>
  )
}
