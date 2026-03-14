'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveProperty } from '@/lib/property-context'
import type { AmenityCategory, PropertyAmenity } from '@/types/hotelero'
import { AddAmenitySchema, formatZodError } from '@/features/property-setup/schemas/validation'

const REVALIDATE_PATH = '/dashboard/setup/amenities'

// NOTE: AMENITY_CATALOG moved to @/features/property-setup/constants/amenity-catalog.ts
// (server action files can only export async functions)

// ─── getPropertyAmenities ─────────────────────────────────────────────────────

export async function getPropertyAmenities(): Promise<{
  amenities?: PropertyAmenity[]
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  const { data, error } = await supabase
    .from('property_amenities')
    .select('*')
    .eq('property_id', property.id)
    .order('sort_order', { ascending: true })
    .order('name_es', { ascending: true })

  if (error) return { error: error.message }
  return { amenities: (data ?? []) as PropertyAmenity[] }
}

// ─── addPropertyAmenity ───────────────────────────────────────────────────────

export async function addPropertyAmenity(input: {
  category: AmenityCategory
  code: string
  name_es: string
  name_en: string
  is_highlighted?: boolean
}): Promise<{ amenity?: PropertyAmenity; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  const parsed = AddAmenitySchema.safeParse(input)
  if (!parsed.success) return { error: formatZodError(parsed.error) }

  const { data, error } = await supabase
    .from('property_amenities')
    .insert({
      property_id: property.id,
      category: parsed.data.category,
      code: parsed.data.code,
      name_es: parsed.data.name_es,
      name_en: parsed.data.name_en,
      is_highlighted: parsed.data.is_highlighted ?? false,
      sort_order: 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe una amenidad con el código "${input.code}" en esta propiedad` }
    }
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { amenity: data as PropertyAmenity }
}

// ─── removePropertyAmenity ────────────────────────────────────────────────────

export async function removePropertyAmenity(
  amenityId: string,
): Promise<{ error?: string }> {
  if (!amenityId) return { error: 'amenityId es requerido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  const { data: existing, error: readError } = await supabase
    .from('property_amenities')
    .select('id')
    .eq('id', amenityId)
    .eq('property_id', property.id)
    .maybeSingle()

  if (readError) return { error: readError.message }
  if (!existing) return { error: 'Amenidad no encontrada' }

  const { error: deleteError } = await supabase
    .from('property_amenities')
    .delete()
    .eq('id', amenityId)

  if (deleteError) return { error: deleteError.message }

  revalidatePath(REVALIDATE_PATH)
  return {}
}

// ─── toggleHighlighted ────────────────────────────────────────────────────────

export async function toggleHighlighted(
  amenityId: string,
): Promise<{ amenity?: PropertyAmenity; error?: string }> {
  if (!amenityId) return { error: 'amenityId es requerido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  const { data: existing, error: readError } = await supabase
    .from('property_amenities')
    .select('id, is_highlighted')
    .eq('id', amenityId)
    .eq('property_id', property.id)
    .maybeSingle()

  if (readError) return { error: readError.message }
  if (!existing) return { error: 'Amenidad no encontrada' }

  const { data, error: updateError } = await supabase
    .from('property_amenities')
    .update({ is_highlighted: !existing.is_highlighted })
    .eq('id', amenityId)
    .select()
    .single()

  if (updateError) return { error: updateError.message }

  revalidatePath(REVALIDATE_PATH)
  return { amenity: data as PropertyAmenity }
}

// ─── reorderAmenities ─────────────────────────────────────────────────────────

export async function reorderAmenities(
  orderedIds: string[],
): Promise<{ error?: string }> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { error: 'Se requiere al menos un ID para reordenar' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('property_amenities')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
      .eq('property_id', property.id)

    if (error) return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return {}
}
