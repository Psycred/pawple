import * as Location from 'expo-location';
import { supabase } from '../config/supabase';

/** Coarse / city-level only — never precise GPS. */
export const APPROXIMATE_LOCATION_OPTIONS = {
  accuracy: Location.Accuracy.Balanced,
  mayShowUserSettingsDialog: false,
};

/** Wave 5 §2: ~1 km grid — admin-only storage, never client-readable. */
export function roundCoordsToApprox(coords, precision = 0.01) {
  if (!coords) {
    return null;
  }
  const latitude = Number(coords.latitude);
  const longitude = Number(coords.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const factor = 1 / precision;
  return {
    latitude: Math.round(latitude * factor) / factor,
    longitude: Math.round(longitude * factor) / factor,
  };
}

/**
 * About You Continue — request foreground permission exactly once when undetermined.
 * Decline/unavailable is non-fatal; never re-prompts from this path.
 */
export async function captureApproximateLocationOnAboutYouContinue() {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== 'granted') {
      return null;
    }
    const coords = await fetchApproximateCoords();
    return roundCoordsToApprox(coords);
  } catch (error) {
    console.log('[ProfileLocation] About You location capture failed:', error?.message ?? error);
    return null;
  }
}

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

    const rounded = roundCoordsToApprox(coords) ?? coords;

    const { error } = await supabase
      .from('profiles')
      .update({
        last_location_lat: rounded.latitude,
        last_location_lng: rounded.longitude,
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
 * Coarse coords for moment publish — read only when OS permission already granted.
 * Never prompts at post time; permission moments own the OS sheet.
 */
export async function captureMomentCoordsIfGranted() {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return null;
    }
    const coords = await fetchApproximateCoords();
    return roundCoordsToApprox(coords);
  } catch (error) {
    console.log('[ProfileLocation] moment coords capture failed:', error?.message ?? error);
    return null;
  }
}

/**
 * Subsequent app opens: silent refresh when granted only.
 * Undetermined → do nothing (first ask is reserved for deliberate user moments).
 */
export async function refreshProfileLocationOnAppOpen(userId) {
  if (!userId) {
    return;
  }

  try {
    const permission = await Location.getForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      return;
    }

    const coords = roundCoordsToApprox(await fetchApproximateCoords());
    if (coords) {
      await saveLatestProfileLocation(userId, coords);
      console.log('[ProfileLocation] Silent location refresh on app open');
    }
  } catch (error) {
    console.log('[ProfileLocation] refreshProfileLocationOnAppOpen failed:', error?.message ?? error);
  }
}
