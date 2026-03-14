/**
 * JarwelERP Integration Module
 *
 * Central export for all ERP integration services.
 * Import from '@/lib/erp' for clean access.
 */

export { emitOperationalEvent, emitOperationalEvents } from './operational-events'
export type { OperationalEventType, EntityType, ActorType, EmitEventInput } from './operational-events'

export { createBookingLedgerEntries, recordPaymentLedgerEntry, recordRefundLedgerEntry } from './ledger'

export { resolveGuest } from './guest-resolver'
export type { GuestInput } from './guest-resolver'
