import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CancelButton } from '@/features/bookings/components'
import { getActivePropertyWithRole } from '@/lib/property-context'
import type { Booking, Room } from '@/types/hotelero'

export const metadata = { title: 'Reservas | Revenia' }

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  confirmed:  { label: 'Confirmada',  classes: 'bg-success-100 text-success-700' },
  hold:       { label: 'En espera',   classes: 'bg-warning-100 text-warning-700' },
  cancelled:  { label: 'Cancelada',   classes: 'bg-gray-100 text-gray-500' },
  no_show:    { label: 'No show',     classes: 'bg-error-100 text-error-700' },
}

const VALID_STATUSES = ['all', 'confirmed', 'hold', 'cancelled', 'no_show'] as const
type FilterStatus = typeof VALID_STATUSES[number]

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function BookingsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const rawStatus = params.status ?? 'confirmed'
  const filterStatus: FilterStatus = (VALID_STATUSES.includes(rawStatus as FilterStatus)
    ? rawStatus
    : 'confirmed') as FilterStatus

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const canEdit = role === 'owner' || role === 'manager'

  // Bookings con join a rooms
  let query = supabase
    .from('bookings')
    .select('id, guest_name, guest_email, guest_phone, check_in, check_out, status, source, created_at, room:rooms(name)')
    .eq('property_id', property.id)
    .order('check_in', { ascending: false })

  if (filterStatus !== 'all') {
    query = query.eq('status', filterStatus)
  }

  const { data: bookings } = await query

  type BookingRow = Booking & { room: Pick<Room, 'name'> | null }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Reservas</h1>
          <p className="text-foreground-secondary mt-1">{property.name}</p>
        </div>
        {canEdit && (
          <Link
            href="/dashboard/bookings/new"
            className="inline-flex items-center gap-2 bg-primary-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-600 transition-colors"
          >
            + Nueva reserva
          </Link>
        )}
      </div>

      {/* Filtros de estado */}
      <div className="flex flex-wrap gap-2 mb-6">
        {VALID_STATUSES.map((s) => {
          const label = s === 'all' ? 'Todas' : (STATUS_CONFIG[s]?.label ?? s)
          const isActive = filterStatus === s
          return (
            <Link
              key={s}
              href={`/dashboard/bookings?status=${s}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500 text-white'
                  : 'bg-white border border-border text-foreground-secondary hover:text-foreground hover:border-primary-300'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Tabla */}
      {!bookings?.length ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <p className="text-foreground-secondary mb-3">No hay reservas con este filtro</p>
          {canEdit && filterStatus !== 'all' && (
            <Link
              href="/dashboard/bookings?status=all"
              className="text-sm font-medium text-accent-600 hover:text-accent-700"
            >
              Ver todas →
            </Link>
          )}
          {canEdit && (
            <div className="mt-4">
              <Link
                href="/dashboard/bookings/new"
                className="text-sm font-medium text-accent-600 hover:text-accent-700"
              >
                Crear primera reserva →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Huésped</th>
                <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Unidad</th>
                <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Check-in</th>
                <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Check-out</th>
                <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Estado</th>
                {canEdit && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(bookings as unknown as BookingRow[]).map((b) => {
                const status = STATUS_CONFIG[b.status] ?? { label: b.status, classes: 'bg-gray-100 text-gray-500' }
                const isCancelled = b.status === 'cancelled'
                return (
                  <tr key={b.id} className={`hover:bg-gray-50/50 ${isCancelled ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{b.guest_name}</p>
                      {b.guest_email && (
                        <p className="text-xs text-foreground-muted">{b.guest_email}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-foreground-secondary">
                      {b.room?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-foreground">{b.check_in}</td>
                    <td className="px-5 py-3.5 font-mono text-foreground">{b.check_out}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.classes}`}>
                        {status.label}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3.5 text-right">
                        {!isCancelled && (
                          <CancelButton bookingId={b.id} guestName={b.guest_name} />
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-foreground-muted text-right">
        {bookings?.length ?? 0} reserva(s) mostrada(s)
      </p>
    </div>
  )
}
