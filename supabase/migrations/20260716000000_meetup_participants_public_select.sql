-- Allow anyone viewing a meetup to read its participant list (meetup details screen).
-- Insert/delete remain restricted to the pet owner; hosts are still managed via meetup_hosts.
-- Idempotent — safe to re-run.

ALTER TABLE public.meetup_participants ENABLE ROW LEVEL SECURITY;

-- Replace owner-only SELECT with public read (required for MeetupDetailsScreen).
DROP POLICY IF EXISTS meetup_participants_select_own ON public.meetup_participants;
DROP POLICY IF EXISTS meetup_participants_select_all ON public.meetup_participants;

CREATE POLICY meetup_participants_select_all
  ON public.meetup_participants
  FOR SELECT
  USING (true);

COMMENT ON POLICY meetup_participants_select_all ON public.meetup_participants IS
  'Public read — meetup details shows the full attendee list. Writes remain owner-scoped.';
