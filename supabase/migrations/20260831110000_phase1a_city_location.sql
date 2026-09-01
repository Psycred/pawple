-- PAW-96: Phase 1a city-only location downgrade (bulletin board surfaces).
-- Mating domain unchanged: profiles.last_location_* retained for server-side haversine RPCs.
--
-- Binding: docs/PAWPLE_PHASE1A_CTO_ARCHITECTURE.md §3.2, PAW-81 location audit.

-- ---------------------------------------------------------------------------
-- 1) meetups.city — canonical bulletin-board locality (denormalized at create)
-- ---------------------------------------------------------------------------
ALTER TABLE public.meetups
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.meetups.city IS
  'Bulletin-board locality: creator profiles.city at insert (immutable). Used for same-city meetup discovery. Not client-supplied.';

UPDATE public.meetups m
SET city = coalesce(btrim(p.city), '')
FROM public.profiles p
WHERE p.id = m.user_id
  AND btrim(coalesce(m.city, '')) = '';

CREATE INDEX IF NOT EXISTS meetups_city_normalized_idx
  ON public.meetups (lower(btrim(city)));

-- ---------------------------------------------------------------------------
-- 2) Server trigger — meetups.city from creator profile at insert; immutable after
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.meetups_apply_creator_city()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT coalesce(btrim(p.city), '')
    INTO v_city
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

    NEW.city := coalesce(v_city, '');
  ELSIF TG_OP = 'UPDATE' THEN
    -- Preserve publish-time city; block client-supplied city changes.
    NEW.city := OLD.city;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.meetups_apply_creator_city() IS
  'PAW-96: Sets meetups.city from creator profiles.city on INSERT; immutable on UPDATE.';

DROP TRIGGER IF EXISTS trg_meetups_apply_creator_city ON public.meetups;
CREATE TRIGGER trg_meetups_apply_creator_city
  BEFORE INSERT OR UPDATE ON public.meetups
  FOR EACH ROW
  EXECUTE FUNCTION public.meetups_apply_creator_city();

-- ---------------------------------------------------------------------------
-- 3) Belt-and-suspenders — strip bulletin coord writes (moments + meetups)
--    Mating continues via profiles.last_location_* (unchanged).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.strip_bulletin_surface_coords()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'moments' THEN
    NEW.location_lat := NULL;
    NEW.location_lng := NULL;
  ELSIF TG_TABLE_NAME = 'meetups' THEN
    NEW.location_lat := NULL;
    NEW.location_lng := NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.strip_bulletin_surface_coords() IS
  'PAW-96: Nulls device coords on moments/meetups writes. Mating uses profiles.last_location_* only.';

DROP TRIGGER IF EXISTS trg_moments_strip_bulletin_coords ON public.moments;
CREATE TRIGGER trg_moments_strip_bulletin_coords
  BEFORE INSERT OR UPDATE ON public.moments
  FOR EACH ROW
  EXECUTE FUNCTION public.strip_bulletin_surface_coords();

DROP TRIGGER IF EXISTS trg_meetups_strip_bulletin_coords ON public.meetups;
CREATE TRIGGER trg_meetups_strip_bulletin_coords
  BEFORE INSERT OR UPDATE ON public.meetups
  FOR EACH ROW
  EXECUTE FUNCTION public.strip_bulletin_surface_coords();

-- ---------------------------------------------------------------------------
-- 4) Revoke client SELECT on bulletin coord columns (mirror profiles.last_location_*)
-- ---------------------------------------------------------------------------
REVOKE SELECT (
  location_lat,
  location_lng
) ON public.moments FROM authenticated;

REVOKE SELECT (
  location_lat,
  location_lng
) ON public.moments FROM anon;

REVOKE SELECT (
  location_lat,
  location_lng
) ON public.meetups FROM authenticated;

REVOKE SELECT (
  location_lat,
  location_lng
) ON public.meetups FROM anon;

COMMENT ON COLUMN public.moments.location_lat IS
  'Legacy device latitude (deprecated PAW-96). Stripped on write; not selectable by authenticated/anon.';
COMMENT ON COLUMN public.moments.location_lng IS
  'Legacy device longitude (deprecated PAW-96). Stripped on write; not selectable by authenticated/anon.';
COMMENT ON COLUMN public.meetups.location_lat IS
  'Legacy meetup latitude (deprecated PAW-96). Stripped on write; not selectable by authenticated/anon.';
COMMENT ON COLUMN public.meetups.location_lng IS
  'Legacy meetup longitude (deprecated PAW-96). Stripped on write; not selectable by authenticated/anon.';
