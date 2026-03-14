'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addPropertyAmenity,
  removePropertyAmenity,
  toggleHighlighted,
} from '@/actions/property-amenities'
import { AMENITY_CATALOG } from '@/features/property-setup/constants/amenity-catalog'
import { SETUP_LABELS } from '@/features/property-setup/constants/setup-labels'
import type { AmenityCategory } from '@/types/hotelero'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AmenityItem {
  id: string
  category: string
  code: string
  name_es: string
  name_en: string
  is_highlighted: boolean
  sort_order: number
}

interface AmenityManagerProps {
  initialAmenities: AmenityItem[]
  canEdit: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS = SETUP_LABELS.amenityCategories

const CATEGORY_ORDER: AmenityCategory[] = [
  'general',
  'pool',
  'business',
  'wellness',
  'dining',
  'accessibility',
  'outdoor',
]

// ─── Star icon ────────────────────────────────────────────────────────────────

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

// ─── Check icon ───────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AmenityManager({ initialAmenities, canEdit }: AmenityManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeCategory, setActiveCategory] = useState<AmenityCategory>('general')
  const [actionError, setActionError] = useState<string | null>(null)
  // Track which amenity code is currently being toggled for granular loading state
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [pendingHighlightId, setPendingHighlightId] = useState<string | null>(null)

  // Build a Set of selected codes for O(1) lookup
  const selectedCodes = new Set(initialAmenities.map((a) => a.code))

  // Build a Map from code -> amenity for the remove/highlight flows
  const amenityByCode = new Map(initialAmenities.map((a) => [a.code, a]))

  // ─── Catalog toggle handler ──────────────────────────────────────────────

  function handleCatalogToggle(entry: typeof AMENITY_CATALOG[number]) {
    if (!canEdit || isPending) return
    setActionError(null)
    setPendingCode(entry.code)

    startTransition(async () => {
      if (selectedCodes.has(entry.code)) {
        // Remove
        const existing = amenityByCode.get(entry.code)
        if (!existing) return
        const result = await removePropertyAmenity(existing.id)
        if (result.error) setActionError(result.error)
      } else {
        // Add
        const result = await addPropertyAmenity({
          category: entry.category,
          code: entry.code,
          name_es: entry.name_es,
          name_en: entry.name_en,
        })
        if (result.error) setActionError(result.error)
      }
      setPendingCode(null)
      router.refresh()
    })
  }

  // ─── Highlight toggle handler ────────────────────────────────────────────

  function handleHighlightToggle(amenityId: string) {
    if (!canEdit || isPending) return
    setActionError(null)
    setPendingHighlightId(amenityId)

    startTransition(async () => {
      const result = await toggleHighlighted(amenityId)
      if (result.error) setActionError(result.error)
      setPendingHighlightId(null)
      router.refresh()
    })
  }

  // ─── Filtered catalog items for active category ──────────────────────────

