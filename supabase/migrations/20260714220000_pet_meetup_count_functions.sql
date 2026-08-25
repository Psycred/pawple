-- Per-pet meetup count helpers for profile community signals.
-- Idempotent — safe to re-run alongside get_pet_meetup_counts.

CREATE OR REPLACE FUNCTION public.get_pet_hosted_count(target_pet_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT COUNT(*)::integer
    FROM public.meetup_hosts mh
    WHERE mh.pet_id = target_pet_id
  ), 0);
$$;

CREATE OR REPLACE FUNCTION public.get_pet_participated_count(target_pet_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT COUNT(*)::integer
    FROM public.meetup_participants mp
    WHERE mp.pet_id = target_pet_id
  ), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_pet_hosted_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pet_hosted_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_pet_participated_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pet_participated_count(uuid) TO anon;

COMMENT ON FUNCTION public.get_pet_hosted_count(uuid) IS
  'Count of meetups where pet_id appears in meetup_hosts.';
COMMENT ON FUNCTION public.get_pet_participated_count(uuid) IS
  'Count of meetups where pet_id appears in meetup_participants.';
