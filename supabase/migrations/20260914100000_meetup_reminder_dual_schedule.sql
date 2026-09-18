-- 10B-B.7a: dual Meetup reminders (evening-before 8 PM + morning-of rules) — scheduling only.

DROP FUNCTION IF EXISTS public.meetup_reminder_morning_fire_at(date, text);
DROP FUNCTION IF EXISTS public.upsert_meetup_reminder_schedule(uuid, uuid, text, date, text);

CREATE OR REPLACE FUNCTION public.meetup_reminder_wall_clock_to_timestamptz(
  p_date date,
  p_time time,
  p_timezone text
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tz text := nullif(btrim(coalesce(p_timezone, '')), '');
BEGIN
  IF p_date IS NULL OR p_time IS NULL OR NOT public.is_valid_iana_timezone(v_tz) THEN
    RETURN NULL;
  END IF;
  RETURN (p_date::timestamp + p_time) AT TIME ZONE v_tz;
END;
$$;

CREATE OR REPLACE FUNCTION public.meetup_reminder_evening_before_fire_at(
  p_meetup_date date,
  p_recipient_timezone text
)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT public.meetup_reminder_wall_clock_to_timestamptz(
    p_meetup_date - 1,
    time '20:00:00',
    p_recipient_timezone
  );
$$;

CREATE OR REPLACE FUNCTION public.meetup_reminder_morning_fire_at(
  p_meetup_date date,
  p_start_time time,
  p_recipient_timezone text
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tz text;
  v_start_mins integer;
  v_fire_ts timestamp;
BEGIN
  v_tz := nullif(btrim(coalesce(p_recipient_timezone, '')), '');
  IF p_meetup_date IS NULL OR p_start_time IS NULL OR NOT public.is_valid_iana_timezone(v_tz) THEN
    RETURN NULL;
  END IF;

  v_start_mins :=
    (extract(hour from p_start_time)::integer * 60) +
    extract(minute from p_start_time)::integer;

  -- Before 10:00 AM → exactly 2 hours before start (may fall on previous calendar day).
  IF v_start_mins < 600 THEN
    v_fire_ts := p_meetup_date::timestamp + p_start_time - interval '2 hours';
  ELSE
    v_fire_ts := p_meetup_date::timestamp + time '08:00:00';
  END IF;

  RETURN v_fire_ts AT TIME ZONE v_tz;
END;
$$;

COMMENT ON FUNCTION public.meetup_reminder_morning_fire_at(date, time, text) IS
  'Morning-of reminder: 2 hours before start when start is before 10:00 AM; otherwise 8:00 AM on Meetup date.';

CREATE OR REPLACE FUNCTION public.upsert_meetup_reminder_schedule(
  p_user_id uuid,
  p_meetup_id uuid,
  p_role text,
  p_meetup_date date,
  p_start_time time,
  p_recipient_timezone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evening timestamptz;
  v_morning timestamptz;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_user_id IS NULL OR p_meetup_id IS NULL OR p_role NOT IN ('host', 'joiner') THEN
    RETURN;
  END IF;

  v_evening := public.meetup_reminder_evening_before_fire_at(p_meetup_date, p_recipient_timezone);
  v_morning := public.meetup_reminder_morning_fire_at(
    p_meetup_date,
    coalesce(p_start_time, time '09:00:00'),
    p_recipient_timezone
  );

  IF v_evening IS NOT NULL AND v_morning IS NOT NULL AND v_evening = v_morning THEN
    v_morning := NULL;
  END IF;

  DELETE FROM public.meetup_reminder_schedules
  WHERE user_id = p_user_id
    AND meetup_id = p_meetup_id
    AND role = p_role
    AND processed_at IS NULL;

  IF v_evening IS NOT NULL AND v_evening > v_now THEN
    INSERT INTO public.meetup_reminder_schedules (
      user_id, meetup_id, role, fire_at, event_key, processed_at
    )
    VALUES (
      p_user_id,
      p_meetup_id,
      p_role,
      v_evening,
      'meetup-reminder:' || p_meetup_id::text || ':' || p_role || ':evening-before',
      NULL
    )
    ON CONFLICT (user_id, event_key)
    DO UPDATE SET
      meetup_id = EXCLUDED.meetup_id,
      role = EXCLUDED.role,
      fire_at = EXCLUDED.fire_at,
      processed_at = NULL;
  END IF;

  IF v_morning IS NOT NULL AND v_morning > v_now THEN
    INSERT INTO public.meetup_reminder_schedules (
      user_id, meetup_id, role, fire_at, event_key, processed_at
    )
    VALUES (
      p_user_id,
      p_meetup_id,
      p_role,
      v_morning,
      'meetup-reminder:' || p_meetup_id::text || ':' || p_role || ':morning-of',
      NULL
    )
    ON CONFLICT (user_id, event_key)
    DO UPDATE SET
      meetup_id = EXCLUDED.meetup_id,
      role = EXCLUDED.role,
      fire_at = EXCLUDED.fire_at,
      processed_at = NULL;
  END IF;
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
    SELECT mrs.meetup_id, mrs.role, m.date AS meetup_date, m.start_time
    FROM public.meetup_reminder_schedules mrs
    INNER JOIN public.meetups m ON m.id = mrs.meetup_id
    WHERE mrs.user_id = p_user_id
      AND mrs.processed_at IS NULL
      AND coalesce(m.status, 'upcoming') = 'upcoming'
    GROUP BY mrs.meetup_id, mrs.role, m.date, m.start_time
  LOOP
    PERFORM public.upsert_meetup_reminder_schedule(
      p_user_id,
      sched.meetup_id,
      sched.role,
      sched.meetup_date,
      sched.start_time,
      v_tz
    );
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
  recipient_tz text;
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
  INTO recipient_tz
  FROM public.profiles pr
  WHERE pr.id = m.user_id;

  IF public.is_valid_iana_timezone(recipient_tz) THEN
    PERFORM public.upsert_meetup_reminder_schedule(
      m.user_id,
      m.id,
      'host',
      m.date,
      m.start_time,
      recipient_tz
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
    INTO recipient_tz
    FROM public.profiles pr
    WHERE pr.id = joiner.user_id;

    IF public.is_valid_iana_timezone(recipient_tz) THEN
      PERFORM public.upsert_meetup_reminder_schedule(
        joiner.user_id,
        m.id,
        'joiner',
        m.date,
        m.start_time,
        recipient_tz
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
        'role', sched.role,
        'reminderSlot', CASE
          WHEN sched.event_key LIKE '%:evening-before' THEN 'evening-before'
          WHEN sched.event_key LIKE '%:morning-of' THEN 'morning-of'
          ELSE NULL
        END
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

-- Drop legacy single-slot pending rows (pre-7a event keys).
DELETE FROM public.meetup_reminder_schedules
WHERE processed_at IS NULL
  AND event_key ~ '^meetup-reminder:[^:]+:(host|joiner)$';

-- Resync upcoming meetups onto the dual-slot schedule.
DO $resync$
DECLARE
  meetup_row record;
BEGIN
  FOR meetup_row IN
    SELECT id
    FROM public.meetups
    WHERE coalesce(status, 'upcoming') = 'upcoming'
  LOOP
    PERFORM public.sync_meetup_reminder_schedules_for_meetup(meetup_row.id);
  END LOOP;
END;
$resync$;
