-- Meetup Step 6: creator-authored city + About (description).
-- Run in Supabase SQL Editor if meetup cards still show profile city
-- or About text is not saving.
--
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE).

ALTER TABLE public.meetups
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.meetups.description IS
  'Optional creator-written context shown in the Meetup About section.';

COMMENT ON COLUMN public.meetups.city IS
  'Creator-selected Meetup locality used for relevant Feed discovery.';

-- PAW-96 originally replaced every Meetup city with profiles.city and made it
-- immutable. Step 6 makes the Meetup form city authoritative.
CREATE OR REPLACE FUNCTION public.meetups_apply_creator_city()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.city := btrim(coalesce(NEW.city, ''));
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.meetups_apply_creator_city() IS
  'Normalizes the creator-supplied Meetup city without reading profiles.city.';
