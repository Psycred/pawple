-- Step 7D FINAL — Chat UX, physical message deletion, block visibility, Mew list RPC.
-- Production-safe: targeted CREATE OR REPLACE + RLS tightening. No conversation archival.
-- Does NOT apply scratch repair wave. Does NOT change Step 7C eligibility math.

-- =============================================================================
-- 1) Helpers — teardown + visibility
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pet_is_blocked_for_viewer(p_pet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_pet_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND public.mating_pair_blocked_for_viewer(
      auth.uid(),
      p_pet_id,
      (SELECT p.owner_id FROM public.pets p WHERE p.id = p_pet_id)
    );
$$;

COMMENT ON FUNCTION public.pet_is_blocked_for_viewer(uuid) IS
  'True when the signed-in viewer must not see this pet (bidirectional block graph).';

CREATE OR REPLACE FUNCTION public.moment_has_blocked_pet_for_viewer(p_moment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.moments m
    WHERE m.id = p_moment_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.moment_pets mp
          INNER JOIN public.pets p ON p.id = mp.pet_id
          WHERE mp.moment_id = m.id
            AND public.pet_is_blocked_for_viewer(p.id)
        )
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(m.pet_ids, ARRAY[]::uuid[])) AS pid
          WHERE public.pet_is_blocked_for_viewer(pid)
        )
      )
  );
$$;

COMMENT ON FUNCTION public.moment_has_blocked_pet_for_viewer(uuid) IS
  'True when a moment tags a pet the viewer is blocked from seeing.';

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

  -- Messages cascade via FK ON DELETE CASCADE.
  DELETE FROM public.mating_introduction_channels
  WHERE pet_low_id = v_low
    AND pet_high_id = v_high;
END;
$$;

COMMENT ON FUNCTION public.mating_teardown_channel_for_pair(uuid, uuid) IS
  'Physically removes an introduction channel and all messages for an ordered pet pair.';

CREATE OR REPLACE FUNCTION public.mating_clear_paw_between_pets(p_pet_a uuid, p_pet_b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_pet_a IS NULL OR p_pet_b IS NULL OR p_pet_a = p_pet_b THEN
    RETURN;
  END IF;

  DELETE FROM public.paw_interests
  WHERE (from_pet_id = p_pet_a AND to_pet_id = p_pet_b)
     OR (from_pet_id = p_pet_b AND to_pet_id = p_pet_a);
END;
$$;

COMMENT ON FUNCTION public.mating_clear_paw_between_pets(uuid, uuid) IS
  'Removes directional Paw rows in both directions for a pet pair.';

-- Internal lifecycle helpers only — not client-callable RPCs.
REVOKE ALL ON FUNCTION public.mating_teardown_channel_for_pair(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mating_teardown_channel_for_pair(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.mating_teardown_channel_for_pair(uuid, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.mating_clear_paw_between_pets(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mating_clear_paw_between_pets(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.mating_clear_paw_between_pets(uuid, uuid) FROM authenticated;

-- =============================================================================
-- 2) Unpaw — delete channel + messages when mutual Paw breaks
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mating_freeze_channel_after_paw_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pets_have_mutual_paw(OLD.from_pet_id, OLD.to_pet_id) THEN
    PERFORM public.mating_teardown_channel_for_pair(OLD.from_pet_id, OLD.to_pet_id);
  END IF;

  RETURN OLD;
END;
$$;

-- =============================================================================
-- 3) Block — end connection, delete messages, clear Paw rows (both directions)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mating_teardown_on_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocker_pet record;
BEGIN
  -- Clear Paw + introduction between the blocked pet and each of the blocker''s pets.
  FOR v_blocker_pet IN
    SELECT id FROM public.pets WHERE owner_id = NEW.blocker_user_id
  LOOP
    PERFORM public.mating_clear_paw_between_pets(v_blocker_pet.id, NEW.blocked_pet_id);
    PERFORM public.mating_teardown_channel_for_pair(v_blocker_pet.id, NEW.blocked_pet_id);
  END LOOP;

  -- Also clear Paw from the blocked pet toward any of the blocker''s pets (safety net).
  DELETE FROM public.paw_interests pi
  WHERE pi.from_pet_id = NEW.blocked_pet_id
    AND pi.to_pet_id IN (SELECT id FROM public.pets WHERE owner_id = NEW.blocker_user_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pet_blocks_freeze_mating_channels ON public.pet_blocks;
CREATE TRIGGER trg_pet_blocks_teardown_mating_on_block
  AFTER INSERT ON public.pet_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.mating_teardown_on_block();

-- Unblock must NOT restore connection, chat, or visibility.
DROP TRIGGER IF EXISTS trg_pet_blocks_reopen_mating_channels ON public.pet_blocks;
DROP FUNCTION IF EXISTS public.mating_try_reopen_after_unblock();

-- =============================================================================
-- 4) Pet opt-out — physically delete channels (no frozen history retention)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mating_on_pet_opt_out()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_looking_for_companion IS TRUE AND NEW.is_looking_for_companion IS FALSE THEN
    -- Outbound only (CTO §3.1). Inbound retained for report evidence; Interest SELECT quiets them.
    DELETE FROM public.paw_interests
    WHERE from_pet_id = NEW.id;

    -- Physically remove all introduction channels + messages for this pet.
    -- Never freeze-and-retain: a later mutual Paw must start with zero messages.
    DELETE FROM public.mating_introduction_channels
    WHERE pet_low_id = NEW.id
       OR pet_high_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 5) Mutual Paw — always delete stale channel row, then insert fresh empty chat
-- =============================================================================

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

  -- Remove any prior open/frozen channel + messages before creating a fresh conversation.
  PERFORM public.mating_teardown_channel_for_pair(NEW.from_pet_id, NEW.to_pet_id);

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
-- 6) Message RLS — participants only (no generation filter)
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
    )
  );

