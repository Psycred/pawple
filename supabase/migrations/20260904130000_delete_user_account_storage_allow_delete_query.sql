-- PAW-144 follow-up: hosted Storage rejects SQL DELETE unless this GUC is set.
-- Live proof after Founder applied 20260904120000: authenticated
-- delete_user_account returned HTTP 403 / SQLSTATE 42501
--   "Direct deletion from storage tables is not allowed. Use the Storage API instead."
-- The protect_objects_delete trigger fires FOR EACH STATEMENT, including 0-row
-- deletes, so self-delete aborted for everyone and rolled back auth/profile/pets.
--
-- Storage API sets storage.allow_delete_query=true internally (supabase/storage#817).
-- Transaction-local set_config matches that, then prefix-delete proceeds.
-- Catalog remnant check in delete_user_account remains; failed delete still rolls back.

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

  -- Required on current hosted Storage. Statement-level protect_delete()
  -- rejects DELETE unless this GUC is true (transaction-local).
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

COMMENT ON FUNCTION public._delete_caller_storage_objects(uuid) IS
  'Internal: prefix-delete caller storage objects. Sets storage.allow_delete_query for hosted protect_delete trigger. Not granted to authenticated/anon.';
