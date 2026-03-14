import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActiveProperty } from '@/lib/property-context'

export const metadata = { title: 'Pagos | Revenia' }

interface PaymentProvider {
  id: string
  provider: 'stripe' | 'recurrente'
  is_enabled: boolean
  is_default: boolean
}

const PROVIDER_LABELS: Record<string, string> = {
  recurrente: 'Recurrente',
  stripe: 'Stripe',
}

export default async function PaymentsSetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const property = await getActiveProperty(supabase)
  if (!property) redirect('/onboarding')

  const { data: providers } = await supabase
    .from('property_payment_providers')
    .select('id, provider, is_enabled, is_default')
    .eq('property_id', property.id)
    .order('created_at', { ascending: true })

  const activeProviders = (providers ?? []).filter((p) => p.is_enabled) as PaymentProvider[]
  const hasProviders = activeProviders.length > 0

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-6 text-sm text-foreground-muted">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight />
        <Link href="/dashboard/setup" className="hover:text-foreground transition-colors">
          Configuracion
        </Link>
        <ChevronRight />
        <span className="text-foreground font-medium" aria-current="page">
          Pagos
        </span>
      </nav>

      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Configuracion de Pagos
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          {property.name}
        </p>
      </header>

      {/* Provider status card */}
      <section className="bg-white rounded-2xl border border-border p-6 mb-4" aria-label="Estado de proveedores">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <CardIcon />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              Proveedores activos
            </h2>

            {hasProviders ? (
              <ul className="mt-3 space-y-2" aria-label="Proveedores de pago habilitados">
                {activeProviders.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-foreground">
                      {PROVIDER_LABELS[p.provider] ?? p.provider}
                    </span>
                    {p.is_default && (
                      <span className="text-xs font-medium text-foreground-muted bg-surface px-1.5 py-0.5 rounded-md border border-border">
                        por defecto
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-foreground-secondary">
                No hay ningun proveedor de pago configurado para esta propiedad.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Setup guide card — shown when no providers exist */}
      {!hasProviders && (
        <section
          className="bg-white rounded-2xl border border-border p-6 mb-4"
          aria-label="Guia de configuracion"
        >
          <div className="flex items-start gap-3 mb-4">
            <InfoIcon />
            <h2 className="text-base font-semibold text-foreground">
              Como configurar pagos
            </h2>
          </div>
          <p className="text-sm text-foreground-secondary mb-4">
            Configura un proveedor de pago para empezar a recibir reservas con pago.
            Actualmente se soportan los siguientes proveedores:
          </p>
          <ul className="space-y-3 mb-4">
            <li className="flex items-start gap-3">
              <span
                className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700"
                aria-hidden="true"
              >
                1
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Recurrente</p>
                <p className="text-xs text-foreground-muted">
                  Proveedor de pagos en linea para Latinoamerica.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span
                className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700"
                aria-hidden="true"
              >
                2
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Stripe</p>
                <p className="text-xs text-foreground-muted">
                  Plataforma de pagos global con soporte para tarjetas y billeteras digitales.
                </p>
              </div>
            </li>
          </ul>
          <p className="text-xs text-foreground-muted">
            Para activar un proveedor contacta al equipo de soporte o configura las
            credenciales desde el panel de administracion.
          </p>
        </section>
      )}

      {/* Coming soon notice */}
      <section
        className="bg-white rounded-2xl border border-border p-6"
        aria-label="Proximas funcionalidades"
      >
        <div className="flex items-start gap-3">
          <ClockIcon />
          <div>
            <p className="text-sm font-semibold text-foreground">Proximamente</p>
            <p className="mt-0.5 text-sm text-foreground-secondary">
              La gestion completa de proveedores de pago — agregar, editar y eliminar
              configuraciones — estara disponible directamente desde esta seccion.
            </p>
          </div>
        </div>
      </section>
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

function CardIcon() {
  return (
    <svg
      className="w-5 h-5 text-primary-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg
      className="w-5 h-5 text-primary-600 shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4m0-4h.01" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg
      className="w-5 h-5 text-foreground-muted shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}
