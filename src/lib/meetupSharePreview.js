import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../config/supabase';

import { SHARE_PREVIEWS_BUCKET } from './storageMedia';

const MOMENTS_BUCKET = SHARE_PREVIEWS_BUCKET;

/**
 * Upload a captured meetup share card so link previews can use it as og:image.
 * Path: {userId}/meetup-share/{meetupId}.png (owner-scoped, public read).
 */
export async function uploadMeetupSharePreview(userId, meetupId, localFileUri) {
  const ownerId = String(userId ?? '').trim();
  const id = String(meetupId ?? '').trim();
  const uri = String(localFileUri ?? '').trim();

  if (!ownerId || !id || !uri) {
    throw new Error('Missing meetup share preview upload inputs.');
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const filePath = `${ownerId}/meetup-share/${id}.png`;
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
