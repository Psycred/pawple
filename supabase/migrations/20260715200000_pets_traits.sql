-- Pet personality traits for profile surfaces (JSON array of strings).
-- Example: ["Friendly", "Playful", "Loves Water"]
-- Idempotent — safe to re-run.

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS traits jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.pets.traits IS
  'Selected personality traits as a JSON array of strings, e.g. ["Friendly", "Playful"].';

-- Normalize any legacy nulls if the column existed without a default.
UPDATE public.pets
SET traits = '[]'::jsonb
WHERE traits IS NULL;
