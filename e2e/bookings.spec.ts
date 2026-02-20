/**
 * Tests E2E — Booking Engine Interno (Fase 2C)
 *
 * Prerrequisitos:
 *   - Servidor corriendo en BASE_URL (default: http://localhost:3001)
 *   - Usuario de prueba autenticado (storageState: e2e/.auth/admin.json)
 *   - Al menos una propiedad y una unidad configurada
 *
 * Los tests usan el API REST de Supabase para setup/teardown directo en DB,
 * y Playwright para verificar comportamiento UI.
 *
 * Variables de entorno necesarias:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (solo para setup/teardown de tests)
 *   BASE_URL (opcional, default http://localhost:3001)
 *   E2E_PROPERTY_ID  — UUID de la propiedad de test
 *   E2E_ROOM_ID      — UUID de una unidad de test
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// ─── Supabase admin client para setup/teardown ────────────────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function getTestIds() {
  const propertyId = process.env.E2E_PROPERTY_ID
  const roomId = process.env.E2E_ROOM_ID
  if (!propertyId || !roomId) {
    throw new Error('Faltan variables de entorno: E2E_PROPERTY_ID, E2E_ROOM_ID')
  }
  return { propertyId, roomId }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cleanupTestBookings(roomId: string) {
  const admin = getAdminClient()
  // Eliminar booking_nights primero (cascada ya existe, pero por seguridad)
  const { data: bookings } = await admin
    .from('bookings')
    .select('id')
    .eq('room_id', roomId)
    .like('guest_name', 'E2E_%')

  if (bookings?.length) {
    const ids = bookings.map((b) => b.id)
    await admin.from('booking_nights').delete().in('booking_id', ids)
    await admin.from('bookings').delete().in('id', ids)
  }
}

async function navigateToNewBooking(page: Page) {
  await page.goto('/dashboard/bookings/new')
  await expect(page.getByRole('heading', { name: 'Nueva Reserva' })).toBeVisible()
}

// ─── Test 1: Crear booking válido → inserta nights correctas ─────────────────

test('Test 1: Crear booking válido inserta las noches correctas', async ({ page }) => {
  const { roomId } = getTestIds()
  const admin = getAdminClient()

  // Cleanup previo
  await cleanupTestBookings(roomId)

  await navigateToNewBooking(page)

  // Seleccionar la primera unidad disponible en el select
  const roomSelect = page.locator('select[name="room_id"]')
  await expect(roomSelect).toBeVisible()
  // Seleccionamos la opción cuyo value es roomId
  await roomSelect.selectOption(roomId)

  await page.fill('input[name="check_in"]', '2026-06-10')
  await page.fill('input[name="check_out"]', '2026-06-12')
  await page.fill('input[name="guest_name"]', 'E2E_Guest_Test1')
  await page.fill('input[name="guest_email"]', 'e2e@test.com')
  await page.fill('input[name="guest_phone"]', '+52 55 0000 0001')

  await page.click('button[type="submit"]')

  // Esperar confirmación visual o redirección
  await expect(
    page.locator('text=Reserva creada correctamente').or(page.getByRole('heading', { name: 'Reservas' }))
  ).toBeVisible({ timeout: 15_000 })

  // Verificar directamente en DB que se insertaron 2 noches (half-open [10, 12))
  const { data: booking } = await admin
    .from('bookings')
    .select('id')
    .eq('room_id', roomId)
    .eq('guest_name', 'E2E_Guest_Test1')
    .single()

  expect(booking).not.toBeNull()

  const { data: nights } = await admin
    .from('booking_nights')
    .select('night')
    .eq('booking_id', booking!.id)
    .order('night')

  expect(nights).toHaveLength(2)
  expect(nights![0].night).toBe('2026-06-10')
  expect(nights![1].night).toBe('2026-06-11')
  // Verificar que check_out (2026-06-12) NO está incluida (half-open)
  expect(nights!.map((n) => n.night)).not.toContain('2026-06-12')

  // Cleanup
  await cleanupTestBookings(roomId)
})

// ─── Test 2: Booking overlapping → debe fallar ────────────────────────────────

test('Test 2: Crear booking overlapping devuelve error de disponibilidad', async ({ page }) => {
  const { propertyId, roomId } = getTestIds()
  const admin = getAdminClient()

  await cleanupTestBookings(roomId)

  // Crear primer booking directamente en DB
  const { data: existingBooking } = await admin
    .from('bookings')
    .insert({
      property_id: propertyId,
      room_id: roomId,
      guest_name: 'E2E_Existing',
      check_in: '2026-07-15',
      check_out: '2026-07-20',
      status: 'confirmed',
      source: 'internal',
      currency: 'USD',
    })
    .select()
    .single()

  // Insertar noches del primer booking
  const nights = ['2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19']
  await admin.from('booking_nights').insert(
    nights.map((night) => ({ booking_id: existingBooking!.id, room_id: roomId, night }))
  )

  // Intentar crear segundo booking que solapa
  await navigateToNewBooking(page)

  await page.locator('select[name="room_id"]').selectOption(roomId)
  await page.fill('input[name="check_in"]', '2026-07-18')
  await page.fill('input[name="check_out"]', '2026-07-22')
  await page.fill('input[name="guest_name"]', 'E2E_Guest_Test2')

  await page.click('button[type="submit"]')

  // Debe mostrar error de disponibilidad
  await expect(page.locator('text=no está disponible')).toBeVisible({ timeout: 15_000 })

  // Verificar que NO se insertó el segundo booking en DB
  const { data: secondBooking } = await admin
    .from('bookings')
    .select('id')
    .eq('room_id', roomId)
    .eq('guest_name', 'E2E_Guest_Test2')
    .maybeSingle()

  expect(secondBooking).toBeNull()

  // Cleanup
  await cleanupTestBookings(roomId)
})

// ─── Test 3: Cancelar booking → nights eliminadas ─────────────────────────────

test('Test 3: Cancelar booking elimina las booking_nights', async ({ page }) => {
  const { propertyId, roomId } = getTestIds()
  const admin = getAdminClient()

  await cleanupTestBookings(roomId)

  // Crear booking directamente en DB
  const { data: booking } = await admin
    .from('bookings')
    .insert({
      property_id: propertyId,
      room_id: roomId,
      guest_name: 'E2E_Guest_Cancel',
      guest_email: 'cancel@test.com',
      check_in: '2026-08-01',
      check_out: '2026-08-03',
      status: 'confirmed',
      source: 'internal',
      currency: 'USD',
    })
    .select()
    .single()

  await admin.from('booking_nights').insert([
    { booking_id: booking!.id, room_id: roomId, night: '2026-08-01' },
    { booking_id: booking!.id, room_id: roomId, night: '2026-08-02' },
  ])

  // Navegar a la lista de reservas
  await page.goto('/dashboard/bookings?status=confirmed')
  await expect(page.getByRole('heading', { name: 'Reservas' })).toBeVisible()

  // Cancelar la reserva via UI
  const cancelBtn = page.getByRole('button', { name: 'Cancelar' }).first()
  await expect(cancelBtn).toBeVisible({ timeout: 10_000 })

  // Aceptar el confirm dialog
  page.on('dialog', (dialog) => dialog.accept())
  await cancelBtn.click()

  // Esperar que la tabla se actualice (booking ya no aparece en confirmadas)
  await page.waitForTimeout(2000)

  // Verificar en DB: status = cancelled y nights eliminadas
  const { data: updatedBooking } = await admin
    .from('bookings')
    .select('status')
    .eq('id', booking!.id)
    .single()

  expect(updatedBooking!.status).toBe('cancelled')

  const { data: remainingNights } = await admin
    .from('booking_nights')
    .select('night')
    .eq('booking_id', booking!.id)

  expect(remainingNights).toHaveLength(0)

  // Cleanup
  await cleanupTestBookings(roomId)
})

// ─── Test 4: Half-open — check_in=12 después de check_out=12 debe permitir ───

test('Test 4: Half-open — booking con check_in igual a check_out anterior debe permitirse', async ({ page }) => {
  const { propertyId, roomId } = getTestIds()
  const admin = getAdminClient()

  await cleanupTestBookings(roomId)

  // Booking 1: check_in=10, check_out=12
  const { data: booking1 } = await admin
    .from('bookings')
    .insert({
      property_id: propertyId,
      room_id: roomId,
      guest_name: 'E2E_HalfOpen_1',
      check_in: '2026-09-10',
      check_out: '2026-09-12',
      status: 'confirmed',
      source: 'internal',
      currency: 'USD',
    })
    .select()
    .single()

  await admin.from('booking_nights').insert([
    { booking_id: booking1!.id, room_id: roomId, night: '2026-09-10' },
    { booking_id: booking1!.id, room_id: roomId, night: '2026-09-11' },
    // Día 12 NO está bloqueado (half-open)
  ])

  // Booking 2: check_in=12 (= check_out del anterior) → debe ser PERMITIDO
  await navigateToNewBooking(page)

  await page.locator('select[name="room_id"]').selectOption(roomId)
  await page.fill('input[name="check_in"]', '2026-09-12')
  await page.fill('input[name="check_out"]', '2026-09-14')
  await page.fill('input[name="guest_name"]', 'E2E_HalfOpen_2')

  await page.click('button[type="submit"]')

  // Debe crearse exitosamente (no error de disponibilidad)
  await expect(
    page.locator('text=Reserva creada correctamente').or(page.getByRole('heading', { name: 'Reservas' }))
  ).toBeVisible({ timeout: 15_000 })

  // Verificar en DB que booking 2 existe y tiene sus noches correctas
  const { data: booking2 } = await admin
    .from('bookings')
    .select('id')
    .eq('room_id', roomId)
    .eq('guest_name', 'E2E_HalfOpen_2')
    .maybeSingle()

  expect(booking2).not.toBeNull()

  const { data: nights2 } = await admin
    .from('booking_nights')
    .select('night')
    .eq('booking_id', booking2!.id)
    .order('night')

  // Noches: 2026-09-12 y 2026-09-13 (half-open, excluye check_out=14)
  expect(nights2).toHaveLength(2)
  expect(nights2![0].night).toBe('2026-09-12')
  expect(nights2![1].night).toBe('2026-09-13')

  // Cleanup
  await cleanupTestBookings(roomId)
})
