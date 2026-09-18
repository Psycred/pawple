-- PAW-207 / CTO PAW-203 §3.2–3.5 — Mating/Chat repair wave (new file only).
-- Recover/repair. Do not rebuild. Do not weaken RLS. Do not flip the production hide.
-- Opt-out stays freeze-and-hide: this migration does NOT DELETE channel or message rows.

-- =============================================================================
-- 1) pets_have_mutual_paw — fail-closed when auth.uid() is NULL
--    (blocks anon if EXECUTE GRANT drifts again). No participant predicate:
--    RLS and triggers call this helper; a caller-ownership check would break
--    freeze/reopen. Eligibility math is unchanged.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pets_have_mutual_paw(pet_x uuid, pet_y uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND pet_x IS NOT NULL
    AND pet_y IS NOT NULL
    AND pet_x <> pet_y
    AND EXISTS (
      SELECT 1 FROM public.paw_interests
      WHERE from_pet_id = pet_x AND to_pet_id = pet_y
    )
    AND EXISTS (
      SELECT 1 FROM public.paw_interests
      WHERE from_pet_id = pet_y AND to_pet_id = pet_x
    );
$$;

COMMENT ON FUNCTION public.pets_have_mutual_paw(uuid, uuid) IS
  'Derived mutuality predicate. Returns false when auth.uid() is NULL (anon fail-closed). Not a match product object.';

REVOKE ALL ON FUNCTION public.pets_have_mutual_paw(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pets_have_mutual_paw(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pets_have_mutual_paw(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pets_have_mutual_paw(uuid, uuid) TO service_role;

-- =============================================================================
-- 2) Internal helpers — no client GRANT (live anon EXECUTE had drifted)
-- =============================================================================

REVOKE ALL ON FUNCTION public.mating_eligible_pair(uuid, uuid, double precision, double precision, boolean, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mating_eligible_pair(uuid, uuid, double precision, double precision, boolean, integer)
  FROM anon;
REVOKE ALL ON FUNCTION public.mating_eligible_pair(uuid, uuid, double precision, double precision, boolean, integer)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mating_eligible_pair(uuid, uuid, double precision, double precision, boolean, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.assert_mating_age_ok(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_mating_age_ok(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.assert_mating_age_ok(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assert_mating_age_ok(uuid) TO service_role;

-- =============================================================================
-- 3) Discovery — keep fixed 100 km; exclude open mutual-Paw pairs
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

  -- Honest scarcity: stale/missing location returns empty, never fabricated rows.
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
    -- Open mutual-Paw introduction already exists; pair lives in Chat, not Discover.
    AND NOT public.pets_have_mutual_paw(v_viewer.id, c.id)
  ORDER BY el.distance_km ASC NULLS LAST, c.created_at DESC NULLS LAST, c.id;
END;
$$;

COMMENT ON FUNCTION public.get_mating_opportunities(uuid) IS
  'Server-authoritative mating discovery. Breed, opposite sex, opt-in, fixed 100 km. Excludes open mutual-Paw pairs. Approximate distance_km only — never raw coordinates.';

REVOKE ALL ON FUNCTION public.get_mating_opportunities(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mating_opportunities(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_mating_opportunities(uuid) TO authenticated;

-- =============================================================================
-- 4) Discovery context — honest empty states (no coordinates)
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
  'Owned-pet discovery context for honest empty states. Returns opted_in and location_fresh only. Never returns coordinates.';

REVOKE ALL ON FUNCTION public.get_mating_discovery_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mating_discovery_context(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_mating_discovery_context(uuid) TO authenticated;

-- =============================================================================
-- 5) Parent-level open introduction list (Chat page). Client never INSERTs channels.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_my_introduction_channels()
RETURNS TABLE (
  channel_id uuid,
  pet_low_id uuid,
  pet_high_id uuid,
  pet_low_name text,
  pet_high_name text,
  pet_low_photo_url text,
  pet_high_photo_url text,
  opened_at timestamptz,
  distance_km double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.pet_low_id,
    c.pet_high_id,
    pl.name,
    ph.name,
    pl.photo_url,
    ph.photo_url,
    c.opened_at,
    -- Approximate ~km only. NULL when either owner location is missing/invalid.
    round(
      public.haversine_km(
        low_pr.last_location_lat,
        low_pr.last_location_lng,
        high_pr.last_location_lat,
        high_pr.last_location_lng
      )::numeric,
      1
    )::double precision
  FROM public.mating_introduction_channels c
  INNER JOIN public.pets pl ON pl.id = c.pet_low_id
  INNER JOIN public.pets ph ON ph.id = c.pet_high_id
  INNER JOIN public.profiles low_pr ON low_pr.id = c.owner_low_id
  INNER JOIN public.profiles high_pr ON high_pr.id = c.owner_high_id
  WHERE c.status = 'open'
    AND v_uid IN (c.owner_low_id, c.owner_high_id)
  ORDER BY c.opened_at DESC NULLS LAST, c.id;
END;
$$;

COMMENT ON FUNCTION public.list_my_introduction_channels() IS
  'Open pet-pair introduction channels for the signed-in parent. Pet names + approximate distance_km only. No human names, message bodies, unread counts, or coordinates.';

REVOKE ALL ON FUNCTION public.list_my_introduction_channels() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_introduction_channels() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_introduction_channels() TO authenticated;
