-- Moderation ops: read-only queue for team review (service_role only).

CREATE OR REPLACE VIEW public.moderation_open_reports AS
SELECT
  r.id,
  r.created_at,
  r.status,
  r.target_type,
  r.target_id,
  r.reason,
  r.details,
  r.reporter_user_id,
  r.reporter_pet_id,
  r.reported_user_id,
  reporter_pet.name AS reporter_pet_name,
  reported_profile.name AS reported_profile_name
FROM public.reports r
LEFT JOIN public.pets reporter_pet ON reporter_pet.id = r.reporter_pet_id
LEFT JOIN public.profiles reported_profile ON reported_profile.id = r.reported_user_id
WHERE r.status = 'open';

REVOKE ALL ON public.moderation_open_reports FROM PUBLIC;
REVOKE ALL ON public.moderation_open_reports FROM anon;
REVOKE ALL ON public.moderation_open_reports FROM authenticated;
GRANT SELECT ON public.moderation_open_reports TO service_role;

CREATE OR REPLACE FUNCTION public.list_open_reports(p_limit integer DEFAULT 50)
RETURNS SETOF public.moderation_open_reports
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.moderation_open_reports
  ORDER BY created_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

REVOKE ALL ON FUNCTION public.list_open_reports(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_open_reports(integer) FROM anon;
REVOKE ALL ON FUNCTION public.list_open_reports(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_reports(integer) TO service_role;

COMMENT ON VIEW public.moderation_open_reports IS
  'Team moderation queue (open reports). service_role only — not exposed to mobile clients.';

COMMENT ON FUNCTION public.list_open_reports(integer) IS
  'Returns open reports for internal review. Run from Supabase SQL editor or ops scripts with service_role.';
