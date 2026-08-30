import { uploadToSupabase } from './supabase';
import { processImageForPetPhoto } from '../services/imageProcessor';

/** Owner-scoped bucket — path `{auth.uid()}/…` per Product Contract. */
export const PET_PHOTOS_BUCKET = 'pet-photos';

export function isRemotePhotoUrl(uri) {
  if (typeof uri !== 'string') {
    return false;
  }
  const trimmed = uri.trim();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

export function isLocalPhotoUri(uri) {
  if (typeof uri !== 'string') {
    return false;
  }
  const trimmed = uri.trim();
  return trimmed.startsWith('file://') || trimmed.startsWith('content://');
}

/**
 * Returns a durable public Storage URL for a pet profile photo.
 * Remote URLs are returned unchanged; local picker URIs are uploaded first.
 */
export async function resolvePetPhotoUrl(photoUri, userId) {
  if (photoUri == null || typeof photoUri !== 'string') {
    return null;
  }

  const trimmed = photoUri.trim();
  if (!trimmed) {
    return null;
  }

  if (isRemotePhotoUrl(trimmed)) {
    return trimmed;
  }

  if (!isLocalPhotoUri(trimmed)) {
    return null;
  }

  if (!userId) {
    throw new Error('User required to upload pet photo');
  }

  console.log('[PetPhoto] Upload starting', { userId });
  const processed = await processImageForPetPhoto(trimmed);
  const publicUrl = await uploadToSupabase(processed, userId, PET_PHOTOS_BUCKET);
  console.log('[PetPhoto] Upload success', { publicUrl });
  return publicUrl;
}
