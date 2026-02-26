'use client'

import { useState, useCallback } from 'react'
import { useClickOutside } from '@/shared/hooks/useClickOutside'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuestSelectorProps {
  adults: number
  onAdultsChange: (n: number) => void
  childrenAges: number[]
  onChildrenAgesChange: (ages: number[]) => void
  maxAdults?: number
  maxChildren?: number
  showPets?: boolean
  hasPets?: boolean
  onHasPetsChange?: (v: boolean) => void
  petCount?: number
  onPetCountChange?: (n: number) => void
  lang?: 'es' | 'en'
  mode?: 'popover' | 'inline'
}

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

const dict = {
  es: {
    adults: 'Adultos',
    children: 'Niños',
    childAge: 'Edad del niño',
    years: 'años',
    pets: 'Mascotas',
    petsQuestion: '¿Viajas con mascotas?',
    done: 'Listo',
  },
  en: {
    adults: 'Adults',
    children: 'Children',
    childAge: 'Child age',
    years: 'years old',
    pets: 'Pets',
    petsQuestion: 'Traveling with pets?',
    done: 'Done',
  },
} as const

function buildSummary(
  adults: number,
  childrenCount: number,
  hasPets: boolean | undefined,
  petCount: number | undefined,
  lang: 'es' | 'en',
): string {
  const parts: string[] = []

  if (lang === 'es') {
    parts.push(`${adults} ${adults === 1 ? 'Adulto' : 'Adultos'}`)
    if (childrenCount > 0) {
      parts.push(`${childrenCount} ${childrenCount === 1 ? 'Niño' : 'Niños'}`)
    }
    if (hasPets && petCount && petCount > 0) {
      parts.push(`${petCount} ${petCount === 1 ? 'Mascota' : 'Mascotas'}`)
    }
  } else {
    parts.push(`${adults} ${adults === 1 ? 'Adult' : 'Adults'}`)
    if (childrenCount > 0) {
      parts.push(`${childrenCount} ${childrenCount === 1 ? 'Child' : 'Children'}`)
    }
    if (hasPets && petCount && petCount > 0) {
      parts.push(`${petCount} ${petCount === 1 ? 'Pet' : 'Pets'}`)
    }
  }

  return parts.join(', ')
}

// ---------------------------------------------------------------------------
// StepperRow
// ---------------------------------------------------------------------------

interface StepperRowProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}

