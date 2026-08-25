-- Adds the columns the app expects on meetups:
--   location_lat / location_lng  → approximate coords for "X km away" in the feed
--   participation_limit          → max pets allowed (nullable = unlimited)
-- Idempotent: safe to run even if the coords columns were already added earlier.
ALTER TABLE public.meetups
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS participation_limit integer;

COMMENT ON COLUMN public.meetups.location_lat IS 'Approximate meetup latitude for distance display.';
COMMENT ON COLUMN public.meetups.location_lng IS 'Approximate meetup longitude for distance display.';
COMMENT ON COLUMN public.meetups.participation_limit IS 'Max number of pets allowed; NULL means unlimited.';
