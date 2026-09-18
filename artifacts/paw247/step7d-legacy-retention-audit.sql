-- Step 7D legacy retention audit (READ-ONLY) — production pexurgcfkxkouthuhlnb

-- 1) Total channels
SELECT count(*) AS total_channels FROM public.mating_introduction_channels;

-- 2) By status
SELECT status, count(*) AS channel_count
FROM public.mating_introduction_channels
GROUP BY status
ORDER BY status;

-- 2b) By freeze_reason (all statuses)
SELECT coalesce(freeze_reason, '(null)') AS freeze_reason, count(*) AS channel_count
FROM public.mating_introduction_channels
GROUP BY freeze_reason
ORDER BY channel_count DESC, freeze_reason;

-- 2c) status x freeze_reason
SELECT status, coalesce(freeze_reason, '(null)') AS freeze_reason, count(*) AS channel_count
FROM public.mating_introduction_channels
GROUP BY status, freeze_reason
ORDER BY status, freeze_reason;

-- 3) open / frozen / other
SELECT
  count(*) FILTER (WHERE status = 'open') AS open_channels,
  count(*) FILTER (WHERE status = 'frozen') AS frozen_channels,
  count(*) FILTER (WHERE status NOT IN ('open', 'frozen')) AS other_status_channels
FROM public.mating_introduction_channels;

-- 4) Non-open channels with message counts
SELECT
  c.id AS channel_id,
  c.pet_low_id,
  c.pet_high_id,
  c.owner_low_id,
  c.owner_high_id,
  c.status,
  c.freeze_reason,
  c.opened_at,
  c.frozen_at,
  count(m.id) AS message_count
FROM public.mating_introduction_channels c
LEFT JOIN public.mating_introduction_messages m ON m.channel_id = c.id
WHERE c.status <> 'open'
GROUP BY c.id, c.pet_low_id, c.pet_high_id, c.owner_low_id, c.owner_high_id,
         c.status, c.freeze_reason, c.opened_at, c.frozen_at
ORDER BY c.frozen_at DESC NULLS LAST, c.opened_at DESC;

-- 5) Total messages
SELECT count(*) AS total_messages FROM public.mating_introduction_messages;

-- 6) Messages by channel status + orphans
SELECT
  count(*) FILTER (WHERE c.status = 'open') AS messages_on_open_channels,
  count(*) FILTER (WHERE c.status = 'frozen') AS messages_on_frozen_channels,
  count(*) FILTER (WHERE c.status IS NOT NULL AND c.status NOT IN ('open', 'frozen')) AS messages_on_other_status_channels,
  count(*) FILTER (WHERE c.id IS NULL) AS orphaned_messages
FROM public.mating_introduction_messages m
LEFT JOIN public.mating_introduction_channels c ON c.id = m.channel_id;

-- 7) Messages on non-open channels (privacy violation candidates)
SELECT
  c.id AS channel_id,
  c.status,
  c.freeze_reason,
  count(m.id) AS message_count
FROM public.mating_introduction_channels c
INNER JOIN public.mating_introduction_messages m ON m.channel_id = c.id
WHERE c.status <> 'open'
GROUP BY c.id, c.status, c.freeze_reason
ORDER BY message_count DESC, c.id;

-- 8) Duplicate channels for same ordered pet pair
SELECT pet_low_id, pet_high_id, count(*) AS channel_rows, array_agg(id ORDER BY opened_at) AS channel_ids
FROM public.mating_introduction_channels
GROUP BY pet_low_id, pet_high_id
HAVING count(*) > 1
ORDER BY channel_rows DESC;

-- 9) Channels with messages but NO mutual Paw
SELECT
  c.id AS channel_id,
  c.status,
  c.freeze_reason,
  c.pet_low_id,
  c.pet_high_id,
  count(m.id) AS message_count,
  public.pets_have_mutual_paw(c.pet_low_id, c.pet_high_id) AS has_mutual_paw
FROM public.mating_introduction_channels c
LEFT JOIN public.mating_introduction_messages m ON m.channel_id = c.id
GROUP BY c.id, c.status, c.freeze_reason, c.pet_low_id, c.pet_high_id
HAVING count(m.id) > 0
   AND NOT public.pets_have_mutual_paw(c.pet_low_id, c.pet_high_id)
ORDER BY message_count DESC, c.id;

-- 10) Channels for blocked pet pairs
SELECT
  c.id AS channel_id,
  c.status,
  c.freeze_reason,
  c.pet_low_id,
  c.pet_high_id,
  count(m.id) AS message_count
FROM public.mating_introduction_channels c
LEFT JOIN public.mating_introduction_messages m ON m.channel_id = c.id
WHERE EXISTS (
  SELECT 1 FROM public.pet_blocks b
  WHERE (b.blocker_user_id = c.owner_low_id AND b.blocked_pet_id = c.pet_high_id)
     OR (b.blocker_user_id = c.owner_high_id AND b.blocked_pet_id = c.pet_low_id)
)
GROUP BY c.id, c.status, c.freeze_reason, c.pet_low_id, c.pet_high_id
ORDER BY c.status, c.id;

-- 11) Channels involving pets opted out of Mating
SELECT
  c.id AS channel_id,
  c.status,
  c.freeze_reason,
  c.pet_low_id,
  c.pet_high_id,
  pl.is_looking_for_companion AS low_opted_in,
  ph.is_looking_for_companion AS high_opted_in,
  count(m.id) AS message_count
FROM public.mating_introduction_channels c
INNER JOIN public.pets pl ON pl.id = c.pet_low_id
INNER JOIN public.pets ph ON ph.id = c.pet_high_id
LEFT JOIN public.mating_introduction_messages m ON m.channel_id = c.id
WHERE pl.is_looking_for_companion IS NOT TRUE
   OR ph.is_looking_for_companion IS NOT TRUE
GROUP BY c.id, c.status, c.freeze_reason, c.pet_low_id, c.pet_high_id,
         pl.is_looking_for_companion, ph.is_looking_for_companion
ORDER BY c.status, c.id;

-- Step 7D sanity: deployment objects still present
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'mating_teardown_channel_for_pair',
    'list_my_introduction_channels',
    'mating_try_reopen_after_unblock'
  )
ORDER BY proname;
