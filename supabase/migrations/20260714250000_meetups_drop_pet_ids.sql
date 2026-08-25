-- Remove legacy meetups.pet_ids array column (replaced by meetup_hosts junction).
-- Idempotent — safe to re-run on databases that already dropped the column.
--
-- Run after meetup_hosts exists (20260714200000). If that migration never ran,
-- this still backfills hosts before dropping pet_ids.

-- Ensure junction table exists (no-op if already created).
CREATE TABLE IF NOT EXISTS public.meetup_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id uuid NOT NULL REFERENCES public.meetups (id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meetup_hosts_meetup_pet_unique UNIQUE (meetup_id, pet_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meetups'
      AND column_name = 'pet_ids'
  ) THEN
    -- Preserve any legacy host data before dropping the array column.
    INSERT INTO public.meetup_hosts (meetup_id, pet_id)
    SELECT m.id, unnest(m.pet_ids)
    FROM public.meetups m
    WHERE m.pet_ids IS NOT NULL
      AND cardinality(m.pet_ids) > 0
    ON CONFLICT (meetup_id, pet_id) DO NOTHING;

    ALTER TABLE public.meetups DROP COLUMN pet_ids;
  END IF;
END $$;

-- Keep denormalized host_count accurate after backfill.
ALTER TABLE public.meetups
  ADD COLUMN IF NOT EXISTS host_count integer NOT NULL DEFAULT 0;

UPDATE public.meetups m
SET host_count = COALESCE((
  SELECT COUNT(*)::integer
  FROM public.meetup_hosts mh
  WHERE mh.meetup_id = m.id
), 0);

COMMENT ON TABLE public.meetup_hosts IS
  'Pets officially hosting a meetup (one row per host pet). Replaces legacy meetups.pet_ids.';
