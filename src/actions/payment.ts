'use server'

/**
 * Server Action: createCheckout
 *
 * Orquesta el flujo completo: quote → booking → payment_session → checkout_url
 *
 * Flujos soportados:
 *   card       → routing rules → recurrente | stripe  → devuelve checkout_url
 *   bank_transfer | whatsapp → manual                  → devuelve instrucciones
 *   property   → finaliza inmediatamente               → devuelve bookingId
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getAvailability } from '@/lib/availability'
import { finalizeBookingPayment } from '@/lib/payment/finalize'
import { createRecurrenteCheckout } from '@/lib/payment/recurrente'
import { createStripeCheckout } from '@/lib/payment/stripe-driver'
import type { PublicLang, QuoteResult } from '@/types/hotelero'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type UIPaymentMethod = 'card' | 'bank_transfer' | 'whatsapp'
export type PaymentProvider  = 'recurrente' | 'stripe' | 'manual' | 'property'

export interface CreateCheckoutInput {
  publicKey: string
  quoteId: string
  guestName: string
  guestEmail?: string | null
  guestPhone?: string | null
  /** ISO 3166-1 alpha-2, ej. 'GT' | 'US' */
  countryIso2: string
  paymentMethod: UIPaymentMethod
  lang?: PublicLang
}

export interface CreateCheckoutResult {
  /** Para flujos card con checkout externo (Recurrente / Stripe) */
  checkoutUrl?: string
  /** Para flujos que finalizan inmediatamente (property / manual confirmado) */
  bookingId?: string
  /** Para flujos manuales: instrucciones de pago */
  manualInstructions?: string
  /** Para whatsapp: URL de WhatsApp preconstruida */
  whatsappUrl?: string
  provider?: PaymentProvider
  error?: string
}

// ─── Acción principal ─────────────────────────────────────────────────────────

