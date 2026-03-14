-- Migration: property_profile_columns
-- Extends properties table with identity, location, classification, and publishing fields.

ALTER TABLE properties ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS state_province TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS country_iso2 TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS check_in_time TEXT DEFAULT '15:00';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS check_out_time TEXT DEFAULT '12:00';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS star_rating INT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT 'hotel';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_star_rating_check') THEN
    ALTER TABLE properties ADD CONSTRAINT properties_star_rating_check
      CHECK (star_rating IS NULL OR (star_rating >= 1 AND star_rating <= 5));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_property_type_check') THEN
    ALTER TABLE properties ADD CONSTRAINT properties_property_type_check
      CHECK (property_type IN ('hotel', 'hostal', 'boutique', 'resort', 'posada', 'apart-hotel', 'villa', 'cabin'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_slug ON properties(slug) WHERE slug IS NOT NULL;
