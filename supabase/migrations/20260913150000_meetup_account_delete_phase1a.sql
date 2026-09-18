-- 10B-B.6: Phase 1A meetup account delete — hard-delete owned meetups, never blocked.
-- Reverts any local 10B-B.2/10B-B.3 preservation artifacts idempotently.
-- Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) Remove abandoned history-lock / preservation artifacts (if present)
-- ---------------------------------------------------------------------------
ALTER TABLE public.meetups DROP COLUMN IF EXISTS history_locked_at;

DROP TRIGGER IF EXISTS meetup_participants_leave_guard ON public.meetup_participants;
DROP FUNCTION IF EXISTS public.check_meetup_participant_leave_allowed();

DROP FUNCTION IF EXISTS public.is_meetup_past(date, time, time, text);
DROP FUNCTION IF EXISTS public.meetup_wall_clock_timezone();

-- Orphan shells from abandoned preservation (no tombstones in Phase 1A).
DELETE FROM public.meetups WHERE user_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meetups'
      AND column_name = 'user_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.meetups ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.meetups DROP CONSTRAINT IF EXISTS meetups_user_id_fkey;
ALTER TABLE public.meetups
  ADD CONSTRAINT meetups_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- Restore pre-preservation meetup triggers (20260828200000 / 20260806000000 semantics).
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
-- Disable adult gate on bulk repair only (migration runs as postgres; no user context).
ALTER TABLE public.meetups DISABLE TRIGGER trg_meetups_assert_adult;
UPDATE public.meetups m
SET participant_count = (
  SELECT COUNT(*)::integer
  FROM public.meetup_participants mp
  WHERE mp.meetup_id = m.id
);
ALTER TABLE public.meetups ENABLE TRIGGER trg_meetups_assert_adult;

