-- 10B-B.8 pre-flight (read-only) — production verification probes

SELECT 'migration_history' AS probe, version, name
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260904140000',
  '20260904150000',
  '20260909120000',
  '20260910120000',
  '20260910150000',
  '20260912100000',
  '20260912110000',
  '20260913150000',
  '20260913210000'
)
ORDER BY version;

SELECT 'history_locked_at_column' AS probe, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'meetups'
  AND column_name = 'history_locked_at';

SELECT 'meetups_user_id_nullable' AS probe, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'meetups'
  AND column_name = 'user_id';

SELECT 'key_functions' AS probe, proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'delete_user_account',
    'create_account_notification',
    'dispatch_account_notification_push',
    'process_due_meetup_reminders',
    'update_latest_timezone',
    'build_meetup_reminder_body',
    'is_meetup_past'
  )
ORDER BY proname;

SELECT 'delete_user_account_markers' AS probe,
  position('DELETE FROM public.meetups WHERE id = ANY(owned_meetup_ids)' IN pg_get_functiondef('public.delete_user_account()'::regprocedure)) > 0
  AS has_hard_delete_meetups,
  position('upcoming hosted meetup' IN lower(pg_get_functiondef('public.delete_user_account()'::regprocedure))) = 0
  AS no_upcoming_block;

SELECT 'notifications_type_check' AS probe, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.notifications'::regclass
  AND conname = 'notifications_type_check';

SELECT 'profiles_timezone_columns' AS probe, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('latest_timezone', 'latest_timezone_updated_at')
ORDER BY column_name;

SELECT 'reminder_schedules_table' AS probe, to_regclass('public.meetup_reminder_schedules')::text AS regclass;

SELECT 'reminder_triggers' AS probe, tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND tgname LIKE '%meetup_reminder%'
ORDER BY tgname;

SELECT 'pg_cron_extension' AS probe, extname FROM pg_extension WHERE extname = 'pg_cron';

SELECT 'device_tokens_table' AS probe, to_regclass('public.device_tokens')::text AS regclass;
