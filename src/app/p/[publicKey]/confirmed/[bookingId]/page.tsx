import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getPublicPropertySettings } from '@/actions/public-content'
import { resolvePublicLang, getPublicText } from '@/lib/public'
import { LanguageSwitcher } from '@/components/public/LanguageSwitcher'

interface PageProps {
  params: Promise<{ publicKey: string; bookingId: string }>
  searchParams: Promise<{ lang?: string; ps?: string }>
}

export default async function PublicConfirmedPage({ params, searchParams }: PageProps) {
  const { publicKey, bookingId } = await params
  const { lang: queryLang } = await searchParams

  const admin = createServiceClient()

  // Resolver propiedad
  const { data: property } = await admin
    .from('properties')
    .select('id, name, currency')
    .eq('public_key', publicKey)
    .maybeSingle()

  if (!property) notFound()

  // Cargar booking
  const { data: booking } = await admin
    .from('bookings')
    .select('id, property_id, guest_name, check_in, check_out, status, total_amount, currency, adults, children_count')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) notFound()

  // Seguridad: validar que la reserva pertenece a esta propiedad
  if (booking.property_id !== property.id) notFound()

  // Idioma y textos
  const publicSettings = await getPublicPropertySettings(publicKey)
  const lang = resolvePublicLang(publicSettings?.default_lang ?? 'es', queryLang)
  const confirmedTitle = await getPublicText(property.id, 'confirmed.title', lang)

  const currency = booking.currency || property.currency
  const fmt = (val: number | null) =>
    val !== null
      ? new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-ES', { style: 'currency', currency }).format(val)
      : '—'

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

  const shortId = bookingId.slice(0, 8).toUpperCase()

  const esHref = `/p/${publicKey}/confirmed/${bookingId}?lang=es`
  const enHref = `/p/${publicKey}/confirmed/${bookingId}?lang=en`

  const isConfirmed      = booking.status === 'confirmed'
  const isPendingPayment = booking.status === 'pending_payment'
  const isCancelled      = booking.status === 'cancelled'

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Language switcher */}
        <div className="flex justify-end mb-4">
          <LanguageSwitcher currentLang={lang} esHref={esHref} enHref={enHref} />
        </div>

        {/* Banner de estado */}
        {isConfirmed && (
          <div className="mb-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
              {confirmedTitle || (lang === 'en' ? 'Booking confirmed!' : '¡Reserva confirmada!')}
            </h1>
          </div>
        )}

        {isPendingPayment && (
          <div className="mb-6 p-5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
            <p className="text-2xl mb-2">⏳</p>
            <h1 className="text-xl font-heading font-bold text-amber-800">
              {lang === 'en' ? 'Payment pending' : 'Pago pendiente'}
            </h1>
            <p className="mt-1 text-sm text-amber-700">
              {lang === 'en'
                ? 'Your booking is reserved while we confirm your payment.'
                : 'Tu reserva está retenida mientras confirmamos tu pago.'}
            </p>
          </div>
        )}

        {isCancelled && (
          <div className="mb-6 p-5 rounded-2xl bg-red-50 border border-red-200 text-center">
            <h1 className="text-xl font-heading font-bold text-red-800">
              {lang === 'en' ? 'Booking cancelled' : 'Reserva cancelada'}
            </h1>
            <p className="mt-1 text-sm text-red-700">
              {lang === 'en'
                ? 'This booking was cancelled. Please start a new search to book again.'
                : 'Esta reserva fue cancelada. Inicia una nueva búsqueda para reservar de nuevo.'}
            </p>
          </div>
        )}

        <p className="text-center text-foreground-secondary mb-8">
          {lang === 'en'
            ? `Booking reference: ${shortId}`
            : `Referencia de reserva: ${shortId}`}
        </p>

        {/* Detalles */}
        <div className="p-6 rounded-2xl bg-white border border-border shadow-card space-y-3">
          <h2 className="font-semibold text-foreground">{property.name}</h2>

          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">
                {lang === 'en' ? 'Guest' : 'Huésped'}
              </span>
              <span className="text-foreground font-medium">{booking.guest_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">
                {lang === 'en' ? 'Check-in' : 'Entrada'}
              </span>
              <span className="text-foreground font-medium">{fmtDate(booking.check_in)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">
                {lang === 'en' ? 'Check-out' : 'Salida'}
              </span>
              <span className="text-foreground font-medium">{fmtDate(booking.check_out)}</span>
            </div>
            {booking.adults !== null && (
              <div className="flex justify-between">
                <span className="text-foreground-secondary">
                  {lang === 'en' ? 'Adults' : 'Adultos'}
                </span>
                <span className="text-foreground font-medium">{booking.adults}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-foreground font-semibold">Total</span>
              <span className="text-foreground font-semibold">{fmt(booking.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Mensaje adicional */}
        <p className="mt-6 text-center text-sm text-foreground-secondary">
          {lang === 'en'
            ? 'The property will contact you to confirm the details of your stay.'
            : 'El establecimiento se pondrá en contacto contigo para confirmar los detalles de tu estancia.'}
        </p>

        <div className="mt-6 text-center">
          <a
            href={`/p/${publicKey}/book`}
            className="text-sm text-primary-600 hover:text-primary-700 underline transition-colors"
          >
            {lang === 'en' ? 'Make another booking' : 'Hacer otra reserva'}
          </a>
        </div>
      </div>
    </div>
  )
}
