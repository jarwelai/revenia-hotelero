import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActivePropertyWithRole } from '@/lib/property-context'
import { getPropertyImages } from '@/actions/property-images'
import { ImageGallery } from '@/features/property-setup/components/ImageGallery'

export const metadata = { title: 'Galeria | Revenia' }

export default async function GallerySetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const canEdit = role === 'owner' || role === 'manager'

  const { images, error } = await getPropertyImages()

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <nav aria-label="Navegacion de seccion" className="flex items-center gap-1.5 mb-6 text-sm text-foreground-muted">
        <Link
          href="/dashboard"
          className="hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <ChevronRight />
        <Link
          href="/dashboard/setup"
          className="hover:text-foreground transition-colors"
        >
          Configuracion
        </Link>
        <ChevronRight />
        <span className="text-foreground font-medium" aria-current="page">
          Galeria
        </span>
      </nav>

      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
          Galeria de Fotos
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

      {/* Gallery component */}
      <ImageGallery
        initialImages={images ?? []}
        propertyId={property.id}
        canEdit={canEdit}
      />
    </div>
  )
}

// ─── Inline icon ──────────────────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg
      className="w-3.5 h-3.5 text-foreground-muted shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
    </svg>
  )
}
