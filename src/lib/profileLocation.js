import * as Location from 'expo-location';
import { supabase } from '../config/supabase';

/** Coarse / city-level only — never precise GPS. */
export const APPROXIMATE_LOCATION_OPTIONS = {
  accuracy: Location.Accuracy.Balanced,
  mayShowUserSettingsDialog: false,
};

/**
 * Fetch one coarse position snapshot. Call only when permission is already granted.
 * @returns {{ latitude: number, longitude: number } | null}
 */
export async function fetchApproximateCoords() {
  try {
    const position = await Location.getCurrentPositionAsync(APPROXIMATE_LOCATION_OPTIONS);
    const latitude = Number(position?.coords?.latitude);
    const longitude = Number(position?.coords?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    return { latitude, longitude };
  } catch (error) {
    console.log('[ProfileLocation] fetchApproximateCoords failed:', error?.message ?? error);
    return null;
  }
}

/**
 * Overwrite the user's single latest location on profiles — never append history.
 */
export async function saveLatestProfileLocation(userId, coords) {
  if (!userId || !coords) {
    return false;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id || user.id !== userId) {
      return false;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        last_location_lat: coords.latitude,
        last_location_lng: coords.longitude,
        location_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      // Background location save — non-fatal, keep quiet so it never blocks the UI.
      console.warn('[ProfileLocation] location save skipped:', error?.message ?? error);
      return false;
    }

    return true;
  } catch (error) {
    console.log('[ProfileLocation] saveLatestProfileLocation failed:', error?.message ?? error);
    return false;
  }
}

/**
 * Subsequent app opens: silent refresh when granted; native OS dialog only when undetermined.
 * Never shows custom onboarding UI.
 */
export async function refreshProfileLocationOnAppOpen(userId) {
  if (!userId) {
    return;
  }

  try {
    let permission = await Location.getForegroundPermissionsAsync();

    if (permission.status === 'undetermined') {
      permission = await Location.requestForegroundPermissionsAsync();
    }

    if (permission.status !== 'granted') {
      return;
    }

    const coords = await fetchApproximateCoords();
    if (coords) {
      await saveLatestProfileLocation(userId, coords);
      console.log('[ProfileLocation] Silent location refresh on app open');
    }
  } catch (error) {
    console.log('[ProfileLocation] refreshProfileLocationOnAppOpen failed:', error?.message ?? error);
  }
}
