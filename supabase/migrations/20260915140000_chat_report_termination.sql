-- Chat report termination: freeze channel + retain messages for moderation,
-- asymmetric reporter/reported UX, preserve evidence on re-mutual Paw.

-- =============================================================================
-- 1) Channel metadata for report teardown
-- =============================================================================

ALTER TABLE public.mating_introduction_channels
  ADD COLUMN IF NOT EXISTS reported_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reporter_chat_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reported_party_acknowledged_at timestamptz;

ALTER TABLE public.mating_introduction_channels
  DROP CONSTRAINT IF EXISTS mating_introduction_channels_freeze_reason_check;

ALTER TABLE public.mating_introduction_channels
  ADD CONSTRAINT mating_introduction_channels_freeze_reason_check
  CHECK (
    freeze_reason IS NULL
    OR freeze_reason IN ('mutual_broken', 'block', 'opt_out', 'admin', 'report')
  );

-- Allow a new open channel after a report-frozen channel for the same pet pair.
ALTER TABLE public.mating_introduction_channels
  DROP CONSTRAINT IF EXISTS mating_introduction_channels_pair_unique;

DROP INDEX IF EXISTS public.mating_introduction_channels_open_pair_unique;

CREATE UNIQUE INDEX mating_introduction_channels_open_pair_unique
  ON public.mating_introduction_channels (pet_low_id, pet_high_id)
  WHERE status = 'open';

-- =============================================================================
-- 2) Teardown helpers — open-only vs full pair delete
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mating_teardown_open_channel_for_pair(p_pet_a uuid, p_pet_b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_low uuid;
  v_high uuid;
BEGIN
  IF p_pet_a IS NULL OR p_pet_b IS NULL OR p_pet_a = p_pet_b THEN
    RETURN;
  END IF;

  IF p_pet_a < p_pet_b THEN
    v_low := p_pet_a;
    v_high := p_pet_b;
  ELSE
    v_low := p_pet_b;
    v_high := p_pet_a;
  END IF;

  DELETE FROM public.mating_introduction_channels
  WHERE pet_low_id = v_low
    AND pet_high_id = v_high
    AND status = 'open';
END;
$$;

COMMENT ON FUNCTION public.mating_teardown_open_channel_for_pair(uuid, uuid) IS
  'Removes only open introduction channels for a pet pair. Preserves report-frozen evidence rows.';

CREATE OR REPLACE FUNCTION public.mating_teardown_channel_for_pair(p_pet_a uuid, p_pet_b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_low uuid;
  v_high uuid;
BEGIN
  IF p_pet_a IS NULL OR p_pet_b IS NULL OR p_pet_a = p_pet_b THEN
    RETURN;
  END IF;

  IF p_pet_a < p_pet_b THEN
    v_low := p_pet_a;
    v_high := p_pet_b;
  ELSE
    v_low := p_pet_b;
    v_high := p_pet_a;
  END IF;

  DELETE FROM public.mating_introduction_channels
  WHERE pet_low_id = v_low
    AND pet_high_id = v_high;
END;
$$;

REVOKE ALL ON FUNCTION public.mating_teardown_open_channel_for_pair(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mating_teardown_open_channel_for_pair(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.mating_teardown_open_channel_for_pair(uuid, uuid) FROM authenticated;

-- =============================================================================
-- 3) Unpaw + mutual Paw — delete open channels only
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mating_freeze_channel_after_paw_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pets_have_mutual_paw(OLD.from_pet_id, OLD.to_pet_id) THEN
    PERFORM public.mating_teardown_open_channel_for_pair(OLD.from_pet_id, OLD.to_pet_id);
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.mating_sync_channel_after_paw_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_low uuid;
  v_high uuid;
  v_owner_low uuid;
  v_owner_high uuid;
  v_from_owner uuid;
  v_to_owner uuid;
BEGIN
  IF NOT public.pets_have_mutual_paw(NEW.from_pet_id, NEW.to_pet_id) THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO v_from_owner FROM public.pets WHERE id = NEW.from_pet_id;
  SELECT owner_id INTO v_to_owner FROM public.pets WHERE id = NEW.to_pet_id;

  IF v_from_owner IS NULL OR v_to_owner IS NULL OR v_from_owner = v_to_owner THEN
    RETURN NEW;
  END IF;

  IF NEW.from_pet_id < NEW.to_pet_id THEN
    v_low := NEW.from_pet_id;
    v_high := NEW.to_pet_id;
    v_owner_low := v_from_owner;
    v_owner_high := v_to_owner;
  ELSE
    v_low := NEW.to_pet_id;
    v_high := NEW.from_pet_id;
    v_owner_low := v_to_owner;
    v_owner_high := v_from_owner;
  END IF;

  IF public.mating_pair_blocked_for_viewer(v_from_owner, NEW.to_pet_id, v_to_owner)
     OR public.mating_pair_blocked_for_viewer(v_to_owner, NEW.from_pet_id, v_from_owner) THEN
    RETURN NEW;
  END IF;

  PERFORM public.mating_teardown_open_channel_for_pair(NEW.from_pet_id, NEW.to_pet_id);

  INSERT INTO public.mating_introduction_channels (
    pet_low_id, pet_high_id, owner_low_id, owner_high_id,
    status, opened_at, frozen_at, freeze_reason
  )
  VALUES (
    v_low, v_high, v_owner_low, v_owner_high,
    'open', timezone('utc', now()), NULL, NULL
  );

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 4) Message visibility — reported party never reads messages on report-frozen chats
-- =============================================================================

DROP POLICY IF EXISTS mating_introduction_messages_select_participants
  ON public.mating_introduction_messages;

CREATE POLICY mating_introduction_messages_select_participants
  ON public.mating_introduction_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.mating_introduction_channels c
      WHERE c.id = channel_id
        AND auth.uid() IN (c.owner_low_id, c.owner_high_id)
        AND NOT (
          c.status = 'frozen'
          AND c.freeze_reason = 'report'
          AND c.reported_by_user_id IS NOT NULL
          AND auth.uid() <> c.reported_by_user_id
        )
    )
  );

