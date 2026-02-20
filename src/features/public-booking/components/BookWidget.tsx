'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PublicLang } from '@/types/hotelero'

interface BookWidgetProps {
  publicKey: string
  lang: PublicLang
  hasChildPricing: boolean
  defaultCheckIn?: string
  defaultCheckOut?: string
  defaultAdults?: number
  defaultChildrenAges?: number[]
}

export function BookWidget({
  publicKey,
  lang,
  hasChildPricing,
  defaultCheckIn,
  defaultCheckOut,
  defaultAdults,
  defaultChildrenAges,
}: BookWidgetProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? '')
  const [checkOut, setCheckOut] = useState(defaultCheckOut ?? '')
  const [adults, setAdults] = useState(defaultAdults ?? 2)
  const [childrenCount, setChildrenCount] = useState(defaultChildrenAges?.length ?? 0)
  const [childrenAges, setChildrenAges] = useState<number[]>(defaultChildrenAges ?? [])

  function handleChildrenCountChange(count: number) {
    setChildrenCount(count)
    setChildrenAges((prev) => Array.from({ length: count }, (_, i) => prev[i] ?? 0))
  }

  function handleChildAgeChange(index: number, age: number) {
    setChildrenAges((prev) => {
      const next = [...prev]
      next[index] = age
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ciDate = checkIn || today
    const coDate = checkOut || tomorrow

    const params = new URLSearchParams({
      checkIn: ciDate,
      checkOut: coDate,
      adults: String(adults),
      lang,
    })

    if (childrenCount > 0) {
      params.set('children', childrenAges.join(','))
    }

    startTransition(() => {
      router.push(`/p/${publicKey}/book?${params.toString()}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-white border border-border shadow-card space-y-4">
      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            {lang === 'en' ? 'Check-in' : 'Entrada'}
          </label>
          <input
            type="date"
            required
            min={today}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            {lang === 'en' ? 'Check-out' : 'Salida'}
          </label>
          <input
            type="date"
            required
            min={checkIn || tomorrow}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Adultos */}
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          {lang === 'en' ? 'Adults' : 'Adultos'}
        </label>
        <select
          value={adults}
          onChange={(e) => setAdults(Number(e.target.value))}
          className="w-full px-3 py-2 rounded-xl border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Niños — solo si la propiedad tiene child pricing */}
      {hasChildPricing && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1">
              {lang === 'en' ? 'Children' : 'Niños'}
            </label>
            <select
              value={childrenCount}
              onChange={(e) => handleChildrenCountChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 0
                    ? (lang === 'en' ? 'No children' : 'Sin niños')
                    : `${n} ${n === 1
                        ? (lang === 'en' ? 'child' : 'niño')
                        : (lang === 'en' ? 'children' : 'niños')}`}
                </option>
              ))}
            </select>
          </div>

          {childrenCount > 0 && (
            <div className="space-y-2">
              {Array.from({ length: childrenCount }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-foreground-muted w-20 shrink-0">
                    {lang === 'en' ? `Child ${i + 1}` : `Niño ${i + 1}`}
                  </span>
                  <select
                    value={childrenAges[i] ?? 0}
                    onChange={(e) => handleChildAgeChange(i, Number(e.target.value))}
                    className="flex-1 px-3 py-2 rounded-xl border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {Array.from({ length: 18 }, (_, age) => (
                      <option key={age} value={age}>
                        {age === 0
                          ? (lang === 'en' ? '< 1 year' : '< 1 año')
                          : `${age} ${lang === 'en'
                              ? (age === 1 ? 'year' : 'years')
                              : (age === 1 ? 'año' : 'años')}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 rounded-xl bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {isPending
          ? (lang === 'en' ? 'Searching...' : 'Buscando...')
          : (lang === 'en' ? 'Check availability' : 'Ver disponibilidad')}
      </button>
    </form>
  )
}
