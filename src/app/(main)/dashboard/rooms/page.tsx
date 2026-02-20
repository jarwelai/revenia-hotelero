import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { deleteRoomType, deleteRoom } from '@/actions/rooms'
import { DeleteButton } from '@/features/rooms/components'
import { getActivePropertyWithRole } from '@/lib/property-context'
import type { RoomType, Room } from '@/types/hotelero'

export const metadata = { title: 'Habitaciones | Revenia' }

export default async function RoomsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')

  const [{ data: roomTypes }, { data: rooms }] = await Promise.all([
    supabase
      .from('room_types')
      .select('id, name, description, max_occupancy, base_price')
      .eq('property_id', property.id)
      .order('name'),
    supabase
      .from('rooms')
      .select('id, name, motopress_accommodation_id, ical_url, sync_status, last_synced_at, room_type:room_types(name)')
      .eq('property_id', property.id)
      .order('name'),
  ])

  const canEdit = role === 'owner' || role === 'manager'

  const syncStatusLabel: Record<string, { label: string; classes: string }> = {
    ok: { label: 'OK', classes: 'bg-success-100 text-success-700' },
    error: { label: 'Error', classes: 'bg-error-100 text-error-700' },
    stale: { label: 'Desactualizado', classes: 'bg-warning-100 text-warning-700' },
    never: { label: 'Sin sync', classes: 'bg-gray-100 text-gray-600' },
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Habitaciones</h1>
          <p className="text-foreground-secondary mt-1">{property.name}</p>
        </div>
        {canEdit && (
          <div className="flex gap-3">
            <Link
              href="/dashboard/rooms/types/new"
              className="inline-flex items-center gap-2 bg-white border border-border text-foreground text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              + Nuevo Tipo
            </Link>
            <Link
              href="/dashboard/rooms/new"
              className="inline-flex items-center gap-2 bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-primary-600 transition-colors"
            >
              + Nueva Unidad
            </Link>
          </div>
        )}
      </div>

      {/* ─── Room Types ─── */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Tipos de Habitación
          <span className="ml-2 text-sm font-normal text-foreground-secondary">
            ({roomTypes?.length ?? 0})
          </span>
        </h2>

        {!roomTypes?.length ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <p className="text-foreground-secondary mb-3">No hay tipos de habitación aún</p>
            {canEdit && (
              <Link
                href="/dashboard/rooms/types/new"
                className="text-sm font-medium text-accent-600 hover:text-accent-700"
              >
                Crear primer tipo →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Descripción</th>
                  <th className="text-center px-5 py-3 font-medium text-foreground-secondary">Ocupación máx.</th>
                  <th className="text-right px-5 py-3 font-medium text-foreground-secondary">Precio base</th>
                  {canEdit && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(roomTypes as unknown as RoomType[]).map((rt) => (
                  <tr key={rt.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-medium text-foreground">{rt.name}</td>
                    <td className="px-5 py-3.5 text-foreground-secondary">{rt.description ?? '—'}</td>
                    <td className="px-5 py-3.5 text-center text-foreground">{rt.max_occupancy}</td>
                    <td className="px-5 py-3.5 text-right text-foreground">
                      {rt.base_price != null ? `$${rt.base_price}` : '—'}
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/dashboard/rooms/types/${rt.id}/edit`}
                            className="text-sm font-medium text-foreground-secondary hover:text-foreground"
                          >
                            Editar
                          </Link>
                          <DeleteButton
                            action={deleteRoomType}
                            id={rt.id}
                            confirmMessage={`¿Eliminar el tipo "${rt.name}"? Las unidades asociadas perderán su tipo.`}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Rooms/Units ─── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Unidades
          <span className="ml-2 text-sm font-normal text-foreground-secondary">
            ({rooms?.length ?? 0})
          </span>
        </h2>

        {!rooms?.length ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <p className="text-foreground-secondary mb-3">No hay unidades configuradas aún</p>
            {canEdit && (
              <Link
                href="/dashboard/rooms/new"
                className="text-sm font-medium text-accent-600 hover:text-accent-700"
              >
                Crear primera unidad →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Unidad</th>
                  <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Tipo</th>
                  <th className="text-left px-5 py-3 font-medium text-foreground-secondary">MP ID</th>
                  <th className="text-left px-5 py-3 font-medium text-foreground-secondary">iCal</th>
                  <th className="text-left px-5 py-3 font-medium text-foreground-secondary">Sync</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(rooms as unknown as Room[]).map((room) => {
                  const status = syncStatusLabel[room.sync_status] ?? syncStatusLabel.never
                  return (
                    <tr key={room.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 font-medium text-foreground">{room.name}</td>
                      <td className="px-5 py-3.5 text-foreground-secondary">
                        {room.room_type?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-foreground-secondary font-mono">
                        {room.motopress_accommodation_id ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-foreground-secondary max-w-[200px]">
                        {room.ical_url ? (
                          <span className="truncate block text-xs text-foreground-muted" title={room.ical_url}>
                            ✓ Configurada
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.classes}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/dashboard/rooms/${room.id}/availability`}
                            className="text-sm font-medium text-foreground-secondary hover:text-foreground"
                          >
                            Disponibilidad
                          </Link>
                          <span
                            className="text-xs text-foreground-muted cursor-not-allowed"
                            title="Próximamente"
                          >
                            Tarifas
                          </span>
                          {canEdit && (
                            <>
                              <Link
                                href={`/dashboard/rooms/${room.id}/edit`}
                                className="text-sm font-medium text-foreground-secondary hover:text-foreground"
                              >
                                Editar
                              </Link>
                              <DeleteButton
                                action={deleteRoom}
                                id={room.id}
                                confirmMessage={`¿Eliminar la unidad "${room.name}"?`}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!!rooms?.length && (
          <div className="mt-4 text-right">
            <Link
              href="/dashboard/sync/ical"
              className="text-sm font-medium text-accent-600 hover:text-accent-700"
            >
              Ir a Sincronización iCal →
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
