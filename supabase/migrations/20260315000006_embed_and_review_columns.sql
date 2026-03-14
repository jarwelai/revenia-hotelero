-- Migration: embed_and_review_columns
-- Embed customization on property_public_settings + review model evolution.

ALTER TABLE property_public_settings ADD COLUMN IF NOT EXISTS embed_primary_color TEXT DEFAULT '#2563eb';
ALTER TABLE property_public_settings ADD COLUMN IF NOT EXISTS embed_border_radius INT DEFAULT 12;
ALTER TABLE property_public_settings ADD COLUMN IF NOT EXISTS embed_theme TEXT DEFAULT 'light';
ALTER TABLE property_public_settings ADD COLUMN IF NOT EXISTS embed_layout TEXT DEFAULT 'vertical';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pps_embed_theme_check') THEN
    ALTER TABLE property_public_settings ADD CONSTRAINT pps_embed_theme_check
      CHECK (embed_theme IN ('light', 'dark'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pps_embed_layout_check') THEN
    ALTER TABLE property_public_settings ADD CONSTRAINT pps_embed_layout_check
      CHECK (embed_layout IN ('vertical', 'horizontal'));
  END IF;
END $$;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_type TEXT DEFAULT 'guest_to_property';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_review_type_check') THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_review_type_check
      CHECK (review_type IN ('guest_to_property', 'property_to_guest', 'internal_note'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_visibility_check') THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_visibility_check
      CHECK (visibility IN ('public', 'private', 'internal'));
  END IF;
END $$;
