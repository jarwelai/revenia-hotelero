import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActivePropertyWithRole } from '@/lib/property-context'
import { getSeasons } from '@/actions/seasons'
import { SeasonManager } from '@/features/property-setup/components/SeasonManager'

export const metadata = { title: 'Temporadas | Revenia' }

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function RatesSetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const canEdit = role === 'owner' || role === 'manager'

  const [{ seasons }, { data: roomTypes }] = await Promise.all([
    getSeasons(),
    supabase
      .from('room_types')
      .select('id, name, base_price')
      .eq('property_id', property.id)
      .order('name'),
  ])

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav
        aria-label="Navegacion de seccion"
        className="flex items-center gap-1.5 text-sm text-foreground-muted mb-6"
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
          Tarifas y Temporadas
        </span>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
          Tarifas y Temporadas
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          {property.name}
        </p>
      </header>

      {/* Link to daily rate editor */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-8 flex items-start gap-3">
        <InfoIcon className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm text-blue-800">
          Para editar tarifas dia a dia, usa el{' '}
          <Link
            href="/dashboard/rates"
            className="font-medium underline underline-offset-2 hover:text-blue-900 transition-colors"
          >
            editor de tarifas
          </Link>
          .
        </p>
      </div>

      {/* Season manager */}
      <SeasonManager
        initialSeasons={seasons ?? []}
        roomTypes={(roomTypes ?? []) as Array<{ id: string; name: string; base_price: number | null }>}
        canEdit={canEdit}
        currency={property.currency}
      />
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

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
    </svg>
  )
}
