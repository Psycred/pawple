-- Recipient quietly dismisses one inbound Paw (Not for me).
-- Deletes only the sender→recipient paw_interests row. No notification trigger on DELETE.

CREATE OR REPLACE FUNCTION public.dismiss_incoming_paw(
  recipient_pet_id uuid,
  sender_pet_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_recipient public.pets%ROWTYPE;
  v_deleted integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF dismiss_incoming_paw.recipient_pet_id IS NULL
     OR dismiss_incoming_paw.sender_pet_id IS NULL
     OR dismiss_incoming_paw.recipient_pet_id = dismiss_incoming_paw.sender_pet_id THEN
    RETURN jsonb_build_object('ok', true, 'deleted', 0);
  END IF;

  SELECT * INTO v_recipient
  FROM public.pets
  WHERE id = dismiss_incoming_paw.recipient_pet_id;

  IF v_recipient.id IS NULL OR v_recipient.owner_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden_pet' USING ERRCODE = '42501';
  END IF;

  IF public.pets_have_mutual_paw(
    dismiss_incoming_paw.recipient_pet_id,
    dismiss_incoming_paw.sender_pet_id
  ) THEN
    RAISE EXCEPTION 'mutual_paw_active'
      USING ERRCODE = 'P0001',
            HINT = 'Connected introductions use unpaw, not Not for me.';
  END IF;

  DELETE FROM public.paw_interests pi
  WHERE pi.from_pet_id = dismiss_incoming_paw.sender_pet_id
    AND pi.to_pet_id = dismiss_incoming_paw.recipient_pet_id
    AND pi.to_owner_id = v_uid;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
END;
$$;

COMMENT ON FUNCTION public.dismiss_incoming_paw(uuid, uuid) IS
  'Recipient dismisses one inbound Paw quietly. Deletes sender→recipient row only. Idempotent. No notification.';

REVOKE ALL ON FUNCTION public.dismiss_incoming_paw(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dismiss_incoming_paw(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.dismiss_incoming_paw(uuid, uuid) TO authenticated;
