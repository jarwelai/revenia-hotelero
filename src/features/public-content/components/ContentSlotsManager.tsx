'use client'

import { useState, useTransition } from 'react'
import { upsertContentSlot, approveContentSlot, initDefaultContentSlots } from '@/actions/public-content'
import { generatePublicCopy, translatePublicCopy } from '@/actions/public-ai'
import type { PublicContentSlot, PublicContentTranslation, PublicLang } from '@/types/hotelero'

interface ContentSlotsManagerProps {
  propertyId: string
  initialSlots: PublicContentSlot[]
  canEdit: boolean
}

const LANG_LABELS: Record<PublicLang, string> = { es: 'Español', en: 'English' }
const LANGS: PublicLang[] = ['es', 'en']

export function ContentSlotsManager({ propertyId, initialSlots, canEdit }: ContentSlotsManagerProps) {
  const [slots, setSlots] = useState<PublicContentSlot[]>(initialSlots)
  const [editTexts, setEditTexts] = useState<Record<string, Record<PublicLang, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [successKey, setSuccessKey] = useState<string | null>(null)
  const [aiPendingKey, setAiPendingKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function getEditText(slotId: string, lang: PublicLang, fallback: string): string {
    return editTexts[slotId]?.[lang] ?? fallback
  }

  function setEditText(slotId: string, lang: PublicLang, text: string) {
    setEditTexts((prev) => ({
      ...prev,
      [slotId]: { ...(prev[slotId] ?? {}), [lang]: text },
    }))
  }

  function getTranslation(slot: PublicContentSlot, lang: PublicLang): PublicContentTranslation | undefined {
    return slot.translations?.find((t) => t.lang === lang)
  }

  function upsertTranslationInSlots(
    slotId: string,
    lang: PublicLang,
    text: string,
    status: 'draft' | 'approved',
  ) {
    setSlots((prev) => prev.map((s) => {
      if (s.id !== slotId) return s
      const existing = s.translations?.find((t) => t.lang === lang)
      const updatedTranslations = existing
        ? s.translations!.map((t) =>
            t.lang === lang
              ? { ...t, text, status, approved_at: status === 'approved' ? new Date().toISOString() : null, approved_by: null }
              : t,
          )
        : [...(s.translations ?? []), {
            id: crypto.randomUUID(),
            slot_id: s.id,
            lang,
            text,
            status,
            approved_at: null,
            approved_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]
      return { ...s, translations: updatedTranslations }
    }))
  }

  function handleSave(slot: PublicContentSlot, lang: PublicLang) {
    const text = getEditText(slot.id, lang, getTranslation(slot, lang)?.text ?? '')
    setError(null)
    setSuccessKey(null)

    startTransition(async () => {
      const result = await upsertContentSlot(propertyId, slot.key, lang, text)
      if (result.error) { setError(result.error); return }

      upsertTranslationInSlots(slot.id, lang, text, 'draft')
      setSuccessKey(`save-${slot.id}-${lang}`)
    })
  }

  function handleApprove(slot: PublicContentSlot, lang: PublicLang) {
    setError(null)
    setSuccessKey(null)

    startTransition(async () => {
      const result = await approveContentSlot(slot.id, lang)
      if (result.error) { setError(result.error); return }

      const now = new Date().toISOString()
      setSlots((prev) => prev.map((s) => {
        if (s.id !== slot.id) return s
        const updatedTranslations = s.translations?.map((t) =>
          t.lang === lang ? { ...t, status: 'approved' as const, approved_at: now } : t,
        ) ?? []
        return { ...s, translations: updatedTranslations }
      }))
      setSuccessKey(`approve-${slot.id}-${lang}`)
    })
  }

  function handleGenerateAI(slot: PublicContentSlot, lang: PublicLang) {
    const opKey = `gen-${slot.id}-${lang}`
    setAiPendingKey(opKey)
    setError(null)
    setSuccessKey(null)

    startTransition(async () => {
      const result = await generatePublicCopy(propertyId, slot.key, lang)
      setAiPendingKey(null)

      if (result.error) { setError(result.error); return }
      if (!result.text) return

      setEditText(slot.id, lang, result.text)
      upsertTranslationInSlots(slot.id, lang, result.text, 'draft')
      setSuccessKey(`gen-${slot.id}-${lang}`)
    })
  }

  function handleTranslateToEn(slot: PublicContentSlot) {
    const opKey = `translate-${slot.id}`
    setAiPendingKey(opKey)
    setError(null)
    setSuccessKey(null)

    startTransition(async () => {
      const result = await translatePublicCopy(slot.id, 'es', 'en')
      setAiPendingKey(null)

      if (result.error) { setError(result.error); return }
      if (!result.text) return

      setEditText(slot.id, 'en', result.text)
      upsertTranslationInSlots(slot.id, 'en', result.text, 'draft')
      setSuccessKey(`translate-${slot.id}`)
    })
  }

  function handleInit() {
    setError(null)
    startTransition(async () => {
      const result = await initDefaultContentSlots(propertyId)
      if (result.error) { setError(result.error); return }
      window.location.reload()
    })
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-foreground-secondary mb-4">
          No hay contenido configurado para esta propiedad.
        </p>
        {canEdit && (
          <button
            onClick={handleInit}
            disabled={isPending}
            className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Creando...' : 'Inicializar contenido por defecto'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {slots.map((slot) => {
        const esApproved = getTranslation(slot, 'es')?.status === 'approved'
        const enTran = getTranslation(slot, 'en')
        const enApproved = enTran?.status === 'approved'
        const showTranslateBtn = canEdit && esApproved && !enApproved

        return (
          <div key={slot.id} className="p-5 rounded-2xl bg-white border border-border shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <code className="text-xs bg-surface px-2 py-0.5 rounded font-mono text-foreground-muted">
                {slot.key}
              </code>
              {showTranslateBtn && (
                <button
                  onClick={() => handleTranslateToEn(slot)}
                  disabled={isPending || !!aiPendingKey}
                  className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {aiPendingKey === `translate-${slot.id}` ? 'Traduciendo...' : 'Traducir ES → EN'}
                </button>
              )}
              {successKey === `translate-${slot.id}` && (
                <span className="text-xs text-indigo-600">Traduccion EN creada como borrador</span>
              )}
            </div>

            <div className="space-y-4">
              {LANGS.map((lang) => {
                const tran = getTranslation(slot, lang)
                const currentText = getEditText(slot.id, lang, tran?.text ?? '')
                const isApproved = tran?.status === 'approved'
                const genKey = `gen-${slot.id}-${lang}`
                const approveFlashKey = `approve-${slot.id}-${lang}`
                const saveFlashKey = `save-${slot.id}-${lang}`

                return (
                  <div key={lang} className="border-l-2 border-border pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-foreground-muted">
                        {LANG_LABELS[lang]}
                      </span>
                      {tran && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isApproved
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isApproved ? 'Aprobado' : 'Borrador'}
                        </span>
                      )}
                      {successKey === approveFlashKey && (
                        <span className="text-xs text-green-600">Aprobado</span>
                      )}
                      {successKey === genKey && (
                        <span className="text-xs text-purple-600">Generado — revisa y aprueba</span>
                      )}
                    </div>

                    {canEdit ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={currentText}
                          onChange={(e) => setEditText(slot.id, lang, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-border text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder={`Texto en ${LANG_LABELS[lang]}...`}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleSave(slot, lang)}
                            disabled={isPending || !currentText.trim()}
                            className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-foreground hover:bg-white disabled:opacity-50 transition-colors"
                          >
                            {isPending && successKey === null && aiPendingKey === null ? 'Guardando...' : 'Guardar'}
                          </button>

                          {tran && !isApproved && (
                            <button
                              onClick={() => handleApprove(slot, lang)}
                              disabled={isPending || !!aiPendingKey}
                              className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              Aprobar
                            </button>
                          )}

                          <button
                            onClick={() => handleGenerateAI(slot, lang)}
                            disabled={isPending || !!aiPendingKey || isApproved}
                            title={isApproved ? 'Ya existe texto aprobado' : 'Generar borrador con IA'}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                          >
                            {aiPendingKey === genKey ? 'Generando...' : 'Generar con IA'}
                          </button>

                          {successKey === saveFlashKey && (
                            <span className="text-xs text-primary-600">Guardado</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground-secondary">
                        {tran?.text ?? <span className="italic text-foreground-muted">Sin contenido</span>}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
