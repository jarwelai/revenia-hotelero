'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveProperty } from '@/lib/property-context'
import type { Property } from '@/types/hotelero'
import { UpdatePropertyProfileSchema, formatZodError } from '@/features/property-setup/schemas/validation'

// ─── getPropertyProfile ───────────────────────────────────────────────────────

export async function getPropertyProfile(): Promise<{ data?: Property; error?: string }> {
  const supabase = await createClient()
  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No property found' }

  const { data, error } = await supabase
    .from('properties')
    .select(
      'id, org_id, name, timezone, currency, inventory_mode, policies_json, public_key, created_at,' +
      ' address, city, state_province, country_iso2, postal_code, latitude, longitude,' +
      ' phone, email, website, check_in_time, check_out_time,' +
      ' star_rating, property_type, slug, is_published, hero_image_url',
    )
    .eq('id', property.id)
    .single()

  if (error) return { error: error.message }
  return { data: data as unknown as Property }
}

// ─── updatePropertyProfile ────────────────────────────────────────────────────

export async function updatePropertyProfile(
  formData: FormData,
): Promise<{ data?: Property; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No property found' }

  const getString = (key: string): string | null => {
    const val = String(formData.get(key) ?? '').trim()
    return val || null
  }

  const getNumber = (key: string): number | null => {
    const val = formData.get(key)
    if (!val) return null
    const num = parseFloat(String(val))
    return isNaN(num) ? null : num
  }

  const rawUpdates = {
    name: getString('name'),
    address: getString('address'),
    city: getString('city'),
    state_province: getString('state_province'),
    country_iso2: getString('country_iso2'),
    postal_code: getString('postal_code'),
    latitude: getNumber('latitude'),
    longitude: getNumber('longitude'),
    phone: getString('phone'),
    email: getString('email'),
    website: getString('website'),
    check_in_time: getString('check_in_time'),
    check_out_time: getString('check_out_time'),
    star_rating: getNumber('star_rating'),
    property_type: getString('property_type'),
    hero_image_url: getString('hero_image_url'),
  }

  const parsed = UpdatePropertyProfileSchema.safeParse(rawUpdates)
  if (!parsed.success) return { error: formatZodError(parsed.error) }

  const { data, error } = await supabase
    .from('properties')
    .update(parsed.data)
    .eq('id', property.id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/setup/identity')
  return { data: data as Property }
}

// ─── generatePropertySlug ─────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

export async function generatePropertySlug(
  name: string,
): Promise<{ slug?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const base = slugify(name)
  if (!base) return { error: 'Nombre inválido para generar slug' }

  let candidate = base
  let suffix = 2

  while (true) {
    const { data, error } = await supabase
      .from('properties')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()

    if (error) return { error: error.message }
    if (!data) return { slug: candidate }

    candidate = `${base}-${suffix}`
    suffix++
  }
}

// ─── togglePublishStatus ──────────────────────────────────────────────────────

export async function togglePublishStatus(): Promise<{ is_published?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No property found' }

  const { data: current, error: fetchError } = await supabase
    .from('properties')
    .select('is_published')
    .eq('id', property.id)
    .single()

  if (fetchError) return { error: fetchError.message }

  const nuevoEstado = !current.is_published

  const { error: updateError } = await supabase
    .from('properties')
    .update({ is_published: nuevoEstado })
    .eq('id', property.id)

  if (updateError) return { error: updateError.message }

  revalidatePath('/dashboard/setup')
  return { is_published: nuevoEstado }
}
