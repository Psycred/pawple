import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const LOCATION_KEY = 'pawple_cached_location';
/** Legacy key from Step 1 — still read so existing installs keep their cache. */
const LEGACY_LOCATION_KEY = 'pawple_device_location';

/** Fresh-enough cache for JIT reads (1 hour). */
const DEFAULT_CACHE_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * @typedef {Object} LocationCoords
 * @property {number} latitude
 * @property {number} longitude
 * @property {string} [capturedAt] ISO timestamp
 */

/**
 * @typedef {Object} LocationResult
 * @property {'granted'|'denied'|'error'} status
 * @property {LocationCoords|null} coords
 * @property {string} message
 * @property {Location.PermissionStatus} [permissionStatus]
 */

function normalizeCoords(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    latitude,
    longitude,
    capturedAt: raw.capturedAt ?? new Date().toISOString(),
  };
}

async function readCache(maxAgeMs = DEFAULT_CACHE_MAX_AGE_MS) {
  for (const key of [LOCATION_KEY, LEGACY_LOCATION_KEY]) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {
        continue;
      }
      const parsed = normalizeCoords(JSON.parse(raw));
      if (!parsed) {
        continue;
      }
      if (maxAgeMs > 0 && parsed.capturedAt) {
        const age = Date.now() - new Date(parsed.capturedAt).getTime();
        if (Number.isNaN(age) || age > maxAgeMs) {
          continue;
        }
      }
      return parsed;
    } catch (e) {
      console.log('[LocationManager] cache read failed:', e?.message);
    }
  }
  return null;
}

async function writeCache(coords) {
  const payload = normalizeCoords(coords);
  if (!payload) {
    return null;
  }
  await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(payload));
  return payload;
}

/** Current foreground permission (no prompt). */
export async function getLocationPermissionState() {
  try {
    const result = await Location.getForegroundPermissionsAsync();
    return {
      status: result.status,
      canAskAgain: result.canAskAgain ?? true,
    };
  } catch (e) {
    console.log('[LocationManager] getLocationPermissionState failed:', e?.message);
    return { status: 'undetermined', canAskAgain: true };
  }
}

/** Explicit foreground permission request from a deliberate user action. */
export async function requestLocationPermission() {
  try {
    const result = await Location.requestForegroundPermissionsAsync();
    return {
      status: result.status,
      canAskAgain: result.canAskAgain ?? true,
    };
  } catch (e) {
    console.log('[LocationManager] requestLocationPermission failed:', e?.message);
    return { status: 'undetermined', canAskAgain: true };
  }
}

/**
 * Explicit user-tap consent (e.g. settings or future pre-prompt UI).
 * Never call during auth/signup — only from deliberate user actions in-app.
 *
 * @returns {{ granted: boolean, coords: LocationCoords|null }}
 */
export async function captureLocationOnUserConsent() {
  const result = await getValidLocation({
    reason: 'to show nearby pet moments and events',
    requestIfNeeded: true,
    preferCache: false,
    maxCacheAgeMs: 0,
  });
  return {
    granted: result.status === 'granted' && result.coords != null,
    coords: result.coords,
  };
}

/**
 * JIT location for CreateMoment, Events, etc.
 * Uses cache when valid; requests permission only when undetermined; never re-prompts if denied.
 *
 * @param {object} [options]
 * @param {string} [options.reason] Human-readable reason (for future UI).
 * @param {boolean} [options.requestIfNeeded] Request OS dialog when status is undetermined.
 * @param {boolean} [options.preferCache] Try cache before GPS when permission is granted.
 * @param {number} [options.maxCacheAgeMs] Max cache age; 0 = ignore cache age.
 * @returns {Promise<LocationResult>}
 */
export async function getValidLocation(options = {}) {
  const {
    reason = 'to enhance your experience',
    requestIfNeeded = true,
    preferCache = true,
    maxCacheAgeMs = DEFAULT_CACHE_MAX_AGE_MS,
  } = options;

  try {
    let permission = await Location.getForegroundPermissionsAsync();

    if (permission.status !== 'granted' && requestIfNeeded) {
      permission = await Location.requestForegroundPermissionsAsync();
    }

    if (permission.status !== 'granted') {
      const staleCache = preferCache ? await readCache(maxCacheAgeMs) : null;
      if (staleCache) {
        return {
          status: 'granted',
          coords: staleCache,
          message: 'Cached location (permission not currently granted)',
          permissionStatus: permission.status,
        };
      }
      const deniedMessage =
        permission.status === 'denied'
          ? 'Permission denied. Enable location in Settings.'
          : 'Permission not granted.';
      return {
        status: 'denied',
        coords: null,
        message: deniedMessage,
        permissionStatus: permission.status,
      };
    }

    if (preferCache) {
      const cached = await readCache(maxCacheAgeMs);
      if (cached) {
        return {
          status: 'granted',
          coords: cached,
          message: 'Cached location',
          permissionStatus: permission.status,
        };
      }
    }

    const servicesOn = await Location.hasServicesEnabledAsync();
    if (!servicesOn) {
      return {
        status: 'error',
        coords: null,
        message: 'Location services are turned off on this device.',
        permissionStatus: permission.status,
      };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: false,
      timeInterval: 3000,
    });

    const coords = await writeCache({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      capturedAt: new Date().toISOString(),
    });

    return {
      status: 'granted',
      coords,
      message: 'Fresh location',
      permissionStatus: permission.status,
    };
  } catch (error) {
    // Non-fatal: log quietly (console.warn avoids the dev red-error overlay) and
    // fall back to cache or a null-coords result so the app stays usable.
    console.warn('[LocationManager] GPS fetch failed (continuing without location):', error?.message ?? error);
    const fallback = preferCache ? await readCache(maxCacheAgeMs) : null;
    if (fallback) {
      return {
        status: 'granted',
        coords: fallback,
        message: 'Cached location (GPS unavailable)',
      };
    }
    return {
      status: 'error',
      coords: null,
      message: 'Location unavailable.',
    };
  }
}

/** Read cache only — no permission prompt, no GPS. */
export async function getCachedLocation(maxAgeMs = DEFAULT_CACHE_MAX_AGE_MS) {
  return readCache(maxAgeMs);
}

export async function clearCachedLocation() {
  try {
    await AsyncStorage.multiRemove([LOCATION_KEY, LEGACY_LOCATION_KEY]);
  } catch (e) {
    console.log('[LocationManager] clearCachedLocation failed:', e?.message);
  }
}
