import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPropertySettings } from '@/actions/settings'
import { getActivePropertyWithRole } from '@/lib/property-context'
import { CommercialSettingsForm } from '@/features/settings/components/CommercialSettingsForm'
import { ChildRulesManager } from '@/features/settings/components/ChildRulesManager'
import { TaxRulesManager } from '@/features/settings/components/TaxRulesManager'

export const metadata = { title: 'Configuración | Revenia' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const canEdit = role === 'owner' || role === 'manager'

  const { commercialSettings, childRules, taxRules } = await getPropertySettings(property.id)

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-foreground-secondary mb-2">
          <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <span>›</span>
          <span>Configuración</span>
        </div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Configuración</h1>
        <p className="text-foreground-secondary mt-1">{property.name}</p>
      </div>

      <div className="space-y-6">
        {/* Configuración comercial */}
        <section className="bg-white rounded-2xl border border-border p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">Configuración comercial</h2>
            <p className="text-sm text-foreground-secondary mt-0.5">
              Moneda, ocupación base y cargo por adulto adicional
            </p>
          </div>
          <CommercialSettingsForm
            propertyId={property.id}
            initialSettings={commercialSettings}
            canEdit={canEdit}
          />
        </section>

        {/* Tarifas por niños */}
        <section className="bg-white rounded-2xl border border-border p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">Tarifas por niños</h2>
            <p className="text-sm text-foreground-secondary mt-0.5">
              Cargos por rango de edad (tarifa fija por noche)
            </p>
          </div>
          <ChildRulesManager
            propertyId={property.id}
            initialRules={childRules}
            canEdit={canEdit}
          />
        </section>

        {/* Impuestos */}
        <section className="bg-white rounded-2xl border border-border p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">Impuestos</h2>
            <p className="text-sm text-foreground-secondary mt-0.5">
              Impuestos porcentuales aplicados sobre el total por noche
            </p>
          </div>
          <TaxRulesManager
            propertyId={property.id}
            initialRules={taxRules}
            canEdit={canEdit}
          />
        </section>
        {/* Contenido público */}
        <section className="bg-white rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Contenido público</h2>
              <p className="text-sm text-foreground-secondary mt-0.5">
                Textos para las páginas de reserva visibles para los huéspedes
              </p>
            </div>
            <Link
              href="/dashboard/settings/content"
              className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-surface transition-colors"
            >
              Gestionar →
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
