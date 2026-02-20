'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  const suffix = Date.now().toString(36).slice(-4)
  return `${base}-${suffix}`
}

export async function createOrgAndProperty(formData: FormData) {
  // Verificar identidad del usuario vía Auth (no RLS)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const orgName = (formData.get('org_name') as string)?.trim()
  const propertyName = (formData.get('property_name') as string)?.trim()
  const timezone = (formData.get('timezone') as string) || 'America/Guatemala'
  const currency = (formData.get('currency') as string) || 'USD'

  if (!orgName) return { error: 'El nombre de la organización es requerido' }
  if (!propertyName) return { error: 'El nombre del hotel es requerido' }

  const slug = generateSlug(orgName)

  // Usar service client para el onboarding inicial (bypasea RLS)
  // Seguro porque el usuario ya fue verificado arriba con getUser()
  const admin = createServiceClient()

  // 1. Crear org
  const { data: org, error: orgError } = await admin
    .from('orgs')
    .insert({ name: orgName, slug })
    .select('id')
    .single()

  if (orgError) return { error: orgError.message }

  // 2. Crear org_member (owner)
  const { error: memberError } = await admin
    .from('org_members')
    .insert({ org_id: org.id, user_id: user.id, role: 'owner' })

  if (memberError) return { error: memberError.message }

  // 3. Crear property
  const { error: propertyError } = await admin
    .from('properties')
    .insert({
      org_id: org.id,
      name: propertyName,
      timezone,
      currency,
    })

  if (propertyError) return { error: propertyError.message }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
