-- Moment caption is optional: empty compose saves NULL (photo + pet + date remain required).
-- Aligns live schema with base_schema intent and client insert payload (caption?.trim() || null).

ALTER TABLE public.moments
  ALTER COLUMN caption DROP NOT NULL;

COMMENT ON COLUMN public.moments.caption IS
  'Optional handwritten caption. NULL when the member leaves caption empty.';
