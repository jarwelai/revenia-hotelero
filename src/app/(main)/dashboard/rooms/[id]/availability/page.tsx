import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveProperty } from '@/lib/property-context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string }>
}

type DayStatus = 'booked' | 'external' | 'free'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

/** Genera todas las noches de un rango [checkIn, checkOut) */
function expandReservationNights(checkIn: string, checkOut: string): string[] {
  const nights: string[] = []
  let cursor = new Date(checkIn + 'T00:00:00Z')
  const end = new Date(checkOut + 'T00:00:00Z')
  while (cursor.getTime() < end.getTime()) {
    nights.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return nights
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RoomAvailabilityPage({ params, searchParams }: PageProps) {
  const { id: roomId } = await params
  const { month: rawMonth } = await searchParams

  const yearMonth = /^\d{4}-\d{2}$/.test(rawMonth ?? '') ? rawMonth! : currentYearMonth()
  const [year, month] = yearMonth.split('-').map(Number)
  const monthStart = `${yearMonth}-01`
  const nextMonth = addMonth(yearMonth, 1)
  const monthEnd = `${nextMonth}-01`  // exclusive upper bound

  const supabase = await createClient()

  // Autenticación
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const property = await getActiveProperty(supabase)
  if (!property) redirect('/onboarding')

  // Validar que la room pertenece a la property del usuario (RLS + check explícito)
  const { data: room } = await supabase
    .from('rooms')
    .select('id, name, sync_status, last_synced_at, room_type:room_types(name)')
    .eq('id', roomId)
    .eq('property_id', property.id)
    .maybeSingle()

  if (!room) notFound()

  // Queries de calendario via service client (scoped al room_id ya validado)
  const admin = createServiceClient()

  const [{ data: nightRows }, { data: extRows }] = await Promise.all([
    admin
      .from('booking_nights')
      .select('night')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .gte('night', monthStart)
      .lt('night', monthEnd),
    admin
      .from('external_reservations')
      .select('check_in, check_out')
      .eq('room_id', roomId)
      .neq('status', 'cancelled')
      .lt('check_in', monthEnd)
      .gt('check_out', monthStart),
  ])

  // Construir set de días bloqueados por tipo
  const bookedSet = new Set<string>((nightRows ?? []).map((r) => r.night as string))
  const externalSet = new Set<string>()
  for (const ext of extRows ?? []) {
    for (const night of expandReservationNights(ext.check_in as string, ext.check_out as string)) {
      externalSet.add(night)
    }
  }

  function getDayStatus(dateStr: string): DayStatus {
    if (bookedSet.has(dateStr)) return 'booked'
    if (externalSet.has(dateStr)) return 'external'
    return 'free'
  }

  // Construir grid del mes (offset del primer día: 0=Lu, 6=Do)
  const firstDayOfMonth = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  // getDay() → 0=Do,1=Lu,...,6=Sa → convertir a Lu-Do (0-6)
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7

  const prevMonth = addMonth(yearMonth, -1)

  const roomTypeName = (Array.isArray(room.room_type)
    ? room.room_type[0]?.name
    : (room.room_type as { name: string } | null)?.name) ?? null

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-foreground-secondary mb-6">
        <Link href="/dashboard/rooms" className="hover:text-foreground transition-colors">
          Habitaciones
        </Link>
        <span>›</span>
        <span className="text-foreground">{room.name}</span>
        <span>›</span>
        <span className="text-foreground">Disponibilidad</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-semibold text-foreground">{room.name}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          {property.name}
          {roomTypeName && <span> · {roomTypeName}</span>}
        </p>
      </div>

      {/* Navegación de mes */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/dashboard/rooms/${roomId}/availability?month=${prevMonth}`}
          className="px-3 py-1.5 text-sm font-medium border border-border rounded-xl bg-white text-foreground-secondary hover:bg-surface transition-colors"
        >
          ← Anterior
        </Link>
        <h2 className="text-base font-semibold text-foreground capitalize">
          {monthLabel(yearMonth)}
        </h2>
        <Link
          href={`/dashboard/rooms/${roomId}/availability?month=${nextMonth}`}
          className="px-3 py-1.5 text-sm font-medium border border-border rounded-xl bg-white text-foreground-secondary hover:bg-surface transition-colors"
        >
          Siguiente →
        </Link>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden p-4">
        {/* Cabecera días de semana */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-foreground-muted py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Celdas del mes */}
        <div className="grid grid-cols-7 gap-1">
          {/* Relleno inicial */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}

          {/* Días del mes */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`
            const status = getDayStatus(dateStr)

            const cellClasses: Record<DayStatus, string> = {
              free:     'bg-success-50 text-success-700 border border-success-100 hover:bg-success-100',
              booked:   'bg-error-100 text-error-700 border border-error-200',
              external: 'bg-warning-100 text-warning-700 border border-warning-200',
            }

            return (
              <div
                key={dateStr}
                className={`rounded-lg text-center text-xs py-2 font-medium transition-colors ${cellClasses[status]}`}
                title={status === 'free' ? 'Libre' : status === 'booked' ? 'Reservado' : 'Bloqueado iCal'}
              >
                {day}
              </div>
            )
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-4 text-xs text-foreground-secondary">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-success-100 border border-success-200 inline-block" />
          Libre
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-error-100 border border-error-200 inline-block" />
          Reservado (interno)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-warning-100 border border-warning-200 inline-block" />
          Bloqueado iCal
        </div>
      </div>
    </div>
  )
}