  const catalogForCategory = AMENITY_CATALOG.filter(
    (entry) => entry.category === activeCategory,
  )

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Global error banner */}
      {actionError && (
        <div
          role="alert"
          aria-live="assertive"
          className="px-4 py-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700"
        >
          {actionError}
        </div>
      )}

      {/* ─── Section 1: Catalog Picker ──────────────────────────────────── */}
      <section
        className="bg-white rounded-2xl border border-border p-5 md:p-6 space-y-5"
        aria-labelledby="catalog-heading"
      >
        <div>
          <h2 id="catalog-heading" className="text-base font-semibold text-foreground">
            Catalogo de amenidades
          </h2>
          <p className="mt-0.5 text-sm text-foreground-secondary">
            Selecciona las comodidades que ofrece tu propiedad.
          </p>
        </div>

        {/* Category tabs — scrollable on mobile */}
        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
          role="tablist"
          aria-label="Categorias de amenidades"
        >
          {CATEGORY_ORDER.map((cat) => {
            const isActive = cat === activeCategory
            return (
              <button
                key={cat}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${cat}`}
                onClick={() => setActiveCategory(cat)}
                className={`
                  shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2
                  ${isActive
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-secondary text-foreground-secondary hover:bg-surface-tertiary hover:text-foreground'
                  }
                `}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            )
          })}
        </div>

        {/* Amenity chips grid */}
        <div
          id={`panel-${activeCategory}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeCategory}`}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5"
        >
          {catalogForCategory.map((entry) => {
            const isSelected = selectedCodes.has(entry.code)
            const isThisPending = pendingCode === entry.code

            return (
              <button
                key={entry.code}
                onClick={() => handleCatalogToggle(entry)}
                disabled={!canEdit || (isPending && pendingCode !== entry.code)}
                aria-pressed={isSelected}
                title={entry.name_en}
                className={`
                  relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium text-left
                  transition-all duration-150
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${isSelected
                    ? 'bg-accent-50 border-accent-500 text-accent-700'
                    : 'bg-white border-border text-foreground hover:border-accent-300 hover:bg-accent-50/50'
                  }
                `}
              >
                {/* Selected indicator */}
                {isSelected && !isThisPending && (
                  <span className="shrink-0 text-accent-600">
                    <CheckIcon />
                  </span>
                )}

                {/* Loading spinner */}
                {isThisPending && (
                  <svg
                    className="shrink-0 animate-spin h-3 w-3 text-accent-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}

                <span className="truncate leading-snug">{entry.name_es}</span>
              </button>
            )
          })}
        </div>

        {/* Read-only notice */}
        {!canEdit && (
          <p className="text-xs text-foreground-muted pt-1">
            No tienes permisos para editar las amenidades.
          </p>
        )}
      </section>

      {/* ─── Section 2: Highlighted Amenities ──────────────────────────────── */}
      <section
        className="bg-white rounded-2xl border border-border p-5 md:p-6 space-y-4"
        aria-labelledby="highlighted-heading"
      >
        <div>
          <h2 id="highlighted-heading" className="text-base font-semibold text-foreground">
            Amenidades destacadas
          </h2>
          <p className="mt-0.5 text-sm text-foreground-secondary">
            Marca las amenidades mas relevantes para mostrarlas en tu pagina publica.
          </p>
        </div>

        {initialAmenities.length === 0 ? (
          <p className="text-sm text-foreground-muted py-4 text-center">
            Aun no has seleccionado ninguna amenidad. Usa el catalogo de arriba para agregar.
          </p>
        ) : (
          <ul className="divide-y divide-border" role="list" aria-label="Amenidades seleccionadas">
            {initialAmenities.map((amenity) => {
              const isHighlightPending = pendingHighlightId === amenity.id

              return (
                <li
                  key={amenity.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Category badge */}
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-surface-secondary text-foreground-secondary text-xs font-medium">
                      {CATEGORY_LABELS[amenity.category] ?? amenity.category}
                    </span>
                    <span className="text-sm text-foreground truncate font-medium">
                      {amenity.name_es}
                    </span>
                  </div>

                  {/* Highlight toggle */}
                  <button
                    onClick={() => handleHighlightToggle(amenity.id)}
                    disabled={!canEdit || (isPending && pendingHighlightId !== amenity.id)}
                    aria-label={
                      amenity.is_highlighted
                        ? `Quitar ${amenity.name_es} de destacados`
                        : `Destacar ${amenity.name_es}`
                    }
                    aria-pressed={amenity.is_highlighted}
                    title={amenity.is_highlighted ? 'Quitar de destacados' : 'Marcar como destacado'}
                    className={`
                      shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                      transition-all duration-150
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2
                      disabled:opacity-40 disabled:cursor-not-allowed
                      ${amenity.is_highlighted
                        ? 'bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100'
                        : 'bg-surface-secondary border border-border text-foreground-secondary hover:border-amber-300 hover:text-amber-600'
                      }
                    `}
                  >
                    {isHighlightPending ? (
                      <svg
                        className="animate-spin h-3.5 w-3.5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <StarIcon filled={amenity.is_highlighted} />
                    )}
                    <span className="hidden sm:inline">
                      {amenity.is_highlighted ? 'Destacado' : 'Destacar'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
