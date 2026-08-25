-- Approximate coordinates for meetups so the feed can show "X km away".
ALTER TABLE public.meetups
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision;

COMMENT ON COLUMN public.meetups.location_lat IS 'Approximate meetup latitude for distance display.';
COMMENT ON COLUMN public.meetups.location_lng IS 'Approximate meetup longitude for distance display.';
