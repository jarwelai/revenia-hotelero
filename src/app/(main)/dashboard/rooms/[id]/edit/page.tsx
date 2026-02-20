import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { RoomForm } from '@/features/rooms/components'
import { getActivePropertyWithRole } from '@/lib/property-context'
import type { Room, RoomType } from '@/types/hotelero'

export const metadata = { title: 'Editar Unidad | Revenia' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditRoomPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')
  if (!role || !['owner', 'manager'].includes(role)) redirect('/dashboard/rooms')

  const [{ data: room }, { data: roomTypes }] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, name, property_id, room_type_id, motopress_accommodation_id, ical_url, sync_enabled, sync_status, last_synced_at, last_sync_error, created_at')
      .eq('id', id)
      .eq('property_id', property.id)
      .maybeSingle(),
    supabase
      .from('room_types')
      .select('id, name')
      .eq('property_id', property.id)
      .order('name'),
  ])

  if (!room) notFound()

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-foreground">Editar unidad</h1>
        <p className="text-foreground-secondary mt-1">{property.name}</p>
      </div>
      <RoomForm
        propertyId={property.id}
        room={room as Room}
        roomTypes={(roomTypes ?? []) as Pick<RoomType, 'id' | 'name'>[]}
      />
    </div>
  )
}
