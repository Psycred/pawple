-- Meetup venue pin from host maps link (unwrap). Distinct from stripped device GPS columns.

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
