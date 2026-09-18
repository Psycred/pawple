-- Phase 5: meetup server notifications, device push tokens, and Expo push dispatch.
-- In-app notifications are always created; OS push respects profiles.notification_enabled.

-- ---------------------------------------------------------------------------
-- 1) device_tokens — Expo push tokens per signed-in device
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text,
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT device_tokens_expo_push_token_nonempty CHECK (btrim(expo_push_token) <> ''),
  CONSTRAINT device_tokens_platform_check CHECK (
    platform IS NULL OR platform IN ('ios', 'android', 'web')
  ),
  CONSTRAINT device_tokens_user_token_unique UNIQUE (user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS device_tokens_user_id_idx
  ON public.device_tokens (user_id);

COMMENT ON TABLE public.device_tokens IS
  'Expo push tokens for account-level OS notifications. One row per user/device token pair.';

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_tokens_select_own ON public.device_tokens;
CREATE POLICY device_tokens_select_own
  ON public.device_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_insert_own ON public.device_tokens;
CREATE POLICY device_tokens_insert_own
  ON public.device_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_update_own ON public.device_tokens;
CREATE POLICY device_tokens_update_own
  ON public.device_tokens
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_delete_own ON public.device_tokens;
CREATE POLICY device_tokens_delete_own
  ON public.device_tokens
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.device_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.device_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_tokens TO authenticated;
GRANT ALL ON TABLE public.device_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_device_push_token(
  p_expo_push_token text,
  p_platform text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_token text := nullif(trim(coalesce(p_expo_push_token, '')), '');
  v_platform text := nullif(trim(lower(coalesce(p_platform, ''))), '');
BEGIN
  IF v_user_id IS NULL OR v_token IS NULL THEN
    RETURN;
  END IF;

  IF v_platform IS NOT NULL AND v_platform NOT IN ('ios', 'android', 'web') THEN
    v_platform := NULL;
  END IF;

  INSERT INTO public.device_tokens (user_id, expo_push_token, platform, last_seen_at)
  VALUES (v_user_id, v_token, v_platform, timezone('utc', now()))
  ON CONFLICT (user_id, expo_push_token)
  DO UPDATE SET
    platform = coalesce(EXCLUDED.platform, public.device_tokens.platform),
    last_seen_at = timezone('utc', now());

  UPDATE public.profiles
  SET notification_enabled = true
  WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_device_push_token(
  p_expo_push_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_token text := nullif(trim(coalesce(p_expo_push_token, '')), '');
BEGIN
  IF v_user_id IS NULL OR v_token IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.device_tokens
  WHERE user_id = v_user_id
    AND expo_push_token = v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_device_push_token(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_device_push_token(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_device_push_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_device_push_token(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.remove_device_push_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_device_push_token(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_device_push_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_device_push_token(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Meetup guest joined — host/creator only, batched per joiner account
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_host_after_meetup_guest_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  batch record;
  guest_label text;
BEGIN
  FOR batch IN
    SELECT
      ir.meetup_id,
      m.user_id AS host_user_id,
      m.title AS meetup_title,
      p.owner_id AS joiner_owner_id,
      array_agg(p.name ORDER BY p.name) AS pet_names
    FROM inserted_rows ir
    INNER JOIN public.meetups m ON m.id = ir.meetup_id
    INNER JOIN public.pets p ON p.id = ir.pet_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.meetup_hosts mh
      WHERE mh.meetup_id = ir.meetup_id
        AND mh.pet_id = ir.pet_id
    )
      AND p.owner_id IS NOT NULL
      AND p.owner_id IS DISTINCT FROM m.user_id
    GROUP BY ir.meetup_id, m.user_id, m.title, p.owner_id
  LOOP
    IF coalesce(cardinality(batch.pet_names), 0) = 1 THEN
      guest_label := coalesce(batch.pet_names[1], 'A pet');
    ELSIF coalesce(cardinality(batch.pet_names), 0) = 2 THEN
      guest_label :=
        coalesce(batch.pet_names[1], 'A pet') || ' and ' ||
        coalesce(batch.pet_names[2], 'a pet');
    ELSE
      guest_label :=
        coalesce(batch.pet_names[1], 'A pet') || ' and ' ||
        (cardinality(batch.pet_names) - 1)::text || ' others';
    END IF;

    PERFORM public.create_account_notification(
      p_user_id => batch.host_user_id,
      p_from_user_id => batch.joiner_owner_id,
      p_type => 'meetup_guest_joined',
      p_event_key =>
        'meetup-guest-joined:' || batch.meetup_id::text || ':' || batch.joiner_owner_id::text,
      p_title => guest_label || ' joined your meetup',
      p_body => coalesce(batch.meetup_title, 'Meetup'),
      p_payload => jsonb_build_object(
        'meetupId', batch.meetup_id,
        'meetupTitle', coalesce(batch.meetup_title, ''),
        'guestPetNames', to_jsonb(batch.pet_names)
      )
    );
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_after_meetup_guest_join ON public.meetup_participants;
CREATE TRIGGER trg_notifications_after_meetup_guest_join
  AFTER INSERT ON public.meetup_participants
  REFERENCING NEW TABLE AS inserted_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.notify_host_after_meetup_guest_join();

-- ---------------------------------------------------------------------------
-- 3) Nearby meetup created — users with saved coarse location within 100 km
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_nearby_after_meetup_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient record;
BEGIN
  IF NEW.location_lat IS NULL OR NEW.location_lng IS NULL THEN
    RETURN NEW;
  END IF;

  FOR recipient IN
    SELECT pr.id AS user_id
    FROM public.profiles pr
    WHERE pr.id IS DISTINCT FROM NEW.user_id
      AND pr.last_location_lat IS NOT NULL
      AND pr.last_location_lng IS NOT NULL
      AND public.haversine_km(
        pr.last_location_lat,
        pr.last_location_lng,
        NEW.location_lat,
        NEW.location_lng
      ) <= 100
  LOOP
    PERFORM public.create_account_notification(
      p_user_id => recipient.user_id,
      p_from_user_id => NEW.user_id,
      p_type => 'meetup_nearby',
      p_event_key => 'meetup-nearby:' || NEW.id::text || ':' || recipient.user_id::text,
      p_title => 'New meetup nearby',
      p_body => coalesce(NEW.title, 'A meetup was posted near you'),
      p_payload => jsonb_build_object(
        'meetupId', NEW.id,
        'meetupTitle', coalesce(NEW.title, ''),
        'city', coalesce(NEW.city, '')
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_after_meetup_create ON public.meetups;
CREATE TRIGGER trg_notifications_after_meetup_create
  AFTER INSERT ON public.meetups
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_nearby_after_meetup_create();

-- ---------------------------------------------------------------------------
-- 4) Expo push dispatch on notification insert (when pg_net is available)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_account_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_row public.profiles%ROWTYPE;
  token_row record;
  push_payload jsonb;
BEGIN
  IF NEW.type IN ('permission_reminder_location', 'permission_reminder_notifications') THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO profile_row
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF NOT FOUND OR profile_row.notification_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN NEW;
  END IF;

  FOR token_row IN
    SELECT dt.expo_push_token
    FROM public.device_tokens dt
    WHERE dt.user_id = NEW.user_id
  LOOP
    push_payload := jsonb_build_object(
      'to', token_row.expo_push_token,
      'title', coalesce(NEW.title, 'Pawple'),
      'body', coalesce(NEW.body, ''),
      'sound', 'default',
      'data', jsonb_build_object(
        'notificationId', NEW.id,
        'type', NEW.type,
        'targetPetId', NEW.target_pet_id,
        'actorPetId', NEW.actor_pet_id,
        'channelId', NEW.channel_id,
        'pawInterestId', NEW.paw_interest_id
      ) || coalesce(NEW.payload, '{}'::jsonb)
    );

    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json'
      ),
      body := push_payload
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_dispatch_push ON public.notifications;
CREATE TRIGGER trg_notifications_dispatch_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_account_notification_push();
