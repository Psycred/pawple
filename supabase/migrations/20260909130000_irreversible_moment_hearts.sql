-- Pawple Step 3: Moment hearts are additive and irreversible.
-- One row per user/Moment remains enforced by likes_user_moment_unique.

DROP POLICY IF EXISTS likes_delete_own ON public.likes;
REVOKE DELETE ON TABLE public.likes FROM authenticated;
REVOKE DELETE ON TABLE public.likes FROM anon;

CREATE OR REPLACE FUNCTION public.get_moment_heart_states(p_moment_ids uuid[])
RETURNS TABLE (
  moment_id uuid,
  heart_count bigint,
  viewer_has_hearted boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    moment.id AS moment_id,
    count(like_row.id)::bigint AS heart_count,
    coalesce(bool_or(like_row.user_id = auth.uid()), false) AS viewer_has_hearted
  FROM public.moments moment
  LEFT JOIN public.likes like_row
    ON like_row.moment_id = moment.id
  WHERE moment.id = ANY(coalesce(p_moment_ids, ARRAY[]::uuid[]))
  GROUP BY moment.id;
$$;

REVOKE ALL ON FUNCTION public.get_moment_heart_states(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_moment_heart_states(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_moment_heart_states(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_moment_heart_states(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.heart_moment(p_moment_id uuid)
RETURNS TABLE (
  heart_count bigint,
  viewer_has_hearted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id uuid := auth.uid();
BEGIN
  IF viewer_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF p_moment_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.moments WHERE id = p_moment_id) THEN
    RAISE EXCEPTION 'moment_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.likes (user_id, moment_id)
  VALUES (viewer_id, p_moment_id)
  ON CONFLICT (user_id, moment_id) DO NOTHING;

  RETURN QUERY
  SELECT
    count(like_row.id)::bigint,
    bool_or(like_row.user_id = viewer_id)
  FROM public.likes like_row
  WHERE like_row.moment_id = p_moment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.heart_moment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.heart_moment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.heart_moment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heart_moment(uuid) TO service_role;

COMMENT ON FUNCTION public.get_moment_heart_states(uuid[]) IS
  'Aggregate Moment heart state without exposing which other accounts hearted a Moment.';

COMMENT ON FUNCTION public.heart_moment(uuid) IS
  'Idempotently adds the caller''s permanent Moment heart and returns aggregate state. There is no unlike path.';
