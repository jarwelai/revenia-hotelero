'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_PROPERTY_COOKIE } from '@/lib/property-context'

/**
 * Switches the active property for the current user.
 *
 * Validates that the user has RLS access to the requested property before
 * writing the cookie. Returns an error string on failure.
 */
export async function setActiveProperty(propertyId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Validate access via RLS — query will return null if user has no access
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .maybeSingle()

  if (!property) return { error: 'Propiedad no encontrada o sin acceso' }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_PROPERTY_COOKIE, propertyId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  })

  revalidatePath('/dashboard', 'layout')
  return {}
}
