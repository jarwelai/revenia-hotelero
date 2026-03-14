'use client'

import { useState, useTransition } from 'react'
import { fetchDiscoveredReviews, importSelectedReviews } from '@/actions/review-sources'
import type { DiscoveredReview } from '@/lib/serpapi/types'

// ─── i18n dict (Spanish primary; English equivalents in comments) ─────────────
const T = {
  fetchBtn: 'Buscar nuevas resenas',     // Search new reviews
  fetching: 'Buscando…',                // Searching…
  importing: 'Importando…',             // Importing…
  importBtn: (n: number) => `Importar ${n} seleccionada${n !== 1 ? 's' : ''}`, // Import N selected
  selectAll: 'Seleccionar todas',        // Select all
  deselectAll: 'Deseleccionar todas',    // Deselect all
  alreadyImported: 'Ya importada',       // Already imported
  noNew: 'No hay resenas nuevas para importar.', // No new reviews to import
  noResults: 'Haz clic en "Buscar nuevas resenas" para cargar resenas externas.', // click to load
  importResult: (imp: number, skip: number) =>
    `${imp} importada${imp !== 1 ? 's' : ''}, ${skip} omitida${skip !== 1 ? 's' : ''}.`, // N imported, M skipped
  errorPrefix: 'Error:',                 // Error:
  anonymous: 'Anonimo',                  // Anonymous
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? 'text-secondary-500' : 'text-gray-200'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
}

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return isoDate
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  propertyId: string
  source: 'google' | 'tripadvisor'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewDiscoveryList({ propertyId, source }: Props) {
  const [reviews, setReviews] = useState<DiscoveredReview[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hasLoaded, setHasLoaded] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const [isPendingFetch, startFetch] = useTransition()
  const [isPendingImport, startImport] = useTransition()

  const isPending = isPendingFetch || isPendingImport

  // Selectable (not already imported)
  const selectableUids = reviews
    .filter((r) => !r.already_imported)
    .map((r) => r.external_uid)

  const allSelected =
    selectableUids.length > 0 && selectableUids.every((uid) => selected.has(uid))

  const handleFetch = () => {
    setFetchError(null)
    setImportResult(null)
    setImportError(null)
    setSelected(new Set())

    startFetch(async () => {
      try {
        const res = await fetchDiscoveredReviews(propertyId, source)
        if (res.error) {
          setFetchError(res.error)
          return
        }
        setReviews(res.reviews ?? [])
        setHasLoaded(true)
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const handleToggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableUids))
    }
  }

  const handleToggleOne = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) {
        next.delete(uid)
      } else {
        next.add(uid)
      }
      return next
    })
  }

  const handleImport = () => {
    if (selected.size === 0) return
    setImportResult(null)
    setImportError(null)

    const toImport = reviews.filter((r) => selected.has(r.external_uid))

    startImport(async () => {
      try {
        const res = await importSelectedReviews(propertyId, toImport)
        if (res.error) {
          setImportError(res.error)
          return
        }
        setImportResult(T.importResult(res.imported, res.skipped))
        // Mark imported reviews as already_imported
        setReviews((prev) =>
          prev.map((r) =>
            selected.has(r.external_uid) ? { ...r, already_imported: true } : r,
          ),
        )
        setSelected(new Set())
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const newCount = reviews.filter((r) => !r.already_imported).length

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleFetch}
          disabled={isPending}
          className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPendingFetch ? T.fetching : T.fetchBtn}
        </button>

        {hasLoaded && selectableUids.length > 0 && (
          <button
            onClick={handleToggleAll}
            disabled={isPending}
            className="px-3 py-2 text-sm font-medium text-foreground-secondary border border-border rounded-xl hover:bg-surface disabled:opacity-50 transition-colors"
          >
            {allSelected ? T.deselectAll : T.selectAll}
          </button>
        )}

        {selected.size > 0 && (
          <button
            onClick={handleImport}
            disabled={isPending}
            className="px-4 py-2 bg-success-600 text-white text-sm font-medium rounded-xl hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPendingImport ? T.importing : T.importBtn(selected.size)}
          </button>
        )}
      </div>

      {/* Fetch error */}
      {fetchError && (
        <p className="text-sm text-error-600">
          {T.errorPrefix} {fetchError}
        </p>
      )}

      {/* Import feedback */}
      {importResult && (
        <div className="rounded-xl border border-success-200 bg-success-50 p-3">
          <p className="text-sm text-success-700">{importResult}</p>
        </div>
      )}
      {importError && (
        <div className="rounded-xl border border-error-200 bg-error-50 p-3">
          <p className="text-sm text-error-700">
            {T.errorPrefix} {importError}
          </p>
        </div>
      )}

      {/* List */}
      {hasLoaded && reviews.length === 0 && (
        <p className="text-sm text-foreground-muted">{T.noNew}</p>
      )}

      {!hasLoaded && !fetchError && (
        <p className="text-sm text-foreground-muted">{T.noResults}</p>
      )}

      {reviews.length > 0 && (
        <div className="space-y-1">
          {/* Header row */}
          {newCount > 0 && (
            <p className="text-xs text-foreground-muted mb-2">
              {newCount} nueva{newCount !== 1 ? 's' : ''} · {reviews.length - newCount} ya importada{reviews.length - newCount !== 1 ? 's' : ''}
            </p>
          )}

          <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {reviews.map((review) => {
              const isSelected = selected.has(review.external_uid)
              const isImported = review.already_imported

              return (
                <li
                  key={review.external_uid}
                  className={`flex items-start gap-3 p-3 transition-colors ${
                    isImported
                      ? 'bg-surface opacity-60 cursor-default'
                      : isSelected
                      ? 'bg-primary-50'
                      : 'bg-white hover:bg-surface cursor-pointer'
                  }`}
                  onClick={() => !isImported && handleToggleOne(review.external_uid)}
                >
                  {/* Checkbox */}
                  <div className="pt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={isImported || isSelected}
                      disabled={isImported || isPending}
                      onChange={() => !isImported && handleToggleOne(review.external_uid)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 accent-primary-500 disabled:opacity-50"
                      aria-label={`Seleccionar resena de ${review.reviewer_name ?? T.anonymous}`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StarRow rating={review.rating} />
                      <span className="text-xs font-medium text-foreground">
                        {review.reviewer_name ?? T.anonymous}
                      </span>
                      <span className="text-xs text-foreground-muted">
                        {formatDate(review.reviewed_at)}
                      </span>
                      {isImported && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                          {T.alreadyImported}
                        </span>
                      )}
                    </div>

                    {review.title && (
                      <p className="text-xs font-medium text-foreground">{review.title}</p>
                    )}

                    {review.comment && (
                      <p className="text-xs text-foreground-secondary line-clamp-2">
                        {review.comment}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
