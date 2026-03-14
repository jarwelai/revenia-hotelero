import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActivePropertyWithRole } from '@/lib/property-context'
import { getPropertySettings } from '@/actions/settings'
import { CommercialSettingsForm } from '@/features/settings/components/CommercialSettingsForm'
import { ChildRulesManager } from '@/features/settings/components/ChildRulesManager'
import { TaxRulesManager } from '@/features/settings/components/TaxRulesManager'

export const metadata = { title: 'Precios | Revenia' }

export default async function PricingSetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const canEdit = role === 'owner' || role === 'manager'

  const { commercialSettings, childRules, taxRules } = await getPropertySettings(property.id)

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      {/* Breadcrumb */}
      <nav
        aria-label="Navegacion de sección"
        className="flex items-center gap-1.5 mb-6 text-sm text-foreground-muted"
      >
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight />
        <Link href="/dashboard/setup" className="hover:text-foreground transition-colors">
          Configuracion
        </Link>
        <ChevronRight />
        <span className="text-foreground font-medium" aria-current="page">
          Precios
        </span>
      </nav>

      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Configuracion de Precios
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          {property.name}
        </p>
      </header>

      {/* Section 1: Configuracion comercial */}
      <section className="bg-white rounded-2xl border border-border p-6 mb-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">Configuracion comercial</h2>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Moneda, ocupacion base y cargo por adulto adicional
          </p>
        </div>
        <CommercialSettingsForm
          propertyId={property.id}
          initialSettings={commercialSettings}
          canEdit={canEdit}
        />
      </section>

      {/* Section 2: Tarifas por ninos */}
      <section className="bg-white rounded-2xl border border-border p-6 mb-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">Tarifas por ninos</h2>
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

      {/* Section 3: Impuestos */}
      <section className="bg-white rounded-2xl border border-border p-6 mb-8">
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

      {/* Next step link */}
      <div className="flex justify-end">
        <Link
          href="/dashboard/setup/rates"
          className="inline-flex items-center gap-2 bg-primary-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-primary-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Siguiente: Tarifas
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

// ─── Inline icons ──────────────────────────────────────────────────────────────

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

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  )
}
