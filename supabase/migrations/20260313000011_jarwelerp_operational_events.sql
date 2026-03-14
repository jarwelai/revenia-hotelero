-- ============================================================================
-- Migration: jarwelerp_operational_events
-- Purpose: Event log for JarwelERP operational integration
--
-- Design:
--   - Immutable append-only event log
--   - Every significant operational event is recorded
--   - JarwelERP can poll or subscribe to this log
--   - Events carry enough context to reconstruct state changes
--   - erp_synced_at allows tracking which events have been consumed by ERP
--
-- Event types (initial set):
--   booking.created, booking.confirmed, booking.cancelled, booking.no_show
--   booking.moved, booking.payment_received
--   block.created, block.deleted
--   guest.created, guest.updated
--   payment.created, payment.completed, payment.failed
--   review.created, review.replied
--   reservation.synced (external iCal)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.operational_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  -- Event classification
  event_type      TEXT NOT NULL,
  -- Entity reference (polymorphic)
  entity_type     TEXT NOT NULL,    -- 'booking', 'guest', 'payment', 'block', 'review', 'reservation'
  entity_id       UUID NOT NULL,
  -- Event payload (JSON snapshot of the event data)
  payload         JSONB NOT NULL DEFAULT '{}',
  -- Actor
  actor_id        UUID,             -- user who triggered the event (null for system/cron)
  actor_type      TEXT DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'webhook', 'cron')),
  -- JarwelERP sync tracking
  erp_synced_at   TIMESTAMPTZ,      -- null = not yet consumed by ERP
  erp_sync_error  TEXT,
  -- Metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_oe_org_id
  ON public.operational_events(org_id);

CREATE INDEX IF NOT EXISTS idx_oe_property_id
  ON public.operational_events(property_id);

CREATE INDEX IF NOT EXISTS idx_oe_event_type
  ON public.operational_events(event_type);

CREATE INDEX IF NOT EXISTS idx_oe_entity
  ON public.operational_events(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_oe_created_at
  ON public.operational_events(created_at);

-- Index for ERP sync polling: "give me events not yet synced"
CREATE INDEX IF NOT EXISTS idx_oe_erp_pending
  ON public.operational_events(org_id, created_at)
  WHERE erp_synced_at IS NULL;

-- RLS — org-scoped read, service role for writes
ALTER TABLE public.operational_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'oe_select_org_member'
  ) THEN
    CREATE POLICY oe_select_org_member ON public.operational_events
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = operational_events.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Writes are service-role only (events are emitted by server actions)
