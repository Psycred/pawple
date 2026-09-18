-- PAW-144 consolidated self-delete (single remaining Production paste).
--
-- Review: QA Auditor PAW-148 Approved; Tester PAW-150 Approved (after PAW-149
-- to_owner_id change). Do not mark PAW-141 Done until live proof.
--
-- Live project pexurgcfkxkouthuhlnb already has:
--   20260904120000  helpers + delete_user_account (then failed on Storage protect_delete)
--   20260904130000  storage.allow_delete_query GUC in the storage helper
-- This file CREATE OR REPLACE those helpers plus column-safe leftover deletes
-- (posts.created_by, meetup organizer_id/created_by, paw_interests.to_owner_id).
--
-- Read-only live audit (2026-09-04): leftover public.posts uses created_by, not
-- user_id. That 42703 aborted every self-delete after Storage succeeded.
-- Meetups also have organizer_id + created_by. invites has no used_by_user_id.
-- notifications.user_id and messages.sender_id exist. matches has no user column.
--
-- Contract unchanged:
--   authenticated self-delete only; anon denied; one transaction; rollback on
--   error; refuse ok:true if auth.users remains; helpers not client-callable.

-- ---------------------------------------------------------------------------
-- Storage helper (GUC required on hosted Storage protect_delete)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._delete_caller_storage_objects(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage, public
AS $$
DECLARE
  n integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_authorized'
      USING ERRCODE = '42501',
            HINT = 'Storage cleanup is only allowed for the authenticated caller.';
  END IF;

  IF to_regclass('storage.objects') IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM set_config('storage.allow_delete_query', 'true', true);

  DELETE FROM storage.objects
  WHERE bucket_id IN ('moments', 'pet-photos')
    AND (
      name = p_user_id::text
      OR name LIKE p_user_id::text || '/%'
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    ALTER FUNCTION public._delete_caller_storage_objects(uuid) OWNER TO supabase_storage_admin;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'PAW-144: could not reassign storage helper owner: %', SQLERRM;
END $$;

REVOKE ALL ON FUNCTION public._delete_caller_storage_objects(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._delete_caller_storage_objects(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._delete_caller_storage_objects(uuid) TO postgres;

DO $$
BEGIN
  GRANT SELECT, DELETE ON TABLE storage.objects TO postgres;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'PAW-144: could not GRANT storage.objects to postgres: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Auth helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._delete_caller_auth_user(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  n integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_authorized'
      USING ERRCODE = '42501',
            HINT = 'Auth identity deletion is only allowed for the authenticated caller.';
  END IF;

  BEGIN
    IF to_regclass('auth.one_time_tokens') IS NOT NULL THEN
      DELETE FROM auth.one_time_tokens WHERE user_id = p_user_id;
    END IF;
    IF to_regclass('auth.mfa_challenges') IS NOT NULL AND to_regclass('auth.mfa_factors') IS NOT NULL THEN
      DELETE FROM auth.mfa_challenges
      WHERE factor_id IN (SELECT id FROM auth.mfa_factors WHERE user_id = p_user_id);
    END IF;
    IF to_regclass('auth.mfa_factors') IS NOT NULL THEN
      DELETE FROM auth.mfa_factors WHERE user_id = p_user_id;
    END IF;
    IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
      DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id;
    END IF;
    IF to_regclass('auth.sessions') IS NOT NULL THEN
      DELETE FROM auth.sessions WHERE user_id = p_user_id;
    END IF;
  EXCEPTION
    WHEN undefined_table OR undefined_column OR insufficient_privilege THEN
      NULL;
  END;

  IF to_regclass('auth.identities') IS NOT NULL THEN
    DELETE FROM auth.identities WHERE user_id = p_user_id;
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    ALTER FUNCTION public._delete_caller_auth_user(uuid) OWNER TO supabase_auth_admin;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'PAW-144: could not reassign auth helper owner: %', SQLERRM;
END $$;

REVOKE ALL ON FUNCTION public._delete_caller_auth_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._delete_caller_auth_user(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._delete_caller_auth_user(uuid) TO postgres;

-- ---------------------------------------------------------------------------
-- Optional-table owner delete (uuid columns that actually exist)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._delete_owned_rows(
  p_table text,
  p_user_id uuid,
  p_owner_columns text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  col text;
  n integer := 0;
  total integer := 0;
BEGIN
  IF p_table IS NULL OR p_table !~ '^[a-z_][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'invalid_table' USING ERRCODE = '42602';
  END IF;

  IF to_regclass(format('public.%I', p_table)) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH col IN ARRAY COALESCE(p_owner_columns, ARRAY[]::text[]) LOOP
    IF col IS NULL OR col !~ '^[a-z_][a-z0-9_]*$' THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = p_table
        AND c.column_name = col
        AND (c.udt_name = 'uuid' OR c.data_type = 'uuid')
    ) THEN
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', p_table, col)
        USING p_user_id;
      GET DIAGNOSTICS n = ROW_COUNT;
      total := total + n;
    END IF;
  END LOOP;

  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public._delete_owned_rows(text, uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._delete_owned_rows(text, uuid, text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._delete_owned_rows(text, uuid, text[]) TO postgres;

-- Live meetups have user_id + organizer_id + created_by.
CREATE OR REPLACE FUNCTION public._owned_meetup_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids uuid[] := ARRAY[]::uuid[];
  extra uuid[];
  col text;
BEGIN
  IF to_regclass('public.meetups') IS NULL THEN
    RETURN ids;
  END IF;

  FOREACH col IN ARRAY ARRAY['user_id', 'organizer_id', 'created_by'] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'meetups'
        AND c.column_name = col
        AND (c.udt_name = 'uuid' OR c.data_type = 'uuid')
    ) THEN
      EXECUTE format(
        'SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) FROM public.meetups WHERE %I = $1',
        col
      )
        USING p_user_id
        INTO extra;
      ids := ids || extra;
    END IF;
  END LOOP;

  RETURN ARRAY(SELECT DISTINCT x FROM unnest(ids) AS x WHERE x IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public._owned_meetup_ids(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._owned_meetup_ids(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._owned_meetup_ids(uuid) TO postgres;

-- ---------------------------------------------------------------------------
-- Canonical self-delete RPC
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
  'PAW-144 consolidated self-delete: owned data, leftover-table owner columns, storage prefixes, auth identity. One transaction. Anon denied. Helpers not granted to clients.';

COMMENT ON FUNCTION public._delete_caller_auth_user(uuid) IS
  'Internal: delete caller auth.identities/sessions/users. Not granted to authenticated/anon.';

COMMENT ON FUNCTION public._delete_caller_storage_objects(uuid) IS
  'Internal: prefix-delete caller storage objects. Sets storage.allow_delete_query. Not granted to authenticated/anon.';

COMMENT ON FUNCTION public._delete_owned_rows(text, uuid, text[]) IS
  'Internal: delete caller-owned rows using only existing uuid owner columns. Not granted to clients.';

COMMENT ON FUNCTION public._owned_meetup_ids(uuid) IS
  'Internal: meetup ids owned via user_id, organizer_id, or created_by when those uuid columns exist.';
