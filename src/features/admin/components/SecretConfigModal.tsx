'use client'

import { useState } from 'react'
import { upsertSecret, upsertSecrets } from '@/actions/system-config'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ConfigField {
  key: string
  label: string
  placeholder: string
  type: 'text' | 'password'
  helpText?: string
}

export interface ConfigDefinition {
  id: string
  title: string
  description: string
  fields: ConfigField[]
  instructions: string
  keys: string[]
}

interface SecretConfigModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  config: ConfigDefinition
  mode: 'create' | 'edit'
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SecretConfigModal({ open, onClose, onSaved, config, mode }: SecretConfigModalProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.fields.map(f => [f.key, '']))
  )
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFieldChange(key: string, value: string) {
    setFieldValues(prev => ({ ...prev, [key]: value }))
    setError(null)
  }

  function toggleShowPassword(key: string) {
    setShowPassword(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    setError(null)
    setSaving(true)

    try {
      let result: { error?: string }

      if (config.fields.length === 1) {
        const field = config.fields[0]
        const value = fieldValues[field.key] ?? ''
        if (!value.trim()) {
          setError('El campo es requerido')
          setSaving(false)
          return
        }
        result = await upsertSecret(field.key, value)
      } else {
        const secrets = config.fields.map(f => ({
          key: f.key,
          value: fieldValues[f.key] ?? '',
        }))
        const empty = secrets.find(s => !s.value.trim())
        if (empty) {
          setError('Todos los campos son requeridos')
          setSaving(false)
          return
        }
        result = await upsertSecrets(secrets)
      }

      if (result.error) {
        setError(result.error)
        setSaving(false)
        return
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      setSaving(false)
    }
  }

  function handleClose() {
    setFieldValues(Object.fromEntries(config.fields.map(f => [f.key, ''])))
    setShowPassword({})
    setError(null)
    onClose()
  }

  if (!open) return null

  const instructionLines = config.instructions.split('\n').filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="secret-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 id="secret-modal-title" className="text-lg font-semibold text-gray-900">
              {mode === 'create' ? 'Configurar' : 'Editar'} {config.title}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{config.description}</p>
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

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* Instructions */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">
              Instrucciones
            </p>
            <ol className="space-y-1.5">
              {instructionLines.map((line, i) => {
                const text = line.replace(/^\d+\.\s*/, '')
                return (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 text-[11px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-indigo-800">{text}</span>
                  </li>
                )
              })}
            </ol>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            {config.fields.map(field => {
              const isPasswordVisible = showPassword[field.key]
              const inputType = field.type === 'password' && !isPasswordVisible ? 'password' : 'text'

              return (
                <div key={field.key}>
                  <label
                    htmlFor={`field-${field.key}`}
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      id={`field-${field.key}`}
                      type={inputType}
                      value={fieldValues[field.key] ?? ''}
                      onChange={e => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      autoComplete="off"
                      spellCheck={false}
                      className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                        field.type === 'password' ? 'pr-10' : ''
                      } border-gray-300`}
                    />
                    {field.type === 'password' && (
                      <button
                        type="button"
                        onClick={() => toggleShowPassword(field.key)}
                        aria-label={isPasswordVisible ? 'Ocultar valor' : 'Mostrar valor'}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {isPasswordVisible ? (
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path
                              fillRule="evenodd"
                              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path
                              fillRule="evenodd"
                              d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                              clipRule="evenodd"
                            />
                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {field.helpText && (
                    <p className="mt-1.5 text-xs text-gray-500">{field.helpText}</p>
                  )}
                </div>
              )
            })}
          </div>

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
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving && (
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
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
