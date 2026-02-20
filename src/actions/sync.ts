'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { syncRoomIcal } from '@/lib/ical'

export async function syncIcal(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const roomId = (formData.get('room_id') as string)?.trim()
  if (!roomId) return { error: 'room_id no especificado' }

  // Verificar que el room pertenece al usuario (RLS garantiza esto)
  const { data: room } = await supabase
    .from('rooms')
    .select('id, ical_url, name')
    .eq('id', roomId)
    .maybeSingle()

  if (!room) return { error: 'Unidad no encontrada o sin permisos' }
  if (!room.ical_url) return { error: `La unidad "${room.name}" no tiene iCal URL configurada` }

  try {
    const result = await syncRoomIcal(roomId)
    revalidatePath('/dashboard/sync/ical')
    return {
      success: true,
      synced: result.synced,
      skipped: result.skipped,
      errors: result.errors,
    }
  } catch (err) {
    revalidatePath('/dashboard/sync/ical')
    const message = err instanceof Error ? err.message : 'Error al sincronizar'
    return { error: message }
  }
}
