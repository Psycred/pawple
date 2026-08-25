-- meetup_participants is the only source of truth for attendance.
-- This replaces historical +/- arithmetic with an exact COUNT(*) after every row change.

CREATE OR REPLACE FUNCTION public.sync_meetup_participant_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_meetup_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_meetup_id := OLD.meetup_id;
  ELSE
    affected_meetup_id := NEW.meetup_id;
  END IF;

  UPDATE public.meetups
  SET participant_count = (
    SELECT COUNT(*)::integer
    FROM public.meetup_participants mp
    WHERE mp.meetup_id = affected_meetup_id
  )
  WHERE id = affected_meetup_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
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

-- Removing a host must also remove that pet's auto-enrolled participant row.
-- New hosts are still enrolled by meetup_hosts_auto_participant.
CREATE OR REPLACE FUNCTION public.remove_meetup_host_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.meetup_participants
  WHERE meetup_id = OLD.meetup_id
    AND pet_id = OLD.pet_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS meetup_hosts_remove_participant ON public.meetup_hosts;
CREATE TRIGGER meetup_hosts_remove_participant
  AFTER DELETE ON public.meetup_hosts
  FOR EACH ROW
  EXECUTE FUNCTION public.remove_meetup_host_participant();

-- Repair any historical drift immediately when this migration is applied.
UPDATE public.meetups m
SET participant_count = (
  SELECT COUNT(*)::integer
  FROM public.meetup_participants mp
  WHERE mp.meetup_id = m.id
);

COMMENT ON COLUMN public.meetups.participant_count IS
  'Derived total of rows in meetup_participants. Client applications must never mutate this column.';
