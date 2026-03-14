import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActiveProperty } from '@/lib/property-context'
import type { RoomType, Room } from '@/types/hotelero'

export const metadata = { title: 'Habitaciones | Revenia' }

// ─── Types ─────────────────────────────────────────────────────────────────────

type RoomTypeRow = Pick<RoomType, 'id' | 'name' | 'max_occupancy' | 'base_price'>
type RoomRow = Pick<Room, 'id' | 'name' | 'room_type_id'>

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function InventorySetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const property = await getActiveProperty(supabase)
  if (!property) redirect('/onboarding')

  const [{ data: roomTypes }, { data: rooms }] = await Promise.all([
    supabase
      .from('room_types')
      .select('id, name, max_occupancy, base_price')
      .eq('property_id', property.id)
      .order('name'),
    supabase
      .from('rooms')
      .select('id, name, room_type_id')
      .eq('property_id', property.id)
      .order('name'),
  ])

  const typedRoomTypes = (roomTypes ?? []) as RoomTypeRow[]
  const typedRooms = (rooms ?? []) as RoomRow[]

  // Group room names by room_type_id for O(1) lookups in the render
  const roomsByType = typedRooms.reduce<Record<string, string[]>>((acc, room) => {
    const key = room.room_type_id ?? '__unassigned__'
    if (!acc[key]) acc[key] = []
    acc[key].push(room.name)
    return acc
  }, {})

  const totalRooms = typedRooms.length

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav aria-label="Navegación de sección" className="flex items-center gap-1.5 text-sm text-foreground-muted mb-6">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight />
        <Link href="/dashboard/setup" className="hover:text-foreground transition-colors">
          Configuracion
        </Link>
        <ChevronRight />
        <span className="text-foreground font-medium">Habitaciones</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
          Inventario de Habitaciones
        </h1>
        <p className="mt-1 text-foreground-secondary text-sm">
          {property.name}
          {totalRooms > 0 && (
            <>
              {' '}
              <span aria-hidden="true">&middot;</span>
              {' '}
              <span className="font-medium text-foreground">{totalRooms}</span>{' '}
              {totalRooms === 1 ? 'unidad' : 'unidades'} en total
            </>
          )}
        </p>
      </div>

      {/* Empty state */}
      {typedRoomTypes.length === 0 ? (
        <section
          className="bg-white rounded-2xl border border-border p-10 text-center"
          aria-label="Sin tipos de habitacion"
        >
          <BedIcon className="w-10 h-10 text-foreground-muted mx-auto mb-3" aria-hidden="true" />
          <p className="text-foreground font-medium mb-1">
            No hay tipos de habitacion configurados
          </p>
          <p className="text-sm text-foreground-secondary mb-5">
            Crea al menos un tipo antes de agregar unidades.
          </p>
          <Link
            href="/dashboard/rooms"
            className="inline-flex items-center gap-2 bg-primary-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-primary-600 transition-colors"
          >
            Gestionar habitaciones
          </Link>
        </section>
      ) : (
        <>
          {/* Room type cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {typedRoomTypes.map((rt) => {
              const assignedRooms = roomsByType[rt.id] ?? []
              return (
                <section
                  key={rt.id}
                  className="bg-white rounded-2xl border border-border p-6"
                  aria-label={`Tipo: ${rt.name}`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h2 className="text-base font-semibold text-foreground leading-tight">
                      {rt.name}
                    </h2>
                    <span
                      className="shrink-0 inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold tabular-nums"
                      aria-label={`${assignedRooms.length} ${assignedRooms.length === 1 ? 'unidad' : 'unidades'}`}
                    >
                      {assignedRooms.length}
                    </span>
                  </div>

                  {/* Metadata row */}
                  <dl className="flex flex-wrap gap-x-5 gap-y-1.5 mb-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <dt className="text-foreground-secondary">Ocupacion max.</dt>
                      <dd className="font-medium text-foreground">{rt.max_occupancy}</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="text-foreground-secondary">Precio base</dt>
                      <dd className="font-medium text-foreground">
                        {formatPrice(rt.base_price, property.currency)}
                      </dd>
                    </div>
                  </dl>

                  {/* Rooms list */}
                  {assignedRooms.length > 0 ? (
                    <ul
                      className="flex flex-wrap gap-1.5"
                      aria-label={`Unidades de ${rt.name}`}
                    >
                      {assignedRooms.map((roomName) => (
                        <li
                          key={roomName}
                          className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
                        >
                          {roomName}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-foreground-muted italic">
                      Sin unidades asignadas a este tipo
                    </p>
                  )}
                </section>
              )
            })}
          </div>

          {/* CTA: link to full management page */}
          <div className="flex justify-end">
            <Link
              href="/dashboard/rooms"
              className="inline-flex items-center gap-2 bg-primary-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-primary-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Gestionar habitaciones
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Inline icons (no Lucide import needed for simple SVGs) ────────────────────

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

function BedIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 21V6.75A2.25 2.25 0 0 1 4.5 4.5h15A2.25 2.25 0 0 1 21.75 6.75V21M2.25 21h19.5M2.25 21v-3.75c0-.621.504-1.125 1.125-1.125h17.25c.621 0 1.125.504 1.125 1.125V21M6.75 13.5h10.5M6.75 13.5A1.5 1.5 0 0 0 5.25 15v1.5h13.5V15a1.5 1.5 0 0 0-1.5-1.5H6.75Z"
      />
    </svg>
  )
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  )
}
