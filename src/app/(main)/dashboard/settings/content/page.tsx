import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getContentSlots } from '@/actions/public-content'
import { getActivePropertyWithRole } from '@/lib/property-context'
import { ContentSlotsManager } from '@/features/public-content/components/ContentSlotsManager'

export const metadata = { title: 'Contenido público | Revenia' }

export default async function PublicContentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const canEdit = role === 'owner' || role === 'manager'

  const { slots, error } = await getContentSlots(property.id)

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/dashboard/settings"
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            ← Configuración
          </Link>
        </div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Contenido público</h1>
        <p className="mt-1 text-foreground-secondary text-sm">
          Textos que aparecen en las páginas de reserva públicas de{' '}
          <strong>{property.name}</strong>.{' '}
          Solo el contenido <span className="text-green-700 font-medium">aprobado</span> es visible para los visitantes.
        </p>
        {property.public_key && (
          <a
            href={`/p/${property.public_key}/book`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-primary-600 hover:text-primary-700 transition-colors"
          >
            Ver página de reservas →
          </a>
        )}
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <ContentSlotsManager
        propertyId={property.id}
        initialSlots={slots}
        canEdit={canEdit}
      />
    </div>
  )
}
