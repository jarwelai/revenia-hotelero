import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookingForm } from '@/features/bookings/components'
import { getActivePropertyWithRole } from '@/lib/property-context'
import type { Room } from '@/types/hotelero'

export const metadata = { title: 'Nueva Reserva | Revenia' }

export default async function NewBookingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  // Solo owner/manager pueden crear reservas
  if (!role || role === 'staff') redirect('/dashboard/bookings')

  // Unidades disponibles para seleccionar
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('property_id', property.id)
    .order('name')

  const { data: commercialSettings } = await supabase
    .from('property_commercial_settings')
    .select('pet_policy_enabled')
    .eq('property_id', property.id)
    .maybeSingle()

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-foreground-secondary mb-4">
          <Link href="/dashboard/bookings" className="hover:text-foreground">
            Reservas
          </Link>
          <span>/</span>
          <span className="text-foreground">Nueva reserva</span>
        </div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Nueva Reserva</h1>
        <p className="text-foreground-secondary mt-1">{property.name}</p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <BookingForm
          propertyId={property.id}
          rooms={(rooms ?? []) as Pick<Room, 'id' | 'name'>[]}
          hasPetPolicy={commercialSettings?.pet_policy_enabled ?? false}
        />
      </div>
    </div>
  )
}
