-- PAW-9 / A5: Server-controlled account deletion (Product Contract §10).
-- Authenticated users may delete only their own account. The operation runs in a single
-- transaction: canonical DB rows, owner-scoped Storage objects, then auth identity.
-- Safe to retry on client/network failure before a successful commit.

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

  -- Idempotent success when a prior run fully completed (auth row already removed).
  IF NOT profile_exists AND NOT auth_exists THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_deleted', true,
      'user_id', target_user_id,
      'deleted_at', NOW(),
      'counts', deleted_counts
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Storage: owner-scoped prefixes in canonical buckets (see src/lib/supabase.js)
  -- -------------------------------------------------------------------------
  DELETE FROM storage.objects
  WHERE bucket_id IN ('moments', 'pet-photos')
    AND (storage.foldername(name))[1] = target_user_id::text;
  GET DIAGNOSTICS storage_deleted = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('storage_objects', storage_deleted);

  -- -------------------------------------------------------------------------
  -- Likes (user-authored and on owned moments)
  -- -------------------------------------------------------------------------
  DELETE FROM public.likes
  WHERE user_id = target_user_id
     OR moment_id IN (SELECT id FROM public.moments WHERE user_id = target_user_id);
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('likes', row_count);

  -- -------------------------------------------------------------------------
  -- Moments (+ transitional moment_pets join when present)
  -- -------------------------------------------------------------------------
  IF to_regclass('public.moment_pets') IS NOT NULL THEN
    DELETE FROM public.moment_pets mp
    USING public.moments m
    WHERE mp.moment_id = m.id
      AND m.user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('moment_pets', row_count);
  END IF;

  DELETE FROM public.moments
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('moments', row_count);

  -- -------------------------------------------------------------------------
  -- Legacy memories table (read fallback only; no new writes)
  -- -------------------------------------------------------------------------
  IF to_regclass('public.memories') IS NOT NULL THEN
    DELETE FROM public.memories
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('memories', row_count);
  END IF;

  -- -------------------------------------------------------------------------
  -- Transitional legacy tables (no new writes; clean if present on older DBs)
  -- -------------------------------------------------------------------------
  IF to_regclass('public.posts') IS NOT NULL THEN
    DELETE FROM public.posts
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('posts', row_count);
  END IF;

  IF to_regclass('public.photos') IS NOT NULL THEN
    DELETE FROM public.photos
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('photos', row_count);
  END IF;

  IF to_regclass('public.meetup_history') IS NOT NULL THEN
    DELETE FROM public.meetup_history
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('meetup_history', row_count);
  END IF;

  -- meetup_participants.user_id exists only on pre-pet-centric schemas.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meetup_participants'
      AND column_name = 'user_id'
  ) THEN
    DELETE FROM public.meetup_participants
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('meetup_participants_legacy', row_count);
  END IF;

  -- -------------------------------------------------------------------------
  -- Mating / Paw interest (extend when E3 schema lands; must run before pets)
  -- -------------------------------------------------------------------------
  IF to_regclass('public.paw_interests') IS NOT NULL THEN
    EXECUTE $sql$
      DELETE FROM public.paw_interests
      WHERE from_pet_id IN (SELECT id FROM public.pets WHERE owner_id = $1)
         OR to_pet_id IN (SELECT id FROM public.pets WHERE owner_id = $1)
         OR from_user_id = $1
         OR to_user_id = $1
    $sql$ USING target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('paw_interests', row_count);
  END IF;

  IF to_regclass('public.pet_paw_interests') IS NOT NULL THEN
    EXECUTE $sql$
      DELETE FROM public.pet_paw_interests
      WHERE from_pet_id IN (SELECT id FROM public.pets WHERE owner_id = $1)
         OR to_pet_id IN (SELECT id FROM public.pets WHERE owner_id = $1)
         OR user_id = $1
    $sql$ USING target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('pet_paw_interests', row_count);
  END IF;

  -- -------------------------------------------------------------------------
  -- Meetups created by the user (cascades meetup_hosts / meetup_participants)
  -- -------------------------------------------------------------------------
  DELETE FROM public.meetups
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('meetups_created', row_count);

  -- -------------------------------------------------------------------------
  -- Owned pets (cascades meetup_hosts / meetup_participants for other meetups)
  -- -------------------------------------------------------------------------
  DELETE FROM public.pets
  WHERE owner_id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('pets', row_count);

  -- -------------------------------------------------------------------------
  -- Invites: remove unused issued codes; anonymize integrity fields on consumed rows
  -- -------------------------------------------------------------------------
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

  UPDATE public.invites
  SET used_by_user_id = NULL
  WHERE used_by_user_id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('invites_redeemed_anonymized', row_count);

  -- -------------------------------------------------------------------------
  -- Profile, then auth identity (must be last)
  -- -------------------------------------------------------------------------
  DELETE FROM public.profiles
  WHERE id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('profiles', row_count);

  DELETE FROM auth.users
  WHERE id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('auth_users', row_count);

  RETURN jsonb_build_object(
    'ok', true,
    'already_deleted', false,
    'user_id', target_user_id,
    'deleted_at', NOW(),
    'counts', deleted_counts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

COMMENT ON FUNCTION public.delete_user_account() IS
  'Product Contract §10: atomically deletes the caller''s profile, pets, moments, likes, invites, meetup relationships, owner-scoped Storage objects, and auth identity. Idempotent when fully complete. Frontend: supabase.rpc(''delete_user_account'').';
