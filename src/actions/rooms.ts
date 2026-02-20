'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Room Types ──────────────────────────────────────────────────────────────

export async function createRoomType(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const propertyId = (formData.get('property_id') as string)?.trim()
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const maxOccupancy = parseInt(formData.get('max_occupancy') as string) || 2
  const basePriceRaw = (formData.get('base_price') as string)?.trim()
  const basePrice = basePriceRaw ? parseFloat(basePriceRaw) : null

  if (!name) return { error: 'El nombre es requerido' }
  if (!propertyId) return { error: 'Propiedad no especificada' }

  const { error } = await supabase.from('room_types').insert({
    property_id: propertyId,
    name,
    description,
    max_occupancy: maxOccupancy,
    base_price: basePrice,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/rooms')
  redirect('/dashboard/rooms')
}

export async function updateRoomType(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const id = (formData.get('id') as string)?.trim()
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const maxOccupancy = parseInt(formData.get('max_occupancy') as string) || 2
  const basePriceRaw = (formData.get('base_price') as string)?.trim()
  const basePrice = basePriceRaw ? parseFloat(basePriceRaw) : null

  if (!name) return { error: 'El nombre es requerido' }
  if (!id) return { error: 'ID no especificado' }

  const { error } = await supabase
    .from('room_types')
    .update({ name, description, max_occupancy: maxOccupancy, base_price: basePrice })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/rooms')
  redirect('/dashboard/rooms')
}

export async function deleteRoomType(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const id = (formData.get('id') as string)?.trim()
  if (!id) return { error: 'ID no especificado' }

  const { error } = await supabase.from('room_types').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/rooms')
}

// ─── Rooms (Units) ───────────────────────────────────────────────────────────

export async function createRoom(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const propertyId = (formData.get('property_id') as string)?.trim()
  const name = (formData.get('name') as string)?.trim()
  const roomTypeId = (formData.get('room_type_id') as string)?.trim() || null
  const mpIdRaw = (formData.get('motopress_accommodation_id') as string)?.trim()
  const motopressId = mpIdRaw ? parseInt(mpIdRaw) : null
  const icalUrl = (formData.get('ical_url') as string)?.trim() || null
  const syncEnabled = (formData.getAll('sync_enabled') as string[]).includes('true')

  if (!name) return { error: 'El nombre es requerido' }
  if (!propertyId) return { error: 'Propiedad no especificada' }

  const { error } = await supabase.from('rooms').insert({
    property_id: propertyId,
    room_type_id: roomTypeId,
    name,
    motopress_accommodation_id: motopressId,
    ical_url: icalUrl,
    sync_enabled: syncEnabled,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/rooms')
  redirect('/dashboard/rooms')
}

export async function updateRoom(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const id = (formData.get('id') as string)?.trim()
  const name = (formData.get('name') as string)?.trim()
  const roomTypeId = (formData.get('room_type_id') as string)?.trim() || null
  const mpIdRaw = (formData.get('motopress_accommodation_id') as string)?.trim()
  const motopressId = mpIdRaw ? parseInt(mpIdRaw) : null
  const icalUrl = (formData.get('ical_url') as string)?.trim() || null
  const syncEnabled = (formData.getAll('sync_enabled') as string[]).includes('true')

  if (!name) return { error: 'El nombre es requerido' }
  if (!id) return { error: 'ID no especificado' }

  const { error } = await supabase
    .from('rooms')
    .update({
      name,
      room_type_id: roomTypeId,
      motopress_accommodation_id: motopressId,
      ical_url: icalUrl,
      sync_enabled: syncEnabled,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/rooms')
  redirect('/dashboard/rooms')
}

export async function deleteRoom(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const id = (formData.get('id') as string)?.trim()
  if (!id) return { error: 'ID no especificado' }

  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/rooms')
}
