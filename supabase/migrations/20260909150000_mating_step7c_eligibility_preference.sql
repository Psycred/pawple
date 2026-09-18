-- Step 7C — Mating eligibility: same pet type, breed preference, mutual-paw discovery exclusion.
-- Production-safe: additive column + CREATE OR REPLACE on mating RPCs/helpers.
-- Does not modify unrelated tables, Moment hearts, or scratch repair-wave-only objects.

-- =============================================================================
-- 1) Breed preference on pets (Same breed | All breeds)
-- =============================================================================

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS mating_breed_preference text;

ALTER TABLE public.pets
  DROP CONSTRAINT IF EXISTS pets_mating_breed_preference_check;

ALTER TABLE public.pets
  ADD CONSTRAINT pets_mating_breed_preference_check
  CHECK (
    mating_breed_preference IS NULL
    OR mating_breed_preference IN ('same_breed', 'all_breeds')
  );

COMMENT ON COLUMN public.pets.mating_breed_preference IS
  'Mating breed scope when opted in: same_breed (exact breed match) or all_breeds (any breed).';

-- =============================================================================
-- 2) Helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pets_same_pet_type(type_a text, type_b text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    nullif(lower(trim(coalesce(type_a, ''))), '') IS NOT NULL
    AND lower(trim(type_a)) = lower(trim(coalesce(type_b, '')));
$$;

COMMENT ON FUNCTION public.pets_same_pet_type(text, text) IS
  'Fundamental species/type gate for mating. Uses pets.pet_type only.';

CREATE OR REPLACE FUNCTION public.pets_are_opposite_sex(gender_a text, gender_b text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    lower(trim(coalesce(gender_a, ''))) IN ('male', 'female')
    AND lower(trim(coalesce(gender_b, ''))) IN ('male', 'female')
    AND lower(trim(gender_a)) <> lower(trim(gender_b));
$$;

COMMENT ON FUNCTION public.pets_are_opposite_sex(text, text) IS
  'Opposite-sex eligibility for Male/Female only. Other/unknown genders are not eligible.';

CREATE OR REPLACE FUNCTION public.pets_same_breed(breed_a text, breed_b text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    nullif(lower(trim(coalesce(breed_a, ''))), '') IS NOT NULL
    AND lower(trim(breed_a)) = lower(trim(coalesce(breed_b, '')));
$$;

-- =============================================================================
-- 3) Core eligibility — pet type, breed preference, opposite sex, location, blocks
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mating_eligible_pair(
  p_from_pet_id uuid,
  p_to_pet_id uuid,
  p_viewer_lat double precision,
  p_viewer_lng double precision,
  p_viewer_loc_fresh boolean,
  p_radius_km integer,
  OUT ok boolean,
  OUT distance_km double precision,
  OUT deny_reason text
)
RETURNS record
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from public.pets%ROWTYPE;
  v_to public.pets%ROWTYPE;
  v_to_lat double precision;
  v_to_lng double precision;
  v_to_fresh boolean;
  v_dist double precision;
  v_breed_pref text;
BEGIN
  ok := false;
  distance_km := NULL;
  deny_reason := NULL;

  SELECT * INTO v_from FROM public.pets WHERE id = p_from_pet_id;
  SELECT * INTO v_to FROM public.pets WHERE id = p_to_pet_id;

  IF v_from.id IS NULL OR v_to.id IS NULL THEN
    deny_reason := 'pet_not_found';
    RETURN;
  END IF;

  IF v_from.id = v_to.id THEN
    deny_reason := 'same_pet';
    RETURN;
  END IF;

  IF v_from.owner_id = v_to.owner_id THEN
    deny_reason := 'same_owner';
    RETURN;
  END IF;

  IF v_from.is_looking_for_companion IS NOT TRUE THEN
    deny_reason := 'viewer_not_opted_in';
    RETURN;
  END IF;

  IF v_to.is_looking_for_companion IS NOT TRUE THEN
    deny_reason := 'candidate_not_opted_in';
    RETURN;
  END IF;

  IF NOT public.pets_same_pet_type(v_from.pet_type, v_to.pet_type) THEN
    deny_reason := 'pet_type';
    RETURN;
  END IF;

  v_breed_pref := coalesce(v_from.mating_breed_preference, 'same_breed');
  IF v_breed_pref = 'same_breed'
     AND NOT public.pets_same_breed(v_from.breed, v_to.breed) THEN
    deny_reason := 'breed';
    RETURN;
  END IF;

  IF NOT public.pets_are_opposite_sex(v_from.gender, v_to.gender) THEN
    deny_reason := 'sex';
    RETURN;
  END IF;

  IF public.mating_pair_blocked_for_viewer(v_from.owner_id, v_to.id, v_to.owner_id) THEN
    deny_reason := 'blocked';
    RETURN;
  END IF;

  IF NOT p_viewer_loc_fresh OR p_viewer_lat IS NULL OR p_viewer_lng IS NULL THEN
    deny_reason := 'viewer_location_stale';
    RETURN;
  END IF;

  SELECT pr.last_location_lat, pr.last_location_lng,
         public.profile_location_is_fresh(pr.location_updated_at)
  INTO v_to_lat, v_to_lng, v_to_fresh
  FROM public.profiles pr
  WHERE pr.id = v_to.owner_id;

  IF NOT coalesce(v_to_fresh, false) OR v_to_lat IS NULL OR v_to_lng IS NULL THEN
    deny_reason := 'candidate_location_stale';
    RETURN;
  END IF;

  v_dist := public.haversine_km(p_viewer_lat, p_viewer_lng, v_to_lat, v_to_lng);
  IF v_dist IS NULL THEN
    deny_reason := 'distance_unavailable';
    RETURN;
  END IF;

  IF v_dist > p_radius_km THEN
    deny_reason := 'out_of_radius';
    RETURN;
  END IF;

  ok := true;
  distance_km := round(v_dist::numeric, 1)::double precision;
  deny_reason := NULL;
END;
$$;

COMMENT ON FUNCTION public.mating_eligible_pair(uuid, uuid, double precision, double precision, boolean, integer) IS
  'Authoritative mating pair eligibility: same pet_type, breed preference, opposite Male/Female, opt-in, blocks, fresh owner locations, radius.';

-- =============================================================================
-- 4) Discovery — fixed 100 km, closest first, exclude active mutual Paw pairs
-- =============================================================================

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
    AND NOT (
      EXISTS (
        SELECT 1 FROM public.paw_interests pi_ab
        WHERE pi_ab.from_pet_id = v_viewer.id AND pi_ab.to_pet_id = c.id
      )
      AND EXISTS (
        SELECT 1 FROM public.paw_interests pi_ba
        WHERE pi_ba.from_pet_id = c.id AND pi_ba.to_pet_id = v_viewer.id
      )
    )
  ORDER BY el.distance_km ASC NULLS LAST, c.created_at DESC NULLS LAST, c.id;
END;
$$;

COMMENT ON FUNCTION public.get_mating_opportunities(uuid) IS
  'Mating discovery: same pet_type, breed preference, opposite sex, opt-in, 100 km, closest first. Excludes active mutual-Paw pairs only.';

REVOKE ALL ON FUNCTION public.get_mating_opportunities(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mating_opportunities(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_mating_opportunities(uuid) TO authenticated;

-- =============================================================================
-- 5) Discovery context for honest empty states (safe to (re)deploy on production)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_mating_discovery_context(viewer_pet_id uuid)
RETURNS TABLE (
  opted_in boolean,
  location_fresh boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_viewer public.pets%ROWTYPE;
  v_fresh boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_viewer
  FROM public.pets p
  WHERE p.id = viewer_pet_id;

  IF v_viewer.id IS NULL OR v_viewer.owner_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden_pet'
      USING ERRCODE = '42501',
            HINT = 'You may only read discovery context for pets you own.';
  END IF;

  SELECT public.profile_location_is_fresh(pr.location_updated_at)
  INTO v_fresh
  FROM public.profiles pr
  WHERE pr.id = v_uid;

  opted_in := v_viewer.is_looking_for_companion IS TRUE;
  location_fresh := coalesce(v_fresh, false);
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.get_mating_discovery_context(uuid) IS
  'Owned-pet discovery context for empty states. Returns opted_in and location_fresh only.';

REVOKE ALL ON FUNCTION public.get_mating_discovery_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mating_discovery_context(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_mating_discovery_context(uuid) TO authenticated;
