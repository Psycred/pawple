-- Step 3B: preserve report rows when the filing pet is deleted.
-- Canonical FK name from inline REFERENCES in 20260830100000_honesty_safety_rls_visibility.sql:
--   reports_reporter_pet_id_fkey

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reporter_pet_id_fkey;

ALTER TABLE public.reports
  ALTER COLUMN reporter_pet_id DROP NOT NULL;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_reporter_pet_id_fkey
  FOREIGN KEY (reporter_pet_id)
  REFERENCES public.pets (id)
  ON DELETE SET NULL;
