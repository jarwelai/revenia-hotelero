import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActivePropertyWithRole } from '@/lib/property-context'
import { getSourceConnections } from '@/actions/review-sources'
import { getPublishRules } from '@/actions/review-rules'
import { SourceConnectionSetup } from '@/features/reviews/components/SourceConnectionSetup'
import { ReviewDiscoveryList } from '@/features/reviews/components/ReviewDiscoveryList'
import { PublishRulesForm } from '@/features/reviews/components/PublishRulesForm'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReviewsDiscoverPage() {
  const supabase = await createClient()

  // Autenticacion / Authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')
  if (!role || role === 'staff') redirect('/dashboard/reviews')

  // Fetch source connections and publish rules in parallel
  const [connectionsResult, rulesResult] = await Promise.all([
    getSourceConnections(property.id),
    getPublishRules(property.id),
  ])

  const connections = connectionsResult.connections ?? []
  const rules = rulesResult.rules ?? null

  // Determine connected sources for section headings
  const googleConn = connections.find((c) => c.source === 'google') ?? null
  const tripConn = connections.find((c) => c.source === 'tripadvisor') ?? null

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-foreground-secondary">
        <Link href="/dashboard/reviews" className="hover:text-foreground transition-colors">
          Resenas
        </Link>
        <span>/</span>
        <span className="text-foreground">Descubrir resenas</span>
        {/* Reviews / Discover reviews */}
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-semibold text-foreground">
          Descubrir resenas externas
          {/* Discover external reviews */}
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Conecta Google Maps y TripAdvisor para importar resenas de {property.name}.
          {/* Connect Google Maps and TripAdvisor to import reviews for [property]. */}
        </p>
      </div>

      {/* ── Section 1: Source connections ─────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Conexion de fuentes
            {/* Source connections */}
          </h2>
          <p className="mt-0.5 text-sm text-foreground-secondary">
            Vincula tu propiedad con su perfil en cada plataforma.
            {/* Link your property to its profile on each platform. */}
          </p>
        </div>
        <SourceConnectionSetup propertyId={property.id} connections={connections} />
      </section>

      {/* ── Section 2: Discovery tabs ─────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Importar resenas
            {/* Import reviews */}
          </h2>
          <p className="mt-0.5 text-sm text-foreground-secondary">
            Selecciona las resenas que quieres agregar a tu panel.
            {/* Select the reviews you want to add to your dashboard. */}
          </p>
        </div>

        {/* Google Maps discovery */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Google Maps</span>
            {googleConn ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success-700 bg-success-50 border border-success-200 rounded-full px-2 py-0.5">
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                Conectado
                {/* Connected */}
              </span>
            ) : (
              <span className="text-xs text-foreground-muted">
                No conectado — configura la conexion arriba
                {/* Not connected — configure the connection above */}
              </span>
            )}
          </div>
          {googleConn ? (
            <ReviewDiscoveryList propertyId={property.id} source="google" />
          ) : (
            <p className="text-sm text-foreground-muted italic">
              Conecta Google Maps para importar resenas.
              {/* Connect Google Maps to import reviews. */}
            </p>
          )}
        </div>

        <hr className="border-border" />

        {/* TripAdvisor discovery */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">TripAdvisor</span>
            {tripConn ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success-700 bg-success-50 border border-success-200 rounded-full px-2 py-0.5">
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                Conectado
                {/* Connected */}
              </span>
            ) : (
              <span className="text-xs text-foreground-muted">
                No conectado — configura la conexion arriba
                {/* Not connected — configure the connection above */}
              </span>
            )}
          </div>
          {tripConn ? (
            <ReviewDiscoveryList propertyId={property.id} source="tripadvisor" />
          ) : (
            <p className="text-sm text-foreground-muted italic">
              Conecta TripAdvisor para importar resenas.
              {/* Connect TripAdvisor to import reviews. */}
            </p>
          )}
        </div>
      </section>

      {/* ── Section 3: Publish rules ──────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-border shadow-card p-6">
        <PublishRulesForm propertyId={property.id} initialRules={rules} />
      </section>
    </div>
  )
}
