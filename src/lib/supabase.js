/**
 * =====================================================================
 * SUPABASE STORAGE POLICIES (PAW-45)
 * =====================================================================
 * Source of truth: supabase/migrations/20260830110000_storage_bucket_policies.sql
 * Do not reconfigure these in the Dashboard unless intentionally overriding;
 * prefer updating the migration so environments stay reproducible.
 *
 * Buckets: moments, pet-photos
 * Path convention: `${userId}/${Date.now()}.<ext>` (first folder = auth.uid())
 *
 * Owner-scoped writes (authenticated):
 *   INSERT / UPDATE / DELETE when (storage.foldername(name))[1] = auth.uid()::text
 *
 * Beta residual (accepted):
 *   Buckets are public; SELECT is open so Image can load getPublicUrl() URLs.
 *   Public object URLs are not authenticated-only media. Owner-scoped writes
 *   still block cross-user upload/overwrite/delete.
 *
 * Bucket settings (migration): public ON; file_size_limit 5 MB when column exists.
 * =====================================================================
 */

/** App-wide Supabase client (re-export for screens/lib that prefer `src/lib`). */
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';

export { supabase };

const DEFAULT_BUCKET = 'moments';

/**
 * [FLOW] Step 4 — Upload a processed image to Supabase Storage and return its public URL.
 * One upload per moment. Path: `${userId}/${Date.now()}.<ext>`.
 *
 * @param {{ base64: string, extension?: string, contentType?: string }} processed
 * @param {string} userId
 * @param {string} [bucket]
 */
export async function uploadToSupabase(processed, userId, bucket = DEFAULT_BUCKET) {
  const { base64, extension = 'jpg', contentType = 'image/jpeg' } = processed ?? {};
  if (!base64) {
    throw new Error('Processed image missing data');
  }

  const filePath = `${userId}/${Date.now()}.${extension}`;
  const uploadResponse = await supabase.storage.from(bucket).upload(filePath, decode(base64), {
    contentType,
    upsert: false,
  });
  console.log('[Moment] storage.upload response', {
    bucket,
    filePath,
    data: uploadResponse.data,
    error: uploadResponse.error,
  });

  if (uploadResponse.error) {
    console.error('[Moment] storage.upload error', {
      message: uploadResponse.error?.message,
      code: uploadResponse.error?.statusCode ?? uploadResponse.error?.code,
      error: uploadResponse.error,
    });
    throw uploadResponse.error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}
