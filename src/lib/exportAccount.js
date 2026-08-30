import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../config/supabase';

/**
 * Server-controlled data export (Product Contract §10).
 * Returns the canonical JSON archive from export_user_data RPC.
 */
export async function exportUserData() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }

  const { data, error } = await supabase.rpc('export_user_data');
  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  if (!data?.ok) {
    throw new Error('Data export did not complete');
  }

  return data;
}

/**
 * Writes the export payload to a JSON file and opens the system share sheet.
 * No email delivery — the user saves or shares from this device.
 */
export async function shareUserDataExport(payload) {
  const exportedAt = payload?.exported_at ?? new Date().toISOString();
  const safeStamp = String(exportedAt).replace(/[:.]/g, '-');
  const fileUri = `${FileSystem.cacheDirectory}pawple-export-${safeStamp}.json`;
  const json = JSON.stringify(payload, null, 2);

  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your Pawple data',
    UTI: 'public.json',
  });

  return fileUri;
}
