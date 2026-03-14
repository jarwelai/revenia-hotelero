-- ============================================================================
-- Migration: create_reviews
-- Purpose: Track reviews + review_aggregates tables
-- Safety: IF NOT EXISTS — does NOT destroy existing data
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  property_id             UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  source                  TEXT NOT NULL DEFAULT 'manual'
                          CHECK (source IN ('manual','internal','google','booking','airbnb','expedia','facebook','tripadvisor','other')),
  external_uid            TEXT,
  rating                  INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title                   TEXT,
  comment                 TEXT,
  reviewer_name           TEXT,
  reviewer_email          TEXT,
  reviewer_country        TEXT,
  reviewer_language       TEXT,
  stay_start              DATE,
  stay_end                DATE,
  booking_id              UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  language                TEXT,
  status                  TEXT NOT NULL DEFAULT 'published'
                          CHECK (status IN ('published', 'hidden')),
  featured                BOOLEAN NOT NULL DEFAULT false,
  reviewed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  reply_text              TEXT,
  reply_author            TEXT,
  replied_at              TIMESTAMPTZ,
  reply_synced_to_source  BOOLEAN NOT NULL DEFAULT false,
  reply_sync_error        TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_property_id
  ON public.reviews(property_id);

CREATE INDEX IF NOT EXISTS idx_reviews_org_id
  ON public.reviews(org_id);

CREATE INDEX IF NOT EXISTS idx_reviews_status
  ON public.reviews(status);

CREATE INDEX IF NOT EXISTS idx_reviews_source
  ON public.reviews(source);

-- Unique external review per property+source
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_reviews_external'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT uq_reviews_external UNIQUE (property_id, source, external_uid);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reviews_updated_at'
  ) THEN
    CREATE TRIGGER trg_reviews_updated_at
      BEFORE UPDATE ON public.reviews
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'reviews_select_org_member'
  ) THEN
    CREATE POLICY reviews_select_org_member ON public.reviews
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = reviews.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'reviews_insert_org_member'
  ) THEN
    CREATE POLICY reviews_insert_org_member ON public.reviews
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = reviews.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'reviews_update_org_member'
  ) THEN
    CREATE POLICY reviews_update_org_member ON public.reviews
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = reviews.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'reviews_delete_org_member'
  ) THEN
    CREATE POLICY reviews_delete_org_member ON public.reviews
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = reviews.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Public read for published reviews (needed for public review pages)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'reviews_public_read'
  ) THEN
    CREATE POLICY reviews_public_read ON public.reviews
      FOR SELECT TO anon USING (status = 'published');
  END IF;
END $$;

-- ─── review_aggregates ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_aggregates (
  property_id         UUID PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  total_reviews       INT NOT NULL DEFAULT 0,
  average_rating      NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_distribution JSONB NOT NULL DEFAULT '{}',
  last_reviewed_at    TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_review_aggregates_updated_at'
  ) THEN
    CREATE TRIGGER trg_review_aggregates_updated_at
      BEFORE UPDATE ON public.review_aggregates
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.review_aggregates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'ra_select_org_member'
  ) THEN
    CREATE POLICY ra_select_org_member ON public.review_aggregates
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = review_aggregates.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Public read for aggregates (public review pages)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'ra_public_read'
  ) THEN
    CREATE POLICY ra_public_read ON public.review_aggregates
      FOR SELECT TO anon USING (true);
  END IF;
END $$;
