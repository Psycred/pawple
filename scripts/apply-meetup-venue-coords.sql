-- Meetup venue coordinates from maps-link unwrap.
-- Run in Supabase SQL Editor, then deploy Edge Function:
--   supabase functions deploy resolve-map-link

ALTER TABLE public.meetups
  ADD COLUMN IF NOT EXISTS venue_lat double precision,
  ADD COLUMN IF NOT EXISTS venue_lng double precision;

COMMENT ON COLUMN public.meetups.venue_lat IS
  'Venue latitude from host-supplied maps link unwrap. Shared intentionally for directions and distance.';

COMMENT ON COLUMN public.meetups.venue_lng IS
  'Venue longitude from host-supplied maps link unwrap. Shared intentionally for directions and distance.';

CREATE INDEX IF NOT EXISTS meetups_venue_coords_idx
  ON public.meetups (venue_lat, venue_lng)
  WHERE venue_lat IS NOT NULL AND venue_lng IS NOT NULL;
