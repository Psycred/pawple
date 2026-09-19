-- Canonical owner-gated pet deletion entry point.
-- Replaces direct client DELETE on public.pets; FK cascades and triggers unchanged.

CREATE OR REPLACE FUNCTION public.delete_pet(p_pet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pets p
    WHERE p.id = p_pet_id
      AND p.owner_id = v_uid
  ) THEN
    RAISE EXCEPTION 'forbidden_pet' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.pets
  WHERE id = p_pet_id
    AND owner_id = v_uid;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'pet_id', p_pet_id,
    'deleted', v_deleted
  );
END;
$$;

COMMENT ON FUNCTION public.delete_pet(uuid) IS
  'Owner-only hard delete of one pet row. Related data is removed via existing FK cascades and triggers; storage and moments are not purged here.';

REVOKE ALL ON FUNCTION public.delete_pet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_pet(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_pet(uuid) TO authenticated;
