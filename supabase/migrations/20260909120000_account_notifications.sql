-- Pawple Step 2: quiet, account-level in-app notification centre.
-- Extends the empty legacy notifications table instead of creating a parallel inbox.
-- OS push delivery is intentionally out of scope.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  type text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- App announcements have no actor, so reconcile the legacy shape if it required one.
ALTER TABLE public.notifications
  ALTER COLUMN from_user_id DROP NOT NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_key text,
  ADD COLUMN IF NOT EXISTS target_pet_id uuid REFERENCES public.pets (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_pet_id uuid REFERENCES public.pets (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paw_interest_id uuid REFERENCES public.paw_interests (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES public.mating_introduction_channels (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES public.mating_introduction_messages (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- The legacy table is empty but may carry an undocumented old type check.
-- Replace only CHECK constraints; preserve its primary and foreign keys.
DO $$
DECLARE
  existing_check record;
BEGIN
  FOR existing_check IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.notifications DROP CONSTRAINT %I',
      existing_check.conname
    );
  END LOOP;
END;
$$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('paw_received', 'paw_response', 'chat_message', 'app_announcement')),
  ADD CONSTRAINT notifications_title_length_check
  CHECK (title IS NULL OR char_length(title) <= 160),
  ADD CONSTRAINT notifications_body_length_check
  CHECK (body IS NULL OR char_length(body) <= 500);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_event_key_unique
  ON public.notifications (user_id, event_key)
  WHERE event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

COMMENT ON TABLE public.notifications IS
  'Account-level Pawple inbox. Quiet events only: incoming Paw, Paw response, introduction message, or intentional app announcement.';

COMMENT ON COLUMN public.notifications.user_id IS
  'Recipient account. Notifications are never scoped to only the currently active pet.';

COMMENT ON COLUMN public.notifications.event_key IS
  'Stable source-event identifier used with user_id to prevent duplicate rows.';

CREATE OR REPLACE FUNCTION public.sync_notification_read_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.read_at IS NOT NULL THEN
    NEW.is_read := true;
  ELSIF NEW.is_read IS TRUE THEN
    NEW.read_at := timezone('utc', now());
  ELSE
    NEW.read_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_sync_read_state ON public.notifications;
CREATE TRIGGER trg_notifications_sync_read_state
  BEFORE INSERT OR UPDATE OF is_read, read_at ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_notification_read_state();

-- Reconcile undocumented legacy policies and expose only an account's own inbox.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.notifications',
      existing_policy.policyname
    );
  END LOOP;
END;
$$;

CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update_read_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.notifications FROM PUBLIC;
REVOKE ALL ON TABLE public.notifications FROM anon;
REVOKE ALL ON TABLE public.notifications FROM authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (is_read, read_at) ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

CREATE OR REPLACE FUNCTION public.create_account_notification(
  p_user_id uuid,
  p_from_user_id uuid,
  p_type text,
  p_event_key text,
  p_target_pet_id uuid DEFAULT NULL,
  p_actor_pet_id uuid DEFAULT NULL,
  p_paw_interest_id uuid DEFAULT NULL,
  p_channel_id uuid DEFAULT NULL,
  p_message_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR nullif(trim(coalesce(p_event_key, '')), '') IS NULL THEN
    RETURN;
  END IF;

  -- Pawple never notifies an account about its own action.
  IF p_from_user_id IS NOT NULL AND p_from_user_id = p_user_id THEN
    RETURN;
  END IF;

  IF p_type NOT IN ('paw_received', 'paw_response', 'chat_message', 'app_announcement') THEN
    RAISE EXCEPTION 'unsupported_notification_type';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    from_user_id,
    type,
    event_key,
    target_pet_id,
    actor_pet_id,
    paw_interest_id,
    channel_id,
    message_id,
    title,
    body,
    payload
  )
  VALUES (
    p_user_id,
    p_from_user_id,
    p_type,
    p_event_key,
    p_target_pet_id,
    p_actor_pet_id,
    p_paw_interest_id,
    p_channel_id,
    p_message_id,
    nullif(trim(coalesce(p_title, '')), ''),
    nullif(trim(coalesce(p_body, '')), ''),
    coalesce(p_payload, '{}'::jsonb)
  )
  ON CONFLICT (user_id, event_key) WHERE event_key IS NOT NULL
  DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.create_account_notification(
  uuid, uuid, text, text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_account_notification(
  uuid, uuid, text, text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb
) FROM anon;
REVOKE ALL ON FUNCTION public.create_account_notification(
  uuid, uuid, text, text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_account_notification(
  uuid, uuid, text, text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb
) TO service_role;

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
    notification_title :=
      coalesce(actor_name, 'A pet') || ' responded to ' ||
      coalesce(target_name, 'your pet') || '''s paw';
  ELSE
    notification_type := 'paw_received';
    notification_title :=
      coalesce(actor_name, 'A pet') || ' pawed ' ||
      coalesce(target_name, 'your pet');
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
    p_payload => jsonb_build_object(
      'actorPetName', coalesce(actor_name, 'Pet'),
      'targetPetName', coalesce(target_name, 'your pet')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_after_paw_insert ON public.paw_interests;
CREATE TRIGGER trg_notifications_after_paw_insert
  AFTER INSERT ON public.paw_interests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_account_after_paw_insert();

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
    p_title => coalesce(actor_name, 'A pet') || ' sent you a message',
    p_body => 'Open the introduction with ' || coalesce(actor_name, 'this pet') || '.',
    p_payload => jsonb_build_object(
      'actorPetName', coalesce(actor_name, 'Pet'),
      'targetPetName', coalesce(target_name, 'Pet')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_after_intro_message
  ON public.mating_introduction_messages;
CREATE TRIGGER trg_notifications_after_intro_message
  AFTER INSERT ON public.mating_introduction_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_account_after_intro_message();

CREATE OR REPLACE FUNCTION public.publish_pawple_announcement(
  p_event_key text,
  p_title text,
  p_body text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  IF nullif(trim(coalesce(p_event_key, '')), '') IS NULL
     OR nullif(trim(coalesce(p_title, '')), '') IS NULL
     OR nullif(trim(coalesce(p_body, '')), '') IS NULL THEN
    RAISE EXCEPTION 'announcement_fields_required';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    from_user_id,
    type,
    event_key,
    title,
    body,
    payload
  )
  SELECT
    profile.id,
    NULL,
    'app_announcement',
    'announcement:' || trim(p_event_key),
    trim(p_title),
    trim(p_body),
    jsonb_build_object('announcementKey', trim(p_event_key))
  FROM public.profiles profile
  ON CONFLICT (user_id, event_key) WHERE event_key IS NOT NULL
  DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_pawple_announcement(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_pawple_announcement(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.publish_pawple_announcement(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.publish_pawple_announcement(text, text, text) TO service_role;

-- Realtime updates the in-app centre only; this does not enable OS push delivery.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;