-- =============================================================================
-- 5) Terminate chat after report (requires a recent matching report row)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.terminate_introduction_chat_after_report(
  p_channel_id uuid,
  p_reporter_pet_id uuid
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
    RAISE EXCEPTION 'channel_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_uid NOT IN (c.owner_low_id, c.owner_high_id) THEN
    RAISE EXCEPTION 'forbidden_channel' USING ERRCODE = '42501';
  END IF;

  IF c.status <> 'open' THEN
    RAISE EXCEPTION 'channel_not_open' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pets p
    WHERE p.id = p_reporter_pet_id
      AND p.owner_id = v_uid
  ) THEN
    RAISE EXCEPTION 'forbidden_pet' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.reporter_user_id = v_uid
      AND r.target_type = 'introduction_chat'
      AND r.target_id = p_channel_id
      AND r.created_at > timezone('utc', now()) - interval '15 minutes'
  ) THEN
    RAISE EXCEPTION 'report_required' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.mating_clear_paw_between_pets(c.pet_low_id, c.pet_high_id);

  UPDATE public.mating_introduction_channels
  SET
    status = 'frozen',
    freeze_reason = 'report',
    frozen_at = timezone('utc', now()),
    reported_by_user_id = v_uid,
    reporter_chat_dismissed_at = NULL,
    reported_party_acknowledged_at = NULL
  WHERE id = c.id;

  RETURN jsonb_build_object('ok', true, 'channel_id', c.id);
END;
$$;

COMMENT ON FUNCTION public.terminate_introduction_chat_after_report(uuid, uuid) IS
  'After a filed introduction_chat report: clear mutual Paw and freeze channel with message evidence retained.';

REVOKE ALL ON FUNCTION public.terminate_introduction_chat_after_report(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.terminate_introduction_chat_after_report(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.terminate_introduction_chat_after_report(uuid, uuid) TO authenticated;

-- =============================================================================
-- 6) Dismiss one-time post-report chat surfaces
-- =============================================================================

CREATE OR REPLACE FUNCTION public.dismiss_reported_introduction_chat(p_channel_id uuid)
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

  IF c.id IS NULL OR v_uid NOT IN (c.owner_low_id, c.owner_high_id) THEN
    RAISE EXCEPTION 'forbidden_channel' USING ERRCODE = '42501';
  END IF;

  IF c.status <> 'frozen' OR c.freeze_reason <> 'report' OR c.reported_by_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'ignored', true);
  END IF;

  IF v_uid = c.reported_by_user_id THEN
    UPDATE public.mating_introduction_channels
    SET reporter_chat_dismissed_at = timezone('utc', now())
    WHERE id = c.id
      AND reporter_chat_dismissed_at IS NULL;
  ELSE
    UPDATE public.mating_introduction_channels
    SET reported_party_acknowledged_at = timezone('utc', now())
    WHERE id = c.id
      AND reported_party_acknowledged_at IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true, 'channel_id', c.id);
END;
$$;

COMMENT ON FUNCTION public.dismiss_reported_introduction_chat(uuid) IS
  'Reporter: hide post-report thread from Chat after exit. Reported party: consume one-time anonymous ended state.';

