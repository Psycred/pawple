-- Step 10 — user-facing Delete Chat: bilateral Paw clear + open-channel teardown only.

CREATE OR REPLACE FUNCTION public.delete_open_introduction_chat(
  p_channel_id uuid,
  p_viewer_pet_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  c public.mating_introduction_channels%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO c
  FROM public.mating_introduction_channels
  WHERE id = p_channel_id;

  IF c.id IS NULL THEN
    RAISE EXCEPTION 'channel_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_uid NOT IN (c.owner_low_id, c.owner_high_id) THEN
    RAISE EXCEPTION 'forbidden_channel' USING ERRCODE = '42501';
  END IF;

  IF p_viewer_pet_id NOT IN (c.pet_low_id, c.pet_high_id) THEN
    RAISE EXCEPTION 'forbidden_pet' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pets p
    WHERE p.id = p_viewer_pet_id
      AND p.owner_id = v_uid
  ) THEN
    RAISE EXCEPTION 'forbidden_pet' USING ERRCODE = '42501';
  END IF;

  IF c.status <> 'open' THEN
    RAISE EXCEPTION 'channel_not_open' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.mating_clear_paw_between_pets(c.pet_low_id, c.pet_high_id);
  PERFORM public.mating_teardown_open_channel_for_pair(c.pet_low_id, c.pet_high_id);

  RETURN jsonb_build_object('ok', true, 'channel_id', c.id);
END;
$$;

COMMENT ON FUNCTION public.delete_open_introduction_chat(uuid, uuid) IS
  'User-initiated delete of an open introduction chat: clear mutual Paw both ways and remove the open channel only.';

REVOKE ALL ON FUNCTION public.delete_open_introduction_chat(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_open_introduction_chat(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_open_introduction_chat(uuid, uuid) TO authenticated;
