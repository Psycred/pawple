import { uploadToSupabase } from './supabase';
import { processImageForPetPhoto } from '../services/imageProcessor';
import { getRegisteredPhotoValidator } from '../contexts/PhotoValidationContext';
import { assertLocalPhotoPassesGate } from './photoValidationGate';
import { isLocalPhotoUri, isRemotePhotoUrl } from './photoUri';

/** Owner-scoped bucket — path `{auth.uid()}/…` per Product Contract. */
export const PET_PHOTOS_BUCKET = 'pet-photos';

export { isLocalPhotoUri, isRemotePhotoUrl };

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

  const validatePhoto = getRegisteredPhotoValidator();
  await assertLocalPhotoPassesGate(trimmed, {
    ready: Boolean(validatePhoto),
    validatePhoto,
  });

  console.log('[PetPhoto] Upload starting', { userId });
  const processed = await processImageForPetPhoto(trimmed);
  const publicUrl = await uploadToSupabase(processed, userId, PET_PHOTOS_BUCKET);
  console.log('[PetPhoto] Upload success', { publicUrl });
  return publicUrl;
}
