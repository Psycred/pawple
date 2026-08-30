-- PAW-44 / Honesty & Safety wave: data-visibility model (B) + companion display-only (G)
-- + Phase-1 report/block schema for PAW-47 (Frontend consumes; Backend owns schema).
--
-- Binding sources: docs/CURRENT.md (B)(F)(G); CTO sequencing on PAW-41.
-- Idempotent where practical. No storage policies (PAW-45). No mating engine.

-- ---------------------------------------------------------------------------
-- 1) (G) Pets SELECT — companion flag must NOT gate visibility
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.pets.is_looking_for_companion IS
  'Display-only mating-intent signal (Open to Companionship). Never gates RLS visibility of pets, profiles, meetups, or feed.';

DROP POLICY IF EXISTS pets_select_visible ON public.pets;
CREATE POLICY pets_select_visible
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY pets_select_visible ON public.pets IS
  'Invite-only community: any authenticated user may read pet profile rows. Companion flag is not a visibility gate (G).';

-- ---------------------------------------------------------------------------
-- 2) (B) Meetup / host / participant SELECT — authenticated only (not public/anon)
-- ---------------------------------------------------------------------------
ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetup_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetup_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.meetups;
DROP POLICY IF EXISTS meetups_select_all ON public.meetups;
DROP POLICY IF EXISTS meetups_select_authenticated ON public.meetups;

CREATE POLICY meetups_select_authenticated
  ON public.meetups
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY meetups_select_authenticated ON public.meetups IS
  'Meetup venue and metadata readable by authenticated users only (B). Anon/public SELECT forbidden.';

DROP POLICY IF EXISTS "Allow public read access on hosts" ON public.meetup_hosts;
DROP POLICY IF EXISTS meetup_hosts_select_all ON public.meetup_hosts;
DROP POLICY IF EXISTS meetup_hosts_select_authenticated ON public.meetup_hosts;

CREATE POLICY meetup_hosts_select_authenticated
  ON public.meetup_hosts
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY meetup_hosts_select_authenticated ON public.meetup_hosts IS
  'Host pet list readable by authenticated users only (B).';

DROP POLICY IF EXISTS meetup_participants_select_all ON public.meetup_participants;
DROP POLICY IF EXISTS meetup_participants_select_own ON public.meetup_participants;
DROP POLICY IF EXISTS meetup_participants_select_authenticated ON public.meetup_participants;

-- Meetup details shows the attendee list to signed-in users; writes stay owner-scoped.
CREATE POLICY meetup_participants_select_authenticated
  ON public.meetup_participants
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY meetup_participants_select_authenticated ON public.meetup_participants IS
  'Authenticated read of RSVP list for meetup details. Anon/public SELECT forbidden (B).';

-- ---------------------------------------------------------------------------
-- 3) (B) Defense in depth — revoke table privileges from anon on user/pet/meetup data
--    RLS already denies when no anon policy applies; revoke removes GRANT ALL leakage.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.pets FROM anon;
REVOKE ALL ON TABLE public.moments FROM anon;
REVOKE ALL ON TABLE public.likes FROM anon;
REVOKE ALL ON TABLE public.invites FROM anon;
REVOKE ALL ON TABLE public.moment_pets FROM anon;
REVOKE ALL ON TABLE public.meetups FROM anon;
REVOKE ALL ON TABLE public.meetup_hosts FROM anon;
REVOKE ALL ON TABLE public.meetup_participants FROM anon;

-- Aggregate view must not leak via anon either (SECURITY INVOKER over junction tables).
REVOKE ALL ON TABLE public.pet_meetup_stats FROM anon;
GRANT SELECT ON TABLE public.pet_meetup_stats TO authenticated;
GRANT ALL ON TABLE public.pet_meetup_stats TO service_role;

-- Authenticated retains full table privileges (column REVOKE below narrows location cols).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.moments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.moment_pets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meetups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meetup_hosts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meetup_participants TO authenticated;

GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.pets TO service_role;
GRANT ALL ON TABLE public.moments TO service_role;
GRANT ALL ON TABLE public.likes TO service_role;
GRANT ALL ON TABLE public.invites TO service_role;
GRANT ALL ON TABLE public.moment_pets TO service_role;
GRANT ALL ON TABLE public.meetups TO service_role;
GRANT ALL ON TABLE public.meetup_hosts TO service_role;
GRANT ALL ON TABLE public.meetup_participants TO service_role;

