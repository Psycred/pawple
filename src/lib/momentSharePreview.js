import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../config/supabase';

import { SHARE_PREVIEWS_BUCKET } from './storageMedia';

const MOMENTS_BUCKET = SHARE_PREVIEWS_BUCKET;

/** Server-side OG cards expire after 24h — see cleanup_expired_share_previews(). */
export const MOMENT_SHARE_PREVIEW_RETENTION_HOURS = 24;

/** Canonical share-previews path for a Moment link-share card. */
export function buildMomentSharePreviewPath(userId, momentId) {
  const ownerId = String(userId ?? '').trim();
  const id = String(momentId ?? '').trim();
  if (!ownerId || !id) {
    return null;
  }
  return `${ownerId}/moment-share/${id}.png`;
}

/**
 * Upload a captured moment share card so link previews can use it as og:image.
 * Path: {userId}/moment-share/{momentId}.png (owner-scoped, public read).
 * Temporary infrastructure — removed after 24 hours or on moment/account delete.
 */
export async function uploadMomentSharePreview(userId, momentId, localFileUri) {
  const ownerId = String(userId ?? '').trim();
  const id = String(momentId ?? '').trim();
  const uri = String(localFileUri ?? '').trim();

  if (!ownerId || !id || !uri) {
    throw new Error('Missing moment share preview upload inputs.');
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const filePath = buildMomentSharePreviewPath(ownerId, id);
  // Remove first so a re-share gets a fresh storage.objects.created_at (upsert preserves it).
  await supabase.storage.from(MOMENTS_BUCKET).remove([filePath]);
  const { error } = await supabase.storage.from(MOMENTS_BUCKET).upload(
    filePath,
    decode(base64),
    {
      contentType: 'image/png',
      upsert: true,
    },
  );

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  const { data } = supabase.storage.from(MOMENTS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/** Best-effort preview cleanup when a Moment is deleted — non-fatal if already absent. */
export async function deleteMomentSharePreview(userId, momentId) {
  const filePath = buildMomentSharePreviewPath(userId, momentId);
  if (!filePath) {
    return;
  }

  const { error } = await supabase.storage.from(MOMENTS_BUCKET).remove([filePath]);
  if (error) {
    console.warn('[MomentSharePreview] preview cleanup skipped:', error.message ?? error);
  }
}
