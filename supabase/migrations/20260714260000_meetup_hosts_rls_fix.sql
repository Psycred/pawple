-- Fix meetup_hosts RLS so authenticated users can insert host rows when creating meetups.
-- Replaces the stricter meetup_hosts_insert_meetup_owner policy (meetup + pet join)
-- with a pet-ownership check that matches the app create flow.
-- Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- meetup_hosts — drop legacy + new policy names
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS meetup_hosts_select_all ON public.meetup_hosts;
DROP POLICY IF EXISTS meetup_hosts_insert_meetup_owner ON public.meetup_hosts;
DROP POLICY IF EXISTS meetup_hosts_delete_meetup_owner ON public.meetup_hosts;
DROP POLICY IF EXISTS "Allow authenticated users to insert hosts" ON public.meetup_hosts;
DROP POLICY IF EXISTS "Allow public read access on hosts" ON public.meetup_hosts;
DROP POLICY IF EXISTS "Allow users to delete their own hosts" ON public.meetup_hosts;

ALTER TABLE public.meetup_hosts ENABLE ROW LEVEL SECURITY;

-- Anyone can read hosts (public meetup info).
CREATE POLICY "Allow public read access on hosts"
  ON public.meetup_hosts
  FOR SELECT
  TO public
  USING (true);

-- Authenticated users may add their own pets as hosts.
CREATE POLICY "Allow authenticated users to insert hosts"
  ON public.meetup_hosts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    pet_id IN (
      SELECT id
      FROM public.pets
      WHERE owner_id = auth.uid()
    )
  );

-- Authenticated users may remove their own pets from a meetup's host list.
CREATE POLICY "Allow users to delete their own hosts"
  ON public.meetup_hosts
  FOR DELETE
  TO authenticated
  USING (
    pet_id IN (
      SELECT id
      FROM public.pets
      WHERE owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- meetups — ensure read + insert policies exist for meetup creation flow
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS meetups_select_all ON public.meetups;
DROP POLICY IF EXISTS meetups_insert_own ON public.meetups;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.meetups;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.meetups;

ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
  ON public.meetups
  FOR SELECT
  TO public
  USING (true);

-- Users create meetups under their own user_id (safer than WITH CHECK (true)).
CREATE POLICY "Enable insert for authenticated users"
  ON public.meetups
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Preserve update/delete ownership if not already present.
DROP POLICY IF EXISTS meetups_update_own ON public.meetups;
CREATE POLICY meetups_update_own
  ON public.meetups
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS meetups_delete_own ON public.meetups;
CREATE POLICY meetups_delete_own
  ON public.meetups
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