function StepperRow({ label, value, min, max, onChange }: StepperRowProps) {
  const atMin = value <= min
  const atMax = value >= max

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={atMin}
          aria-label={`Decrease ${label}`}
          className={[
            'flex h-8 w-8 items-center justify-center rounded-full border border-gray-300',
            'text-gray-600 transition-colors',
            atMin
              ? 'cursor-not-allowed opacity-50'
              : 'hover:border-gray-400 hover:bg-gray-50',
          ].join(' ')}
        >
          <span className="text-base leading-none select-none">−</span>
        </button>

        <span className="min-w-8 text-center text-sm font-semibold text-gray-900">
          {value}
        </span>

        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={atMax}
          aria-label={`Increase ${label}`}
          className={[
            'flex h-8 w-8 items-center justify-center rounded-full border border-gray-300',
            'text-gray-600 transition-colors',
            atMax
              ? 'cursor-not-allowed opacity-50'
              : 'hover:border-gray-400 hover:bg-gray-50',
          ].join(' ')}
        >
          <span className="text-base leading-none select-none">+</span>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SelectorContent (shared between popover and inline modes)
// ---------------------------------------------------------------------------

interface SelectorContentProps
  extends Required<
    Pick<
      GuestSelectorProps,
      | 'adults'
      | 'onAdultsChange'
      | 'childrenAges'
      | 'onChildrenAgesChange'
      | 'maxAdults'
      | 'maxChildren'
      | 'showPets'
      | 'lang'
    >
  > {
  hasPets?: boolean
  onHasPetsChange?: (v: boolean) => void
  petCount?: number
  onPetCountChange?: (n: number) => void
  onClose?: () => void
}

function SelectorContent({
  adults,
  onAdultsChange,
  childrenAges,
  onChildrenAgesChange,
  maxAdults,
  maxChildren,
  showPets,
  hasPets,
  onHasPetsChange,
  petCount,
  onPetCountChange,
  lang,
  onClose,
}: SelectorContentProps) {
  const t = dict[lang]
  const childrenCount = childrenAges.length

  function handleChildrenChange(n: number) {
    if (n > childrenCount) {
      // Add a child with default age 0
      onChildrenAgesChange([...childrenAges, 0])
    } else {
      onChildrenAgesChange(childrenAges.slice(0, n))
    }
  }

  function handleChildAgeChange(index: number, age: number) {
    const updated = [...childrenAges]
    updated[index] = age
    onChildrenAgesChange(updated)
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* Adults */}
      <StepperRow
        label={t.adults}
        value={adults}
        min={1}
        max={maxAdults}
        onChange={onAdultsChange}
      />

      {/* Children */}
      <StepperRow
        label={t.children}
        value={childrenCount}
        min={0}
        max={maxChildren}
        onChange={handleChildrenChange}
      />

      {/* Child age selects */}
      {childrenAges.map((age, index) => (
        <div key={index} className="flex items-center justify-between py-2 pl-2">
          <label
            htmlFor={`child-age-${index}`}
            className="text-sm text-gray-500"
          >
            {t.childAge} {index + 1}
          </label>
          <select
            id={`child-age-${index}`}
            value={age}
            onChange={(e) => handleChildAgeChange(index, Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          >
            {Array.from({ length: 18 }, (_, i) => (
              <option key={i} value={i}>
                {i} {t.years}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Pets section */}
      {showPets && (
        <>
          <div className="my-3 border-t border-gray-200" />

          {/* Pets toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700">{t.petsQuestion}</span>
            <button
              type="button"
              role="switch"
              aria-checked={hasPets ?? false}
              onClick={() => onHasPetsChange?.(!hasPets)}
              className={[
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2',
                hasPets ? 'bg-primary-600' : 'bg-gray-200',
              ].join(' ')}
            >
              <span
                className={[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0',
                  'transition duration-200 ease-in-out',
                  hasPets ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>

          {/* Pet count stepper — only visible when hasPets is true */}
          {hasPets && (
            <StepperRow
              label={t.pets}
              value={petCount ?? 1}
              min={1}
              max={5}
              onChange={(n) => onPetCountChange?.(n)}
            />
          )}
        </>
      )}

      {/* Done button — only rendered when inside a popover */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
        >
          {t.done}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GuestSelector (public export)
// ---------------------------------------------------------------------------

export function GuestSelector({
  adults,
  onAdultsChange,
  childrenAges,
  onChildrenAgesChange,
  maxAdults = 6,
  maxChildren = 6,
  showPets = false,
  hasPets,
  onHasPetsChange,
  petCount,
  onPetCountChange,
  lang = 'es',
  mode = 'popover',
}: GuestSelectorProps) {
  const [open, setOpen] = useState(false)

  const handleClose = useCallback(() => setOpen(false), [])
  const containerRef = useClickOutside<HTMLDivElement>(handleClose)

  const summaryText = buildSummary(
    adults,
    childrenAges.length,
    hasPets,
    petCount,
    lang,
  )

  const contentProps: SelectorContentProps = {
    adults,
    onAdultsChange,
    childrenAges,
    onChildrenAgesChange,
    maxAdults,
    maxChildren,
    showPets,
    hasPets,
    onHasPetsChange,
    petCount,
    onPetCountChange,
    lang,
  }

  // ---- Inline mode --------------------------------------------------------
  if (mode === 'inline') {
    return (
      <div className="w-full">
        <SelectorContent {...contentProps} />
      </div>
    )
  }

  // ---- Popover mode -------------------------------------------------------
  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-3 py-2.5 text-left text-sm transition-colors hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1"
      >
        <span className="truncate text-gray-700">{summaryText}</span>
        <svg
          className={[
            'ml-2 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200',
            open ? 'rotate-180' : '',
          ].join(' ')}
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label={summaryText}
          className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-white p-4 shadow-lg"
        >
          <SelectorContent {...contentProps} onClose={handleClose} />
        </div>
      )}
    </div>
  )
}