COMMENT ON COLUMN public.meetups.participant_count IS
  'Derived total of rows in meetup_participants. Client applications must never mutate this column.';


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
  -- Serialize concurrent RSVPs for the same meetup (Product Contract Â§7 atomicity).
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
-- 3) Cancel meetup when no host pets remain (Product Contract Â§7)
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
-- 3) delete_user_account — production hard-delete meetup graph (140000 baseline)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage, extensions
AS $$
DECLARE
  target_user_id uuid := auth.uid();
  profile_exists boolean;
  auth_exists boolean;
  deleted_counts jsonb := '{}'::jsonb;
  storage_deleted integer := 0;
  row_count integer;
  auth_deleted integer := 0;
  owned_meetup_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '28000',
            HINT = 'Sign in before deleting your account.';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = target_user_id)
  INTO profile_exists;

  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = target_user_id)
  INTO auth_exists;

  IF NOT profile_exists AND NOT auth_exists THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_deleted', true,
      'user_id', target_user_id,
      'deleted_at', NOW(),
      'counts', deleted_counts
    );
  END IF;

  storage_deleted := public._delete_caller_storage_objects(target_user_id);
  deleted_counts := deleted_counts || jsonb_build_object('storage_objects', storage_deleted);

  IF to_regclass('storage.objects') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id IN ('moments', 'pet-photos')
      AND (
        name = target_user_id::text
        OR name LIKE target_user_id::text || '/%'
      )
  ) THEN
    RAISE EXCEPTION 'storage_objects_not_deleted'
      USING ERRCODE = '42501',
            HINT = 'Self-delete could not remove storage objects; transaction rolled back.';
  END IF;

  IF to_regclass('public.likes') IS NOT NULL THEN
    DELETE FROM public.likes
    WHERE user_id = target_user_id
       OR moment_id IN (SELECT id FROM public.moments WHERE user_id = target_user_id);
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('likes', row_count);
  END IF;

  IF to_regclass('public.moment_pets') IS NOT NULL THEN
    DELETE FROM public.moment_pets mp
    USING public.moments m
    WHERE mp.moment_id = m.id
      AND m.user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('moment_pets', row_count);
  END IF;

  DELETE FROM public.moments WHERE user_id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('moments', row_count);

  row_count := public._delete_owned_rows(
    'memories', target_user_id, ARRAY['user_id', 'owner_id', 'created_by']
  );
  deleted_counts := deleted_counts || jsonb_build_object('memories', row_count);

  row_count := public._delete_owned_rows(
    'posts', target_user_id, ARRAY['user_id', 'created_by', 'owner_id']
  );
  deleted_counts := deleted_counts || jsonb_build_object('posts', row_count);

  row_count := public._delete_owned_rows(
    'photos', target_user_id, ARRAY['user_id', 'owner_id', 'created_by']
  );
  deleted_counts := deleted_counts || jsonb_build_object('photos', row_count);

  row_count := public._delete_owned_rows(
    'meetup_history', target_user_id, ARRAY['user_id', 'owner_id', 'created_by']
  );
  deleted_counts := deleted_counts || jsonb_build_object('meetup_history', row_count);

  row_count := public._delete_owned_rows(
    'notifications', target_user_id, ARRAY['user_id', 'recipient_id']
  );
  deleted_counts := deleted_counts || jsonb_build_object('notifications', row_count);

  row_count := public._delete_owned_rows(
    'messages', target_user_id, ARRAY['user_id', 'sender_id', 'sender_user_id']
  );
  deleted_counts := deleted_counts || jsonb_build_object('messages', row_count);

  IF to_regclass('public.mating_introduction_messages') IS NOT NULL THEN
    DELETE FROM public.mating_introduction_messages m
    USING public.mating_introduction_channels c
    WHERE m.channel_id = c.id
      AND (c.owner_low_id = target_user_id OR c.owner_high_id = target_user_id);
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('mating_introduction_messages', row_count);
  END IF;

  IF to_regclass('public.mating_introduction_channels') IS NOT NULL THEN
    DELETE FROM public.mating_introduction_channels
    WHERE owner_low_id = target_user_id OR owner_high_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('mating_introduction_channels', row_count);
  END IF;

  -- Live paw_interests has to_owner_id (audit). Tester PAW-149: inbound rows
  -- must be deleted explicitly, not only via from_owner_id / owned pet ids.
  IF to_regclass('public.paw_interests') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'paw_interests'
        AND column_name = 'to_owner_id'
    ) THEN
      DELETE FROM public.paw_interests
      WHERE from_owner_id = target_user_id
         OR to_owner_id = target_user_id
         OR from_pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id)
         OR to_pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id);
    ELSE
      DELETE FROM public.paw_interests
      WHERE from_owner_id = target_user_id
         OR from_pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id)
         OR to_pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id);
    END IF;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('paw_interests', row_count);
  END IF;

  IF to_regclass('public.reports') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'reported_user_id'
    ) THEN
      DELETE FROM public.reports
      WHERE reporter_user_id = target_user_id
         OR reported_user_id = target_user_id;
    ELSE
      DELETE FROM public.reports
      WHERE reporter_user_id = target_user_id;
    END IF;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('reports', row_count);
  END IF;

  IF to_regclass('public.pet_blocks') IS NOT NULL THEN
    DELETE FROM public.pet_blocks
    WHERE blocker_user_id = target_user_id
       OR blocked_pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id);
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('pet_blocks', row_count);
  END IF;

  -- Meetup graph: children first so AFTER DELETE host/participant triggers
  -- do not UPDATE a meetup row that is being deleted in the same statement.
  owned_meetup_ids := public._owned_meetup_ids(target_user_id);

  IF to_regclass('public.meetup_participants') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'meetup_participants' AND column_name = 'user_id'
    ) THEN
      DELETE FROM public.meetup_participants WHERE user_id = target_user_id;
      GET DIAGNOSTICS row_count = ROW_COUNT;
      deleted_counts := deleted_counts || jsonb_build_object('meetup_participants_legacy', row_count);
    END IF;

    DELETE FROM public.meetup_participants
    WHERE pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id)
       OR meetup_id = ANY (owned_meetup_ids);
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('meetup_participants', row_count);
  END IF;

  IF to_regclass('public.meetup_hosts') IS NOT NULL THEN
    DELETE FROM public.meetup_hosts
    WHERE pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id)
       OR meetup_id = ANY (owned_meetup_ids);
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('meetup_hosts', row_count);
  END IF;

  IF to_regclass('public.meetups') IS NOT NULL THEN
    DELETE FROM public.meetups WHERE id = ANY (owned_meetup_ids);
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('meetups_created', row_count);
  END IF;

  DELETE FROM public.pets WHERE owner_id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('pets', row_count);

  IF to_regclass('public.invites') IS NOT NULL THEN
    DELETE FROM public.invites
    WHERE user_id = target_user_id
      AND status = 'unused';
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('invites_unused_deleted', row_count);

    UPDATE public.invites
    SET user_id = NULL
    WHERE user_id = target_user_id
      AND status = 'used';
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('invites_issued_anonymized', row_count);

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invites' AND column_name = 'used_by_user_id'
    ) THEN
      UPDATE public.invites
      SET used_by_user_id = NULL
      WHERE used_by_user_id = target_user_id;
      GET DIAGNOSTICS row_count = ROW_COUNT;
      deleted_counts := deleted_counts || jsonb_build_object('invites_redeemed_anonymized', row_count);
    END IF;
  END IF;

  DELETE FROM public.profiles WHERE id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('profiles', row_count);

  auth_deleted := public._delete_caller_auth_user(target_user_id);
  deleted_counts := deleted_counts || jsonb_build_object('auth_users', auth_deleted);

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'auth_user_not_deleted'
      USING ERRCODE = '42501',
            HINT = 'Self-delete could not remove auth.users; transaction rolled back.';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_deleted', false,
    'user_id', target_user_id,
    'deleted_at', NOW(),
    'counts', deleted_counts
  );
END;
$$;

ALTER FUNCTION public.delete_user_account() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

REVOKE ALL ON FUNCTION public._owned_meetup_ids(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._delete_owned_rows(text, uuid, text[]) FROM PUBLIC;

COMMENT ON FUNCTION public.delete_user_account() IS
  '10B-B.6 Phase 1A: hard-delete all owned meetups (past and future); never blocked by meetup state.';

COMMENT ON FUNCTION public._delete_caller_auth_user(uuid) IS
  'Internal: delete caller auth.identities/sessions/users. Not granted to authenticated/anon.';

COMMENT ON FUNCTION public._delete_caller_storage_objects(uuid) IS
  'Internal: prefix-delete caller storage objects. Sets storage.allow_delete_query. Not granted to authenticated/anon.';

COMMENT ON FUNCTION public._delete_owned_rows(text, uuid, text[]) IS
  'Internal: delete caller-owned rows using only existing uuid owner columns. Not granted to clients.';

COMMENT ON FUNCTION public._owned_meetup_ids(uuid) IS
  'Internal: meetup ids owned via user_id, organizer_id, or created_by when those uuid columns exist.';
