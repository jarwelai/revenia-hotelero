/**
 * iCal Engine — Fase 2A
 * Funciones: fetchIcs, parseIcsToEvents, computeHash, syncRoomIcal
 * Solo server-side. Sin cron (trigger manual por ahora).
 */

import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ICalEvent {
  uid: string
  summary: string | null
  dtstart: string  // YYYY-MM-DD
  dtend: string    // YYYY-MM-DD
  status: 'confirmed' | 'tentative' | 'cancelled'
}

export interface SyncResult {
  synced: number
  skipped: number
  errors: string[]
}

// ─── fetchIcs ────────────────────────────────────────────────────────────────

export async function fetchIcs(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'Revenia-iCal-Sync/1.0' },
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al obtener iCal de: ${url}`)
  }
  return response.text()
}

// ─── parseIcsToEvents ────────────────────────────────────────────────────────

/**
 * Parser mínimo para formato MotoPress iCal (VEVENT blocks).
 * Soporta: UID, DTSTART, DTEND, STATUS, SUMMARY.
 * Normaliza fechas a YYYY-MM-DD.
 */
export function parseIcsToEvents(icsText: string): ICalEvent[] {
  const events: ICalEvent[] = []
  const lines = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  let current: Record<string, string> | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line === 'BEGIN:VEVENT') {
      current = {}
    } else if (line === 'END:VEVENT') {
      if (current) {
        const uid = current['UID']
        const dtstart = current['DTSTART'] ?? current['DTSTART;VALUE=DATE']
        const dtend = current['DTEND'] ?? current['DTEND;VALUE=DATE']

        if (uid && dtstart && dtend) {
          const rawStatus = (current['STATUS'] ?? '').toUpperCase()
          const status: ICalEvent['status'] =
            rawStatus === 'TENTATIVE' ? 'tentative' :
            rawStatus === 'CANCELLED' ? 'cancelled' :
            'confirmed'

          events.push({
            uid,
            summary: current['SUMMARY'] ?? null,
            dtstart: normalizeIcsDate(dtstart),
            dtend: normalizeIcsDate(dtend),
            status,
          })
        }
      }
      current = null
    } else if (current !== null) {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        const rawKey = line.slice(0, colonIdx)
        const value = line.slice(colonIdx + 1)
        // Store both raw key (e.g. DTSTART;VALUE=DATE) and stripped key (DTSTART)
        current[rawKey] = value
        current[rawKey.split(';')[0]] = value
      }
    }
  }

  return events
}

function normalizeIcsDate(dt: string): string {
  // Strip time component: YYYYMMDDTHHMMSSZ → YYYYMMDD
  const dateOnly = dt.replace(/T.*$/, '').replace(/Z$/, '')
  if (dateOnly.length === 8) {
    return `${dateOnly.slice(0, 4)}-${dateOnly.slice(4, 6)}-${dateOnly.slice(6, 8)}`
  }
  return dateOnly
}

// ─── computeHash ─────────────────────────────────────────────────────────────

export function computeHash(uid: string, dtstart: string, dtend: string): string {
  return createHash('md5').update(`${uid}:${dtstart}:${dtend}`).digest('hex')
}

// ─── syncRoomIcal ────────────────────────────────────────────────────────────

/**
 * Sincroniza el iCal de una unidad (room) con external_reservations.
 * Usa service client para bypass de RLS (operación privilegiada server-only).
 * La identidad del usuario ya fue verificada en la capa de server action.
 */
export async function syncRoomIcal(roomId: string): Promise<SyncResult> {
  const admin = createServiceClient()

  // Obtener room
  const { data: room, error: roomError } = await admin
    .from('rooms')
    .select('id, ical_url')
    .eq('id', roomId)
    .single()

  if (roomError || !room) {
    throw new Error('Unidad no encontrada')
  }
  if (!room.ical_url) {
    throw new Error('Esta unidad no tiene iCal URL configurada')
  }

  try {
    const icsText = await fetchIcs(room.ical_url)

    // Validación estricta: el feed debe ser un VCALENDAR real
    if (!icsText.includes('BEGIN:VCALENDAR')) {
      const errMsg = 'Feed iCal returned HTML/CAPTCHA (not a VCALENDAR) — whitelist server IP in MotoPress/WPEngine'
      await admin
        .from('rooms')
        .update({ sync_status: 'error', last_sync_error: errMsg })
        // last_synced_at NO se actualiza: no hubo sync real
        .eq('id', roomId)
      return { synced: 0, skipped: 0, errors: [errMsg] }
    }

    const events = parseIcsToEvents(icsText)

    const errors: string[] = []
    let synced = 0
    let skipped = 0

    for (const event of events) {
      if (event.status === 'cancelled') {
        // Marcar como cancelado si existe
        await admin
          .from('external_reservations')
          .update({ status: 'cancelled', last_seen_at: new Date().toISOString() })
          .eq('room_id', roomId)
          .eq('external_uid', event.uid)
        skipped++
        continue
      }

      const hash = computeHash(event.uid, event.dtstart, event.dtend)

      const { error: upsertError } = await admin
        .from('external_reservations')
        .upsert(
          {
            room_id: roomId,
            provider: 'motopress',
            external_uid: event.uid,
            check_in: event.dtstart,
            check_out: event.dtend,
            status: event.status,
            raw_hash: hash,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'room_id,provider,external_uid' }
        )

      if (upsertError) {
        errors.push(`UID ${event.uid}: ${upsertError.message}`)
      } else {
        synced++
      }
    }

    await admin
      .from('rooms')
      .update({
        sync_status: errors.length === 0 ? 'ok' : 'error',
        last_synced_at: new Date().toISOString(),
        last_sync_error: errors.length > 0 ? errors.slice(0, 3).join(' | ') : null,
      })
      .eq('id', roomId)

    return { synced, skipped, errors }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'

    await admin
      .from('rooms')
      .update({
        sync_status: 'error',
        last_synced_at: new Date().toISOString(),
        last_sync_error: message,
      })
      .eq('id', roomId)

    throw err
  }
}
