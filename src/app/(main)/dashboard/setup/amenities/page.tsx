import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActivePropertyWithRole } from '@/lib/property-context'
import { getPropertyAmenities } from '@/actions/property-amenities'
import { AmenityManager } from '@/features/property-setup/components/AmenityManager'

export const metadata = { title: 'Amenidades | Revenia' }

export default async function AmenitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const canEdit = role === 'owner' || role === 'manager'

  const { amenities, error } = await getPropertyAmenities()

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-6 text-sm text-foreground-muted">
        <Link
          href="/dashboard"
          className="hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href="/dashboard/setup"
          className="hover:text-foreground transition-colors"
        >
          Configuracion
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground font-medium" aria-current="page">
          Amenidades
        </span>
      </nav>

      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Amenidades y Servicios
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          {property.name}
        </p>
      </header>

      {/* Load error state */}
      {error && (
        <div
          role="alert"
          className="mb-6 px-4 py-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700"
        >
          {error}
        </div>
      )}

      {/* Manager */}
      <AmenityManager
        initialAmenities={amenities ?? []}
        canEdit={canEdit}
      />
    </div>
  )
}
