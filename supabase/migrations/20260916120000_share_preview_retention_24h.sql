-- Step 21C.3: Temporary share-preview retention (24 hours).
-- Bucket share-previews holds public OG cards for link sharing only.

-- ---------------------------------------------------------------------------
-- 1) Account deletion — include share-previews in owner prefix cleanup
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
  WHERE bucket_id IN ('moments', 'pet-photos', 'share-previews')
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
    RAISE NOTICE 'share-preview retention: could not reassign storage helper owner: %', SQLERRM;
END $$;

REVOKE ALL ON FUNCTION public._delete_caller_storage_objects(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._delete_caller_storage_objects(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._delete_caller_storage_objects(uuid) TO postgres;

COMMENT ON FUNCTION public._delete_caller_storage_objects(uuid) IS
  'Internal: prefix-delete caller storage objects (moments, pet-photos, share-previews). Sets storage.allow_delete_query for hosted protect_delete trigger.';

-- ---------------------------------------------------------------------------
-- 2) delete_user_account — extend storage remnant gate to share-previews
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
    WHERE bucket_id IN ('moments', 'pet-photos', 'share-previews')
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

COMMENT ON FUNCTION public.delete_user_account() IS
  '10B-B.6 Phase 1A + 21C.3: hard-delete owned data; storage includes share-previews prefix.';

-- ---------------------------------------------------------------------------
-- 3) Scheduled cleanup — delete share-previews older than 24 hours
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_share_previews()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage, public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM set_config('storage.allow_delete_query', 'true', true);

  DELETE FROM storage.objects
  WHERE bucket_id = 'share-previews'
    AND created_at < timezone('utc', now()) - interval '24 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

ALTER FUNCTION public.cleanup_expired_share_previews() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.cleanup_expired_share_previews() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_share_previews() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_share_previews() TO postgres, service_role;

COMMENT ON FUNCTION public.cleanup_expired_share_previews() IS
  'Idempotent: remove share-previews objects older than 24 hours (storage.objects.created_at). service_role/cron only.';

-- ---------------------------------------------------------------------------
-- 4) pg_cron — daily at 00:00 UTC (Supabase; skip if unavailable)
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'cleanup-expired-share-previews';

  PERFORM cron.schedule(
    'cleanup-expired-share-previews',
    '0 0 * * *',
    $job$SELECT public.cleanup_expired_share_previews();$job$
  );
EXCEPTION
  WHEN undefined_object OR insufficient_privilege OR OTHERS THEN
    RAISE NOTICE 'pg_cron unavailable — run cleanup_expired_share_previews() daily via dashboard or ops';
END;
$cron$;
