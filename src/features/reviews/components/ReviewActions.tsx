'use client'

import { useTransition } from 'react'
import { updateReview, deleteReview } from '@/actions/reviews'
import type { ReviewStatus } from '@/types/hotelero'

interface ReviewActionsProps {
  reviewId: string
  currentStatus: ReviewStatus
  currentFeatured: boolean
  reviewerName: string | null
}

export function ReviewActions({
  reviewId,
  currentStatus,
  currentFeatured,
  reviewerName,
}: ReviewActionsProps) {
  const [isPendingStatus, startStatus] = useTransition()
  const [isPendingFeatured, startFeatured] = useTransition()
  const [isPendingDelete, startDelete] = useTransition()

  const isPending = isPendingStatus || isPendingFeatured || isPendingDelete

  const handleToggleStatus = () => {
    startStatus(async () => {
      const newStatus: ReviewStatus = currentStatus === 'published' ? 'hidden' : 'published'
      const result = await updateReview(reviewId, { status: newStatus })
      if (result.error) {
        window.alert(`Error: ${result.error}`)
      }
    })
  }

  const handleToggleFeatured = () => {
    startFeatured(async () => {
      const result = await updateReview(reviewId, { featured: !currentFeatured })
      if (result.error) {
        window.alert(`Error: ${result.error}`)
      }
    })
  }

  const handleDelete = () => {
    const name = reviewerName ? `"${reviewerName}"` : 'esta reseña'
    if (!window.confirm(`¿Eliminar la reseña de ${name}? Esta acción no se puede deshacer.`)) return

    startDelete(async () => {
      const result = await deleteReview(reviewId)
      if (result.error) {
        window.alert(`Error: ${result.error}`)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {/* Toggle Publicar/Ocultar */}
      <button
        onClick={handleToggleStatus}
        disabled={isPending}
        title={currentStatus === 'published' ? 'Ocultar reseña' : 'Publicar reseña'}
        className={`
          text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors
          disabled:opacity-40 disabled:cursor-not-allowed
          ${currentStatus === 'published'
            ? 'border-warning-200 text-warning-700 bg-warning-50 hover:bg-warning-100'
            : 'border-success-200 text-success-700 bg-success-50 hover:bg-success-100'
          }
        `}
      >
        {isPendingStatus
          ? '...'
          : currentStatus === 'published'
          ? 'Ocultar'
          : 'Publicar'}
      </button>

      {/* Toggle Destacado */}
      <button
        onClick={handleToggleFeatured}
        disabled={isPending}
        title={currentFeatured ? 'Quitar destacado' : 'Destacar reseña'}
        className={`
          text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors
          disabled:opacity-40 disabled:cursor-not-allowed
          ${currentFeatured
            ? 'border-secondary-300 text-secondary-700 bg-secondary-50 hover:bg-secondary-100'
            : 'border-border text-foreground-secondary bg-white hover:bg-surface'
          }
        `}
      >
        {isPendingFeatured ? '...' : currentFeatured ? '★ Quitar' : '☆ Destacar'}
      </button>

      {/* Eliminar */}
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs font-medium text-error-600 hover:text-error-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPendingDelete ? 'Eliminando…' : 'Eliminar'}
      </button>
    </div>
  )
}
