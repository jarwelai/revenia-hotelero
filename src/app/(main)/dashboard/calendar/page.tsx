import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTapeChart } from '@/actions/calendar'
import { TapeChart } from '@/features/calendar/components/TapeChart'
import { getActiveProperty } from '@/lib/property-context'
import type { SearchParams } from 'next/dist/server/request/search-params'

export const metadata = { title: 'Calendario | Revenia' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatRangeLabel(dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom + 'T00:00:00Z')
  const toDate = new Date(dateTo + 'T00:00:00Z')
  toDate.setUTCDate(toDate.getUTCDate() - 1)  // mostrar último día incluido
  return `${from.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })} — ${toDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`
}

interface Props {
  searchParams: Promise<SearchParams>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CalendarPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const property = await getActiveProperty(supabase)
  if (!property) redirect('/onboarding')

  const params = await searchParams
  const dateFrom = typeof params.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.from)
    ? params.from
    : todayStr()
  const dateTo = addDays(dateFrom, 14)

  const prevFrom = addDays(dateFrom, -14)
  const nextFrom = addDays(dateFrom, 14)

  const tapeData = await getTapeChart(property.id, dateFrom, dateTo)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-foreground-secondary mb-2">
          <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <span>›</span>
          <span>Calendario</span>
        </div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Calendario</h1>
        <p className="text-foreground-secondary mt-1">{property.name}</p>
      </div>

      {/* Navegación de período */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/dashboard/calendar?from=${prevFrom}`}
          className="px-3 py-1.5 text-sm font-medium border border-border rounded-xl bg-white text-foreground-secondary hover:bg-surface transition-colors"
        >
          ← 14 días
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground capitalize">
            {formatRangeLabel(dateFrom, dateTo)}
          </p>
          {dateFrom !== todayStr() && (
            <Link
              href="/dashboard/calendar"
              className="text-xs text-accent-600 hover:text-accent-700"
            >
              Ir a hoy
            </Link>
          )}
        </div>
        <Link
          href={`/dashboard/calendar?from=${nextFrom}`}
          className="px-3 py-1.5 text-sm font-medium border border-border rounded-xl bg-white text-foreground-secondary hover:bg-surface transition-colors"
        >
          Siguiente 14 días →
        </Link>
      </div>

      {/* Tape Chart */}
      {tapeData.rooms.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
          <p className="text-foreground-secondary mb-3">No hay habitaciones configuradas</p>
          <Link
            href="/dashboard/rooms/new"
            className="text-sm font-medium text-accent-600 hover:text-accent-700"
          >
            Crear primera habitación →
          </Link>
        </div>
      ) : (
        <TapeChart data={tapeData} propertyId={property.id} />
      )}
    </div>
  )
}
