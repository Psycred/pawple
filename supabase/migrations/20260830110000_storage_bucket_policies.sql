-- PAW-45 / Honesty & Safety: version-control Storage policies for moments + pet-photos.
--
-- Matches live Dashboard intent previously documented only in src/lib/supabase.js:
--   - owner-scoped INSERT / UPDATE / DELETE (first path segment = auth.uid())
--   - public SELECT so React Native Image can load getPublicUrl() object URLs
--
-- Beta residual (accepted): buckets remain public and SELECT is open. Public object
-- URLs bypass authenticated-only media gating for rendering. Owner-scoped writes
-- still prevent cross-user upload/overwrite/delete. Tightening to private buckets
-- + signed URLs is a future CTO-scoped change, not this ticket.
--
-- Do NOT ALTER TABLE storage.objects (Supabase blocks ownership changes).
-- Idempotent: recreates canonical policy names; drops any prior storage.objects
-- policies so Dashboard duplicates cannot OR-widen write access.

-- ---------------------------------------------------------------------------
-- 1) Ensure canonical buckets exist (public = live Image / getPublicUrl contract)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('moments', 'moments', true),
  ('pet-photos', 'pet-photos', true)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  name = EXCLUDED.name;

-- file_size_limit exists on real Supabase; bootstrap stub may omit the column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
      AND column_name = 'file_size_limit'
  ) THEN
    EXECUTE $u$
      UPDATE storage.buckets
      SET file_size_limit = 5242880
      WHERE id IN ('moments', 'pet-photos')
    $u$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Replace prior storage.objects policies with version-controlled set
--    Pawple Beta uses only moments + pet-photos; wipe-and-recreate avoids
--    Dashboard policy names OR-widening owner-scoped writes.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- RLS is on by default in Supabase Storage; enable when missing (local bootstrap).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  ) THEN
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    -- Real Supabase may deny ALTER; RLS is already enabled there.
    NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 3) moments — owner writes; public read (Beta residual)
-- ---------------------------------------------------------------------------
CREATE POLICY moments_storage_select_public
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'moments');

CREATE POLICY moments_storage_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'moments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

CREATE POLICY moments_storage_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'moments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'moments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

CREATE POLICY moments_storage_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'moments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- 4) pet-photos — owner writes; public read (Beta residual)
-- ---------------------------------------------------------------------------
CREATE POLICY pet_photos_storage_select_public
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'pet-photos');

CREATE POLICY pet_photos_storage_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

CREATE POLICY pet_photos_storage_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

CREATE POLICY pet_photos_storage_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

COMMENT ON POLICY moments_storage_insert_own ON storage.objects IS
  'PAW-45: authenticated owners may upload only under {auth.uid()}/ in moments.';

COMMENT ON POLICY moments_storage_select_public ON storage.objects IS
  'PAW-45 Beta residual: public SELECT for getPublicUrl / Image rendering. Not authenticated-only media.';

COMMENT ON POLICY pet_photos_storage_insert_own ON storage.objects IS
  'PAW-45: authenticated owners may upload only under {auth.uid()}/ in pet-photos.';

COMMENT ON POLICY pet_photos_storage_select_public ON storage.objects IS
  'PAW-45 Beta residual: public SELECT for getPublicUrl / Image rendering. Not authenticated-only media.';
