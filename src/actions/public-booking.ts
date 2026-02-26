'use server'

/**
 * Server Actions — Flujo de reserva pública (Phase 2D)
 *
 * createPublicQuote: genera una cotización temporal (booking_quote, 30 min TTL)
 * confirmPublicBooking: confirma la reserva a partir de un quote válido
 *
 * Ambas usan createServiceClient() — el flujo público no tiene sesión de usuario.
 * El aislamiento de propiedad se garantiza via validación de public_key en cada acción.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getAvailability } from '@/lib/availability'
import { computeQuotePublic } from '@/lib/quote'
import type { PublicLang, QuoteResult } from '@/types/hotelero'

// ─── createPublicQuote ─────────────────────────────────────────────────────────

export interface CreatePublicQuoteInput {
  publicKey: string
  roomTypeId: string
  checkIn: string    // YYYY-MM-DD
  checkOut: string   // YYYY-MM-DD
  adults: number
  childrenAges: number[]
  hasPets?: boolean
  petCount?: number
  lang?: PublicLang
}

export async function createPublicQuote(
  input: CreatePublicQuoteInput,
): Promise<{ quoteId?: string; error?: string }> {
  const { publicKey, roomTypeId, checkIn, checkOut, adults, childrenAges, hasPets, petCount, lang = 'es' } = input
  const admin = createServiceClient()

  // 1. Resolver propiedad por public_key
  const { data: property } = await admin
    .from('properties')
    .select('id')
    .eq('public_key', publicKey)
    .maybeSingle()

  if (!property) return { error: 'Propiedad no encontrada' }

  // 2. Validar fechas básicas
  if (!checkIn || !checkOut || checkIn >= checkOut) {
    return { error: 'Las fechas de entrada y salida no son válidas' }
  }
  if (adults < 1) return { error: 'Se requiere al menos un adulto' }

  // 3. Obtener disponibilidad y seleccionar primera habitación del tipo solicitado
  let availability
  try {
    availability = await getAvailability(property.id, checkIn, checkOut, { safeMode: false })
  } catch (err) {
    return { error: `Error al consultar disponibilidad: ${err instanceof Error ? err.message : String(err)}` }
  }

  const group = availability.byType.find((g) => g.roomTypeId === roomTypeId)
  const room = group?.rooms[0]

  if (!room) return { error: 'No hay habitaciones disponibles de ese tipo para las fechas seleccionadas' }

  // 4. Calcular cotización
  const quote = await computeQuotePublic({
    propertyId: property.id,
    roomId: room.id,
    checkIn,
    checkOut,
    adults,
    childrenAges,
    hasPets,
    petCount,
  })

  if (quote.error) return { error: quote.error }

  // 5. Obtener rate_plan_id del plan BAR (para persistencia)
  const { data: ratePlan } = await admin
    .from('rate_plans')
    .select('id')
    .eq('property_id', property.id)
    .eq('code', 'BAR')
    .maybeSingle()

  // 6. INSERT booking_quote con TTL de 30 minutos
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  const { data: bq, error: insertError } = await admin
    .from('booking_quotes')
    .insert({
      property_id: property.id,
      room_id: room.id,
      room_type_id: roomTypeId,
      rate_plan_id: ratePlan?.id ?? null,
      check_in: checkIn,
      check_out: checkOut,
      adults,
      children_ages: childrenAges,
      has_pets: hasPets ?? false,
      pet_count: petCount ?? 0,
      lang,
      quote_payload: quote,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (insertError || !bq) {
    return { error: insertError?.message ?? 'Error al guardar la cotización' }
  }

  return { quoteId: bq.id }
}

// ─── confirmPublicBooking ──────────────────────────────────────────────────────

export interface ConfirmPublicBookingInput {
  publicKey: string   // Anti-IDOR: valida que el quote pertenece a esta propiedad
  quoteId: string
  guestName: string
  guestEmail?: string | null
  guestPhone?: string | null
}

export async function confirmPublicBooking(
  input: ConfirmPublicBookingInput,
): Promise<{ bookingId?: string; error?: string }> {
  const admin = createServiceClient()

  // 1. Resolver propiedad por public_key
  const { data: property } = await admin
    .from('properties')
    .select('id')
    .eq('public_key', input.publicKey)
    .maybeSingle()

  if (!property) return { error: 'Propiedad no encontrada' }

  // 2. Cargar booking_quote
  const { data: bq } = await admin
    .from('booking_quotes')
    .select('*')
    .eq('id', input.quoteId)
    .maybeSingle()

  if (!bq) return { error: 'Cotización no encontrada' }

  // 3. Anti-IDOR: validar que el quote pertenece a ESTA propiedad
  if (bq.property_id !== property.id) {
    return { error: 'Cotización no válida para esta propiedad' }
  }

  // 4. Validar TTL
  if (new Date(bq.expires_at) < new Date()) {
    return { error: 'La cotización ha expirado. Por favor, realiza una nueva búsqueda.' }
  }

  // 5. Validar nombre del huésped
  if (!input.guestName?.trim()) {
    return { error: 'El nombre del huésped es requerido' }
  }

  // 6. Re-validar disponibilidad antes de INSERT (protección contra race conditions)
  let availability
  try {
    availability = await getAvailability(property.id, bq.check_in, bq.check_out, { safeMode: false })
  } catch (err) {
    return { error: `Error al verificar disponibilidad: ${err instanceof Error ? err.message : String(err)}` }
  }

  const stillAvailable = availability.byType.some((group) =>
    group.rooms.some((r) => r.id === bq.room_id),
  )
  if (!stillAvailable) {
    return { error: 'La habitación ya no está disponible. Por favor, realiza una nueva búsqueda.' }
  }

  // 7. Parsear quote_payload
  const quote = bq.quote_payload as QuoteResult
  const childrenAges = (bq.children_ages as number[]) ?? []
  const hasPets = bq.has_pets ?? false
  const petCountVal = bq.pet_count ?? 0

  // 8. INSERT booking en estado 'hold', source='direct'
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .insert({
      property_id: property.id,
      room_id: bq.room_id,
      guest_name: input.guestName.trim(),
      guest_email: input.guestEmail?.trim() || null,
      guest_phone: input.guestPhone?.trim() || null,
      check_in: bq.check_in,
      check_out: bq.check_out,
      status: 'hold',
      source: 'direct',
      currency: quote.currency,
      adults: bq.adults,
      children_count: childrenAges.length,
      subtotal: quote.subtotal,
      taxes_total: quote.taxes_total,
      total_amount: quote.grand_total,
      has_pets: hasPets,
      pet_count: petCountVal,
    })
    .select()
    .single()

  if (bookingError || !booking) {
    return { error: bookingError?.message ?? 'Error al crear la reserva' }
  }

  // 9. INSERT booking_nights — snapshot completo (UNIQUE partial index es la guardia final)
  if (quote.nights.length > 0) {
    const { error: nightsError } = await admin
      .from('booking_nights')
      .insert(
        quote.nights.map((nq) => ({
          booking_id: booking.id,
          room_id: bq.room_id,
          night: nq.night,
          is_active: true,
          adults: bq.adults,
          children_count: childrenAges.length,
          base_rate: nq.base_rate,
          extras_adults: nq.extras_adults,
          extras_children: nq.extras_children,
          extras_pets: nq.extras_pets,
          taxes: nq.taxes,
          total_rate: nq.total_rate,
        })),
      )

    if (nightsError) {
      // Rollback del booking si falla el INSERT de noches
      await admin.from('bookings').delete().eq('id', booking.id)
      return { error: `Error al registrar noches (posible conflicto de disponibilidad): ${nightsError.message}` }
    }
  }

  // 10. Confirmar booking
  const { error: confirmError } = await admin
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', booking.id)

  if (confirmError) {
    await admin.from('bookings').delete().eq('id', booking.id)
    return { error: `Error al confirmar reserva: ${confirmError.message}` }
  }

  return { bookingId: booking.id }
}
