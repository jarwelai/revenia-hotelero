import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActiveProperty } from '@/lib/property-context'

export const metadata = { title: 'Contenido | Revenia' }

export default async function ContentSetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const property = await getActiveProperty(supabase)
  if (!property) redirect('/onboarding')

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
          Contenido
        </span>
      </nav>

      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Contenido Publico
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          {property.name}
        </p>
      </header>

      {/* Content card */}
      <section className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <DocumentIcon />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              Textos de las paginas de reserva
            </h2>
            <p className="mt-1 text-sm text-foreground-secondary">
              Gestiona los textos visibles para los huespedes: encabezados, descripciones,
              mensajes de bienvenida y avisos en las paginas publicas de reserva de{' '}
              <strong>{property.name}</strong>.
            </p>
            <p className="mt-2 text-sm text-foreground-secondary">
              Solo el contenido <span className="text-green-700 font-medium">aprobado</span>{' '}
              es visible para los visitantes.
            </p>
            <div className="mt-5">
              <Link
                href="/dashboard/settings/content"
                className="inline-flex items-center gap-2 bg-primary-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Gestionar contenido
                <ArrowRight />
              </Link>
            </div>
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

function DocumentIcon() {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function ArrowRight() {
  return (
    <svg
      className="w-4 h-4"
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
