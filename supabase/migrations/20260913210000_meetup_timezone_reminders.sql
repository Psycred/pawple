-- Phase 1A (10B-B.7): latest user device timezone + server-scheduled Meetup reminders.
-- Meetups keep city/date/start_time/end_time only — no Meetup timezone column.

-- ---------------------------------------------------------------------------
-- 1) profiles.latest_timezone — IANA device timezone, updated while app is active
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latest_timezone text,
  ADD COLUMN IF NOT EXISTS latest_timezone_updated_at timestamptz;

COMMENT ON COLUMN public.profiles.latest_timezone IS
  'Latest known IANA device timezone from the Pawple app. Used for Meetup reminder scheduling.';

COMMENT ON COLUMN public.profiles.latest_timezone_updated_at IS
  'When latest_timezone was last updated from the client.';

-- ---------------------------------------------------------------------------
-- 2) Shared Meetup reminder time + copy (recipient timezone only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_iana_timezone(p_timezone text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF nullif(btrim(coalesce(p_timezone, '')), '') IS NULL THEN
    RETURN false;
  END IF;
  PERFORM (timestamp '2000-01-01 00:00:00' AT TIME ZONE btrim(p_timezone));
  RETURN true;
EXCEPTION
  WHEN invalid_parameter_value THEN
    RETURN false;
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.meetup_reminder_morning_fire_at(
  p_meetup_date date,
  p_recipient_timezone text
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tz text := nullif(btrim(coalesce(p_recipient_timezone, '')), '');
BEGIN
  IF p_meetup_date IS NULL OR v_tz IS NULL OR NOT public.is_valid_iana_timezone(v_tz) THEN
    RETURN NULL;
  END IF;

  RETURN (p_meetup_date::timestamp + time '08:00:00') AT TIME ZONE v_tz;
END;
$$;

COMMENT ON FUNCTION public.meetup_reminder_morning_fire_at(date, text) IS
  'Morning-of (08:00) reminder instant in the recipient IANA timezone.';

CREATE OR REPLACE FUNCTION public.format_meetup_reminder_clock_time(p_start_time time)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    to_char(p_start_time, 'FMHH12:MI AM'),
    'the scheduled time'
  );
$$;

CREATE OR REPLACE FUNCTION public.format_meetup_reminder_date(p_meetup_date date)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    to_char(p_meetup_date, 'FMDD Mon YYYY'),
    'the scheduled date'
  );
$$;

CREATE OR REPLACE FUNCTION public.build_meetup_reminder_body(
  p_role text,
  p_city text,
  p_start_time time,
  p_meetup_date date
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_city text := coalesce(nullif(btrim(coalesce(p_city, '')), ''), 'your city');
  v_time text := public.format_meetup_reminder_clock_time(p_start_time);
  v_date text := public.format_meetup_reminder_date(p_meetup_date);
BEGIN
  IF lower(coalesce(p_role, '')) = 'host' THEN
    RETURN format(
      'You''re hosting a Meetup in %s at %s on %s.',
      v_city,
      v_time,
      v_date
    );
  END IF;

  RETURN format(
    'You have an upcoming Meetup in %s at %s on %s.',
    v_city,
    v_time,
    v_date
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Reminder schedule queue (processed by cron / RPC — works when app is closed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meetup_reminder_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  meetup_id uuid NOT NULL REFERENCES public.meetups (id) ON DELETE CASCADE,
  role text NOT NULL,
  fire_at timestamptz NOT NULL,
  event_key text NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT meetup_reminder_schedules_role_check
    CHECK (role IN ('host', 'joiner')),
  CONSTRAINT meetup_reminder_schedules_user_event_key_unique UNIQUE (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS meetup_reminder_schedules_due_idx
  ON public.meetup_reminder_schedules (fire_at)
  WHERE processed_at IS NULL;

COMMENT ON TABLE public.meetup_reminder_schedules IS
  'Server-side Meetup reminder queue. Fires in-app + push via create_account_notification.';

ALTER TABLE public.meetup_reminder_schedules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.meetup_reminder_schedules FROM PUBLIC;
REVOKE ALL ON TABLE public.meetup_reminder_schedules FROM anon;
REVOKE ALL ON TABLE public.meetup_reminder_schedules FROM authenticated;
GRANT ALL ON TABLE public.meetup_reminder_schedules TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Upsert / reschedule helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_meetup_reminder_schedule(
  p_user_id uuid,
  p_meetup_id uuid,
  p_role text,
  p_meetup_date date,
  p_recipient_timezone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fire_at timestamptz;
  v_event_key text;
BEGIN
  IF p_user_id IS NULL OR p_meetup_id IS NULL OR p_role NOT IN ('host', 'joiner') THEN
    RETURN;
  END IF;

  v_fire_at := public.meetup_reminder_morning_fire_at(p_meetup_date, p_recipient_timezone);
  IF v_fire_at IS NULL OR v_fire_at <= timezone('utc', now()) THEN
    DELETE FROM public.meetup_reminder_schedules
    WHERE user_id = p_user_id
      AND event_key = 'meetup-reminder:' || p_meetup_id::text || ':' || p_role;
    RETURN;
  END IF;

  v_event_key := 'meetup-reminder:' || p_meetup_id::text || ':' || p_role;

  INSERT INTO public.meetup_reminder_schedules (
    user_id,
    meetup_id,
    role,
    fire_at,
    event_key,
    processed_at
  )
  VALUES (
    p_user_id,
    p_meetup_id,
    p_role,
    v_fire_at,
    v_event_key,
    NULL
  )
  ON CONFLICT (user_id, event_key)
  DO UPDATE SET
    meetup_id = EXCLUDED.meetup_id,
    role = EXCLUDED.role,
    fire_at = EXCLUDED.fire_at,
    processed_at = NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_meetup_reminders_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz text;
  sched record;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT pr.latest_timezone
  INTO v_tz
  FROM public.profiles pr
  WHERE pr.id = p_user_id;

  IF NOT public.is_valid_iana_timezone(v_tz) THEN
    RETURN;
  END IF;

  FOR sched IN
    SELECT mrs.id, mrs.meetup_id, mrs.role, m.date AS meetup_date
    FROM public.meetup_reminder_schedules mrs
    INNER JOIN public.meetups m ON m.id = mrs.meetup_id
    WHERE mrs.user_id = p_user_id
      AND mrs.processed_at IS NULL
      AND coalesce(m.status, 'upcoming') = 'upcoming'
  LOOP
    PERFORM public.upsert_meetup_reminder_schedule(
      p_user_id,
      sched.meetup_id,
      sched.role,
      sched.meetup_date,
      v_tz
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_all_meetup_reminders_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meetup_row record;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  FOR meetup_row IN
    SELECT DISTINCT s.meetup_id
    FROM (
      SELECT m.id AS meetup_id
      FROM public.meetups m
      WHERE m.user_id = p_user_id
        AND coalesce(m.status, 'upcoming') = 'upcoming'
      UNION
      SELECT mp.meetup_id
      FROM public.meetup_participants mp
      INNER JOIN public.pets p ON p.id = mp.pet_id
      WHERE p.owner_id = p_user_id
    ) s
  LOOP
    PERFORM public.sync_meetup_reminder_schedules_for_meetup(meetup_row.meetup_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_meetup_reminder_schedules_for_meetup(p_meetup_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  host_tz text;
  joiner record;
BEGIN
  IF p_meetup_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO m
  FROM public.meetups
  WHERE id = p_meetup_id;

  IF NOT FOUND OR coalesce(m.status, 'upcoming') <> 'upcoming' THEN
    DELETE FROM public.meetup_reminder_schedules
    WHERE meetup_id = p_meetup_id;
    RETURN;
  END IF;

  SELECT pr.latest_timezone
  INTO host_tz
  FROM public.profiles pr
  WHERE pr.id = m.user_id;

  IF public.is_valid_iana_timezone(host_tz) THEN
    PERFORM public.upsert_meetup_reminder_schedule(
      m.user_id,
      m.id,
      'host',
      m.date,
      host_tz
    );
  ELSE
    DELETE FROM public.meetup_reminder_schedules
    WHERE meetup_id = m.id
      AND user_id = m.user_id
      AND role = 'host';
  END IF;

  FOR joiner IN
    SELECT DISTINCT p.owner_id AS user_id
    FROM public.meetup_participants mp
    INNER JOIN public.pets p ON p.id = mp.pet_id
    WHERE mp.meetup_id = m.id
      AND p.owner_id IS NOT NULL
      AND p.owner_id IS DISTINCT FROM m.user_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.meetup_hosts mh
        WHERE mh.meetup_id = m.id
          AND mh.pet_id = mp.pet_id
      )
  LOOP
    SELECT pr.latest_timezone
    INTO host_tz
    FROM public.profiles pr
    WHERE pr.id = joiner.user_id;

    IF public.is_valid_iana_timezone(host_tz) THEN
      PERFORM public.upsert_meetup_reminder_schedule(
        joiner.user_id,
        m.id,
        'joiner',
        m.date,
        host_tz
      );
    ELSE
      DELETE FROM public.meetup_reminder_schedules
      WHERE meetup_id = m.id
        AND user_id = joiner.user_id
        AND role = 'joiner';
    END IF;
  END LOOP;

  DELETE FROM public.meetup_reminder_schedules mrs
  WHERE mrs.meetup_id = m.id
    AND mrs.role = 'joiner'
    AND mrs.processed_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.meetup_participants mp
      INNER JOIN public.pets p ON p.id = mp.pet_id
      WHERE mp.meetup_id = m.id
        AND p.owner_id = mrs.user_id
        AND p.owner_id IS DISTINCT FROM m.user_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.meetup_hosts mh
          WHERE mh.meetup_id = m.id
            AND mh.pet_id = mp.pet_id
        )
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Process due reminders → in-app notification + existing Expo push dispatch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_due_meetup_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sched record;
  m record;
  v_body text;
  v_count integer := 0;
BEGIN
  FOR sched IN
    SELECT mrs.*
    FROM public.meetup_reminder_schedules mrs
    WHERE mrs.processed_at IS NULL
      AND mrs.fire_at <= timezone('utc', now())
    ORDER BY mrs.fire_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT *
    INTO m
    FROM public.meetups
    WHERE id = sched.meetup_id;

    IF NOT FOUND OR coalesce(m.status, 'upcoming') <> 'upcoming' THEN
      UPDATE public.meetup_reminder_schedules
      SET processed_at = timezone('utc', now())
      WHERE id = sched.id;
      CONTINUE;
    END IF;

    v_body := public.build_meetup_reminder_body(
      sched.role,
      m.city,
      m.start_time,
      m.date
    );

    PERFORM public.create_account_notification(
      p_user_id => sched.user_id,
      p_from_user_id => NULL,
      p_type => 'meetup_reminder',
      p_event_key => sched.event_key,
      p_title => coalesce(nullif(btrim(coalesce(m.title, '')), ''), 'Meetup reminder'),
      p_body => v_body,
      p_payload => jsonb_build_object(
        'meetupId', m.id,
        'meetupTitle', coalesce(m.title, ''),
        'city', coalesce(m.city, ''),
        'role', sched.role
      )
    );

    UPDATE public.meetup_reminder_schedules
    SET processed_at = timezone('utc', now())
    WHERE id = sched.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.process_due_meetup_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_due_meetup_reminders() TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Client RPC — update latest timezone + reschedule pending reminders
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_latest_timezone(p_timezone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tz text := nullif(btrim(coalesce(p_timezone, '')), '');
BEGIN
  IF v_user_id IS NULL OR NOT public.is_valid_iana_timezone(v_tz) THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET
    latest_timezone = v_tz,
    latest_timezone_updated_at = timezone('utc', now())
  WHERE id = v_user_id;

  PERFORM public.reschedule_meetup_reminders_for_user(v_user_id);
  PERFORM public.sync_all_meetup_reminders_for_user(v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_latest_timezone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_latest_timezone(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_latest_timezone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_latest_timezone(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 7) Triggers — maintain schedules on meetup / participant / timezone changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_meetup_reminder_after_meetup_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.meetup_reminder_schedules
    WHERE meetup_id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' OR (
    TG_OP = 'UPDATE' AND (
      NEW.date IS DISTINCT FROM OLD.date
      OR NEW.start_time IS DISTINCT FROM OLD.start_time
      OR NEW.city IS DISTINCT FROM OLD.city
      OR NEW.status IS DISTINCT FROM OLD.status
    )
  ) THEN
    PERFORM public.sync_meetup_reminder_schedules_for_meetup(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meetup_reminder_after_meetup_change ON public.meetups;
CREATE TRIGGER trg_meetup_reminder_after_meetup_change
  AFTER INSERT OR UPDATE OR DELETE ON public.meetups
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_meetup_reminder_after_meetup_change();

CREATE OR REPLACE FUNCTION public.trg_meetup_reminder_after_participant_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meetup_id uuid;
BEGIN
  v_meetup_id := COALESCE(NEW.meetup_id, OLD.meetup_id);
  PERFORM public.sync_meetup_reminder_schedules_for_meetup(v_meetup_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_meetup_reminder_after_participant_change ON public.meetup_participants;
CREATE TRIGGER trg_meetup_reminder_after_participant_change
  AFTER INSERT OR DELETE ON public.meetup_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_meetup_reminder_after_participant_change();

CREATE OR REPLACE FUNCTION public.trg_meetup_reminder_after_timezone_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.latest_timezone IS DISTINCT FROM OLD.latest_timezone THEN
    PERFORM public.reschedule_meetup_reminders_for_user(NEW.id);
    PERFORM public.sync_all_meetup_reminders_for_user(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meetup_reminder_after_timezone_change ON public.profiles;
CREATE TRIGGER trg_meetup_reminder_after_timezone_change
  AFTER UPDATE OF latest_timezone ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_meetup_reminder_after_timezone_change();

-- ---------------------------------------------------------------------------
-- 8) Notification type meetup_reminder
-- ---------------------------------------------------------------------------
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
      'meetup_nearby',
      'meetup_reminder'
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
    'meetup_nearby',
    'meetup_reminder'
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

-- ---------------------------------------------------------------------------
-- 9) pg_cron — process due reminders every minute (Supabase; skip if unavailable)
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'process-meetup-reminders';

  PERFORM cron.schedule(
    'process-meetup-reminders',
    '* * * * *',
    $job$SELECT public.process_due_meetup_reminders();$job$
  );
EXCEPTION
  WHEN undefined_object OR insufficient_privilege OR OTHERS THEN
    RAISE NOTICE 'pg_cron unavailable — meetup reminders require process_due_meetup_reminders() cron';
END;
$cron$;
