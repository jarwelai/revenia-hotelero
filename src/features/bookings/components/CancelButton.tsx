'use client'

import { useTransition } from 'react'
import { cancelBooking } from '@/actions/bookings'

interface CancelButtonProps {
  bookingId: string
  guestName: string
}

export function CancelButton({ bookingId, guestName }: CancelButtonProps) {
  const [pending, startTransition] = useTransition()

  const handleCancel = () => {
    if (!confirm(`¿Cancelar la reserva de "${guestName}"? Esta acción eliminará las noches bloqueadas.`)) {
      return
    }

    startTransition(async () => {
      const result = await cancelBooking(bookingId)
      if (result.error) {
        alert(`Error al cancelar: ${result.error}`)
      }
    })
  }

  return (
    <button
      onClick={handleCancel}
      disabled={pending}
      className="text-sm font-medium text-error-600 hover:text-error-700 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {pending ? 'Cancelando…' : 'Cancelar'}
    </button>
  )
}