REVOKE ALL ON FUNCTION public.dismiss_reported_introduction_chat(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dismiss_reported_introduction_chat(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.dismiss_reported_introduction_chat(uuid) TO authenticated;

-- =============================================================================
-- 7) Sanitized chat view for clients (no stale identity for reported party)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_introduction_chat_view(p_channel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  c public.mating_introduction_channels%ROWTYPE;
  v_viewer_pet_id uuid;
  v_other_pet_id uuid;
  v_other_pet_name text;
  v_other_pet_photo_url text;
  v_other_owner_id uuid;
  v_messages jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO c
  FROM public.mating_introduction_channels
  WHERE id = p_channel_id;

  IF c.id IS NULL OR v_uid NOT IN (c.owner_low_id, c.owner_high_id) THEN
    RETURN jsonb_build_object('view', 'unavailable');
  END IF;

  IF c.status = 'frozen' AND c.freeze_reason = 'report' AND c.reported_by_user_id IS NOT NULL THEN
    IF v_uid = c.reported_by_user_id THEN
      IF c.reporter_chat_dismissed_at IS NOT NULL THEN
        RETURN jsonb_build_object('view', 'unavailable');
      END IF;

      IF v_uid = c.owner_low_id THEN
        v_viewer_pet_id := c.pet_low_id;
        v_other_pet_id := c.pet_high_id;
        v_other_owner_id := c.owner_high_id;
      ELSE
        v_viewer_pet_id := c.pet_high_id;
        v_other_pet_id := c.pet_low_id;
        v_other_owner_id := c.owner_low_id;
      END IF;

      SELECT p.name, p.photo_url
      INTO v_other_pet_name, v_other_pet_photo_url
      FROM public.pets p
      WHERE p.id = v_other_pet_id;

      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'channel_id', m.channel_id,
          'sender_user_id', m.sender_user_id,
          'body', m.body,
          'created_at', m.created_at
        )
        ORDER BY m.created_at ASC
      ), '[]'::jsonb)
      INTO v_messages
      FROM public.mating_introduction_messages m
      WHERE m.channel_id = c.id;

      RETURN jsonb_build_object(
        'view', 'reporter_frozen',
        'channel_id', c.id,
        'status', c.status,
        'viewer_pet_id', v_viewer_pet_id,
        'other_pet_id', v_other_pet_id,
        'other_pet_name', coalesce(v_other_pet_name, 'Pet'),
        'other_pet_photo_url', v_other_pet_photo_url,
        'other_owner_id', v_other_owner_id,
        'messages', v_messages
      );
    END IF;

    IF c.reported_party_acknowledged_at IS NOT NULL THEN
      RETURN jsonb_build_object('view', 'unavailable');
    END IF;

    RETURN jsonb_build_object(
      'view', 'ended_anonymous',
      'channel_id', c.id,
      'status', c.status
    );
  END IF;

  IF c.status <> 'open' THEN
    RETURN jsonb_build_object('view', 'unavailable');
  END IF;

  IF v_uid = c.owner_low_id THEN
    v_viewer_pet_id := c.pet_low_id;
    v_other_pet_id := c.pet_high_id;
    v_other_owner_id := c.owner_high_id;
  ELSE
    v_viewer_pet_id := c.pet_high_id;
    v_other_pet_id := c.pet_low_id;
    v_other_owner_id := c.owner_low_id;
  END IF;

  SELECT p.name, p.photo_url
  INTO v_other_pet_name, v_other_pet_photo_url
  FROM public.pets p
  WHERE p.id = v_other_pet_id;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'channel_id', m.channel_id,
      'sender_user_id', m.sender_user_id,
      'body', m.body,
      'created_at', m.created_at
    )
    ORDER BY m.created_at ASC
  ), '[]'::jsonb)
  INTO v_messages
  FROM public.mating_introduction_messages m
  WHERE m.channel_id = c.id;

  RETURN jsonb_build_object(
    'view', 'open',
    'channel_id', c.id,
    'status', c.status,
    'viewer_pet_id', v_viewer_pet_id,
    'other_pet_id', v_other_pet_id,
    'other_pet_name', coalesce(v_other_pet_name, 'Pet'),
    'other_pet_photo_url', v_other_pet_photo_url,
    'other_owner_id', v_other_owner_id,
    'messages', v_messages
  );
END;
$$;

COMMENT ON FUNCTION public.get_introduction_chat_view(uuid) IS
  'Participant chat payload with report-frozen asymmetry: reporter retains read-only context; reported party sees anonymous ended copy only.';

REVOKE ALL ON FUNCTION public.get_introduction_chat_view(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_introduction_chat_view(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_introduction_chat_view(uuid) TO authenticated;

-- =============================================================================
-- 8) Chat list — active threads + one-time anonymous ended rows for reported party
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
    c.pet_low_id,
    c.pet_high_id,
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
  'Open introduction channels plus one-time anonymous ended rows for reported parties. Never exposes reporter identity on ended rows.';

REVOKE ALL ON FUNCTION public.list_my_introduction_channels() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_introduction_channels() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_introduction_channels() TO authenticated;
