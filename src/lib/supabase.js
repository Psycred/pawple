/**
 * =====================================================================
 * SUPABASE STORAGE POLICIES - PHASE 1 SECURITY CHECKLIST
 * =====================================================================
 * These policies MUST be configured manually in the Supabase Dashboard
 * under Storage -> [Bucket Name] -> Policies.
 *
 * 1. MOMENTS BUCKET:
 *    - INSERT: Target 'authenticated'. WITH CHECK: (storage.foldername(name))[1] = auth.uid()::text
 *    - SELECT: Target 'public' (leave blank if UI requires). USING: true
 *    - DELETE: Target 'authenticated'. USING: (storage.foldername(name))[1] = auth.uid()::text
 *
 * 2. PET-PHOTOS BUCKET:
 *    - INSERT: Target 'authenticated'. WITH CHECK: (storage.foldername(name))[1] = auth.uid()::text
 *    - SELECT: Target 'public' (leave blank if UI requires). USING: true
 *    - DELETE: Target 'authenticated'. USING: (storage.foldername(name))[1] = auth.uid()::text
 *
 * 3. BUCKET SETTINGS (Both Buckets):
 *    - Public bucket: ON (Toggle enabled)
 *    - Restrict file size: ON -> 5242880 bytes (5 MB)
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
