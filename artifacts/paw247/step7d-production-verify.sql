-- Step 7D production verification (read-only)
SELECT p.proname, r.rolname,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN (VALUES ('public'::name), ('anon'::name), ('authenticated'::name)) AS roles(rolname)
JOIN pg_roles r ON r.rolname = roles.rolname
WHERE n.nspname = 'public'
  AND p.proname IN ('mating_teardown_channel_for_pair', 'mating_clear_paw_between_pets')
ORDER BY p.proname, r.rolname;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'mating_introduction_channels'
  AND column_name = 'conversation_generation';

SELECT tgname FROM pg_trigger WHERE tgname = 'trg_pet_blocks_reopen_mating_channels';

SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'mating_try_reopen_after_unblock';

SELECT tgname FROM pg_trigger WHERE tgname = 'trg_pet_blocks_teardown_mating_on_block';

SELECT proname,
  prosrc LIKE '%ON CONFLICT%' AS has_on_conflict,
  prosrc LIKE '%mating_teardown_channel_for_pair%' AS calls_teardown,
  prosrc LIKE '%DELETE FROM public.mating_introduction_channels%' AS deletes_channels
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'mating_sync_channel_after_paw_insert',
    'mating_on_pet_opt_out',
    'mating_freeze_channel_after_paw_delete',
    'mating_teardown_on_block'
  )
ORDER BY proname;

SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'mating_eligible_pair',
    'get_mating_opportunities',
    'get_mating_discovery_context',
    'pets_same_pet_type'
  )
ORDER BY proname;

SELECT pg_get_function_result(p.oid) AS result_type
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'list_my_introduction_channels';

SELECT polname, tablename
FROM pg_policies
WHERE schemaname = 'public'
  AND polname IN (
    'pets_select_visible',
    'moments_select_authenticated',
    'meetup_participants_select_authenticated',
    'meetup_hosts_select_authenticated',
    'mating_introduction_messages_select_participants'
  )
ORDER BY tablename, polname;
