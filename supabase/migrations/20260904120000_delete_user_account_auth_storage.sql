-- PAW-144: Make delete_user_account actually remove auth identity + storage.
-- Live project pexurgcfkxkouthuhlnb currently serves an older RPC body:
--   { ok, user_id, counts: { pets, moments, storage_objects: -1 } }
-- Storage delete is swallowed (objects remain publicly readable). The repo
-- body from 20260830200000 was never what PostgREST returned.
--
-- This migration is the canonical self-delete implementation:
--   * authenticated self-delete only (anon still denied)
--   * one transaction; any error rolls back
--   * storage objects under {user_id}/ are deleted (no foldername(), no swallow)
--   * auth.identities / sessions / tokens / auth.users removed via a helper
--     owned by supabase_auth_admin when that role exists
--   * schema-drift safe (optional tables/columns)
--   * meetup child rows deleted before parent rows so host-count triggers
--     cannot abort with "tuple concurrently updated"
--   * refuses to return ok:true if auth.users still exists

-- ---------------------------------------------------------------------------
-- Storage helper — prefix delete without storage.foldername()
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

  -- Hosted Storage protect_delete() rejects SQL DELETE unless this GUC is set
  -- (supabase/storage#817). Statement-level; fires even for 0 matching rows.
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
-- Auth helper — identities first, then auth.users (Google restore root)
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

  -- Optional GoTrue child tables. Schema drift must not abort identity removal.
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
-- Canonical self-delete RPC (replaces live Dashboard body and PAW-9/PAW-60 copies)
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

  IF to_regclass('public.memories') IS NOT NULL THEN
    DELETE FROM public.memories WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('memories', row_count);
  END IF;

  IF to_regclass('public.posts') IS NOT NULL THEN
    DELETE FROM public.posts WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('posts', row_count);
  END IF;

  IF to_regclass('public.photos') IS NOT NULL THEN
    DELETE FROM public.photos WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('photos', row_count);
  END IF;

  IF to_regclass('public.meetup_history') IS NOT NULL THEN
    DELETE FROM public.meetup_history WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('meetup_history', row_count);
  END IF;

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

  IF to_regclass('public.paw_interests') IS NOT NULL THEN
    DELETE FROM public.paw_interests
    WHERE from_owner_id = target_user_id
       OR from_pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id)
       OR to_pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id);
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
       OR meetup_id IN (SELECT id FROM public.meetups WHERE user_id = target_user_id);
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('meetup_participants', row_count);
  END IF;

  IF to_regclass('public.meetup_hosts') IS NOT NULL THEN
    DELETE FROM public.meetup_hosts
    WHERE pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id)
       OR meetup_id IN (SELECT id FROM public.meetups WHERE user_id = target_user_id);
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('meetup_hosts', row_count);
  END IF;

  DELETE FROM public.meetups WHERE user_id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('meetups_created', row_count);

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

COMMENT ON FUNCTION public.delete_user_account() IS
  'PAW-144 / Product Contract §10: authenticated self-delete of owned data, storage prefixes, and auth identity in one transaction. Anon denied. Helpers are not granted to clients.';

COMMENT ON FUNCTION public._delete_caller_auth_user(uuid) IS
  'Internal: delete caller auth.identities/sessions/users. Not granted to authenticated/anon.';

COMMENT ON FUNCTION public._delete_caller_storage_objects(uuid) IS
  'Internal: delete caller storage objects under {user_id}/ in moments and pet-photos. Not granted to authenticated/anon.';
