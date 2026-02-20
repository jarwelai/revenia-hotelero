import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActivePropertyWithRole } from '@/lib/property-context'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export const metadata = {
  title: 'Dashboard | Revenia',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const { data: org } = await supabase
    .from('orgs')
    .select('id, name, slug')
    .eq('id', property.org_id)
    .single()

  const roleLabel: Record<string, string> = {
    owner: 'Propietario',
    manager: 'Gerente',
    staff: 'Staff',
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-foreground">
          Bienvenido a {org?.name ?? 'Revenia'}
        </h1>
        <p className="text-foreground-secondary mt-1">
          Panel de control · {roleLabel[role ?? ''] ?? role ?? ''}
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Propiedad activa */}
        {property && (
          <Card variant="gold-accent">
            <CardHeader>
              <CardTitle>Propiedad activa</CardTitle>
              <CardDescription>Tu hotel configurado</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">{property.name}</p>
              <div className="mt-3 space-y-1.5">
                <p className="text-sm text-foreground-secondary">
                  <span className="font-medium text-foreground">Zona horaria:</span>{' '}
                  {property.timezone}
                </p>
                <p className="text-sm text-foreground-secondary">
                  <span className="font-medium text-foreground">Moneda:</span>{' '}
                  {property.currency}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Habitaciones (Fase 2) */}
        <Card>
          <CardHeader>
            <CardTitle>Habitaciones</CardTitle>
            <CardDescription>Disponible en Fase 2</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground-secondary">
              Gestión de tipos de habitación, inventario y tarifas por temporada.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium bg-border px-3 py-1 rounded-full">
              <ClockIcon className="w-3.5 h-3.5" />
              Próximamente
            </div>
          </CardContent>
        </Card>

        {/* Reservas (Fase 2) */}
        <Card>
          <CardHeader>
            <CardTitle>Reservas</CardTitle>
            <CardDescription>Disponible en Fase 2</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground-secondary">
              Motor de reservas directas, gestión de disponibilidad y calendario multi-canal.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium bg-border px-3 py-1 rounded-full">
              <ClockIcon className="w-3.5 h-3.5" />
              Próximamente
            </div>
          </CardContent>
        </Card>

        {/* Agente IA (Fase 3) */}
        <Card>
          <CardHeader>
            <CardTitle>Agente IA</CardTitle>
            <CardDescription>Disponible en Fase 3</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground-secondary">
              Asistente inteligente que cotiza, confirma y procesa pagos vía WhatsApp automáticamente.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium bg-border px-3 py-1 rounded-full">
              <ClockIcon className="w-3.5 h-3.5" />
              Próximamente
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  )
}
