-- PAW-73: Phase 1 automatic 100 km mating discovery window.
-- Removes user-selectable radius from RPC eligibility; column retained for future phases.

ALTER TABLE public.profiles
  ALTER COLUMN mating_discovery_radius_km SET DEFAULT 100;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_mating_discovery_radius_km_check;

UPDATE public.profiles
SET mating_discovery_radius_km = 100
WHERE mating_discovery_radius_km IS DISTINCT FROM 100;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_mating_discovery_radius_km_check
  CHECK (mating_discovery_radius_km = 100);

COMMENT ON COLUMN public.profiles.mating_discovery_radius_km IS
  'Phase 1: fixed at 100 km for mating eligibility RPCs. No user-facing radius UI.';

CREATE OR REPLACE FUNCTION public.get_mating_opportunities(viewer_pet_id uuid)
RETURNS TABLE (
  pet_id uuid,
  name text,
  breed text,
  gender text,
  age text,
  photo_url text,
  bio text,
  mating_description text,
  traits jsonb,
  is_looking_for_companion boolean,
  distance_km double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_viewer public.pets%ROWTYPE;
  v_lat double precision;
  v_lng double precision;
  v_fresh boolean;
  v_radius constant integer := 100;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM public.assert_mating_age_ok(v_uid);

  SELECT * INTO v_viewer
  FROM public.pets p
  WHERE p.id = viewer_pet_id;

  IF v_viewer.id IS NULL OR v_viewer.owner_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden_pet'
      USING ERRCODE = '42501',
            HINT = 'You may only explore mating for pets you own.';
  END IF;

  IF v_viewer.is_looking_for_companion IS NOT TRUE THEN
    RETURN;
  END IF;

  SELECT
    pr.last_location_lat,
    pr.last_location_lng,
    public.profile_location_is_fresh(pr.location_updated_at)
  INTO v_lat, v_lng, v_fresh
  FROM public.profiles pr
  WHERE pr.id = v_uid;

  IF NOT coalesce(v_fresh, false) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.breed,
    c.gender,
    c.age,
    c.photo_url,
    c.bio,
    c.mating_description,
    c.traits,
    c.is_looking_for_companion,
    el.distance_km
  FROM public.pets c
  CROSS JOIN LATERAL public.mating_eligible_pair(
    v_viewer.id, c.id, v_lat, v_lng, v_fresh, v_radius
  ) el
  WHERE c.id <> v_viewer.id
    AND el.ok IS TRUE
  ORDER BY el.distance_km ASC NULLS LAST, c.created_at DESC NULLS LAST, c.id;
END;
$$;

COMMENT ON FUNCTION public.get_mating_opportunities(uuid) IS
  'Server-authoritative mating discovery for an owned opted-in pet. Phase 1: breed, opposite sex, opt-in, fixed 100 km radius, closest-first.';

CREATE OR REPLACE FUNCTION public.express_paw(from_pet_id uuid, to_pet_id uuid)
RETURNS public.paw_interests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from public.pets%ROWTYPE;
  v_to public.pets%ROWTYPE;
  v_lat double precision;
  v_lng double precision;
  v_fresh boolean;
  v_radius constant integer := 100;
  v_el record;
  v_recent integer;
  v_row public.paw_interests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM public.assert_mating_age_ok(v_uid);

  SELECT * INTO v_from FROM public.pets WHERE id = from_pet_id;
  SELECT * INTO v_to FROM public.pets WHERE id = to_pet_id;

  IF v_from.id IS NULL OR v_from.owner_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden_pet' USING ERRCODE = '42501';
  END IF;

  IF v_to.id IS NULL THEN
    RAISE EXCEPTION 'pet_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Harassment mitigation: soft rate limit (transparent Paw retained).
  SELECT count(*)::integer INTO v_recent
  FROM public.paw_interests pi
  WHERE pi.from_owner_id = v_uid
    AND pi.created_at > timezone('utc', now()) - interval '1 hour';

  IF v_recent >= 40 THEN
    RAISE EXCEPTION 'paw_rate_limited'
      USING ERRCODE = 'P0001',
            HINT = 'Take a pause before expressing more interest.';
  END IF;

  SELECT
    pr.last_location_lat,
    pr.last_location_lng,
    public.profile_location_is_fresh(pr.location_updated_at)
  INTO v_lat, v_lng, v_fresh
  FROM public.profiles pr
  WHERE pr.id = v_uid;

  SELECT * INTO v_el
  FROM public.mating_eligible_pair(
    from_pet_id, to_pet_id, v_lat, v_lng, coalesce(v_fresh, false), v_radius
  );

  IF v_el.ok IS NOT TRUE THEN
    RAISE EXCEPTION 'not_eligible'
      USING ERRCODE = 'P0001',
            HINT = coalesce(v_el.deny_reason, 'not_eligible');
  END IF;

  INSERT INTO public.paw_interests (from_pet_id, to_pet_id, from_owner_id, to_owner_id)
  VALUES (from_pet_id, to_pet_id, v_uid, v_to.owner_id)
  ON CONFLICT (from_pet_id, to_pet_id) DO UPDATE
  SET
    from_owner_id = EXCLUDED.from_owner_id,
    to_owner_id = EXCLUDED.to_owner_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.express_paw(uuid, uuid) IS
  'Idempotent Paw write with eligibility + same-owner + block + rate-limit checks. Phase 1: fixed 100 km radius.';
