-- Pet-centric meetup hosting: meetup_hosts junction, meetup_participants refactor,
-- companion discoverability flag, and denormalized host_count on meetups.
-- Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) Drop legacy single-host columns from meetups (if present)
-- ---------------------------------------------------------------------------
ALTER TABLE public.meetups
  DROP COLUMN IF EXISTS host_pet_id,
  DROP COLUMN IF EXISTS creator_id;

-- ---------------------------------------------------------------------------
-- 2) meetup_hosts — pets hosting a meetup (replaces meetups.pet_ids)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meetup_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id uuid NOT NULL REFERENCES public.meetups (id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meetup_hosts_meetup_pet_unique UNIQUE (meetup_id, pet_id)
);

COMMENT ON TABLE public.meetup_hosts IS 'Pets officially hosting a meetup (one row per host pet).';

-- Backfill hosts from legacy pet_ids array before dropping the column.
INSERT INTO public.meetup_hosts (meetup_id, pet_id)
SELECT m.id, unnest(m.pet_ids)
FROM public.meetups m
WHERE m.pet_ids IS NOT NULL
  AND cardinality(m.pet_ids) > 0
ON CONFLICT (meetup_id, pet_id) DO NOTHING;

-- Denormalized host count for feed cards (RSVP count stays in participant_count).
ALTER TABLE public.meetups
  ADD COLUMN IF NOT EXISTS host_count integer NOT NULL DEFAULT 0;

UPDATE public.meetups m
SET host_count = COALESCE((
  SELECT COUNT(*)::integer
  FROM public.meetup_hosts mh
  WHERE mh.meetup_id = m.id
), 0);

-- Legacy array no longer needed once meetup_hosts is populated.
ALTER TABLE public.meetups
  DROP COLUMN IF EXISTS pet_ids;

COMMENT ON COLUMN public.meetups.host_count IS 'Denormalized count of rows in meetup_hosts.';
COMMENT ON COLUMN public.meetups.participant_count IS 'Denormalized count of RSVP rows in meetup_participants (excludes hosts).';

-- Keep host_count in sync
CREATE OR REPLACE FUNCTION public.sync_meetup_host_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.meetups
    SET host_count = host_count + 1
    WHERE id = NEW.meetup_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.meetups
    SET host_count = GREATEST(0, host_count - 1)
    WHERE id = OLD.meetup_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS meetup_hosts_count_insert ON public.meetup_hosts;
CREATE TRIGGER meetup_hosts_count_insert
  AFTER INSERT ON public.meetup_hosts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_meetup_host_count();

DROP TRIGGER IF EXISTS meetup_hosts_count_delete ON public.meetup_hosts;
CREATE TRIGGER meetup_hosts_count_delete
  AFTER DELETE ON public.meetup_hosts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_meetup_host_count();

CREATE INDEX IF NOT EXISTS meetup_hosts_meetup_id_idx
  ON public.meetup_hosts (meetup_id);
CREATE INDEX IF NOT EXISTS meetup_hosts_pet_id_idx
  ON public.meetup_hosts (pet_id);

-- ---------------------------------------------------------------------------
-- 3) meetup_participants — pet-centric RSVP (no user_id column)
-- ---------------------------------------------------------------------------
-- Table may already exist from an earlier migration with user_id; normalize shape.
CREATE TABLE IF NOT EXISTS public.meetup_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id uuid NOT NULL REFERENCES public.meetups (id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meetup_participants_meetup_pet_unique UNIQUE (meetup_id, pet_id)
);

-- Drop user_id if the older schema added it (privacy derived via pets.owner_id).
ALTER TABLE public.meetup_participants
  DROP COLUMN IF EXISTS user_id;

-- Reconcile participant_count with junction rows only (not hosts).
UPDATE public.meetups m
SET participant_count = COALESCE((
  SELECT COUNT(*)::integer
  FROM public.meetup_participants mp
  WHERE mp.meetup_id = m.id
), 0);

