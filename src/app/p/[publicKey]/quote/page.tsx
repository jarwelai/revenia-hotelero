import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getPublicPropertySettings } from '@/actions/public-content'
import { resolvePublicLang, getPublicText } from '@/lib/public'
import { StarRating } from '@/features/reviews/components/StarRating'
import { LanguageSwitcher } from '@/components/public/LanguageSwitcher'
import type { BookingQuote } from '@/types/hotelero'

interface PageProps {
  params: Promise<{ publicKey: string }>
  searchParams: Promise<{ qid?: string; lang?: string }>
}

export default async function PublicQuotePage({ params, searchParams }: PageProps) {
  const { publicKey } = await params
  const { qid, lang: queryLang } = await searchParams

  if (!qid) redirect(`/p/${publicKey}/book`)

  const admin = createServiceClient()

  // Resolver propiedad
  const { data: property } = await admin
    .from('properties')
    .select('id, name, currency')
    .eq('public_key', publicKey)
    .maybeSingle()

  if (!property) redirect(`/p/${publicKey}/book`)

  // Cargar quote
  const { data: bqData } = await admin
    .from('booking_quotes')
    .select('*')
    .eq('id', qid)
    .maybeSingle()

  const bq = bqData as BookingQuote | null

  // Validar: existe y pertenece a esta propiedad y no expiró
  if (!bq || bq.property_id !== property.id || new Date(bq.expires_at) < new Date()) {
    redirect(`/p/${publicKey}/book?expired=1`)
  }

  // Idioma y texto de políticas
  const publicSettings = await getPublicPropertySettings(publicKey)
  const lang = resolvePublicLang(publicSettings?.default_lang ?? 'es', queryLang)
  const cancellationText = await getPublicText(property.id, 'policies.cancellation', lang)

  const nights = bq.quote_payload.nights
  const checkInDate = new Date(bq.check_in + 'T00:00:00Z')
  const checkOutDate = new Date(bq.check_out + 'T00:00:00Z')
  const nightCount = nights.length
  const currency = bq.quote_payload.currency || property.currency

  const fmt = (val: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(val)

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

  // Calcular tiempo restante (para mostrar advertencia de expiración)
  const minsLeft = Math.max(0, Math.floor((new Date(bq.expires_at).getTime() - Date.now()) / 60_000))

  const esHref = `/p/${publicKey}/quote?qid=${qid}&lang=es`
  const enHref = `/p/${publicKey}/quote?qid=${qid}&lang=en`

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <a
            href={`/p/${publicKey}/book`}
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            ← {lang === 'en' ? 'Modify search' : 'Modificar búsqueda'}
          </a>
          <LanguageSwitcher currentLang={lang} esHref={esHref} enHref={enHref} />
        </div>

        <h1 className="text-2xl font-heading font-bold text-foreground mb-6">
          {lang === 'en' ? 'Your quote' : 'Tu cotización'}
        </h1>

        {minsLeft <= 10 && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            {lang === 'en'
              ? `Your quote expires in ${minsLeft} min. Complete your booking soon.`
              : `Tu cotización vence en ${minsLeft} min. Completa tu reserva pronto.`}
          </div>
        )}

        {/* Resumen de estancia */}
        <div className="p-5 rounded-2xl bg-white border border-border shadow-card mb-4">
          <h2 className="font-semibold text-foreground mb-3">
            {property.name}
          </h2>
          <div className="text-sm text-foreground-secondary space-y-1">
            <p>
              <span className="font-medium text-foreground">
                {lang === 'en' ? 'Check-in:' : 'Entrada:'}
              </span>{' '}
              {fmtDate(checkInDate)}
            </p>
            <p>
              <span className="font-medium text-foreground">
                {lang === 'en' ? 'Check-out:' : 'Salida:'}
              </span>{' '}
              {fmtDate(checkOutDate)}
            </p>
            <p>
              <span className="font-medium text-foreground">
                {lang === 'en' ? 'Nights:' : 'Noches:'}
              </span>{' '}
              {nightCount}
            </p>
            <p>
              <span className="font-medium text-foreground">
                {lang === 'en' ? 'Adults:' : 'Adultos:'}
              </span>{' '}
              {bq.adults}
            </p>
          </div>
        </div>

        {/* Desglose por noche */}
        {nights.length > 0 && (
          <div className="p-5 rounded-2xl bg-white border border-border shadow-card mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {lang === 'en' ? 'Nightly breakdown' : 'Desglose por noche'}
            </h3>
            <div className="space-y-1">
              {nights.map((nq) => (
                <div key={nq.night} className="flex justify-between text-sm">
                  <span className="text-foreground-secondary">
                    {new Date(nq.night + 'T00:00:00Z').toLocaleDateString(
                      lang === 'en' ? 'en-US' : 'es-ES',
                      { month: 'short', day: 'numeric' },
                    )}
                  </span>
                  <span className="text-foreground">
                    {nq.base_rate !== null ? fmt(nq.total_rate) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totales */}
        <div className="p-5 rounded-2xl bg-white border border-border shadow-card mb-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">
                {lang === 'en' ? 'Subtotal' : 'Subtotal'}
              </span>
              <span className="text-foreground">{fmt(bq.quote_payload.subtotal)}</span>
            </div>
            {bq.quote_payload.taxes_total > 0 && (
              <div className="flex justify-between">
                <span className="text-foreground-secondary">
                  {lang === 'en' ? 'Taxes' : 'Impuestos'}
                </span>
                <span className="text-foreground">{fmt(bq.quote_payload.taxes_total)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-border font-semibold">
              <span className="text-foreground">Total</span>
              <span className="text-foreground text-base">{fmt(bq.quote_payload.grand_total)}</span>
            </div>
          </div>
        </div>

        {/* Políticas de cancelación */}
        {cancellationText && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-surface border border-border text-xs text-foreground-secondary">
            <p className="font-medium text-foreground-muted mb-1">
              {lang === 'en' ? 'Cancellation policy' : 'Política de cancelación'}
            </p>
            <p>{cancellationText}</p>
          </div>
        )}

        {/* CTA */}
        <a
          href={`/p/${publicKey}/checkout?qid=${qid}&lang=${lang}`}
          className="block w-full py-3 text-center rounded-xl bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 transition-colors"
        >
          {lang === 'en' ? 'Confirm booking' : 'Confirmar reserva'}
        </a>
      </div>
    </div>
  )
}
