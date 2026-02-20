'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRoomType, updateRoomType } from '@/actions/rooms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { RoomType } from '@/types/hotelero'

interface Props {
  propertyId: string
  roomType?: RoomType
}

export function RoomTypeForm({ propertyId, roomType }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const action = roomType ? updateRoomType : createRoomType
    const result = await action(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success: server action redirects → no further action needed
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="property_id" value={propertyId} />
      {roomType && <input type="hidden" name="id" value={roomType.id} />}

      <Input
        id="name"
        name="name"
        label="Nombre del tipo"
        placeholder="Ej: Habitación Estándar"
        defaultValue={roomType?.name}
        required
      />

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Descripción <span className="text-foreground-muted">(opcional)</span>
        </label>
        <textarea
          name="description"
          rows={3}
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none"
          placeholder="Descripción visible para el equipo"
          defaultValue={roomType?.description ?? ''}
        />
      </div>

      <Input
        id="max_occupancy"
        name="max_occupancy"
        type="number"
        label="Ocupación máxima"
        placeholder="2"
        defaultValue={String(roomType?.max_occupancy ?? 2)}
        min="1"
        max="20"
        required
      />

      <Input
        id="base_price"
        name="base_price"
        type="number"
        step="0.01"
        label="Precio base (opcional)"
        placeholder="150.00"
        defaultValue={roomType?.base_price != null ? String(roomType.base_price) : ''}
        min="0"
      />

      {error && (
        <div className="rounded-xl bg-error-50 border border-error-100 p-3">
          <p className="text-sm text-error-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" isLoading={loading}>
          {roomType ? 'Guardar cambios' : 'Crear tipo'}
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
