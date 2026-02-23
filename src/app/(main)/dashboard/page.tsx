import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActivePropertyWithRole } from '@/lib/property-context'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export const metadata = {
  title: 'Dashboard | Revenia',
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency ?? 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getTodayInTimezone(timezone: string): string {
  try {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const year = parts.find((p) => p.type === 'year')?.value ?? ''
    const month = parts.find((p) => p.type === 'month')?.value ?? ''
    const day = parts.find((p) => p.type === 'day')?.value ?? ''
    return `${year}-${month}-${day}`
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

function getFirstDayOfMonth(timezone: string): string {
  try {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(now)
    const year = parts.find((p) => p.type === 'year')?.value ?? ''
    const month = parts.find((p) => p.type === 'month')?.value ?? ''
    return `${year}-${month}-01`
  } catch {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }
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

  const today = getTodayInTimezone(property.timezone)
  const firstDayOfMonth = getFirstDayOfMonth(property.timezone)

  // Run all 3 metric queries in parallel — they are fully independent
  const [bookingsResult, roomsResult, revenueResult] = await Promise.all([
    // Query 1: Active bookings (confirmed + pending_payment)
    supabase
      .from('bookings')
      .select('id, status')
      .eq('property_id', property.id)
      .in('status', ['confirmed', 'pending_payment']),

    // Query 2a: All rooms for occupancy denominator
    supabase
      .from('rooms')
      .select('id')
      .eq('property_id', property.id),

    // Query 3: Revenue for this month
    supabase
      .from('bookings')
      .select('total_amount, check_in, check_out')
      .eq('property_id', property.id)
      .eq('status', 'confirmed')
      .gte('check_in', firstDayOfMonth),
  ])

  const bookings = bookingsResult.data ?? []
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length
  const pendingCount = bookings.filter((b) => b.status === 'pending_payment').length
  const totalBookings = bookings.length

  const rooms = roomsResult.data ?? []
  const totalRooms = rooms.length
  const roomIds = rooms.map((r) => r.id)

  // Query 2b: Occupied rooms tonight — only runs when there are rooms to check
  let occupiedCount = 0
  if (roomIds.length > 0) {
    const { data: occupiedNights } = await supabase
      .from('booking_nights')
      .select('room_id')
      .in('room_id', roomIds)
      .eq('night', today)
      .eq('is_active', true)
    occupiedCount = occupiedNights?.length ?? 0
  }

  const occupancyPct =
    totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0

  const revenueBookings = revenueResult.data ?? []
  const totalRevenue = revenueBookings.reduce(
    (sum, b) => sum + (Number(b.total_amount) || 0),
    0,
  )
  const revenueBookingCount = revenueBookings.length

  // ADR: total revenue / total nights booked this month
  const totalNights = revenueBookings.reduce((sum, b) => {
    const checkIn = new Date(b.check_in)
    const checkOut = new Date(b.check_out)
    const nights = Math.max(
      0,
      Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
    )
    return sum + nights
  }, 0)
  const adr = totalNights > 0 ? totalRevenue / totalNights : 0

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

        {/* Card: Reservas */}
        <a href="/dashboard/bookings" className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <Card className="h-full transition-shadow group-hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Reservas</CardTitle>
                  <CardDescription>Confirmadas y pendientes</CardDescription>
                </div>
                <CalendarIcon className="w-5 h-5 text-foreground-secondary shrink-0 mt-0.5" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{totalBookings}</p>
              <div className="mt-3 space-y-1.5">
                <p className="text-sm text-foreground-secondary">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5 align-middle" aria-hidden="true" />
                  <span className="font-medium text-foreground">{confirmedCount}</span>
                  {' '}confirmadas
                </p>
                <p className="text-sm text-foreground-secondary">
                  <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1.5 align-middle" aria-hidden="true" />
                  <span className="font-medium text-foreground">{pendingCount}</span>
                  {' '}pendientes de pago
                </p>
              </div>
            </CardContent>
          </Card>
        </a>

        {/* Card: Ocupacion hoy */}
        <a href="/dashboard/calendar" className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <Card className="h-full transition-shadow group-hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Ocupacion hoy</CardTitle>
                  <CardDescription>
                    {today}
                  </CardDescription>
                </div>
                <BedIcon className="w-5 h-5 text-foreground-secondary shrink-0 mt-0.5" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {occupiedCount}
                <span className="text-lg font-medium text-foreground-secondary">
                  /{totalRooms}
                </span>
              </p>
              <div className="mt-3">
                <div
                  className="w-full bg-border rounded-full h-2"
                  role="progressbar"
                  aria-valuenow={occupiedCount}
                  aria-valuemin={0}
                  aria-valuemax={totalRooms}
                  aria-label={`${occupancyPct}% de ocupacion`}
                >
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${occupancyPct}%` }}
                  />
                </div>
                <p className="text-sm text-foreground-secondary mt-1.5">
                  <span className="font-medium text-foreground">{occupancyPct}%</span>
                  {' '}de ocupacion
                </p>
              </div>
            </CardContent>
          </Card>
        </a>

        {/* Card: Revenue del mes */}
        <a href="/dashboard/portfolio" className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <Card className="h-full transition-shadow group-hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Revenue del mes</CardTitle>
                  <CardDescription>Reservas confirmadas</CardDescription>
                </div>
                <RevenueIcon className="w-5 h-5 text-foreground-secondary shrink-0 mt-0.5" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(totalRevenue, property.currency)}
              </p>
              <div className="mt-3 space-y-1.5">
                <p className="text-sm text-foreground-secondary">
                  <span className="font-medium text-foreground">{revenueBookingCount}</span>
                  {' '}reservas confirmadas
                </p>
                <p className="text-sm text-foreground-secondary">
                  ADR:{' '}
                  <span className="font-medium text-foreground">
                    {adr > 0 ? formatCurrency(adr, property.currency) : '—'}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </a>
      </div>
    </div>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}

function BedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21V6.75A2.25 2.25 0 0 1 4.5 4.5h15A2.25 2.25 0 0 1 21.75 6.75V21M2.25 21h19.5M2.25 21v-3.75c0-.621.504-1.125 1.125-1.125h17.25c.621 0 1.125.504 1.125 1.125V21M6.75 13.5h10.5M6.75 13.5A1.5 1.5 0 0 0 5.25 15v1.5h13.5V15a1.5 1.5 0 0 0-1.5-1.5H6.75Z" />
    </svg>
  )
}

function RevenueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.519l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
    </svg>
  )
}
