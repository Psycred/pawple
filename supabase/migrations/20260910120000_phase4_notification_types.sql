-- Phase 4/5: extend in-app notification types for permission reminders and meetup events.
-- Client-scheduled permission reminders stay local; meetup types are for Phase 5 server events.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'paw_received',
      'paw_response',
      'chat_message',
      'app_announcement',
      'permission_reminder_location',
      'permission_reminder_notifications',
      'meetup_guest_joined',
      'meetup_nearby'
    )
  );

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

  IF p_from_user_id IS NOT NULL AND p_from_user_id = p_user_id THEN
    RETURN;
  END IF;

  IF p_type NOT IN (
    'paw_received',
    'paw_response',
    'chat_message',
    'app_announcement',
    'permission_reminder_location',
    'permission_reminder_notifications',
    'meetup_guest_joined',
    'meetup_nearby'
  ) THEN
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
