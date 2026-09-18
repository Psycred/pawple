-- PAW-176 Wave 5 §3/§5: separate meetup venue name from title and city.
ALTER TABLE public.meetups
  ADD COLUMN IF NOT EXISTS location_name text;

COMMENT ON COLUMN public.meetups.location_name IS
  'User-provided venue (e.g. Cubbon Park). Separate from title (meetup name) and city.';
