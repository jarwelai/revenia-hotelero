'use client'

import { useState } from 'react'
import { deleteSecrets } from '@/actions/system-config'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  open: boolean
  onClose: () => void
  onDeleted: () => void
  configTitle: string
  keys: string[]
}

const CONFIRM_WORD = 'ELIMINAR'

// ─── Component ─────────────────────────────────────────────────────────────────

export function DeleteConfirmDialog({
  open,
  onClose,
  onDeleted,
  configTitle,
  keys,
}: DeleteConfirmDialogProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setStep(1)
    setConfirmText('')
    setError(null)
    onClose()
  }

  function handleFirstConfirm() {
    setStep(2)
  }

  async function handleFinalDelete() {
    if (confirmText !== CONFIRM_WORD) return
    setError(null)
    setDeleting(true)

    try {
      const result = await deleteSecrets(keys)
      if (result.error) {
        setError(result.error)
        setDeleting(false)
        return
      }

      onDeleted()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      setDeleting(false)
    }
  }

  if (!open) return null

  const canDelete = confirmText === CONFIRM_WORD

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h2 id="delete-dialog-title" className="text-base font-semibold text-gray-900">
                Eliminar {configTitle}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {step === 1
                  ? 'Esta accion no se puede deshacer.'
                  : 'Confirma para eliminar definitivamente.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-4 space-y-4">

          {step === 1 ? (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700">
                Se eliminaran las siguientes claves de la base de datos:
              </p>
              <ul className="mt-2 space-y-1">
                {keys.map(key => (
                  <li key={key} className="flex items-center gap-2 text-sm font-mono text-red-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" aria-hidden="true" />
                    {key}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-red-500 mt-2">
                Nota: Solo se eliminan los secretos guardados en la base de datos, no las variables de entorno del servidor.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <p className="text-sm text-amber-700">
                  Si los servicios dependen de estas claves dejaran de funcionar hasta que las vuelvas a configurar.
                </p>
              </div>
              <div>
                <label htmlFor="confirm-input" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Escribe{' '}
                  <span className="font-mono font-bold text-gray-900">{CONFIRM_WORD}</span>{' '}
                  para confirmar
                </label>
                <input
                  id="confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>

          {step === 1 ? (
            <button
              type="button"
              onClick={handleFirstConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Si, eliminar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalDelete}
              disabled={!canDelete || deleting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deleting && (
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              )}
              {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
