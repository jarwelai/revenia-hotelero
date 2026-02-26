'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createInternalBooking } from '@/actions/bookings'
import { GuestSelector } from '@/shared/components/GuestSelector'
import type { Room } from '@/types/hotelero'

interface BookingFormProps {
  propertyId: string
  rooms: Pick<Room, 'id' | 'name'>[]
  hasPetPolicy?: boolean
}

export function BookingForm({ propertyId, rooms, hasPetPolicy }: BookingFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [adults, setAdults] = useState(2)
  const [childrenAges, setChildrenAges] = useState<number[]>([])
  const [hasPets, setHasPets] = useState(false)
  const [petCount, setPetCount] = useState(0)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)

    const input = {
      property_id: propertyId,
      room_id: (fd.get('room_id') as string)?.trim(),
      check_in: (fd.get('check_in') as string)?.trim(),
      check_out: (fd.get('check_out') as string)?.trim(),
      guest_name: (fd.get('guest_name') as string)?.trim(),
      guest_email: (fd.get('guest_email') as string)?.trim() || null,
      guest_phone: (fd.get('guest_phone') as string)?.trim() || null,
      adults,
      children_ages: childrenAges,
      has_pets: hasPets,
      pet_count: petCount,
    }

    startTransition(async () => {
      const result = await createInternalBooking(input)

      if (result.error) {
        setError(result.error)
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/dashboard/bookings'), 1200)
    })
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-success-200 bg-success-50 p-8 text-center">
        <div className="text-4xl mb-3">✓</div>
        <p className="text-lg font-semibold text-success-700">Reserva creada correctamente</p>
        <p className="text-sm text-success-600 mt-1">Redirigiendo a la lista de reservas…</p>
      </div>
    )
  }

  const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-400'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl bg-error-50 border border-error-200 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      {/* Unidad */}
      <div>
        <label htmlFor="room_id" className="block text-sm font-medium text-foreground mb-1.5">
          Unidad <span className="text-error-500">*</span>
        </label>
        {rooms.length === 0 ? (
          <p className="text-sm text-foreground-secondary">
            No hay unidades configuradas en esta propiedad.{' '}
            <a href="/dashboard/rooms/new" className="text-accent-600 hover:underline">
              Crear primera unidad →
            </a>
          </p>
        ) : (
          <select id="room_id" name="room_id" required className={inputCls}>
            <option value="">Seleccionar unidad…</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="check_in" className="block text-sm font-medium text-foreground mb-1.5">
            Check-in <span className="text-error-500">*</span>
          </label>
          <input id="check_in" type="date" name="check_in" required className={inputCls} />
        </div>
        <div>
          <label htmlFor="check_out" className="block text-sm font-medium text-foreground mb-1.5">
            Check-out <span className="text-error-500">*</span>
          </label>
          <input id="check_out" type="date" name="check_out" required className={inputCls} />
        </div>
      </div>

      {/* Ocupación */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
          Ocupación
        </legend>
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
          lang="es"
          mode="inline"
        />
      </fieldset>

      {/* Huésped */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
          Datos del huésped
        </legend>

        <div>
          <label htmlFor="guest_name" className="block text-sm font-medium text-foreground mb-1.5">
            Nombre completo <span className="text-error-500">*</span>
          </label>
          <input
            id="guest_name"
            type="text"
            name="guest_name"
            required
            placeholder="Ej. Juan García"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="guest_email" className="block text-sm font-medium text-foreground mb-1.5">
              Email
            </label>
            <input
              id="guest_email"
              type="email"
              name="guest_email"
              placeholder="huesped@ejemplo.com"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="guest_phone" className="block text-sm font-medium text-foreground mb-1.5">
              Teléfono
            </label>
            <input
              id="guest_phone"
              type="tel"
              name="guest_phone"
              placeholder="+52 55 1234 5678"
              className={inputCls}
            />
          </div>
        </div>
      </fieldset>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <a
          href="/dashboard/bookings"
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-gray-100 transition-colors"
        >
          Cancelar
        </a>
        <button
          type="submit"
          disabled={pending || rooms.length === 0}
          className="px-6 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? 'Creando reserva…' : 'Crear reserva'}
        </button>
      </div>
    </form>
  )
}
