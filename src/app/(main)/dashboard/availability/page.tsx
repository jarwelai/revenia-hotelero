import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAvailability } from '@/lib/availability'
import { getActiveProperty } from '@/lib/property-context'
import type { SearchParams } from 'next/dist/server/request/search-params'

export const metadata = { title: 'Disponibilidad | Revenia' }

// Fechas de hoy y mañana como defaults
function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}
function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function AvailabilityPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const property = await getActiveProperty(supabase)
  if (!property) redirect('/onboarding')

  const params = await searchParams
  const dateFrom = typeof params.from === 'string' ? params.from : todayStr()
  const dateTo   = typeof params.to   === 'string' ? params.to   : tomorrowStr()

  let result = null
  let queryError: string | null = null

  // Solo consultar si las fechas son válidas (dateFrom < dateTo)
  if (dateFrom < dateTo) {
    try {
      result = await getAvailability(property.id, dateFrom, dateTo)
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Error al consultar disponibilidad'
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-foreground-secondary mb-2">
          <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <span>›</span>
          <span>Disponibilidad</span>
        </div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Disponibilidad</h1>
        <p className="text-foreground-secondary mt-1">{property.name} · Consulta por rango de fechas</p>
      </div>

      {/* Date Range Form */}
      <form method="GET" className="mb-8 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-1">Check-in</label>
          <input
            type="date"
            name="from"
            defaultValue={dateFrom}
            className="rounded-xl border border-border px-3 py-2 text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-1">Check-out</label>
          <input
            type="date"
            name="to"
            defaultValue={dateTo}
            className="rounded-xl border border-border px-3 py-2 text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-accent-600 hover:bg-accent-700 text-white px-5 py-2 text-sm font-medium transition-colors"
        >
          Consultar
        </button>
      </form>

      {/* Error */}
      {dateFrom >= dateTo && (
        <div className="rounded-xl bg-error-50 border border-error-200 p-4 mb-6">
          <p className="text-sm text-error-700">El check-out debe ser posterior al check-in.</p>
        </div>
      )}

      {queryError && (
        <div className="rounded-xl bg-error-50 border border-error-200 p-4 mb-6">
          <p className="text-sm text-error-700">{queryError}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border p-4 bg-surface">
              <p className="text-xs text-foreground-secondary uppercase tracking-wide mb-1">Período</p>
              <p className="font-semibold text-foreground">
                {dateFrom} → {dateTo}
              </p>
            </div>
            <div className="rounded-2xl border border-border p-4 bg-surface">
              <p className="text-xs text-foreground-secondary uppercase tracking-wide mb-1">Total unidades</p>
              <p className="text-2xl font-bold text-foreground">{result.totalRooms}</p>
            </div>
            <div className={`rounded-2xl border p-4 ${
              result.totalAvailable > 0
                ? 'border-success-200 bg-success-50'
                : 'border-error-200 bg-error-50'
            }`}>
              <p className="text-xs text-foreground-secondary uppercase tracking-wide mb-1">Disponibles</p>
              <p className={`text-2xl font-bold ${
                result.totalAvailable > 0 ? 'text-success-700' : 'text-error-700'
              }`}>
                {result.totalAvailable}
              </p>
            </div>
          </div>

          {/* By Room Type */}
          {result.byType.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
              <p className="text-foreground-secondary">No hay unidades configuradas para esta propiedad</p>
            </div>
          ) : (
            <div className="space-y-4">
              {result.byType.map((group) => (
                <div key={group.roomTypeId ?? 'no-type'} className="rounded-2xl border border-border overflow-hidden">
                  {/* Group Header */}
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-border">
                    <div>
                      <h3 className="font-semibold text-foreground">{group.roomTypeName}</h3>
                      <p className="text-xs text-foreground-secondary">
                        {group.totalUnits} unidad{group.totalUnits !== 1 ? 'es' : ''} en total
                      </p>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                      group.availableUnits > 0
                        ? 'bg-success-100 text-success-700'
                        : 'bg-error-100 text-error-700'
                    }`}>
                      {group.availableUnits}/{group.totalUnits} disponible{group.availableUnits !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Available Rooms */}
                  {group.rooms.length > 0 ? (
                    <ul className="divide-y divide-border">
                      {group.rooms.map((room) => (
                        <li key={room.id} className="flex items-center px-5 py-3">
                          <span className="w-2 h-2 rounded-full bg-success-500 mr-3 flex-shrink-0" />
                          <span className="text-sm text-foreground">{room.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-5 py-4 text-sm text-foreground-secondary italic">
                      Todas las unidades están ocupadas en este período
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
