-- Add companion discovery flag to pets (idempotent).
-- Safe to run even if 20260714200000_meetup_pet_centric_schema.sql was partially applied.

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS is_looking_for_companion boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pets.is_looking_for_companion IS
  'When true, pet profile is discoverable in public feed/search for companion matching.';

-- Backfill any nulls if column existed without NOT NULL/default.
UPDATE public.pets
SET is_looking_for_companion = false
WHERE is_looking_for_companion IS NULL;
