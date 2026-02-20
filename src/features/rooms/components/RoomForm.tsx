'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRoom, updateRoom } from '@/actions/rooms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Room, RoomType } from '@/types/hotelero'

interface Props {
  propertyId: string
  roomTypes: Pick<RoomType, 'id' | 'name'>[]
  room?: Room
}

export function RoomForm({ propertyId, roomTypes, room }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const action = room ? updateRoom : createRoom
    const result = await action(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success: server action redirects
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="property_id" value={propertyId} />
      {room && <input type="hidden" name="id" value={room.id} />}

      <Input
        id="name"
        name="name"
        label="Nombre de la unidad"
        placeholder="Ej: Cabaña Azul"
        defaultValue={room?.name}
        required
      />

      <div>
        <label htmlFor="room_type_id" className="block text-sm font-medium text-foreground mb-1.5">
          Tipo de habitación <span className="text-foreground-muted font-normal">(opcional)</span>
        </label>
        <select
          id="room_type_id"
          name="room_type_id"
          defaultValue={room?.room_type_id ?? ''}
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="">Sin tipo asignado</option>
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name}
            </option>
          ))}
        </select>
      </div>

      <Input
        id="motopress_accommodation_id"
        name="motopress_accommodation_id"
        type="number"
        label="ID MotoPress (accommodation_id)"
        placeholder="50557"
        defaultValue={room?.motopress_accommodation_id != null ? String(room.motopress_accommodation_id) : ''}
        min="1"
      />

      <div>
        <label htmlFor="ical_url" className="block text-sm font-medium text-foreground mb-1.5">
          iCal URL
        </label>
        <input
          id="ical_url"
          name="ical_url"
          type="url"
          placeholder="https://bookings.mayajadesurf.com/?feed=mphb.ics&accommodation_id=50557"
          defaultValue={room?.ical_url ?? ''}
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
        <p className="mt-1 text-xs text-foreground-muted">
          URL del calendario iCal de MotoPress para esta unidad.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Hidden input garantiza que 'false' se envíe cuando el checkbox esté desmarcado */}
        <input type="hidden" name="sync_enabled" value="false" />
        <input
          id="sync_enabled"
          name="sync_enabled"
          type="checkbox"
          value="true"
          defaultChecked={room?.sync_enabled ?? true}
          className="w-4 h-4 rounded border-border text-accent-500 focus:ring-accent-500"
        />
        <label htmlFor="sync_enabled" className="text-sm font-medium text-foreground">
          Habilitar sincronización iCal
        </label>
      </div>

      {error && (
        <div className="rounded-xl bg-error-50 border border-error-100 p-3">
          <p className="text-sm text-error-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" isLoading={loading}>
          {room ? 'Guardar cambios' : 'Crear unidad'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
