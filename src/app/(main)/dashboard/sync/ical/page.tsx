import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SyncButton } from '@/features/rooms/components'
import { getActiveProperty } from '@/lib/property-context'
import type { Room, SyncStatus } from '@/types/hotelero'

export const metadata = { title: 'Sincronización iCal | Revenia' }

const SYNC_STALE_MINUTES = 15

function effectiveSyncStatus(room: Room): SyncStatus {
  if (!room.last_synced_at) return 'never'
  if (room.sync_status === 'error') return 'error'
  const ageMs = Date.now() - new Date(room.last_synced_at).getTime()
  if (ageMs > SYNC_STALE_MINUTES * 60 * 1000) return 'stale'
  return room.sync_status
}

export default async function SyncIcalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const property = await getActiveProperty(supabase)
  if (!property) redirect('/onboarding')

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name, ical_url, sync_enabled, sync_status, last_synced_at, last_sync_error, room_type:room_types(name)')
    .eq('property_id', property.id)
    .order('name')

  // Count active external_reservations per room (status != 'cancelled')
  const { data: reservationCounts } = await supabase
    .from('external_reservations')
    .select('room_id')
    .neq('status', 'cancelled')
    .in('room_id', (rooms ?? []).map((r) => r.id))

  const countByRoom: Record<string, number> = {}
  for (const row of reservationCounts ?? []) {
    countByRoom[row.room_id] = (countByRoom[row.room_id] ?? 0) + 1
  }

  const syncStatusConfig: Record<SyncStatus, { label: string; classes: string }> = {
    ok: { label: 'OK', classes: 'bg-success-100 text-success-700' },
    error: { label: 'Error', classes: 'bg-error-100 text-error-700' },
    stale: { label: 'Desactualizado', classes: 'bg-warning-100 text-warning-700' },
    never: { label: 'Nunca', classes: 'bg-gray-100 text-gray-600' },
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-foreground-secondary mb-2">
          <Link href="/dashboard/rooms" className="hover:text-foreground">Habitaciones</Link>
          <span>›</span>
          <span>Sincronización iCal</span>
        </div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Sincronización iCal</h1>
        <p className="text-foreground-secondary mt-1">
          {property.name} · Trigger manual por unidad · Stale threshold: {SYNC_STALE_MINUTES} min
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 p-4">
        <p className="text-sm text-blue-800">
          <strong>Flujo shadow strategy:</strong> Revenia lee el iCal de MotoPress → guarda bloqueos en{' '}
          <code className="bg-blue-100 px-1 rounded">external_reservations</code> → el Agente IA consulta
          Revenia para disponibilidad (sin tocar MotoPress directamente).
        </p>
      </div>

      {/* Table */}
      {!rooms?.length ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
          <p className="text-foreground-secondary mb-3">No hay unidades configuradas</p>
          <Link href="/dashboard/rooms/new" className="text-sm font-medium text-accent-600 hover:text-accent-700">
            Crear primera unidad →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Unidad</th>
                <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Tipo</th>
                <th className="text-left px-5 py-3 font-medium text-foreground-secondary">iCal URL</th>
                <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Estado</th>
                <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Último sync</th>
                <th className="text-center px-5 py-3 font-medium text-foreground-secondary">Bloqueos</th>
                <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(rooms as unknown as Room[]).map((room) => {
                const status = effectiveSyncStatus(room)
                const statusCfg = syncStatusConfig[status]
                const activeCount = countByRoom[room.id] ?? 0
                return (
                  <tr key={room.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-4 font-medium text-foreground">{room.name}</td>
                    <td className="px-5 py-4 text-foreground-secondary">
                      {room.room_type?.name ?? '—'}
                    </td>
                    <td className="px-5 py-4 max-w-[220px]">
                      {room.ical_url ? (
                        <code className="text-xs text-foreground-muted bg-gray-50 px-2 py-0.5 rounded block truncate" title={room.ical_url}>
                          {room.ical_url}
                        </code>
                      ) : (
                        <Link href={`/dashboard/rooms/${room.id}/edit`} className="text-xs text-accent-600 hover:text-accent-700">
                          Configurar URL
                        </Link>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.classes}`}>
                          {statusCfg.label}
                        </span>
                        {room.last_sync_error && (
                          <p className="text-xs text-error-600 max-w-[200px] truncate" title={room.last_sync_error}>
                            {room.last_sync_error}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-foreground-secondary text-xs">
                      {room.last_synced_at
                        ? new Date(room.last_synced_at).toLocaleString('es-GT', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        activeCount > 0 ? 'bg-accent-100 text-accent-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {activeCount}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <SyncButton roomId={room.id} hasIcalUrl={!!room.ical_url} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
