import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RoomTypeForm } from '@/features/rooms/components'
import { getActivePropertyWithRole } from '@/lib/property-context'

export const metadata = { title: 'Nuevo Tipo de Habitación | Revenia' }

export default async function NewRoomTypePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')
  if (!role || !['owner', 'manager'].includes(role)) redirect('/dashboard/rooms')

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-foreground">Nuevo tipo de habitación</h1>
        <p className="text-foreground-secondary mt-1">{property.name}</p>
      </div>
      <RoomTypeForm propertyId={property.id} />
    </div>
  )
}
