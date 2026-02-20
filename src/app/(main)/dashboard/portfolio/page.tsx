import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ range?: string }>
}

interface PropertyRow {
  id: string
  name: string
  currency: string
}

interface PropertyStats {
  id: string
  name: string
  currency: string
  bookings_count: number
  confirmed_count: number
  cancelled_count: number
  revenue_sum: number
  quotes_count: number
  conversion_rate: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDateRange(range: string): { fromISO: string; toISO: string; days: number } {
  const days = range === '7' ? 7 : range === '90' ? 90 : 30
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) // exclusive upper bound
  const from = new Date(to)
  from.setDate(to.getDate() - days)
  return { fromISO: from.toISOString(), toISO: to.toISOString(), days }
}

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function RangeFilter({ active }: { active: string }) {
  const ranges = [
    { value: '7', label: '7 días' },
    { value: '30', label: '30 días' },
    { value: '90', label: '90 días' },
  ]
  return (
    <div className="flex items-center gap-1 bg-surface rounded-xl border border-border p-1">
      {ranges.map((r) => (
        <Link
          key={r.value}
          href={`/dashboard/portfolio?range=${r.value}`}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            active === r.value
              ? 'bg-white text-foreground shadow-sm border border-border'
              : 'text-foreground-secondary hover:text-foreground'
          }`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  )
}

function ConversionBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-sm text-foreground-muted">—</span>
  const color =
    rate >= 30 ? 'text-success-700' : rate >= 10 ? 'text-amber-600' : 'text-red-600'
  return <span className={`text-sm font-medium ${color}`}>{rate}%</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const metadata = { title: 'Portfolio | Revenia' }

export default async function PortfolioPage({ searchParams }: PageProps) {
  const params = await searchParams
  const activeRange = ['7', '30', '90'].includes(params.range ?? '') ? (params.range ?? '30') : '30'
  const { fromISO, toISO, days } = buildDateRange(activeRange)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Todas las properties accesibles — NO filtrar por cookie activa
  const { data: propertiesRaw } = await supabase
    .from('properties')
    .select('id, name, currency')
    .order('created_at', { ascending: true })

  const properties = (propertiesRaw ?? []) as PropertyRow[]
  if (properties.length === 0) redirect('/onboarding')

  const propertyIds = properties.map((p) => p.id)

  // Queries paralelas
  const [bookingsRes, quotesRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('property_id, status, total_amount')
      .in('property_id', propertyIds)
      .gte('created_at', fromISO)
      .lt('created_at', toISO),
    supabase
      .from('booking_quotes')
      .select('property_id')
      .in('property_id', propertyIds)
      .gte('created_at', fromISO)
      .lt('created_at', toISO),
  ])

  const bookings = bookingsRes.data ?? []
  const quotes = quotesRes.data ?? []

  // Agregar en JS por property
  const statsMap = new Map<string, PropertyStats>()
  for (const p of properties) {
    statsMap.set(p.id, {
      id: p.id,
      name: p.name,
      currency: p.currency,
      bookings_count: 0,
      confirmed_count: 0,
      cancelled_count: 0,
      revenue_sum: 0,
      quotes_count: 0,
      conversion_rate: null,
    })
  }

  for (const b of bookings) {
    const s = statsMap.get(b.property_id)
    if (!s) continue
    s.bookings_count++
    if (b.status === 'confirmed') {
      s.confirmed_count++
      s.revenue_sum += Number(b.total_amount ?? 0)
    }
    if (b.status === 'cancelled') s.cancelled_count++
  }

  for (const q of quotes) {
    const s = statsMap.get(q.property_id)
    if (!s) continue
    s.quotes_count++
  }

  for (const s of statsMap.values()) {
    s.conversion_rate =
      s.quotes_count > 0
        ? Math.round((s.confirmed_count / s.quotes_count) * 1000) / 10
        : null
  }

  const stats = [...statsMap.values()]

  // Fila de totales (sin mezclar currencies en revenue)
  const totals = stats.reduce(
    (acc, s) => ({
      bookings_count: acc.bookings_count + s.bookings_count,
      confirmed_count: acc.confirmed_count + s.confirmed_count,
      cancelled_count: acc.cancelled_count + s.cancelled_count,
      quotes_count: acc.quotes_count + s.quotes_count,
    }),
    { bookings_count: 0, confirmed_count: 0, cancelled_count: 0, quotes_count: 0 }
  )

  const totalConversion =
    totals.quotes_count > 0
      ? Math.round((totals.confirmed_count / totals.quotes_count) * 1000) / 10
      : null

  const hasActivity = stats.some((s) => s.bookings_count > 0 || s.quotes_count > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">Portfolio</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Comparativo de métricas por propiedad · Últimos {days} días
          </p>
        </div>
        <RangeFilter active={activeRange} />
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs text-foreground-muted uppercase tracking-wider">Propiedades</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{properties.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs text-foreground-muted uppercase tracking-wider">Reservas totales</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{totals.bookings_count}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs text-foreground-muted uppercase tracking-wider">Confirmadas</p>
          <p className="mt-1 text-2xl font-semibold text-success-700">{totals.confirmed_count}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs text-foreground-muted uppercase tracking-wider">Cotizaciones</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{totals.quotes_count}</p>
        </div>
      </div>

      {/* Tabla comparativa */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider w-48">
                Propiedad
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">
                Reservas
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">
                Confirmadas
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">
                Canceladas
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">
                Revenue
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">
                Cotizaciones
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">
                Conversión
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stats.map((s) => (
              <tr key={s.id} className="hover:bg-surface/50 transition-colors">
                <td className="px-5 py-4">
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                  <span className="ml-2 text-xs text-foreground-muted">{s.currency}</span>
                </td>
                <td className="px-4 py-4 text-right text-sm text-foreground">
                  {s.bookings_count}
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-medium text-success-700">
                    {s.confirmed_count}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span
                    className={`text-sm ${
                      s.cancelled_count > 0 ? 'text-red-600' : 'text-foreground-muted'
                    }`}
                  >
                    {s.cancelled_count || '—'}
                  </span>
                </td>
                <td className="px-4 py-4 text-right text-sm font-medium text-foreground">
                  {s.revenue_sum > 0 ? formatCurrency(s.revenue_sum, s.currency) : '—'}
                </td>
                <td className="px-4 py-4 text-right text-sm text-foreground">
                  {s.quotes_count}
                </td>
                <td className="px-4 py-4 text-right">
                  <ConversionBadge rate={s.conversion_rate} />
                </td>
              </tr>
            ))}
          </tbody>

          {/* Totals row — solo cuando hay >1 property */}
          {stats.length > 1 && (
            <tfoot className="border-t-2 border-border bg-surface">
              <tr>
                <td className="px-5 py-3 text-sm font-semibold text-foreground">
                  Total ({stats.length} propiedades)
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                  {totals.bookings_count}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-success-700">
                  {totals.confirmed_count}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-red-600">
                  {totals.cancelled_count || '—'}
                </td>
                <td className="px-4 py-3 text-right text-xs text-foreground-muted italic">
                  Multi-currency
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                  {totals.quotes_count}
                </td>
                <td className="px-4 py-3 text-right">
                  <ConversionBadge rate={totalConversion} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Empty state */}
      {!hasActivity && (
        <div className="text-center py-6 text-sm text-foreground-muted">
          No hay actividad registrada en este período para ninguna propiedad.
        </div>
      )}
    </div>
  )
}
