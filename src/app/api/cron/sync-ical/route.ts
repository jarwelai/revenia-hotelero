/**
 * Vercel Cron — iCal Sync automático
 *
 * Schedule: cada hora (Hobby)  → "0 * * * *"
 *           cada 15 min (Pro) → every-15-min cron expression
 *
 * Auth: Bearer CRON_SECRET (set in Vercel env vars)
 *
 * Env vars requeridas:
 *   CRON_SECRET              — secreto compartido con Vercel Cron
 *   SUPABASE_SERVICE_ROLE_KEY — necesario para createServiceClient
 *   NEXT_PUBLIC_SUPABASE_URL  — URL de Supabase
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncRoomIcal } from '@/lib/ical'

export const runtime = 'nodejs'
export const maxDuration = 60 // segundos — límite para cron jobs en Vercel

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoomSyncResult {
  roomId: string
  synced: number
  errors: string[]
}

interface CronResponse {
  totalRooms: number
  totalSynced: number
  totalErrors: number
  results: RoomSyncResult[]
  timestamp: string
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('[cron/sync-ical] Unauthorized request — header mismatch')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[cron/sync-ical] Starting iCal sync run')

  const admin = createServiceClient()

  // 2. Obtener todas las habitaciones con iCal URL configurada
  const { data: rooms, error: fetchError } = await admin
    .from('rooms')
    .select('id, ical_url, property_id')
    .not('ical_url', 'is', null)

  if (fetchError) {
    console.error('[cron/sync-ical] Failed to fetch rooms:', fetchError.message)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!rooms || rooms.length === 0) {
    console.log('[cron/sync-ical] No rooms with iCal URLs configured')
    return NextResponse.json({
      totalRooms: 0,
      totalSynced: 0,
      totalErrors: 0,
      results: [],
      timestamp: new Date().toISOString(),
    } satisfies CronResponse)
  }

  console.log(`[cron/sync-ical] Syncing ${rooms.length} room(s)`)

  const results: RoomSyncResult[] = []
  let totalSynced = 0
  let totalErrors = 0

  // 3. Procesar de forma secuencial para no saturar hosts externos
  for (const room of rooms) {
    try {
      const result = await syncRoomIcal(room.id)
      results.push({
        roomId: room.id,
        synced: result.synced,
        errors: result.errors,
      })
      totalSynced += result.synced
      totalErrors += result.errors.length

      if (result.errors.length > 0) {
        console.warn(
          `[cron/sync-ical] Room ${room.id} partial errors:`,
          result.errors
        )
      } else {
        console.log(
          `[cron/sync-ical] Room ${room.id} — synced ${result.synced} event(s)`
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[cron/sync-ical] Room ${room.id} failed:`, message)
      results.push({
        roomId: room.id,
        synced: 0,
        errors: [message],
      })
      totalErrors++
    }
  }

  console.log(
    `[cron/sync-ical] Run complete — rooms: ${rooms.length}, synced: ${totalSynced}, errors: ${totalErrors}`
  )

  const response: CronResponse = {
    totalRooms: rooms.length,
    totalSynced,
    totalErrors,
    results,
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
