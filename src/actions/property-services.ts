'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveProperty } from '@/lib/property-context'
import type { ServiceType, PropertyService } from '@/types/hotelero'
import { CreateServiceSchema, UpdateServiceSchema, formatZodError } from '@/features/property-setup/schemas/validation'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServiceActionResult {
  service?: PropertyService
  error?: string
}

export interface ServiceDeleteResult {
  error?: string
}

export interface CreateServiceInput {
  service_type: ServiceType
  name: string
  short_description_es?: string
  short_description_en?: string
  long_description_es?: string
  long_description_en?: string
  metadata?: Record<string, unknown>
}

export interface UpdateServiceInput {
  name?: string
  short_description_es?: string
  short_description_en?: string
  long_description_es?: string
  long_description_en?: string
  metadata?: Record<string, unknown>
  is_active?: boolean
  sort_order?: number
}

const REVALIDATE_PATH = '/dashboard/setup/services'

// ─── getPropertyServices ──────────────────────────────────────────────────────

/**
 * Returns all services for the active property.
 * Optionally filters by service_type. Ordered by sort_order ASC, name ASC.
 */
export async function getPropertyServices(
  serviceType?: string,
): Promise<{ services?: PropertyService[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  let query = supabase
    .from('property_services')
    .select('*')
    .eq('property_id', property.id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (serviceType) {
    query = query.eq('service_type', serviceType)
  }

  const { data, error } = await query

  if (error) return { error: error.message }
  return { services: data as PropertyService[] }
}

// ─── createService ────────────────────────────────────────────────────────────

/**
 * Inserts a new service for the active property.
 */
export async function createService(
  input: CreateServiceInput,
): Promise<ServiceActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  const parsed = CreateServiceSchema.safeParse(input)
  if (!parsed.success) return { error: formatZodError(parsed.error) }

  const { data, error } = await supabase
    .from('property_services')
    .insert({
      property_id: property.id,
      service_type: parsed.data.service_type,
      name: parsed.data.name,
      short_description_es: parsed.data.short_description_es ?? null,
      short_description_en: parsed.data.short_description_en ?? null,
      long_description_es: parsed.data.long_description_es ?? null,
      long_description_en: parsed.data.long_description_en ?? null,
      metadata: parsed.data.metadata ?? {},
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(REVALIDATE_PATH)
  return { service: data as PropertyService }
}

// ─── updateService ────────────────────────────────────────────────────────────

/**
 * Updates a service. Verifies it belongs to the active property via RLS + explicit check.
 */
export async function updateService(
  serviceId: string,
  input: UpdateServiceInput,
): Promise<ServiceActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!serviceId) return { error: 'ID de servicio no especificado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  // Verify ownership before update
  const { data: existing } = await supabase
    .from('property_services')
    .select('id')
    .eq('id', serviceId)
    .eq('property_id', property.id)
    .maybeSingle()

  if (!existing) return { error: 'Servicio no encontrado o sin acceso' }

  const parsed = UpdateServiceSchema.safeParse(input)
  if (!parsed.success) return { error: formatZodError(parsed.error) }

  const patch: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) patch.name = parsed.data.name
  if (parsed.data.short_description_es !== undefined) patch.short_description_es = parsed.data.short_description_es
  if (parsed.data.short_description_en !== undefined) patch.short_description_en = parsed.data.short_description_en
  if (parsed.data.long_description_es !== undefined) patch.long_description_es = parsed.data.long_description_es
  if (parsed.data.long_description_en !== undefined) patch.long_description_en = parsed.data.long_description_en
  if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata
  if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active
  if (parsed.data.sort_order !== undefined) patch.sort_order = parsed.data.sort_order

  const { data, error } = await supabase
    .from('property_services')
    .update(patch)
    .eq('id', serviceId)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(REVALIDATE_PATH)
  return { service: data as PropertyService }
}

// ─── deleteService ────────────────────────────────────────────────────────────

/**
 * Deletes a service. Verifies it belongs to the active property.
 */
export async function deleteService(
  serviceId: string,
): Promise<ServiceDeleteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!serviceId) return { error: 'ID de servicio no especificado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  // Verify ownership before delete
  const { data: existing } = await supabase
    .from('property_services')
    .select('id')
    .eq('id', serviceId)
    .eq('property_id', property.id)
    .maybeSingle()

  if (!existing) return { error: 'Servicio no encontrado o sin acceso' }

  const { error } = await supabase
    .from('property_services')
    .delete()
    .eq('id', serviceId)

  if (error) return { error: error.message }

  revalidatePath(REVALIDATE_PATH)
  return {}
}
