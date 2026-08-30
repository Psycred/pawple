-- PAW-24 / D1: Meetup RSVP, capacity, cancellation — Product Contract §7 alignment.
-- Idempotent — safe to re-run.
--
-- Closes gaps found in audit:
--   • meetups.status (cancelled blocks new RSVPs; feeds filter client-side)
--   • Atomic capacity enforcement (row lock prevents concurrent overfill)
--   • Auto-cancel when the last host pet is removed
--   • meetup_hosts INSERT restricted to meetup creator + owned pets (RLS fix)

-- ---------------------------------------------------------------------------
-- 1) Lifecycle status on meetups
-- ---------------------------------------------------------------------------
ALTER TABLE public.meetups
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'upcoming';

ALTER TABLE public.meetups
  DROP CONSTRAINT IF EXISTS meetups_status_check;

ALTER TABLE public.meetups
  ADD CONSTRAINT meetups_status_check
  CHECK (status IN ('upcoming', 'cancelled', 'completed'));

COMMENT ON COLUMN public.meetups.status IS
  'Meetup lifecycle: upcoming (default), cancelled (no new RSVPs), completed (past).';

CREATE INDEX IF NOT EXISTS meetups_status_date_idx
  ON public.meetups (status, date)
  WHERE status = 'upcoming';

-- ---------------------------------------------------------------------------
-- 2) Atomic capacity + cancelled-meetup guard (BEFORE INSERT on participants)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_meetup_participant_count(meetup_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT COUNT(*)::integer
    FROM public.meetup_participants
    WHERE meetup_id = meetup_uuid
  ), 0);
$$;

CREATE OR REPLACE FUNCTION public.check_meetup_participation_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim integer;
  current_count integer;
  meetup_status text;
BEGIN
  -- Serialize concurrent RSVPs for the same meetup (Product Contract §7 atomicity).
  SELECT m.participation_limit, COALESCE(m.status, 'upcoming')
  INTO lim, meetup_status
  FROM public.meetups m
  WHERE m.id = NEW.meetup_id
  FOR UPDATE;

  IF meetup_status = 'cancelled' THEN
    RAISE EXCEPTION 'This meetup has been cancelled.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF lim IS NOT NULL AND lim > 0 THEN
    SELECT COUNT(*)::integer
    INTO current_count
    FROM public.meetup_participants mp
    WHERE mp.meetup_id = NEW.meetup_id;

    IF current_count >= lim THEN
      RAISE EXCEPTION 'This meetup is full.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meetup_participants_capacity_check ON public.meetup_participants;
CREATE TRIGGER meetup_participants_capacity_check
  BEFORE INSERT ON public.meetup_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.check_meetup_participation_capacity();

COMMENT ON FUNCTION public.check_meetup_participation_capacity() IS
  'Blocks RSVPs when meetup is cancelled or participation_limit is reached. Uses FOR UPDATE for atomicity.';

-- ---------------------------------------------------------------------------
-- 3) Cancel meetup when no host pets remain (Product Contract §7)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_meetup_if_no_hosts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.meetup_hosts mh
    WHERE mh.meetup_id = OLD.meetup_id
  ) THEN
    UPDATE public.meetups
    SET status = 'cancelled'
    WHERE id = OLD.meetup_id
      AND COALESCE(status, 'upcoming') <> 'cancelled';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS meetup_hosts_cancel_if_empty ON public.meetup_hosts;
CREATE TRIGGER meetup_hosts_cancel_if_empty
  AFTER DELETE ON public.meetup_hosts
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_meetup_if_no_hosts();

COMMENT ON FUNCTION public.cancel_meetup_if_no_hosts() IS
  'Sets meetups.status = cancelled when the last meetup_hosts row is removed.';

-- ---------------------------------------------------------------------------
-- 4) meetup_hosts INSERT — creator + pet ownership (closes RLS gap from 20260714260000)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to insert hosts" ON public.meetup_hosts;
DROP POLICY IF EXISTS meetup_hosts_insert_meetup_owner ON public.meetup_hosts;

CREATE POLICY meetup_hosts_insert_creator_owned_pets
  ON public.meetup_hosts
  FOR INSERT
  TO authenticated
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

COMMENT ON POLICY meetup_hosts_insert_creator_owned_pets ON public.meetup_hosts IS
  'Only the meetup creator may assign their own pets as hosts.';
