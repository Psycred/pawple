-- Security wave — apply in Supabase SQL Editor (Step 1).
-- Project: run once on linked Supabase project before deploying edge functions / new APK.
-- Idempotent where noted. Prefer `npx supabase db push` when CLI is linked.

-- ---------------------------------------------------------------------------
-- 1) Private media buckets + share-previews (from 20260911120000)
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id IN ('moments', 'pet-photos');

INSERT INTO storage.buckets (id, name, public)
VALUES ('share-previews', 'share-previews', true)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  name = EXCLUDED.name;

DROP POLICY IF EXISTS moments_storage_select_public ON storage.objects;
DROP POLICY IF EXISTS pet_photos_storage_select_public ON storage.objects;

DROP POLICY IF EXISTS moments_storage_select_authenticated ON storage.objects;
CREATE POLICY moments_storage_select_authenticated
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'moments');

DROP POLICY IF EXISTS pet_photos_storage_select_authenticated ON storage.objects;
CREATE POLICY pet_photos_storage_select_authenticated
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'pet-photos');

DROP POLICY IF EXISTS share_previews_storage_select_public ON storage.objects;
CREATE POLICY share_previews_storage_select_public
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'share-previews');

DROP POLICY IF EXISTS share_previews_storage_insert_own ON storage.objects;
CREATE POLICY share_previews_storage_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'share-previews'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS share_previews_storage_update_own ON storage.objects;
CREATE POLICY share_previews_storage_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'share-previews'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'share-previews'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS share_previews_storage_delete_own ON storage.objects;
CREATE POLICY share_previews_storage_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'share-previews'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- 2) Moderation ops queue (from 20260911121000)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.moderation_open_reports AS
SELECT
  r.id,
  r.created_at,
  r.status,
  r.target_type,
  r.target_id,
  r.reason,
  r.details,
  r.reporter_user_id,
  r.reporter_pet_id,
  r.reported_user_id,
  reporter_pet.name AS reporter_pet_name,
  reported_profile.name AS reported_profile_name
FROM public.reports r
LEFT JOIN public.pets reporter_pet ON reporter_pet.id = r.reporter_pet_id
LEFT JOIN public.profiles reported_profile ON reported_profile.id = r.reported_user_id
WHERE r.status = 'open';

REVOKE ALL ON public.moderation_open_reports FROM PUBLIC;
REVOKE ALL ON public.moderation_open_reports FROM anon;
REVOKE ALL ON public.moderation_open_reports FROM authenticated;
GRANT SELECT ON public.moderation_open_reports TO service_role;

CREATE OR REPLACE FUNCTION public.list_open_reports(p_limit integer DEFAULT 50)
RETURNS SETOF public.moderation_open_reports
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.moderation_open_reports
  ORDER BY created_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

REVOKE ALL ON FUNCTION public.list_open_reports(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_open_reports(integer) FROM anon;
REVOKE ALL ON FUNCTION public.list_open_reports(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_reports(integer) TO service_role;
