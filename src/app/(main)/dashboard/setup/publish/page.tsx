import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActivePropertyWithRole } from '@/lib/property-context'
import { getPropertyProfile } from '@/actions/property-setup'
import { computeActivationChecklist } from '@/lib/activation-checklist'
import { PublishPanel } from '@/features/property-setup/components/PublishPanel'

export const metadata = { title: 'Publicar | Revenia' }

export default async function PublishPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const canEdit = role === 'owner' || role === 'manager'

  const { data: profile, error } = await getPropertyProfile()
  const checklist = await computeActivationChecklist(property.id)

  return (
    <div className="p-6 md:p-8 max-w-3xl">
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
          Publicar
        </span>
      </nav>

      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Publicar Hotel
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Controla la visibilidad de {property.name} y configura tu URL publica.
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

      {/* Panel */}
      {profile && (
        <PublishPanel
          propertyName={profile.name}
          slug={profile.slug ?? null}
          isPublished={profile.is_published ?? false}
          publicKey={profile.public_key}
          checklistScore={checklist.score}
          readyToPublish={checklist.ready_to_publish}
          canEdit={canEdit}
        />
      )}

      {!profile && !error && (
        <p className="text-sm text-foreground-muted">
          No se pudo cargar el perfil de la propiedad.
        </p>
      )}
    </div>
  )
}