-- =============================================================================
-- 7) Block visibility — pets, moments, meetup participants/hosts
-- =============================================================================

DROP POLICY IF EXISTS pets_select_visible ON public.pets;
CREATE POLICY pets_select_visible
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (NOT public.pet_is_blocked_for_viewer(id));

COMMENT ON POLICY pets_select_visible ON public.pets IS
  'Pet profiles hidden bidirectionally when a block exists. Owners always pass unless they blocked the pet themselves.';

DROP POLICY IF EXISTS moments_select_authenticated ON public.moments;
CREATE POLICY moments_select_authenticated
  ON public.moments
  FOR SELECT
  TO authenticated
  USING (NOT public.moment_has_blocked_pet_for_viewer(id));

COMMENT ON POLICY moments_select_authenticated ON public.moments IS
  'Feed moments featuring blocked pets are not returned to the blocking viewer.';

DROP POLICY IF EXISTS meetup_participants_select_authenticated ON public.meetup_participants;
CREATE POLICY meetup_participants_select_authenticated
  ON public.meetup_participants
  FOR SELECT
  TO authenticated
  USING (NOT public.pet_is_blocked_for_viewer(pet_id));

COMMENT ON POLICY meetup_participants_select_authenticated ON public.meetup_participants IS
  'Meetup participant rows for blocked pets are hidden from the blocking viewer.';

DROP POLICY IF EXISTS meetup_hosts_select_authenticated ON public.meetup_hosts;
CREATE POLICY meetup_hosts_select_authenticated
  ON public.meetup_hosts
  FOR SELECT
  TO authenticated
  USING (NOT public.pet_is_blocked_for_viewer(pet_id));

COMMENT ON POLICY meetup_hosts_select_authenticated ON public.meetup_hosts IS
  'Meetup host rows for blocked pets are hidden from the blocking viewer.';

REVOKE ALL ON FUNCTION public.pet_is_blocked_for_viewer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.moment_has_blocked_pet_for_viewer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pet_is_blocked_for_viewer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moment_has_blocked_pet_for_viewer(uuid) TO authenticated;

