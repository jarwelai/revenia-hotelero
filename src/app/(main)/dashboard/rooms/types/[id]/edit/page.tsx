import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { RoomTypeForm } from '@/features/rooms/components'
import { getActivePropertyWithRole } from '@/lib/property-context'
import type { RoomType } from '@/types/hotelero'

export const metadata = { title: 'Editar Tipo de Habitación | Revenia' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditRoomTypePage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')
  if (!role || !['owner', 'manager'].includes(role)) redirect('/dashboard/rooms')

  const { data: roomType } = await supabase
    .from('room_types')
    .select('id, name, description, max_occupancy, base_price, amenities_json, property_id, created_at')
    .eq('id', id)
    .eq('property_id', property.id)
    .maybeSingle()

  if (!roomType) notFound()

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-foreground">Editar tipo de habitación</h1>
        <p className="text-foreground-secondary mt-1">{property.name}</p>
      </div>
      <RoomTypeForm propertyId={property.id} roomType={roomType as RoomType} />
    </div>
  )
}
