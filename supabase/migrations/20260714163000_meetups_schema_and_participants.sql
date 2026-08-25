-- Meetups schema expansion: location, participation, targeting, and RSVP tracking.
-- Idempotent — safe to re-run on databases that already applied earlier partial migrations.
--
-- Legacy columns kept for backward compatibility:
--   user_id          (creator; app alias: creator_id)
--   compatibility    (denormalized open-to label for feed cards)
--   directions_url   (legacy maps link; mirrored into google_maps_link)
--   pet_ids          (creator's pets at plan time; not the live RSVP list)

-- ---------------------------------------------------------------------------
-- 1) New / expanded columns on public.meetups
-- ---------------------------------------------------------------------------
ALTER TABLE public.meetups
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS google_maps_link text,
  ADD COLUMN IF NOT EXISTS participation_limit integer,
  ADD COLUMN IF NOT EXISTS open_to text,
  ADD COLUMN IF NOT EXISTS custom_breed_spec text,
  ADD COLUMN IF NOT EXISTS participant_count integer NOT NULL DEFAULT 0;

-- Positive limit only; NULL = unlimited attendees.
ALTER TABLE public.meetups
  DROP CONSTRAINT IF EXISTS meetups_participation_limit_positive;

ALTER TABLE public.meetups
  ADD CONSTRAINT meetups_participation_limit_positive
  CHECK (participation_limit IS NULL OR participation_limit > 0);

ALTER TABLE public.meetups
  DROP CONSTRAINT IF EXISTS meetups_open_to_check;

ALTER TABLE public.meetups
  ADD CONSTRAINT meetups_open_to_check
  CHECK (
    open_to IS NULL
    OR open_to IN ('Open to All', 'Dogs Meetup', 'Cats Meetup', 'Please Specify')
  );

COMMENT ON COLUMN public.meetups.location_lat IS 'Meetup latitude for distance sorting/display.';
COMMENT ON COLUMN public.meetups.location_lng IS 'Meetup longitude for distance sorting/display.';
COMMENT ON COLUMN public.meetups.google_maps_link IS 'Google Maps URL for cross-platform directions.';
COMMENT ON COLUMN public.meetups.participation_limit IS 'Max pets allowed; NULL means unlimited.';
COMMENT ON COLUMN public.meetups.open_to IS 'Audience targeting: Open to All | Dogs Meetup | Cats Meetup | Please Specify.';
COMMENT ON COLUMN public.meetups.custom_breed_spec IS 'Free-text breed/species rule when open_to = Please Specify.';
COMMENT ON COLUMN public.meetups.participant_count IS 'Denormalized count of rows in meetup_participants.';

-- ---------------------------------------------------------------------------
-- 2) Backfill from legacy columns
-- ---------------------------------------------------------------------------
UPDATE public.meetups
SET google_maps_link = directions_url
WHERE google_maps_link IS NULL
  AND directions_url IS NOT NULL
  AND btrim(directions_url) <> '';

UPDATE public.meetups
SET open_to = CASE
  WHEN compatibility IN ('Open to All', 'Dogs Meetup', 'Cats Meetup', 'Please Specify') THEN compatibility
  WHEN compatibility ILIKE 'open to all%' THEN 'Open to All'
  WHEN compatibility ILIKE 'dogs meetup%' THEN 'Dogs Meetup'
  WHEN compatibility ILIKE 'cats meetup%' THEN 'Cats Meetup'
  ELSE 'Please Specify'
END
WHERE open_to IS NULL
  AND compatibility IS NOT NULL;

UPDATE public.meetups
SET custom_breed_spec = compatibility
WHERE open_to = 'Please Specify'
  AND custom_breed_spec IS NULL
  AND compatibility IS NOT NULL
  AND compatibility NOT IN ('Open to All', 'Dogs Meetup', 'Cats Meetup', 'Please Specify');

UPDATE public.meetups
SET participant_count = COALESCE(array_length(pet_ids, 1), 0)
WHERE participant_count = 0
  AND COALESCE(array_length(pet_ids, 1), 0) > 0;

-- ---------------------------------------------------------------------------
-- 3) meetup_participants (relational RSVP list)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meetup_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id uuid NOT NULL REFERENCES public.meetups (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meetup_participants_meetup_pet_unique UNIQUE (meetup_id, pet_id)
);

COMMENT ON TABLE public.meetup_participants IS 'Pets (and their humans) who RSVP''d to a meetup.';

-- ---------------------------------------------------------------------------
-- 4) Keep participant_count in sync
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_meetup_participant_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.meetups
    SET participant_count = participant_count + 1
    WHERE id = NEW.meetup_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.meetups
    SET participant_count = GREATEST(0, participant_count - 1)
    WHERE id = OLD.meetup_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS meetup_participants_count_insert ON public.meetup_participants;
CREATE TRIGGER meetup_participants_count_insert
  AFTER INSERT ON public.meetup_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_meetup_participant_count();

DROP TRIGGER IF EXISTS meetup_participants_count_delete ON public.meetup_participants;
CREATE TRIGGER meetup_participants_count_delete
  AFTER DELETE ON public.meetup_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_meetup_participant_count();

-- ---------------------------------------------------------------------------
-- 5) Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS meetups_user_id_idx ON public.meetups (user_id);
CREATE INDEX IF NOT EXISTS meetups_date_idx ON public.meetups (date);
CREATE INDEX IF NOT EXISTS meetups_location_coords_idx
  ON public.meetups (location_lat, location_lng)
  WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS meetup_participants_meetup_id_idx
  ON public.meetup_participants (meetup_id);
CREATE INDEX IF NOT EXISTS meetup_participants_user_id_idx
  ON public.meetup_participants (user_id);
CREATE INDEX IF NOT EXISTS meetup_participants_pet_id_idx
  ON public.meetup_participants (pet_id);

-- ---------------------------------------------------------------------------
-- 6) Row Level Security for meetup_participants
-- ---------------------------------------------------------------------------
ALTER TABLE public.meetup_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meetup_participants_select_all ON public.meetup_participants;
CREATE POLICY meetup_participants_select_all
  ON public.meetup_participants
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS meetup_participants_insert_own ON public.meetup_participants;
CREATE POLICY meetup_participants_insert_own
  ON public.meetup_participants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS meetup_participants_delete_own ON public.meetup_participants;
CREATE POLICY meetup_participants_delete_own
  ON public.meetup_participants
  FOR DELETE
  USING (auth.uid() = user_id);
