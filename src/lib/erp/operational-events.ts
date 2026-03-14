/**
 * JarwelERP Operational Event Emitter
 *
 * This service records operational events to the `operational_events` table.
 * JarwelERP can poll or subscribe to these events to stay synchronized
 * with Revenia's operational state.
 *
 * Events are immutable, append-only, and carry enough context to
 * reconstruct state changes without querying the source tables.
 *
 * Design:
 *   - Fire-and-forget: failures are logged but never block the main operation
 *   - All events are org-scoped for multi-tenant isolation
 *   - actor_type distinguishes user actions from system/webhook/cron events
 *   - erp_synced_at is set by JarwelERP when it consumes the event
 */

import { createServiceClient } from '@/lib/supabase/server'

// ─── Event Types ──────────────────────────────────────────────────────────────

export type OperationalEventType =
  // Booking lifecycle
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'booking.no_show'
  | 'booking.moved'
  | 'booking.payment_received'
  // Block management
  | 'block.created'
  | 'block.deleted'
  // Guest / CRM
  | 'guest.created'
  | 'guest.updated'
  // Payments
  | 'payment.created'
  | 'payment.completed'
  | 'payment.failed'
  // Reviews
  | 'review.created'
  | 'review.replied'
  // External sync
  | 'reservation.synced'

export type EntityType =
  | 'booking'
  | 'guest'
  | 'payment'
  | 'block'
  | 'review'
  | 'reservation'

export type ActorType = 'user' | 'system' | 'webhook' | 'cron'

export interface EmitEventInput {
  orgId: string
  propertyId?: string
  eventType: OperationalEventType
  entityType: EntityType
  entityId: string
  payload: Record<string, unknown>
  actorId?: string
  actorType?: ActorType
}

// ─── Emit ─────────────────────────────────────────────────────────────────────

/**
 * Emit an operational event. Fire-and-forget — never throws.
 */
export async function emitOperationalEvent(input: EmitEventInput): Promise<void> {
  try {
    const admin = createServiceClient()
    await admin.from('operational_events').insert({
      org_id: input.orgId,
      property_id: input.propertyId ?? null,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      payload: input.payload,
      actor_id: input.actorId ?? null,
      actor_type: input.actorType ?? 'system',
    })
  } catch (err) {
    console.error('[emitOperationalEvent] Failed:', err)
  }
}

/**
 * Emit multiple events in a single insert. Fire-and-forget.
 */
export async function emitOperationalEvents(
  events: EmitEventInput[],
): Promise<void> {
  if (events.length === 0) return
  try {
    const admin = createServiceClient()
    await admin.from('operational_events').insert(
      events.map((e) => ({
        org_id: e.orgId,
        property_id: e.propertyId ?? null,
        event_type: e.eventType,
        entity_type: e.entityType,
        entity_id: e.entityId,
        payload: e.payload,
        actor_id: e.actorId ?? null,
        actor_type: e.actorType ?? 'system',
      })),
    )
  } catch (err) {
    console.error('[emitOperationalEvents] Failed:', err)
  }
}