export async function createCheckout(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  const {
    publicKey, quoteId, guestName, guestEmail, guestPhone,
    countryIso2, paymentMethod, lang = 'es',
  } = input

  const admin = createServiceClient()

  // 1. Resolver propiedad
  const { data: property } = await admin
    .from('properties')
    .select('id, name, currency')
    .eq('public_key', publicKey)
    .maybeSingle()

  if (!property) return { error: 'Propiedad no encontrada' }

  // 2. Cargar y validar booking_quote
  const { data: bqData } = await admin
    .from('booking_quotes')
    .select('*')
    .eq('id', quoteId)
    .maybeSingle()

  if (!bqData) return { error: 'Cotización no encontrada' }
  if (bqData.property_id !== property.id) return { error: 'Cotización no válida para esta propiedad' }
  if (new Date(bqData.expires_at) < new Date()) {
    return { error: lang === 'en'
      ? 'Your quote has expired. Please start a new search.'
      : 'La cotización ha expirado. Por favor, inicia una nueva búsqueda.' }
  }

  if (!guestName.trim()) {
    return { error: lang === 'en' ? 'Name is required.' : 'El nombre es requerido.' }
  }

  // 3. Re-validar disponibilidad
  let availability
  try {
    availability = await getAvailability(property.id, bqData.check_in, bqData.check_out, { safeMode: false })
  } catch (err) {
    return { error: `Error al verificar disponibilidad: ${err instanceof Error ? err.message : String(err)}` }
  }

  const stillAvailable = availability.byType.some((g) =>
    g.rooms.some((r) => r.id === bqData.room_id),
  )
  if (!stillAvailable) {
    return { error: lang === 'en'
      ? 'The room is no longer available. Please start a new search.'
      : 'La habitación ya no está disponible. Por favor, inicia una nueva búsqueda.' }
  }

  // 4. Determinar provider
  const quote = bqData.quote_payload as QuoteResult
  const currency = quote.currency || property.currency
  const childrenAges = (bqData.children_ages as number[]) ?? []

  let provider: PaymentProvider
  if (paymentMethod === 'bank_transfer' || paymentMethod === 'whatsapp') {
    provider = 'manual'
  } else {
    // card → routing rules
    const { data: routedProvider, error: rpcError } = await admin
      .rpc('select_payment_provider', {
        p_property_id:  property.id,
        p_country_iso2: countryIso2.toUpperCase(),
        p_currency:     currency,
      }) as { data: string | null; error: unknown }

    if (rpcError || !routedProvider) {
      provider = 'manual'
    } else {
      provider = routedProvider as PaymentProvider
    }
  }

  // 5. Crear booking en estado pending_payment
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .insert({
      property_id:    property.id,
      room_id:        bqData.room_id,
      guest_name:     guestName.trim(),
      guest_email:    guestEmail?.trim() || null,
      guest_phone:    guestPhone?.trim() || null,
      check_in:       bqData.check_in,
      check_out:      bqData.check_out,
      status:         provider === 'property' ? 'hold' : 'pending_payment',
      source:         'direct',
      currency,
      adults:         bqData.adults,
      children_count: childrenAges.length,
      subtotal:       quote.subtotal,
      taxes_total:    quote.taxes_total,
      total_amount:   quote.grand_total,
      quote_payload:  quote,
    })
    .select('id')
    .single()

  if (bookingError || !booking) {
    return { error: bookingError?.message ?? 'Error al crear la reserva' }
  }

  const bookingId = booking.id

  // 6. Crear payment_session
  const { data: psData, error: psError } = await admin
    .from('payment_sessions')
    .insert({
      property_id:  property.id,
      booking_id:   bookingId,
      provider,
      status:       'created',
      amount:       quote.grand_total,
      currency,
    })
    .select('id')
    .single()

  if (psError || !psData) {
    // Limpiar booking
    await admin.from('bookings').delete().eq('id', bookingId)
    return { error: psError?.message ?? 'Error al crear la sesión de pago' }
  }

  const paymentSessionId = psData.id
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const successUrl = `${appUrl}/p/${publicKey}/confirmed/${bookingId}?lang=${lang}&ps=${paymentSessionId}`
  const cancelUrl  = `${appUrl}/p/${publicKey}/checkout?qid=${quoteId}&lang=${lang}`
  const description = `${property.name} · ${bqData.check_in} → ${bqData.check_out}`

  // 7. Flujo por provider
  switch (provider) {

    // ── Recurrente ───────────────────────────────────────────────────────────
    case 'recurrente': {
      try {
        const result = await createRecurrenteCheckout({
          amount:      Math.round(quote.grand_total * 100), // centavos
          currency,
          description,
          successUrl,
          cancelUrl,
          referenceId: paymentSessionId,
        })

        await admin
          .from('payment_sessions')
          .update({
            status:             'pending',
            provider_reference: result.checkoutId,
            checkout_url:       result.checkoutUrl,
            updated_at:         new Date().toISOString(),
          })
          .eq('id', paymentSessionId)

        return { provider, checkoutUrl: result.checkoutUrl }

      } catch (err) {
        await admin.from('bookings').delete().eq('id', bookingId)
        await admin.from('payment_sessions').delete().eq('id', paymentSessionId)
        return { error: `Error al crear sesión Recurrente: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    // ── Stripe ───────────────────────────────────────────────────────────────
    case 'stripe': {
      try {
        const result = await createStripeCheckout({
          amount:           Math.round(quote.grand_total * 100), // cents
          currency,
          description,
          successUrl,
          cancelUrl,
          paymentSessionId,
        })

        await admin
          .from('payment_sessions')
          .update({
            status:             'pending',
            provider_reference: result.sessionId,
            checkout_url:       result.checkoutUrl,
            updated_at:         new Date().toISOString(),
          })
          .eq('id', paymentSessionId)

        return { provider, checkoutUrl: result.checkoutUrl }

      } catch (err) {
        await admin.from('bookings').delete().eq('id', bookingId)
        await admin.from('payment_sessions').delete().eq('id', paymentSessionId)
        return { error: `Error al crear sesión Stripe: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    // ── Manual (bank_transfer / whatsapp) ────────────────────────────────────
    case 'manual': {
      await admin
        .from('payment_sessions')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', paymentSessionId)

      const instrEs = 'Realiza tu transferencia bancaria y envía el comprobante al establecimiento para confirmar tu reserva.'
      const instrEn = 'Please complete your bank transfer and send the receipt to the property to confirm your booking.'
      const manualInstructions = lang === 'en' ? instrEn : instrEs

      let whatsappUrl: string | undefined
      if (paymentMethod === 'whatsapp' && guestPhone?.trim()) {
        const phone = guestPhone.trim().replace(/\D/g, '')
        const msg = encodeURIComponent(
          lang === 'en'
            ? `Hello! I made a booking at ${property.name} (ref: ${bookingId.slice(0, 8).toUpperCase()}). I would like to confirm by WhatsApp.`
            : `¡Hola! Hice una reserva en ${property.name} (ref: ${bookingId.slice(0, 8).toUpperCase()}). Me gustaría confirmar por WhatsApp.`,
        )
        whatsappUrl = `https://wa.me/${phone}?text=${msg}`
      }

      return { provider, bookingId, manualInstructions, whatsappUrl }
    }

    // ── Pay at property ───────────────────────────────────────────────────────
    case 'property': {
      const finalizeResult = await finalizeBookingPayment(bookingId, paymentSessionId)
      if (finalizeResult.error) {
        return { error: finalizeResult.error }
      }
      return { provider, bookingId }
    }

    default:
      return { error: 'Provider desconocido' }
  }
}
