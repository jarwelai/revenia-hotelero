'use client'

import { useState, useTransition } from 'react'
import { savePublishRules } from '@/actions/review-rules'
import type { ReviewPublishRules, ReviewSource } from '@/types/hotelero'

// ─── i18n dict (Spanish primary; English equivalents in comments) ─────────────
const T = {
  title: 'Reglas de publicacion automatica',   // Auto-publish rules
  autoPublishLabel: 'Activar auto-publicacion', // Enable auto-publish
  autoPublishDesc: 'Las resenas nuevas que cumplan los criterios se publicaran automaticamente.', // Auto-publish matching reviews
  minRatingLabel: 'Rating minimo para publicar', // Minimum rating to publish
  sourcesLabel: 'Fuentes permitidas',            // Allowed sources
  saveBtn: 'Guardar reglas',                     // Save rules
  saving: 'Guardando…',                         // Saving…
  savedMsg: 'Reglas guardadas correctamente.',   // Rules saved successfully.
  errorPrefix: 'Error:',                         // Error:
} as const

// ─── Source labels ────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<ReviewSource, string> = {
  manual:      'Manual',
  internal:    'Interno',
  google:      'Google Maps',
  booking:     'Booking.com',
  airbnb:      'Airbnb',
  expedia:     'Expedia',
  facebook:    'Facebook',
  tripadvisor: 'TripAdvisor',
  other:       'Otro',
}

const ALL_SOURCES: ReviewSource[] = [
  'google',
  'tripadvisor',
  'manual',
  'internal',
  'booking',
  'airbnb',
  'expedia',
  'facebook',
  'other',
]

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  propertyId: string
  initialRules: ReviewPublishRules | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PublishRulesForm({ propertyId, initialRules }: Props) {
  const [enabled, setEnabled] = useState(initialRules?.auto_publish_enabled ?? false)
  const [minRating, setMinRating] = useState<number>(initialRules?.min_rating ?? 4)
  const [sources, setSources] = useState<Set<ReviewSource>>(
    new Set((initialRules?.auto_publish_sources ?? ['google', 'tripadvisor']) as ReviewSource[]),
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleToggleSource = (source: ReviewSource) => {
    setSources((prev) => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
    setSaved(false)
  }

  const handleSave = () => {
    setError(null)
    setSaved(false)

    startTransition(async () => {
      try {
        const res = await savePublishRules({
          propertyId,
          autoPublishEnabled: enabled,
          minRating,
          autoPublishSources: Array.from(sources),
        })
        if (res.error) {
          setError(res.error)
          return
        }
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-foreground">{T.title}</h2>

      {/* Auto-publish toggle */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => { setEnabled((v) => !v); setSaved(false) }}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 ${
            enabled ? 'bg-primary-500' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <div>
          <p className="text-sm font-medium text-foreground">{T.autoPublishLabel}</p>
          <p className="text-xs text-foreground-muted">{T.autoPublishDesc}</p>
        </div>
      </div>

      {/* Criteria (only relevant when enabled, but always editable) */}
      <div className={`space-y-5 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Min rating */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {T.minRatingLabel}
          </label>
          <div className="flex gap-2">
            {RATING_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setMinRating(r); setSaved(false) }}
                className={`w-9 h-9 rounded-lg text-sm font-medium border transition-colors ${
                  minRating === r
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white text-foreground-secondary border-border hover:bg-surface'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            Solo se publicaran resenas con {minRating} o mas estrellas.
            {/* Only reviews with {minRating}+ stars will be published. */}
          </p>
        </div>

        {/* Allowed sources */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">{T.sourcesLabel}</p>
          <div className="flex flex-wrap gap-2">
            {ALL_SOURCES.map((source) => {
              const isChecked = sources.has(source)
              return (
                <button
                  key={source}
                  type="button"
                  onClick={() => handleToggleSource(source)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    isChecked
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-foreground-secondary border-border hover:bg-surface'
                  }`}
                >
                  {SOURCE_LABELS[source]}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Feedback */}
      {saved && (
        <div className="rounded-xl border border-success-200 bg-success-50 p-3">
          <p className="text-sm text-success-700">{T.savedMsg}</p>
        </div>
      )}
      {error && (
        <p className="text-sm text-error-600">
          {T.errorPrefix} {error}
        </p>
      )}

      {/* Save button */}
      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="px-5 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? T.saving : T.saveBtn}
        </button>
      </div>
    </div>
  )
}
