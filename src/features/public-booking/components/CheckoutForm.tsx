'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCheckout } from '@/actions/payment'
import { resolveFromEnabledProviders } from '@/lib/payments/provider-registry'
import type { PublicLang } from '@/types/hotelero'
import type { UIPaymentMethod } from '@/actions/payment'
import type { PaymentProvider } from '@/lib/payments'

// Países relevantes para el mercado de Maya Jade (Guatemala + principales orígenes)
const COUNTRIES: { iso2: string; name_es: string; name_en: string }[] = [
  { iso2: 'GT', name_es: 'Guatemala',      name_en: 'Guatemala' },
  { iso2: 'US', name_es: 'Estados Unidos', name_en: 'United States' },
  { iso2: 'MX', name_es: 'México',         name_en: 'Mexico' },
  { iso2: 'CA', name_es: 'Canadá',         name_en: 'Canada' },
  { iso2: 'SV', name_es: 'El Salvador',    name_en: 'El Salvador' },
  { iso2: 'HN', name_es: 'Honduras',       name_en: 'Honduras' },
  { iso2: 'CR', name_es: 'Costa Rica',     name_en: 'Costa Rica' },
  { iso2: 'PA', name_es: 'Panamá',         name_en: 'Panama' },
  { iso2: 'CO', name_es: 'Colombia',       name_en: 'Colombia' },
  { iso2: 'GB', name_es: 'Reino Unido',    name_en: 'United Kingdom' },
  { iso2: 'DE', name_es: 'Alemania',       name_en: 'Germany' },
  { iso2: 'FR', name_es: 'Francia',        name_en: 'France' },
  { iso2: 'ES', name_es: 'España',         name_en: 'Spain' },
  { iso2: 'XX', name_es: 'Otro',           name_en: 'Other' },
]

/** Subconjunto de PropertyPaymentProvider que CheckoutForm necesita */
interface EnabledProviderInfo {
  provider: 'stripe' | 'recurrente'
  is_default: boolean
}

interface CheckoutFormProps {
  publicKey: string
  quoteId: string
  lang: PublicLang
  propertyId: string
  /** Proveedores habilitados pre-cargados desde el servidor */
  enabledProviders: EnabledProviderInfo[]
}

