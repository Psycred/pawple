-- PAW-216 — Fix express_paw Postgres 42702 (ambiguous from_pet_id / to_pet_id).
-- Root cause: function parameters share names with paw_interests columns; unqualified
-- ON CONFLICT (from_pet_id, to_pet_id) and VALUES references collide in plpgsql.
-- Pattern matches withdraw_paw (function-qualified params). Conflict target uses the
-- unique constraint name so columns are unambiguous.
-- Scratch-first. Do not apply to live without CTO authorization.
-- Does not flip EXPOSE_MATING_SURFACES. Eligibility / rate-limit behaviour unchanged.

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

  SELECT * INTO v_from FROM public.pets WHERE id = express_paw.from_pet_id;
  SELECT * INTO v_to FROM public.pets WHERE id = express_paw.to_pet_id;

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
    express_paw.from_pet_id,
    express_paw.to_pet_id,
    v_lat,
    v_lng,
    coalesce(v_fresh, false),
    v_radius
  );

  IF v_el.ok IS NOT TRUE THEN
    RAISE EXCEPTION 'not_eligible'
      USING ERRCODE = 'P0001',
            HINT = coalesce(v_el.deny_reason, 'not_eligible');
  END IF;

  INSERT INTO public.paw_interests (from_pet_id, to_pet_id, from_owner_id, to_owner_id)
  VALUES (express_paw.from_pet_id, express_paw.to_pet_id, v_uid, v_to.owner_id)
  ON CONFLICT ON CONSTRAINT paw_interests_pair_unique DO UPDATE
  SET
    from_owner_id = EXCLUDED.from_owner_id,
    to_owner_id = EXCLUDED.to_owner_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.express_paw(uuid, uuid) IS
  'Idempotent Paw write with eligibility + same-owner + block + rate-limit checks. Phase 1: fixed 100 km radius. Params function-qualified to avoid 42702 ambiguity with paw_interests columns.';

REVOKE ALL ON FUNCTION public.express_paw(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.express_paw(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.express_paw(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.express_paw(uuid, uuid) TO service_role;
