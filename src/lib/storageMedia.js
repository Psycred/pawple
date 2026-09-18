import { supabase } from '../config/supabase';
import {
  buildStorageObjectReference,
  MOMENTS_BUCKET,
  parseSupabaseStorageReference,
  PET_PHOTOS_BUCKET,
  SHARE_PREVIEWS_BUCKET,
} from './storageMediaParse';

export {
  buildStorageObjectReference,
  MOMENTS_BUCKET,
  PET_PHOTOS_BUCKET,
  parseSupabaseStorageReference,
  SHARE_PREVIEWS_BUCKET,
};

const SIGNED_URL_TTL_SEC = 3600;
const signedUrlCache = new Map();

function isLocalOrExternalUri(uri) {
  const value = String(uri ?? '').trim();
  if (!value) {
    return true;
  }
  if (value.startsWith('file:') || value.startsWith('data:') || value.startsWith('content:')) {
    return true;
  }
  if (!value.includes('/storage/v1/object/') && !value.includes(':')) {
    return true;
  }
  return false;
}

function getCachedSignedUrl(cacheKey) {
  const cached = signedUrlCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now() + 60_000) {
    signedUrlCache.delete(cacheKey);
    return null;
  }
  return cached.url;
}

/**
 * Resolve a stored media URL to a fetchable URI.
 * - Local URIs pass through unchanged.
 * - share-previews remain public.
 * - moments / pet-photos use short-lived signed URLs for signed-in users.
 */
export async function resolveStorageMediaUrl(uri) {
  const value = String(uri ?? '').trim();
  if (!value || isLocalOrExternalUri(value)) {
    return value || null;
  }

  const parsed = parseSupabaseStorageReference(value);
  if (!parsed?.bucket || !parsed?.path) {
    return value;
  }

  if (parsed.bucket === SHARE_PREVIEWS_BUCKET) {
    const { data } = supabase.storage.from(parsed.bucket).getPublicUrl(parsed.path);
    return data?.publicUrl ?? value;
  }

  const cacheKey = `${parsed.bucket}:${parsed.path}`;
  const cached = getCachedSignedUrl(cacheKey);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, SIGNED_URL_TTL_SEC);

  if (error || !data?.signedUrl) {
    console.error('[Supabase]', error);
    return value;
  }

  signedUrlCache.set(cacheKey, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SEC * 1000,
  });
  return data.signedUrl;
}

export function clearSignedUrlCache() {
  signedUrlCache.clear();
}
