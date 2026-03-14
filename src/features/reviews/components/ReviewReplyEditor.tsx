'use client'

import { useState, useTransition } from 'react'
import { generateAiReviewResponse } from '@/actions/reviews'
import { saveReviewReply } from '@/actions/reviews'
import { publishReplyToGoogle } from '@/actions/reviews'
import type { ReviewSource } from '@/types/hotelero'

interface ReviewReplyEditorProps {
  reviewId: string
  source: ReviewSource
  existingReply: string | null
  replySyncedToSource: boolean
  replySyncError: string | null
  hasGoogleConnection: boolean
  aiEnabled: boolean
}

// ─── Sync status indicator ────────────────────────────────────────────────────

function ReplySyncStatus({
  synced,
  error,
}: {
  synced: boolean
  error: string | null
}) {
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 p-3">
        <svg
          className="w-4 h-4 text-error-500 shrink-0 mt-0.5"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-xs text-error-700">{error}</p>
      </div>
    )
  }

  if (synced) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 p-3">
        <svg
          className="w-4 h-4 text-success-500 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-xs font-medium text-success-700">Sincronizado con Google</p>
      </div>
    )
  }

  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReviewReplyEditor({
  reviewId,
  source,
  existingReply,
  replySyncedToSource,
  replySyncError,
  hasGoogleConnection,
  aiEnabled,
}: ReviewReplyEditorProps) {
  const [replyText, setReplyText] = useState(existingReply ?? '')
  const [synced, setSynced] = useState(replySyncedToSource)
  const [syncError, setSyncError] = useState<string | null>(replySyncError)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  const [isPendingAi, startAi] = useTransition()
  const [isPendingSave, startSave] = useTransition()
  const [isPendingPublish, startPublish] = useTransition()

  const isPending = isPendingAi || isPendingSave || isPendingPublish

  // A saved reply exists if existingReply or the user has just saved one
  const hasSavedReply = Boolean(existingReply || saveSuccess)
  const canPublishToGoogle =
    source === 'google' && hasGoogleConnection && hasSavedReply

  const handleGenerateAi = () => {
    setSaveError(null)
    setSaveSuccess(false)
    startAi(async () => {
      try {
        const result = await generateAiReviewResponse(reviewId)
        if (result.error) {
          setSaveError(result.error)
          return
        }
        if (result.text) {
          setReplyText(result.text)
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const handleSave = () => {
    setSaveError(null)
    setSaveSuccess(false)
    startSave(async () => {
      try {
        const result = await saveReviewReply(reviewId, replyText)
        if (result.error) {
          setSaveError(result.error)
          return
        }
        setSaveSuccess(true)
        // Reset sync state after a new save (reply changed, may need re-publish)
        setSynced(false)
        setSyncError(null)
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const handlePublish = () => {
    setPublishError(null)
    setPublishSuccess(false)
    startPublish(async () => {
      try {
        const result = await publishReplyToGoogle(reviewId)
        if (result.error) {
          setPublishError(result.error)
          setSyncError(result.error)
          setSynced(false)
          return
        }
        setPublishSuccess(true)
        setSynced(true)
        setSyncError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        setPublishError(message)
        setSyncError(message)
        setSynced(false)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Textarea */}
      <div>
        <label
          htmlFor={`reply-${reviewId}`}
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          Respuesta
        </label>
        <textarea
          id={`reply-${reviewId}`}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          rows={5}
          disabled={isPending}
          placeholder="Escribe una respuesta para este huesped…"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          aria-label="Texto de respuesta a la resena"
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* AI generate button — only when aiEnabled */}
        {aiEnabled && (
          <button
            onClick={handleGenerateAi}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-foreground border border-border rounded-xl bg-white hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Generar borrador de respuesta con IA"
          >
            {isPendingAi ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Generando…
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
                Generar borrador IA
              </>
            )}
          </button>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isPending || !replyText.trim()}
          className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Guardar respuesta"
        >
          {isPendingSave ? 'Guardando…' : 'Guardar respuesta'}
        </button>

        {/* Publish to Google button */}
        {canPublishToGoogle && (
          <button
            onClick={handlePublish}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#4285F4] hover:bg-[#3367D6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4285F4] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Publicar respuesta en Google"
          >
            {isPendingPublish ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Publicando…
              </>
            ) : (
              'Publicar en Google'
            )}
          </button>
        )}
      </div>

      {/* Save feedback */}
      {saveSuccess && !saveError && (
        <div className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 p-3">
          <svg
            className="w-4 h-4 text-success-500 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs font-medium text-success-700">Respuesta guardada correctamente.</p>
        </div>
      )}

      {saveError && (
        <div className="rounded-xl border border-error-200 bg-error-50 p-3">
          <p className="text-xs text-error-700">{saveError}</p>
        </div>
      )}

      {/* Publish feedback */}
      {publishSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 p-3">
          <svg
            className="w-4 h-4 text-success-500 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs font-medium text-success-700">Respuesta publicada en Google.</p>
        </div>
      )}

      {publishError && !publishSuccess && (
        <div className="rounded-xl border border-error-200 bg-error-50 p-3">
          <p className="text-xs text-error-700">{publishError}</p>
        </div>
      )}

      {/* Sync status (from server-persisted state) */}
      {!publishSuccess && !publishError && (
        <ReplySyncStatus synced={synced} error={syncError} />
      )}
    </div>
  )
}
