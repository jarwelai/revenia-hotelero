'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { togglePublishStatus, generatePropertySlug, updatePropertyProfile } from '@/actions/property-setup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublishPanelProps {
  propertyName: string
  slug: string | null
  isPublished: boolean
  publicKey: string
  checklistScore: number
  readyToPublish: boolean
  canEdit: boolean
}

// ─── Section card wrapper ────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl border border-border p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-foreground-secondary">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PublishPanel({
  propertyName,
  slug: initialSlug,
  isPublished: initialIsPublished,
  publicKey,
  checklistScore,
  readyToPublish,
  canEdit,
}: PublishPanelProps) {
  const router = useRouter()

  // ─── Local state ──────────────────────────────────────────────────────────
  const [isPublished, setIsPublished] = useState(initialIsPublished)
  const [slug, setSlug] = useState(initialSlug ?? '')
  const [copied, setCopied] = useState(false)

  // ─── Feedback state ───────────────────────────────────────────────────────
  const [publishError, setPublishError] = useState<string | null>(null)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugSuccess, setSlugSuccess] = useState(false)

  // ─── Transitions ──────────────────────────────────────────────────────────
  const [isTogglingPublish, startPublishTransition] = useTransition()
  const [isGeneratingSlug, startGenerateSlugTransition] = useTransition()
  const [isSavingSlug, startSaveSlugTransition] = useTransition()

  const scorePercent = Math.round(checklistScore * 100)

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleTogglePublish = () => {
    if (!canEdit) return
    setPublishError(null)

    startPublishTransition(async () => {
      const result = await togglePublishStatus()

      if (result.error) {
        setPublishError(result.error)
        return
      }

      setIsPublished(result.is_published ?? false)
      router.refresh()
    })
  }

  const handleGenerateSlug = () => {
    if (!canEdit) return
    setSlugError(null)

    startGenerateSlugTransition(async () => {
      const result = await generatePropertySlug(propertyName)

      if (result.error) {
        setSlugError(result.error)
        return
      }

      setSlug(result.slug ?? '')
    })
  }

  const handleSaveSlug = () => {
    if (!canEdit) return
    setSlugError(null)
    setSlugSuccess(false)

    startSaveSlugTransition(async () => {
      const formData = new FormData()
      formData.set('slug', slug.trim())

      const result = await updatePropertyProfile(formData)

      if (result.error) {
        setSlugError(result.error)
        return
      }

      setSlugSuccess(true)
      router.refresh()
    })
  }

  const handleCopyEmbed = async () => {
    const code = `<iframe src="https://revenia.ai/p/${publicKey}/book" width="100%" height="600" frameborder="0"></iframe>`
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for browsers that block clipboard access
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const embedCode = `<iframe src="https://revenia.ai/p/${publicKey}/book" width="100%" height="600" frameborder="0"></iframe>`
  const canPublish = readyToPublish || isPublished

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Section 1: Publishing Status ─────────────────────────────────── */}
      <SectionCard
        title="Estado de publicacion"
        description="Controla si tu hotel es visible para los huespedes."
      >
        {/* Status badge */}
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
              isPublished
                ? 'bg-success-50 text-success-700 border border-success-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
            aria-label={`Estado actual: ${isPublished ? 'Publicado' : 'Borrador'}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPublished ? 'bg-success-500' : 'bg-gray-400'
              }`}
              aria-hidden="true"
            />
            {isPublished ? 'Publicado' : 'Borrador'}
          </span>
        </div>

        {/* Readiness message */}
        {readyToPublish ? (
          <p className="text-sm text-success-700">
            {isPublished
              ? 'Tu hotel esta publicado y visible para los huespedes.'
              : 'Tu hotel esta listo para publicar.'}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-foreground-secondary">
              Completa al menos el 80% de la configuracion para publicar.
            </p>
            <div
              className="w-full bg-gray-100 rounded-full h-2"
              role="progressbar"
              aria-valuenow={scorePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progreso de configuracion: ${scorePercent}%`}
            >
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${scorePercent}%` }}
              />
            </div>
            <p className="text-xs text-foreground-muted">{scorePercent}% completado</p>
          </div>
        )}

        {/* Error feedback */}
        {publishError && (
          <div
            role="alert"
            aria-live="assertive"
            className="px-4 py-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700"
          >
            {publishError}
          </div>
        )}

        {/* Toggle button */}
        {canEdit && (
          <Button
            type="button"
            variant={isPublished ? 'outline' : 'primary'}
            size="md"
            onClick={handleTogglePublish}
            isLoading={isTogglingPublish}
            disabled={isTogglingPublish || (!canPublish && !isPublished)}
            className="w-full sm:w-auto"
            aria-label={isPublished ? 'Despublicar hotel' : 'Publicar hotel'}
          >
            {isPublished ? 'Despublicar' : 'Publicar hotel'}
          </Button>
        )}
      </SectionCard>

      {/* ── Section 2: Slug & URL ─────────────────────────────────────────── */}
      <SectionCard
        title="URL publica"
        description="El identificador unico de tu hotel en Revenia."
      >
        {/* Slug input row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              label="Slug del hotel"
              id="slug-input"
              placeholder="mi-hotel-paraiso"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugSuccess(false)
                setSlugError(null)
              }}
              disabled={!canEdit || isSavingSlug || isGeneratingSlug}
              hint="Solo letras minusculas, numeros y guiones."
            />
          </div>
          {canEdit && (
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={handleGenerateSlug}
                isLoading={isGeneratingSlug}
                disabled={isGeneratingSlug || isSavingSlug}
                aria-label="Generar slug automaticamente desde el nombre del hotel"
                className="whitespace-nowrap"
              >
                Generar slug
              </Button>
            </div>
          )}
        </div>

        {/* Preview URL */}
        <div className="rounded-xl bg-gray-50 border border-border px-4 py-3">
          <p className="text-xs text-foreground-muted mb-1">URL de tu hotel</p>
          {slug ? (
            <p className="text-sm font-mono text-foreground break-all">
              https://{slug}.revenia.ai
            </p>
          ) : (
            <p className="text-sm text-foreground-muted italic">
              Configura un slug primero
            </p>
          )}
        </div>

        {/* Slug feedback */}
        {slugError && (
          <div
            role="alert"
            aria-live="assertive"
            className="px-4 py-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700"
          >
            {slugError}
          </div>
        )}
        {slugSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="px-4 py-3 rounded-xl bg-success-50 border border-success-200 text-sm text-success-700"
          >
            Slug guardado correctamente.
          </div>
        )}

        {/* Save slug + booking link row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {canEdit && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleSaveSlug}
              isLoading={isSavingSlug}
              disabled={isSavingSlug || isGeneratingSlug || !slug.trim()}
              className="w-full sm:w-auto"
            >
              Guardar slug
            </Button>
          )}

          <Link
            href={`/p/${publicKey}/book`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:rounded"
            aria-label="Ver pagina de reservas (se abre en nueva pestana)"
          >
            Ver pagina de reservas
            <ExternalLinkIcon />
          </Link>
        </div>
      </SectionCard>

      {/* ── Section 3: Embed Code ─────────────────────────────────────────── */}
      <SectionCard
        title="Widget Embebible"
        description="Inserta el motor de reservas en tu sitio web."
      >
        {/* Code textarea */}
        <div className="relative">
          <label
            htmlFor="embed-code"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Codigo de integracion
          </label>
          <textarea
            id="embed-code"
            readOnly
            value={embedCode}
            rows={3}
            className="
              w-full px-4 py-3
              bg-gray-50 text-foreground
              border border-border rounded-xl
              font-mono text-xs
              resize-none
              focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent
              cursor-text select-all
            "
            aria-label="Codigo iframe para embeber el motor de reservas"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </div>

        {/* Copy button + feedback */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleCopyEmbed}
            leftIcon={<CopyIcon />}
            aria-label="Copiar codigo de integracion al portapapeles"
            className="w-full sm:w-auto"
          >
            Copiar codigo
          </Button>

          {copied && (
            <span
              role="status"
              aria-live="polite"
              className="text-sm text-success-700 font-medium"
            >
              Copiado
            </span>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Inline icons ─────────────────────────────────────────────────────────────

function ExternalLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}
