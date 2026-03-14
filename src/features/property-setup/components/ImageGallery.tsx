'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { uploadImage, deleteImage, setHeroImage } from '@/actions/property-images'
import type { PropertyImage } from '@/types/hotelero'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageGalleryProps {
  initialImages: Array<{
    id: string
    url: string
    alt_text_es: string | null
    entity_type: string
    entity_id: string | null
    is_hero: boolean
    sort_order: number
  }>
  propertyId: string
  canEdit: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImageGallery({ initialImages, propertyId: _propertyId, canEdit }: ImageGalleryProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Local state ──────────────────────────────────────────────────────────
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [heroingId, setHeroingId] = useState<string | null>(null)

  const [isUploading, startUploadTransition] = useTransition()
  const [isActing, startActTransition] = useTransition()

  // ─── Upload handler ───────────────────────────────────────────────────────

  function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return

    const file = files[0]
    const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

    if (file.size > MAX_SIZE_BYTES) {
      setUploadError('El archivo supera el limite de 5 MB.')
      return
    }

    if (!file.type.startsWith('image/')) {
      setUploadError('Solo se permiten archivos de imagen (JPEG, PNG, WebP).')
      return
    }

    setUploadError(null)

    const formData = new FormData()
    formData.set('file', file)
    formData.set('entity_type', 'property')

    startUploadTransition(async () => {
      const result = await uploadImage(formData)
      if (result.error) {
        setUploadError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFileSelect(e.target.files)
    // Reset the input so the same file can be re-selected after deletion
    e.target.value = ''
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  // ─── Delete handler ───────────────────────────────────────────────────────

  function handleDelete(imageId: string) {
    const confirmed = window.confirm('¿Eliminar esta imagen? Esta accion no se puede deshacer.')
    if (!confirmed) return

    setActionError(null)
    setDeletingId(imageId)

    startActTransition(async () => {
      const result = await deleteImage(imageId)
      setDeletingId(null)
      if (result.error) {
        setActionError(result.error)
        return
      }
      router.refresh()
    })
  }

  // ─── Set hero handler ─────────────────────────────────────────────────────

  function handleSetHero(image: ImageGalleryProps['initialImages'][number]) {
    setActionError(null)
    setHeroingId(image.id)

    startActTransition(async () => {
      const result = await setHeroImage(
        image.id,
        image.entity_type as 'property' | 'room_type' | 'service',
        image.entity_id,
      )
      setHeroingId(null)
      if (result.error) {
        setActionError(result.error)
        return
      }
      router.refresh()
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Section 1: Upload Zone ─────────────────────────────────────────── */}
      {canEdit && (
        <section aria-label="Subir imagen">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Seleccionar imagen para subir"
            onChange={handleInputChange}
          />

          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Zona de carga de imagenes. Haz clic o arrastra una imagen aqui."
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={[
              'flex flex-col items-center justify-center gap-3',
              'min-h-[160px] rounded-2xl border-2 border-dashed',
              'transition-colors duration-200 cursor-pointer select-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
              isDragOver
                ? 'border-primary-500 bg-primary-50'
                : 'border-border bg-white hover:border-primary-400 hover:bg-gray-50',
              isUploading ? 'pointer-events-none opacity-60' : '',
            ].join(' ')}
          >
            {isUploading ? (
              <>
                <Spinner className="w-8 h-8 text-primary-500" />
                <p className="text-sm font-medium text-foreground-secondary">
                  Subiendo imagen...
                </p>
              </>
            ) : (
              <>
                <UploadIcon className="w-9 h-9 text-foreground-muted" />
                <div className="text-center px-4">
                  <p className="text-sm font-medium text-foreground">
                    Arrastra una imagen o{' '}
                    <span className="text-primary-600 underline underline-offset-2">
                      haz clic para explorar
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    JPEG, PNG o WebP &middot; Maximo 5 MB por imagen
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Upload error */}
          {uploadError && (
            <p
              role="alert"
              aria-live="assertive"
              className="mt-2 text-sm text-error-600"
            >
              {uploadError}
            </p>
          )}
        </section>
      )}

      {/* ── Action error ──────────────────────────────────────────────────── */}
      {actionError && (
        <div
          role="alert"
          aria-live="assertive"
          className="px-4 py-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700"
        >
          {actionError}
        </div>
      )}

      {/* ── Section 2: Image Grid ──────────────────────────────────────────── */}
      <section aria-label="Imagenes del hotel">
        {initialImages.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-2xl border border-border p-10 text-center">
            <PhotoIcon className="w-10 h-10 text-foreground-muted mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">
              No hay fotos todavia
            </p>
            <p className="text-sm text-foreground-secondary">
              {canEdit
                ? 'Sube la primera imagen de tu hotel usando la zona de arriba.'
                : 'No hay fotos. Contacta al administrador para agregar imagenes.'}
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            role="list"
            aria-label="Lista de imagenes"
          >
            {initialImages.map((image) => {
              const isDeleting = deletingId === image.id
              const isHeroing = heroingId === image.id
              const isBusy = isActing && (isDeleting || isHeroing)

              return (
                <div
                  key={image.id}
                  role="listitem"
                  className={[
                    'group relative rounded-xl overflow-hidden bg-gray-100',
                    'border border-border',
                    isBusy ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  {/* Image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.alt_text_es ?? 'Imagen del hotel'}
                    className="w-full aspect-[4/3] object-cover"
                    loading="lazy"
                  />

                  {/* Hero badge */}
                  {image.is_hero && (
                    <div
                      className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 text-xs font-semibold shadow-sm"
                      aria-label="Imagen principal"
                    >
                      <StarIcon className="w-3 h-3" />
                      <span>Principal</span>
                    </div>
                  )}

                  {/* Busy overlay spinner */}
                  {isBusy && (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-white/60"
                      aria-hidden="true"
                    >
                      <Spinner className="w-6 h-6 text-primary-500" />
                    </div>
                  )}

                  {/* Action buttons — visible on hover (or always on touch) */}
                  {canEdit && !isBusy && (
                    <div
                      className={[
                        'absolute inset-0 flex flex-col items-end justify-end gap-1.5 p-2',
                        'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                        'transition-opacity duration-150',
                        'bg-gradient-to-t from-black/50 via-transparent to-transparent',
                      ].join(' ')}
                    >
                      {/* Set as hero */}
                      {!image.is_hero && (
                        <button
                          type="button"
                          onClick={() => handleSetHero(image)}
                          disabled={isActing}
                          aria-label={`Hacer principal: ${image.alt_text_es ?? 'imagen'}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-gray-800 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <StarIcon className="w-3 h-3" />
                          Hacer principal
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDelete(image.id)}
                        disabled={isActing}
                        aria-label={`Eliminar imagen: ${image.alt_text_es ?? 'imagen'}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-error-500 hover:bg-error-600 text-white text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <TrashIcon className="w-3 h-3" />
                        Eliminar
                      </button>
                    </div>
                  )}

                  {/* Alt text caption */}
                  {image.alt_text_es && (
                    <p className="px-2 py-1.5 text-xs text-foreground-secondary truncate bg-white border-t border-border">
                      {image.alt_text_es}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ''}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
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
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" />
      <polyline points="16 12 12 8 8 12" />
      <line x1="12" y1="8" x2="12" y2="20" />
    </svg>
  )
}

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
