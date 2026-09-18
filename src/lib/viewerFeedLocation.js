import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { resolveCityFromCoords } from './cityFromLocation';
import { fetchApproximateCoords } from './profileLocation';

/** Device-local cache for feed proximity sort — never read from profiles (Wave 5 §2). */
const VIEWER_FEED_LOCATION_KEY = '@pawple/viewer_feed_location_v1';

/** Coalesce concurrent foreground refreshes into a single GPS read. */
let refreshInFlight = null;

/**
 * Cache rounded viewer coords captured on About You Continue.
 * Used only for client-side nearest-first ordering; not shared with other users.
 */
export async function cacheViewerFeedLocation(coords, city) {
  try {
    const payload = {
      city: String(city ?? '').trim() || null,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(VIEWER_FEED_LOCATION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.log('[ViewerFeedLocation] cache failed:', error?.message ?? error);
  }
}

/** @returns {{ city: string|null, latitude: number|null, longitude: number|null } | null} */
export async function readCachedViewerFeedLocation() {
  try {
    const raw = await AsyncStorage.getItem(VIEWER_FEED_LOCATION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const city = String(parsed?.city ?? '').trim() || null;
    const latitude = Number(parsed?.latitude);
    const longitude = Number(parsed?.longitude);
    return {
      city,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    };
  } catch (error) {
    console.log('[ViewerFeedLocation] read failed:', error?.message ?? error);
    return null;
  }
}

/**
 * Silent foreground refresh when location is already granted.
 * Never prompts; best-effort only. Updates the device city/GPS cache used by Meetup Feed.
 */
export async function refreshViewerFeedLocationOnAppOpen() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        return;
      }

      const coords = await fetchApproximateCoords();
      if (!coords) {
        return;
      }

      const city = await resolveCityFromCoords(coords.latitude, coords.longitude);
      await cacheViewerFeedLocation(coords, city);
    } catch (error) {
      console.log('[ViewerFeedLocation] refresh on app open failed:', error?.message ?? error);
    }
  })();

  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}
