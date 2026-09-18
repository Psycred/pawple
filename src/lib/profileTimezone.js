import { getDeviceIanaTimezone, isValidIanaTimezone } from './meetupReminderTime';
import { supabase } from '../config/supabase';

/**
 * Persist the device's current IANA timezone on profiles.latest_timezone.
 * No location permission — uses Intl only.
 */
export async function saveLatestProfileTimezone(userId, timezone) {
  const trimmed = String(timezone ?? '').trim();
  if (!userId || !isValidIanaTimezone(trimmed)) {
    return false;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id || user.id !== userId) {
      return false;
    }

    const { error } = await supabase.rpc('update_latest_timezone', {
      p_timezone: trimmed,
    });

    if (error) {
      console.warn('[ProfileTimezone] save skipped:', error?.message ?? error);
      return false;
    }

    return true;
  } catch (error) {
    console.log('[ProfileTimezone] saveLatestProfileTimezone failed:', error?.message ?? error);
    return false;
  }
}

/**
 * Read device IANA timezone and overwrite profiles.latest_timezone when it changes.
 * Call on app foreground — non-blocking.
 */
export async function refreshLatestTimezoneOnAppActive(userId) {
  if (!userId) {
    return;
  }

  const timezone = getDeviceIanaTimezone();
  if (!timezone) {
    return;
  }

  await saveLatestProfileTimezone(userId, timezone);
}