-- ---------------------------------------------------------------------------
-- 4) (B) Exact user location — never readable by users (admin/service_role only)
--     Owner UPDATE of these columns may remain; SELECT revoked from client roles.
-- ---------------------------------------------------------------------------
REVOKE SELECT (
  last_location_lat,
  last_location_lng,
  location_updated_at
) ON public.profiles FROM authenticated;

REVOKE SELECT (
  last_location_lat,
  last_location_lng,
  location_updated_at
) ON public.profiles FROM anon;

COMMENT ON COLUMN public.profiles.last_location_lat IS
  'Internal approximate latitude for server-side use. Not selectable by authenticated/anon (B); service_role only.';
COMMENT ON COLUMN public.profiles.last_location_lng IS
  'Internal approximate longitude for server-side use. Not selectable by authenticated/anon (B); service_role only.';
COMMENT ON COLUMN public.profiles.location_updated_at IS
  'When last_location_* was last updated. Not selectable by authenticated/anon (B); service_role only.';

-- ---------------------------------------------------------------------------
-- 5) (B) Revoke inappropriate anon EXECUTE on count RPCs
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_meetup_participant_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_pet_hosted_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_pet_participated_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_pet_meetup_counts(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_meetup_participant_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pet_hosted_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pet_participated_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pet_meetup_counts(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) (F) reports — Phase-1 trust & safety (schema for PAW-47 Frontend)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reporter_pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reported_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_target_type_check CHECK (target_type IN ('moment', 'meetup')),
  CONSTRAINT reports_status_check CHECK (
    status IN ('open', 'reviewed', 'actioned', 'dismissed')
  )
);

CREATE INDEX IF NOT EXISTS reports_reporter_user_id_idx
  ON public.reports (reporter_user_id);
CREATE INDEX IF NOT EXISTS reports_reported_user_id_idx
  ON public.reports (reported_user_id);
CREATE INDEX IF NOT EXISTS reports_target_idx
  ON public.reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS reports_status_idx
  ON public.reports (status);

COMMENT ON TABLE public.reports IS
  'Phase-1 user reports. Filed in the name of a pet; flags the human account (reported_user_id). Team review via service_role only. Mating-session targets deferred.';

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pets p
      WHERE p.id = reporter_pet_id
        AND p.owner_id = auth.uid()
    )
  );

-- No user UPDATE/DELETE — status transitions are service_role / team review only.

REVOKE ALL ON TABLE public.reports FROM anon;
GRANT SELECT, INSERT ON TABLE public.reports TO authenticated;
GRANT ALL ON TABLE public.reports TO service_role;

-- ---------------------------------------------------------------------------
-- 7) (F) pet_blocks — block other pet profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pet_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blocked_pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pet_blocks_blocker_pet_unique UNIQUE (blocker_user_id, blocked_pet_id)
);

CREATE INDEX IF NOT EXISTS pet_blocks_blocker_user_id_idx
  ON public.pet_blocks (blocker_user_id);
CREATE INDEX IF NOT EXISTS pet_blocks_blocked_pet_id_idx
  ON public.pet_blocks (blocked_pet_id);

COMMENT ON TABLE public.pet_blocks IS
  'Phase-1 block list: a user blocks a pet profile. No cross-user read of others'' blocks.';

ALTER TABLE public.pet_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pet_blocks_select_own ON public.pet_blocks;
CREATE POLICY pet_blocks_select_own
  ON public.pet_blocks
  FOR SELECT
  TO authenticated
  USING (blocker_user_id = auth.uid());

DROP POLICY IF EXISTS pet_blocks_insert_own ON public.pet_blocks;
CREATE POLICY pet_blocks_insert_own
  ON public.pet_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (blocker_user_id = auth.uid());

DROP POLICY IF EXISTS pet_blocks_delete_own ON public.pet_blocks;
CREATE POLICY pet_blocks_delete_own
  ON public.pet_blocks
  FOR DELETE
  TO authenticated
  USING (blocker_user_id = auth.uid());

REVOKE ALL ON TABLE public.pet_blocks FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.pet_blocks TO authenticated;
GRANT ALL ON TABLE public.pet_blocks TO service_role;
