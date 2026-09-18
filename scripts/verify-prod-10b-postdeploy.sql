SELECT 'migrations_10b' AS probe, version FROM supabase_migrations.schema_migrations
WHERE version IN ('20260913150000','20260913210000','20260912100000','20260912110000') ORDER BY version;

SELECT 'history_locked_at' AS probe, count(*)::int AS col_count FROM information_schema.columns
WHERE table_schema='public' AND table_name='meetups' AND column_name='history_locked_at';

SELECT 'user_id_not_null' AS probe, is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name='meetups' AND column_name='user_id';

SELECT 'hard_delete' AS probe,
  position('DELETE FROM public.meetups WHERE id = ANY(owned_meetup_ids)' IN pg_get_functiondef('public.delete_user_account()'::regprocedure)) > 0 AS ok;

SELECT 'no_upcoming_block' AS probe,
  position('upcoming hosted meetup' IN lower(pg_get_functiondef('public.delete_user_account()'::regprocedure))) = 0 AS ok;

SELECT 'notification_types' AS probe, pg_get_constraintdef(oid) AS def FROM pg_constraint
WHERE conrelid='public.notifications'::regclass AND conname='notifications_type_check';

SELECT 'timezone_columns' AS probe, column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles' AND column_name IN ('latest_timezone','latest_timezone_updated_at') ORDER BY 1;

SELECT 'reminder_funcs' AS probe, proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('process_due_meetup_reminders','update_latest_timezone','build_meetup_reminder_body','meetup_reminder_morning_fire_at') ORDER BY 1;

SELECT 'reminder_table' AS probe, to_regclass('public.meetup_reminder_schedules')::text AS reg;

SELECT 'reminder_triggers' AS probe, tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal AND tgname LIKE '%meetup_reminder%' ORDER BY 1;

SELECT 'push_dispatch' AS probe, proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname='dispatch_account_notification_push';

SELECT 'pg_cron' AS probe, extname FROM pg_extension WHERE extname='pg_cron';

SELECT 'host_copy' AS probe, public.build_meetup_reminder_body('host','Mumbai','14:30:00'::time,'2026-10-15'::date) AS body;
SELECT 'joiner_copy' AS probe, public.build_meetup_reminder_body('joiner','Mumbai','14:30:00'::time,'2026-10-15'::date) AS body;
