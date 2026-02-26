'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPublicQuote } from '@/actions/public-booking'
import type { PublicLang } from '@/types/hotelero'

interface SelectRoomButtonProps {
  publicKey: string
  lang: PublicLang
  roomTypeId: string
  checkIn: string
  checkOut: string
  adults: number
  childrenAges: number[]
  hasPets?: boolean
  petCount?: number
}

export function SelectRoomButton({
  publicKey,
  lang,
  roomTypeId,
  checkIn,
  checkOut,
  adults,
  childrenAges,
  hasPets,
  petCount,
}: SelectRoomButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSelect() {
    setError(null)
    startTransition(async () => {
      const result = await createPublicQuote({
        publicKey,
        roomTypeId,
        checkIn,
        checkOut,
        adults,
        childrenAges,
        hasPets,
        petCount,
        lang,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      router.push(`/p/${publicKey}/checkout?qid=${result.quoteId}&lang=${lang}`)
    })
  }

  return (
    <div className="mt-3">
      {error && (
        <p className="mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleSelect}
        disabled={isPending}
        className="w-full py-2.5 rounded-xl bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {isPending
          ? (lang === 'en' ? 'Processing...' : 'Procesando...')
          : (lang === 'en' ? 'Select' : 'Seleccionar')}
      </button>
    </div>
  )
}
