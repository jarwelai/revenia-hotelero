import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getPublicPropertySettings } from '@/actions/public-content'
import { resolvePublicLang } from '@/lib/public'
import { CheckoutForm } from '@/features/public-booking/components/CheckoutForm'
import { LanguageSwitcher } from '@/components/public/LanguageSwitcher'
import type { BookingQuote } from '@/types/hotelero'

interface PageProps {
  params: Promise<{ publicKey: string }>
  searchParams: Promise<{ qid?: string; lang?: string }>
}

export default async function PublicCheckoutPage({ params, searchParams }: PageProps) {
  const { publicKey } = await params
  const { qid, lang: queryLang } = await searchParams

  if (!qid) redirect(`/p/${publicKey}/book`)

  const admin = createServiceClient()

  const { data: property } = await admin
    .from('properties')
    .select('id, name, currency')
    .eq('public_key', publicKey)
    .maybeSingle()

  if (!property) redirect(`/p/${publicKey}/book`)

  const { data: bqData } = await admin
    .from('booking_quotes')
    .select('*')
    .eq('id', qid)
    .maybeSingle()

  const bq = bqData as BookingQuote | null

  if (!bq || bq.property_id !== property.id || new Date(bq.expires_at) < new Date()) {
    redirect(`/p/${publicKey}/book?expired=1`)
  }

  // Pre-cargar proveedores habilitados para resolución client-side
  const { data: providersRaw } = await admin
    .from('payment_provider_configs')
    .select('provider, is_enabled, mode')
    .eq('property_id', property.id)
    .eq('is_enabled', true)

  const enabledProviders = (providersRaw ?? []).map((p) => ({
    provider: p.provider as 'stripe' | 'recurrente',
    is_default: p.mode === 'live',
  }))

  const publicSettings = await getPublicPropertySettings(publicKey)
  const lang = resolvePublicLang(publicSettings?.default_lang ?? 'es', queryLang)

  const currency = bq.quote_payload.currency || property.currency
  const fmt = (val: number) =>
    new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-ES', { style: 'currency', currency }).format(val)

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

  const esHref = `/p/${publicKey}/checkout?qid=${qid}&lang=es`
  const enHref = `/p/${publicKey}/checkout?qid=${qid}&lang=en`

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
          {lang === 'en' ? 'Confirm your booking' : 'Confirma tu reserva'}
        </h1>

        {/* Resumen sticky */}
        <div className="sticky top-4 p-5 rounded-2xl bg-white border border-border shadow-card mb-6">
          <h2 className="font-semibold text-foreground mb-3">{property.name}</h2>
          <div className="text-sm text-foreground-secondary space-y-1">
            <div className="flex justify-between">
              <span>{lang === 'en' ? 'Check-in' : 'Entrada'}</span>
              <span className="text-foreground font-medium">{fmtDate(bq.check_in)}</span>
            </div>
            <div className="flex justify-between">
              <span>{lang === 'en' ? 'Check-out' : 'Salida'}</span>
              <span className="text-foreground font-medium">{fmtDate(bq.check_out)}</span>
            </div>
            <div className="flex justify-between">
              <span>{lang === 'en' ? 'Nights' : 'Noches'}</span>
              <span className="text-foreground font-medium">{bq.quote_payload.nights.length}</span>
            </div>
            <div className="flex justify-between">
              <span>{lang === 'en' ? 'Adults' : 'Adultos'}</span>
              <span className="text-foreground font-medium">{bq.adults}</span>
            </div>
          </div>

          {/* Desglose por noche */}
          {bq.quote_payload.nights.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-medium text-foreground-muted mb-2">
                {lang === 'en' ? 'Nightly breakdown' : 'Desglose por noche'}
              </p>
              <div className="space-y-1">
                {bq.quote_payload.nights.map((nq) => (
                  <div key={nq.night} className="flex justify-between text-xs">
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

          <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm">
            {bq.quote_payload.taxes_total > 0 && (
              <div className="flex justify-between">
                <span className="text-foreground-secondary">
                  {lang === 'en' ? 'Taxes' : 'Impuestos'}
                </span>
                <span className="text-foreground">{fmt(bq.quote_payload.taxes_total)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">{fmt(bq.quote_payload.grand_total)}</span>
            </div>
          </div>
        </div>

        {/* Formulario de checkout */}
        <CheckoutForm
          publicKey={publicKey}
          quoteId={qid}
          lang={lang}
          propertyId={property.id}
          enabledProviders={enabledProviders}
        />
      </div>
    </div>
  )
}