-- =============================================================================
-- 8) Mew list RPC
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
  last_message_at timestamptz
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
    latest.created_at
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
  ORDER BY coalesce(latest.created_at, c.opened_at) DESC NULLS LAST, c.id;
END;
$$;

COMMENT ON FUNCTION public.list_my_introduction_channels() IS
  'Open introduction channels: pet identity, actual latest message preview, activity sort. Blocked pets excluded.';

REVOKE ALL ON FUNCTION public.list_my_introduction_channels() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_introduction_channels() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_introduction_channels() TO authenticated;

-- =============================================================================
-- 9) Notifications — actual message body + calm mutual-Paw wording
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_account_after_paw_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name text;
  target_name text;
  is_response boolean;
  notification_type text;
  notification_title text;
  notification_body text;
BEGIN
  IF NEW.from_owner_id IS NULL
     OR NEW.to_owner_id IS NULL
     OR NEW.from_owner_id = NEW.to_owner_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO actor_name FROM public.pets WHERE id = NEW.from_pet_id;
  SELECT name INTO target_name FROM public.pets WHERE id = NEW.to_pet_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.paw_interests reverse_interest
    WHERE reverse_interest.from_pet_id = NEW.to_pet_id
      AND reverse_interest.to_pet_id = NEW.from_pet_id
  ) INTO is_response;

  IF is_response THEN
    notification_type := 'paw_response';
    notification_title := 'You found a companion 🐾';
    notification_body := coalesce(actor_name, 'A pet');
  ELSE
    notification_type := 'paw_received';
    notification_title :=
      coalesce(actor_name, 'A pet') || ' pawed ' ||
      coalesce(target_name, 'your pet');
    notification_body := NULL;
  END IF;

  PERFORM public.create_account_notification(
    p_user_id => NEW.to_owner_id,
    p_from_user_id => NEW.from_owner_id,
    p_type => notification_type,
    p_event_key => 'paw:' || NEW.id::text,
    p_target_pet_id => NEW.to_pet_id,
    p_actor_pet_id => NEW.from_pet_id,
    p_paw_interest_id => NEW.id,
    p_title => notification_title,
    p_body => notification_body,
    p_payload => jsonb_build_object(
      'actorPetName', coalesce(actor_name, 'Pet'),
      'targetPetName', coalesce(target_name, 'your pet')
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_account_after_intro_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_row public.mating_introduction_channels%ROWTYPE;
  recipient_id uuid;
  target_pet uuid;
  actor_pet uuid;
  actor_name text;
  target_name text;
BEGIN
  SELECT *
  INTO channel_row
  FROM public.mating_introduction_channels
  WHERE id = NEW.channel_id;

  IF channel_row.id IS NULL OR channel_row.status <> 'open' THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_user_id = channel_row.owner_low_id THEN
    recipient_id := channel_row.owner_high_id;
    actor_pet := channel_row.pet_low_id;
    target_pet := channel_row.pet_high_id;
  ELSIF NEW.sender_user_id = channel_row.owner_high_id THEN
    recipient_id := channel_row.owner_low_id;
    actor_pet := channel_row.pet_high_id;
    target_pet := channel_row.pet_low_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT name INTO actor_name FROM public.pets WHERE id = actor_pet;
  SELECT name INTO target_name FROM public.pets WHERE id = target_pet;

  PERFORM public.create_account_notification(
    p_user_id => recipient_id,
    p_from_user_id => NEW.sender_user_id,
    p_type => 'chat_message',
    p_event_key => 'chat-message:' || NEW.id::text,
    p_target_pet_id => target_pet,
    p_actor_pet_id => actor_pet,
    p_channel_id => NEW.channel_id,
    p_message_id => NEW.id,
    p_title => coalesce(actor_name, 'Pet'),
    p_body => NEW.body,
    p_payload => jsonb_build_object(
      'actorPetName', coalesce(actor_name, 'Pet'),
      'targetPetName', coalesce(target_name, 'Pet'),
      'messageBody', NEW.body
    )
  );

  RETURN NEW;
END;
$$;
