-- PAW security wave: private media buckets + authenticated read.
-- share-previews stays public for OG cards only (not full-resolution moment photos).

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

CREATE POLICY moments_storage_select_authenticated
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'moments');

CREATE POLICY pet_photos_storage_select_authenticated
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'pet-photos');

CREATE POLICY share_previews_storage_select_public
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'share-previews');

CREATE POLICY share_previews_storage_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'share-previews'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

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

CREATE POLICY share_previews_storage_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'share-previews'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

COMMENT ON POLICY moments_storage_select_authenticated ON storage.objects IS
  'Authenticated community read for private moment media. Anon/public SELECT forbidden.';

COMMENT ON POLICY pet_photos_storage_select_authenticated ON storage.objects IS
  'Authenticated community read for private pet photos. Anon/public SELECT forbidden.';

COMMENT ON POLICY share_previews_storage_select_public ON storage.objects IS
  'Public OG share cards only — not full-resolution moment or pet photos.';
