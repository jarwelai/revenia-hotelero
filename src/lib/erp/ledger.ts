/**
 * JarwelERP Ledger Entry Service
 *
 * Creates financial ledger entries for every booking.
 * These entries allow JarwelERP to:
 *   - Generate accounts receivable reports
 *   - Feed general ledger
 *   - Reconcile payments vs revenue
 *   - Generate tax reports
 *   - Track revenue by property, room type, rate plan
 *
 * Design:
 *   - Immutable: entries are never updated, only appended
 *   - Reversals (refunds) are new entries with negative amounts
 *   - Each booking generates per-night revenue + tax entries
 *   - Payment events generate payment_received entries
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { NightQuote, QuoteResult } from '@/types/hotelero'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LedgerEntryType =
  | 'revenue'
  | 'tax'
  | 'extra_adult'
  | 'extra_child'
  | 'extra_pet'
  | 'payment_received'
  | 'refund'
  | 'adjustment'
  | 'commission'

interface CreateLedgerEntriesInput {
  orgId: string
  propertyId: string
  bookingId: string
  quote: QuoteResult
  taxRuleNames?: Record<string, string>  // tax rule id → name mapping
}

interface RecordPaymentInput {
  orgId: string
  propertyId: string
  bookingId: string
  paymentSessionId: string
  amount: number
  currency: string
}

// ─── Create Booking Ledger Entries ────────────────────────────────────────────

/**
 * Create ledger entries for a confirmed booking.
 * Generates per-night revenue breakdown + aggregated tax entries.
 * Fire-and-forget — never throws.
 */
export async function createBookingLedgerEntries(
  input: CreateLedgerEntriesInput,
): Promise<void> {
  try {
    const admin = createServiceClient()
    const { orgId, propertyId, bookingId, quote } = input
    const currency = quote.currency

    const entries: Array<{
      org_id: string
      property_id: string
      booking_id: string
      entry_type: LedgerEntryType
      amount: number
      currency: string
      description: string | null
      night: string | null
      tax_rule_name: string | null
    }> = []

    // Per-night entries
    for (const nq of quote.nights) {
      // Base room revenue
      if (nq.base_rate && nq.base_rate > 0) {
        entries.push({
          org_id: orgId,
          property_id: propertyId,
          booking_id: bookingId,
          entry_type: 'revenue',
          amount: nq.base_rate,
          currency,
          description: `Room revenue - ${nq.night}`,
          night: nq.night,
          tax_rule_name: null,
        })
      }

      // Extra adult fees
      if (nq.extras_adults > 0) {
        entries.push({
          org_id: orgId,
          property_id: propertyId,
          booking_id: bookingId,
          entry_type: 'extra_adult',
          amount: nq.extras_adults,
          currency,
          description: `Extra adult fee - ${nq.night}`,
          night: nq.night,
          tax_rule_name: null,
        })
      }

      // Child fees
      if (nq.extras_children > 0) {
        entries.push({
          org_id: orgId,
          property_id: propertyId,
          booking_id: bookingId,
          entry_type: 'extra_child',
          amount: nq.extras_children,
          currency,
          description: `Child fee - ${nq.night}`,
          night: nq.night,
          tax_rule_name: null,
        })
      }

      // Pet fees
      if (nq.extras_pets > 0) {
        entries.push({
          org_id: orgId,
          property_id: propertyId,
          booking_id: bookingId,
          entry_type: 'extra_pet',
          amount: nq.extras_pets,
          currency,
          description: `Pet fee - ${nq.night}`,
          night: nq.night,
          tax_rule_name: null,
        })
      }

      // Taxes
      if (nq.taxes > 0) {
        entries.push({
          org_id: orgId,
          property_id: propertyId,
          booking_id: bookingId,
          entry_type: 'tax',
          amount: nq.taxes,
          currency,
          description: `Tax - ${nq.night}`,
          night: nq.night,
          tax_rule_name: null,
        })
      }
    }

    if (entries.length > 0) {
      await admin.from('ledger_entries').insert(entries)
    }
  } catch (err) {
    console.error('[createBookingLedgerEntries] Failed:', err)
  }
}

/**
 * Record a payment received entry.
 * Fire-and-forget — never throws.
 */
export async function recordPaymentLedgerEntry(
  input: RecordPaymentInput,
): Promise<void> {
  try {
    const admin = createServiceClient()
    await admin.from('ledger_entries').insert({
      org_id: input.orgId,
      property_id: input.propertyId,
      booking_id: input.bookingId,
      payment_session_id: input.paymentSessionId,
      entry_type: 'payment_received',
      amount: input.amount,
      currency: input.currency,
      description: 'Payment received',
    })
  } catch (err) {
    console.error('[recordPaymentLedgerEntry] Failed:', err)
  }
}

/**
 * Record a refund entry (negative amount).
 * Fire-and-forget — never throws.
 */
export async function recordRefundLedgerEntry(
  input: RecordPaymentInput,
): Promise<void> {
  try {
    const admin = createServiceClient()
    await admin.from('ledger_entries').insert({
      org_id: input.orgId,
      property_id: input.propertyId,
      booking_id: input.bookingId,
      payment_session_id: input.paymentSessionId,
      entry_type: 'refund',
      amount: -Math.abs(input.amount),
      currency: input.currency,
      description: 'Refund issued',
    })
  } catch (err) {
    console.error('[recordRefundLedgerEntry] Failed:', err)
  }
}
