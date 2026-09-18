export const SHARE_PREVIEWS_BUCKET = 'share-previews';
export const MOMENTS_BUCKET = 'moments';
export const PET_PHOTOS_BUCKET = 'pet-photos';

/**
 * Parse a Supabase Storage object reference from a stored URL or path.
 * @returns {{ bucket: string, path: string } | null}
 */
export function parseSupabaseStorageReference(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  const publicMatch = raw.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i);
  if (publicMatch) {
    return { bucket: publicMatch[1], path: publicMatch[2] };
  }

  const signedMatch = raw.match(/\/storage\/v1\/object\/sign\/([^/]+)\/([^?]+)/i);
  if (signedMatch) {
    return { bucket: signedMatch[1], path: signedMatch[2] };
  }

  const bucketPathMatch = raw.match(/^([^:]+):(.+)$/);
  if (bucketPathMatch) {
    return { bucket: bucketPathMatch[1], path: bucketPathMatch[2] };
  }

  return null;
}

export function buildStorageObjectReference(bucket, path) {
  return `${bucket}:${path}`;
}

/**
 * Upload/replace time for the current profile photo from its Storage path filename.
 * Pawple convention: `{ownerId}/{Date.now()}.{ext}` — see src/lib/supabase.js.
 * @param {string|null|undefined} photoUrl
 * @returns {string|null} ISO timestamp
 */
export function profilePhotoDateFromStorageUrl(photoUrl) {
  const parsed = parseSupabaseStorageReference(photoUrl);
  if (!parsed?.path) {
    return null;
  }

  const filename = String(parsed.path).split('/').pop() ?? '';
  const stem = filename.includes('.') ? filename.slice(0, filename.lastIndexOf('.')) : filename;
  if (!/^\d{10,}$/.test(stem)) {
    return null;
  }

  const uploadedAtMs = Number(stem);
  if (!Number.isFinite(uploadedAtMs)) {
    return null;
  }

  return new Date(uploadedAtMs).toISOString();
}
