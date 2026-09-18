-- Chat report termination privacy: deny reported-party direct channel reads and
-- strip identifying fields from ended_anonymous list rows.

-- =============================================================================
-- 1) Channel SELECT — reported party cannot read report-frozen channel rows
-- =============================================================================

DROP POLICY IF EXISTS mating_introduction_channels_select_participants
  ON public.mating_introduction_channels;

CREATE POLICY mating_introduction_channels_select_participants
  ON public.mating_introduction_channels
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (owner_low_id, owner_high_id)
    AND NOT (
      status = 'frozen'
      AND freeze_reason = 'report'
      AND reported_by_user_id IS NOT NULL
      AND auth.uid() <> reported_by_user_id
    )
  );

COMMENT ON POLICY mating_introduction_channels_select_participants
  ON public.mating_introduction_channels IS
  'Participants may read open channels and report-frozen channels only when they are the reporter. Reported parties use get_introduction_chat_view().';

-- =============================================================================
-- 2) Chat list — ended_anonymous rows expose viewer pet only (for tab filtering)
-- =============================================================================

DROP FUNCTION IF EXISTS public.list_my_introduction_channels();

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
  distance_km double precision,
  last_message_body text,
  last_message_at timestamptz,
  list_kind text
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
    round(
      public.haversine_km(
        low_pr.last_location_lat,
        low_pr.last_location_lng,
        high_pr.last_location_lat,
        high_pr.last_location_lng
      )::numeric,
      1
    )::double precision,
    latest.body,
    latest.created_at,
    'active'::text
  FROM public.mating_introduction_channels c
  INNER JOIN public.pets pl ON pl.id = c.pet_low_id
  INNER JOIN public.pets ph ON ph.id = c.pet_high_id
  INNER JOIN public.profiles low_pr ON low_pr.id = c.owner_low_id
  INNER JOIN public.profiles high_pr ON high_pr.id = c.owner_high_id
  LEFT JOIN LATERAL (
    SELECT m.body, m.created_at
    FROM public.mating_introduction_messages m
    WHERE m.channel_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) latest ON true
  WHERE c.status = 'open'
    AND v_uid IN (c.owner_low_id, c.owner_high_id)
    AND NOT public.pet_is_blocked_for_viewer(
      CASE WHEN v_uid = c.owner_low_id THEN c.pet_high_id ELSE c.pet_low_id END
    )

  UNION ALL

  SELECT
    c.id,
    CASE WHEN v_uid = c.owner_low_id THEN c.pet_low_id ELSE c.pet_high_id END,
    NULL::uuid,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    c.opened_at,
    NULL::double precision,
    'This conversation is no longer available.'::text,
    c.frozen_at,
    'ended_anonymous'::text
  FROM public.mating_introduction_channels c
  WHERE c.status = 'frozen'
    AND c.freeze_reason = 'report'
    AND c.reported_by_user_id IS NOT NULL
    AND v_uid IN (c.owner_low_id, c.owner_high_id)
    AND v_uid <> c.reported_by_user_id
    AND c.reported_party_acknowledged_at IS NULL
    AND NOT public.pet_is_blocked_for_viewer(
      CASE WHEN v_uid = c.owner_low_id THEN c.pet_high_id ELSE c.pet_low_id END
    )

  ORDER BY 10 DESC NULLS LAST, 1;
END;
$$;

COMMENT ON FUNCTION public.list_my_introduction_channels() IS
  'Open introduction channels plus one-time anonymous ended rows for reported parties. Ended rows never expose the other pet identity.';

REVOKE ALL ON FUNCTION public.list_my_introduction_channels() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_introduction_channels() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_introduction_channels() TO authenticated;