export function CheckoutForm({
  publicKey,
  quoteId,
  lang,
  propertyId: _propertyId,
  enabledProviders,
}: CheckoutFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [guestName,     setGuestName]     = useState('')
  const [guestEmail,    setGuestEmail]    = useState('')
  const [guestPhone,    setGuestPhone]    = useState('')
  const [countryIso2,   setCountryIso2]   = useState('GT')
  const [paymentMethod, setPaymentMethod] = useState<UIPaymentMethod>('card')

  // Estado para instrucciones manuales post-submit
  const [manualResult, setManualResult] = useState<{
    instructions: string
    whatsappUrl?: string
    bookingId: string
  } | null>(null)

  // Provider derivado reactivamente — usa config real de la propiedad (pre-cargada)
  // Solo relevante para método 'card'.
  const detectedProvider: PaymentProvider | null =
    paymentMethod === 'card'
      ? resolveFromEnabledProviders(enabledProviders, countryIso2)
      : null

  // Si método card pero sin providers configurados → mostrar aviso
  const noProvidersWarning =
    paymentMethod === 'card' && enabledProviders.length === 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setManualResult(null)

    if (!guestName.trim()) {
      setError(lang === 'en' ? 'Name is required.' : 'El nombre es requerido.')
      return
    }

    // Bloquear submit si no hay provider para el método card
    if (paymentMethod === 'card' && enabledProviders.length === 0) {
      setError(
        lang === 'en'
          ? 'No payment provider is configured for this property. Please contact the hotel.'
          : 'No hay proveedor de pago configurado para esta propiedad. Contacta al hotel.',
      )
      return
    }

    startTransition(async () => {
      // Sprint 3C/3D: Loggear provider resuelto antes de iniciar checkout
      if (paymentMethod === 'card') {
        const provider = resolveFromEnabledProviders(enabledProviders, countryIso2)
        console.log(`[Sprint 3D] resolvePaymentProviderForProperty → ${provider ?? 'null'} (país: ${countryIso2})`)
      }

      const result = await createCheckout({
        publicKey,
        quoteId,
        guestName:     guestName.trim(),
        guestEmail:    guestEmail.trim() || null,
        guestPhone:    guestPhone.trim() || null,
        countryIso2,
        paymentMethod,
        lang,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      // Flujo card → checkout externo (Recurrente / Stripe)
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }

      // Flujo property → confirmado directamente
      if (result.bookingId && !result.manualInstructions) {
        router.push(`/p/${publicKey}/confirmed/${result.bookingId}?lang=${lang}`)
        return
      }

      // Flujo manual / whatsapp → instrucciones inline
      if (result.bookingId && result.manualInstructions) {
        setManualResult({
          instructions: result.manualInstructions,
          whatsappUrl:  result.whatsappUrl,
          bookingId:    result.bookingId,
        })
      }
    })
  }

  // ── Pantalla de instrucciones manuales ─────────────────────────────────────
  if (manualResult) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-border shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-foreground">
            {lang === 'en' ? 'Booking received' : 'Reserva recibida'}
          </h2>
        </div>

        <p className="text-sm text-foreground-secondary">
          {`Ref: ${manualResult.bookingId.slice(0, 8).toUpperCase()}`}
        </p>

        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {manualResult.instructions}
        </div>

        {manualResult.whatsappUrl && (
          <a
            href={manualResult.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors"
          >
            {lang === 'en' ? 'Contact via WhatsApp' : 'Contactar por WhatsApp'}
          </a>
        )}

        <a
          href={`/p/${publicKey}/confirmed/${manualResult.bookingId}?lang=${lang}`}
          className="block text-center text-sm text-primary-600 underline underline-offset-2"
        >
          {lang === 'en' ? 'View booking status' : 'Ver estado de la reserva'}
        </a>
      </div>
    )
  }

  // ── Etiqueta contextual del método tarjeta ─────────────────────────────────
  const cardSublabel = countryIso2 === 'GT'
    ? (lang === 'en' ? 'Guatemala · GTQ' : 'Guatemala · GTQ')
    : (lang === 'en' ? 'International' : 'Internacional')

  const paymentOptions: { id: UIPaymentMethod; label: string; sublabel?: string }[] = [
    { id: 'card',          label: lang === 'en' ? 'Card' : 'Tarjeta',    sublabel: cardSublabel },
    { id: 'bank_transfer', label: lang === 'en' ? 'Bank transfer' : 'Transferencia' },
    { id: 'whatsapp',      label: 'WhatsApp' },
  ]

  return (
    <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-white border border-border shadow-card space-y-4">
      <h2 className="font-semibold text-foreground">
        {lang === 'en' ? 'Your information' : 'Tus datos'}
      </h2>

      {/* Nombre */}
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          {lang === 'en' ? 'Full name *' : 'Nombre completo *'}
        </label>
        <input
          type="text"
          required
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder={lang === 'en' ? 'John Smith' : 'Juan García'}
          className="w-full px-3 py-2 rounded-xl border border-border text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* País */}
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          {lang === 'en' ? 'Country *' : 'País *'}
        </label>
        <select
          value={countryIso2}
          onChange={(e) => setCountryIso2(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-xl border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso2} value={c.iso2}>
              {lang === 'en' ? c.name_en : c.name_es}
            </option>
          ))}
        </select>
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          {lang === 'en' ? 'Email (optional)' : 'Email (opcional)'}
        </label>
        <input
          type="email"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          placeholder="email@ejemplo.com"
          className="w-full px-3 py-2 rounded-xl border border-border text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Teléfono */}
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          {lang === 'en' ? 'Phone (optional)' : 'Teléfono (opcional)'}
        </label>
        <input
          type="tel"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          placeholder="+502 5000 0000"
          className="w-full px-3 py-2 rounded-xl border border-border text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Método de pago */}
      <div>
        <p className="text-xs font-medium text-foreground-muted mb-2">
          {lang === 'en' ? 'Payment method' : 'Método de pago'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {paymentOptions.map(({ id, label, sublabel }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPaymentMethod(id)}
              className={`py-2.5 px-2 rounded-xl border text-xs font-medium transition-colors flex flex-col items-center gap-0.5 ${
                paymentMethod === id
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-border bg-surface text-foreground-secondary hover:bg-white'
              }`}
            >
              <span>{label}</span>
              {sublabel && (
                <span className="text-[10px] font-normal opacity-70">{sublabel}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sprint 3D: Badge de proveedor resuelto desde config de propiedad */}
      {detectedProvider && !noProvidersWarning && (
        <p className="text-xs text-foreground-muted bg-surface border border-border rounded-lg px-3 py-2">
          {lang === 'en'
            ? `Payment provider: ${detectedProvider === 'stripe' ? 'Stripe' : 'Recurrente'}`
            : `Proveedor de pago seleccionado: ${detectedProvider === 'stripe' ? 'Stripe' : 'Recurrente'}`}
        </p>
      )}

      {/* Aviso: sin proveedores configurados */}
      {noProvidersWarning && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {lang === 'en'
            ? 'No payment provider configured. Please contact the property or choose another payment method.'
            : 'No hay proveedor de pago configurado. Contacta al establecimiento o elige otro método de pago.'}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 rounded-xl bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {isPending
          ? (lang === 'en' ? 'Processing...' : 'Procesando...')
          : (lang === 'en' ? 'Confirm booking' : 'Confirmar reserva')}
      </button>

      <p className="text-xs text-foreground-muted text-center">
        {lang === 'en'
          ? "By confirming, you agree to the property's booking conditions."
          : 'Al confirmar, aceptas las condiciones de reserva del establecimiento.'}
      </p>
    </form>
  )
}
