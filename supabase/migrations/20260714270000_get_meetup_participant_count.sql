-- Live participant total for a meetup (hosts + RSVPs in meetup_participants).
-- Hosts are auto-enrolled via meetup_hosts_auto_participant trigger.
-- Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION public.get_meetup_participant_count(meetup_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT COUNT(*)::integer
    FROM public.meetup_participants
    WHERE meetup_id = meetup_uuid
  ), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_meetup_participant_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meetup_participant_count(uuid) TO anon;

COMMENT ON FUNCTION public.get_meetup_participant_count(uuid) IS
  'Total attending pets for a meetup (hosts auto-enrolled in meetup_participants + RSVPs).';

-- Keep denormalized meetups.participant_count aligned with junction rows.
UPDATE public.meetups m
SET participant_count = public.get_meetup_participant_count(m.id);

-- Enforce capacity at the database layer (prevents race conditions on concurrent RSVPs).
CREATE OR REPLACE FUNCTION public.check_meetup_participation_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim integer;
  current_count integer;
BEGIN
  SELECT m.participation_limit
  INTO lim
  FROM public.meetups m
  WHERE m.id = NEW.meetup_id;

  IF lim IS NOT NULL AND lim > 0 THEN
    SELECT public.get_meetup_participant_count(NEW.meetup_id)
    INTO current_count;

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
  'Blocks new meetup_participants rows when participation_limit is reached.';
