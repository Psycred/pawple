-- Auto-enroll every meetup host as a participant (hosts count toward capacity).
-- participant_count on meetups = COUNT(meetup_participants), including auto-added hosts.

CREATE OR REPLACE FUNCTION public.auto_enroll_meetup_host_as_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.meetup_participants (meetup_id, pet_id)
  VALUES (NEW.meetup_id, NEW.pet_id)
  ON CONFLICT (meetup_id, pet_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meetup_hosts_auto_participant ON public.meetup_hosts;
CREATE TRIGGER meetup_hosts_auto_participant
  AFTER INSERT ON public.meetup_hosts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enroll_meetup_host_as_participant();

-- Backfill hosts that were added before this trigger existed.
INSERT INTO public.meetup_participants (meetup_id, pet_id)
SELECT mh.meetup_id, mh.pet_id
FROM public.meetup_hosts mh
ON CONFLICT (meetup_id, pet_id) DO NOTHING;

-- Reconcile denormalized totals (sync trigger may have missed backfill batch).
UPDATE public.meetups m
SET participant_count = COALESCE((
  SELECT COUNT(*)::integer
  FROM public.meetup_participants mp
  WHERE mp.meetup_id = m.id
), 0);

COMMENT ON COLUMN public.meetups.participant_count IS
  'Total attending pets in meetup_participants (hosts auto-enrolled + RSVPs).';
