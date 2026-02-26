'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GuestSelector } from '@/shared/components/GuestSelector'
import type { PublicLang } from '@/types/hotelero'

interface BookWidgetProps {
  publicKey: string
  lang: PublicLang
  hasChildPricing: boolean
  hasPetPolicy?: boolean
  defaultCheckIn?: string
  defaultCheckOut?: string
  defaultAdults?: number
  defaultChildrenAges?: number[]
  defaultHasPets?: boolean
  defaultPetCount?: number
}

export function BookWidget({
  publicKey,
  lang,
  hasChildPricing,
  hasPetPolicy,
  defaultCheckIn,
  defaultCheckOut,
  defaultAdults,
  defaultChildrenAges,
  defaultHasPets,
  defaultPetCount,
}: BookWidgetProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? '')
  const [checkOut, setCheckOut] = useState(defaultCheckOut ?? '')
  const [adults, setAdults] = useState(defaultAdults ?? 2)
  const [childrenAges, setChildrenAges] = useState<number[]>(defaultChildrenAges ?? [])
  const [hasPets, setHasPets] = useState(defaultHasPets ?? false)
  const [petCount, setPetCount] = useState(defaultPetCount ?? 1)

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

    if (childrenAges.length > 0) {
      params.set('children', childrenAges.join(','))
    }

    if (hasPets && petCount > 0) {
      params.set('pets', String(petCount))
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

      {/* Huéspedes */}
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          {lang === 'en' ? 'Guests' : 'Huéspedes'}
        </label>
        <GuestSelector
          adults={adults}
          onAdultsChange={setAdults}
          childrenAges={childrenAges}
          onChildrenAgesChange={setChildrenAges}
          showPets={hasPetPolicy}
          hasPets={hasPets}
          onHasPetsChange={setHasPets}
          petCount={petCount}
          onPetCountChange={setPetCount}
          lang={lang}
          mode="popover"
        />
      </div>

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
