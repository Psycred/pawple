-- Single latest approximate location per user (overwrite only — no history).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_location_lat double precision,
  ADD COLUMN IF NOT EXISTS last_location_lng double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

COMMENT ON COLUMN public.profiles.last_location_lat IS 'Latest approximate latitude; overwritten on each refresh.';
COMMENT ON COLUMN public.profiles.last_location_lng IS 'Latest approximate longitude; overwritten on each refresh.';
COMMENT ON COLUMN public.profiles.location_updated_at IS 'When last_location_* was last updated.';
