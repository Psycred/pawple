-- PAW-165: live auth.refresh_tokens.user_id is varchar, not uuid.
-- 140000 compared it to p_user_id uuid → SQLSTATE 42883
-- (operator does not exist: character varying = uuid), which is not
-- caught by the helper's undefined_table/undefined_column handler, so
-- the whole delete_user_account transaction rolled back after storage
-- and owned-row deletes.
--
-- Cast only when the live column is text-like. Keep uuid comparison
-- for environments where GoTrue uses uuid.

CREATE OR REPLACE FUNCTION public._delete_caller_auth_user(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  n integer := 0;
  refresh_user_id_type text;
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
      SELECT c.data_type
        INTO refresh_user_id_type
        FROM information_schema.columns c
       WHERE c.table_schema = 'auth'
         AND c.table_name = 'refresh_tokens'
         AND c.column_name = 'user_id';

      IF refresh_user_id_type IN ('character varying', 'text', 'character') THEN
        DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
      ELSE
        DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id;
      END IF;
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
    RAISE NOTICE 'PAW-165: could not reassign auth helper owner: %', SQLERRM;
END $$;

REVOKE ALL ON FUNCTION public._delete_caller_auth_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._delete_caller_auth_user(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._delete_caller_auth_user(uuid) TO postgres;

COMMENT ON FUNCTION public._delete_caller_auth_user(uuid) IS
  'Internal: delete caller auth tokens/sessions/identities/users. refresh_tokens.user_id cast matches live varchar or uuid. Not granted to authenticated/anon.';
