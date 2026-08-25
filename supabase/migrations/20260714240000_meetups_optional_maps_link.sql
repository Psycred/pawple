-- Ensure meetup directions columns accept NULL / empty (no backend link requirement).
-- Idempotent — safe to re-run.

ALTER TABLE public.meetups
  ALTER COLUMN google_maps_link DROP NOT NULL,
  ALTER COLUMN directions_url DROP NOT NULL;

COMMENT ON COLUMN public.meetups.google_maps_link IS
  'Optional Google Maps URL for directions. NULL when not provided.';
COMMENT ON COLUMN public.meetups.directions_url IS
  'Legacy optional maps link (mirrors google_maps_link).';
