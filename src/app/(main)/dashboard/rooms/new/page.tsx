import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RoomForm } from '@/features/rooms/components'
import { getActivePropertyWithRole } from '@/lib/property-context'
import type { RoomType } from '@/types/hotelero'

export const metadata = { title: 'Nueva Unidad | Revenia' }

export default async function NewRoomPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')
  if (!role || !['owner', 'manager'].includes(role)) redirect('/dashboard/rooms')

  const { data: roomTypes } = await supabase
    .from('room_types')
    .select('id, name')
    .eq('property_id', property.id)
    .order('name')

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-foreground">Nueva unidad</h1>
        <p className="text-foreground-secondary mt-1">{property.name}</p>
      </div>
      <RoomForm
        propertyId={property.id}
        roomTypes={(roomTypes ?? []) as Pick<RoomType, 'id' | 'name'>[]}
      />
    </div>
  )
}
