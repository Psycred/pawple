-- Bilateral mutual UnPaw: clear both Paw directions and tear down open channel only.

CREATE OR REPLACE FUNCTION public.unpaw_mutual_introduction(
  p_viewer_pet_id uuid,
  p_other_pet_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_viewer_pet_id IS NULL
     OR p_other_pet_id IS NULL
     OR p_viewer_pet_id = p_other_pet_id THEN
    RAISE EXCEPTION 'invalid_pet_pair' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pets p
    WHERE p.id = p_viewer_pet_id
      AND p.owner_id = v_uid
  ) THEN
    RAISE EXCEPTION 'forbidden_pet' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pets p
    WHERE p.id = p_other_pet_id
  ) THEN
    RAISE EXCEPTION 'pet_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.pets_have_mutual_paw(p_viewer_pet_id, p_other_pet_id) THEN
    RAISE EXCEPTION 'not_mutual_paw' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.mating_clear_paw_between_pets(p_viewer_pet_id, p_other_pet_id);
  PERFORM public.mating_teardown_open_channel_for_pair(p_viewer_pet_id, p_other_pet_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.unpaw_mutual_introduction(uuid, uuid) IS
  'Bilateral mutual UnPaw: clear both Paw directions and remove the open introduction channel only.';

REVOKE ALL ON FUNCTION public.unpaw_mutual_introduction(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unpaw_mutual_introduction(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.unpaw_mutual_introduction(uuid, uuid) TO authenticated;