-- Participant count trigger (unchanged semantics — RSVPs only)
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

DROP INDEX IF EXISTS meetup_participants_user_id_idx;
CREATE INDEX IF NOT EXISTS meetup_participants_meetup_id_idx
  ON public.meetup_participants (meetup_id);
CREATE INDEX IF NOT EXISTS meetup_participants_pet_id_idx
  ON public.meetup_participants (pet_id);

-- ---------------------------------------------------------------------------
-- 4) is_looking_for_companion on pets
-- ---------------------------------------------------------------------------
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS is_looking_for_companion boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pets.is_looking_for_companion IS
  'When true, pet profile is discoverable in public feed/search for companion matching.';

-- ---------------------------------------------------------------------------
-- 5) Row Level Security — meetup_hosts
-- ---------------------------------------------------------------------------
ALTER TABLE public.meetup_hosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meetup_hosts_select_all ON public.meetup_hosts;
CREATE POLICY meetup_hosts_select_all
  ON public.meetup_hosts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS meetup_hosts_insert_meetup_owner ON public.meetup_hosts;
CREATE POLICY meetup_hosts_insert_meetup_owner
  ON public.meetup_hosts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meetups m
      INNER JOIN public.pets p ON p.id = pet_id
      WHERE m.id = meetup_id
        AND m.user_id = auth.uid()
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS meetup_hosts_delete_meetup_owner ON public.meetup_hosts;
CREATE POLICY meetup_hosts_delete_meetup_owner
  ON public.meetup_hosts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.meetups m
      WHERE m.id = meetup_id
        AND m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6) Row Level Security — meetup_participants (pet-owner privacy)
-- ---------------------------------------------------------------------------
ALTER TABLE public.meetup_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meetup_participants_select_all ON public.meetup_participants;
DROP POLICY IF EXISTS meetup_participants_select_own ON public.meetup_participants;
CREATE POLICY meetup_participants_select_own
  ON public.meetup_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pets p
      WHERE p.id = meetup_participants.pet_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS meetup_participants_insert_own ON public.meetup_participants;
CREATE POLICY meetup_participants_insert_own
  ON public.meetup_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pets p
      WHERE p.id = pet_id
        AND p.owner_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.meetup_hosts mh
      WHERE mh.meetup_id = meetup_id
        AND mh.pet_id = pet_id
    )
  );

DROP POLICY IF EXISTS meetup_participants_delete_own ON public.meetup_participants;
CREATE POLICY meetup_participants_delete_own
  ON public.meetup_participants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.pets p
      WHERE p.id = meetup_participants.pet_id
        AND p.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 7) Helper view for pet meetup stats (optional server-side aggregation)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.pet_meetup_stats AS
SELECT
  p.id AS pet_id,
  COALESCE(h.hosted_count, 0)::integer AS hosted_count,
  COALESCE(part.participated_count, 0)::integer AS participated_count
FROM public.pets p
LEFT JOIN (
  SELECT pet_id, COUNT(*)::integer AS hosted_count
  FROM public.meetup_hosts
  GROUP BY pet_id
) h ON h.pet_id = p.id
LEFT JOIN (
  SELECT pet_id, COUNT(*)::integer AS participated_count
  FROM public.meetup_participants
  GROUP BY pet_id
) part ON part.pet_id = p.id;

COMMENT ON VIEW public.pet_meetup_stats IS
  'Per-pet hosted_count and participated_count for profile surfaces.';

-- Public aggregate counts without exposing individual RSVP rows.
CREATE OR REPLACE FUNCTION public.get_pet_meetup_counts(target_pet_id uuid)
RETURNS TABLE(hosted_count integer, participated_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.meetup_hosts mh
      WHERE mh.pet_id = target_pet_id
    ), 0),
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.meetup_participants mp
      WHERE mp.pet_id = target_pet_id
    ), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_pet_meetup_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pet_meetup_counts(uuid) TO anon;
