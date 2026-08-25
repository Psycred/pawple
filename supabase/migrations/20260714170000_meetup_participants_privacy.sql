-- Privacy: users may only read their own RSVP rows (meetup_participants).
-- Public profiles expose hosted meetups via public.meetups (creator user_id), never Going lists.

DROP POLICY IF EXISTS meetup_participants_select_all ON public.meetup_participants;

DROP POLICY IF EXISTS meetup_participants_select_own ON public.meetup_participants;
CREATE POLICY meetup_participants_select_own
  ON public.meetup_participants
  FOR SELECT
  USING (auth.uid() = user_id);
