import * as Location from 'expo-location';

/** True when foreground location is granted ("while using the app"). */
export async function isForegroundLocationGranted() {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    return current?.status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Surface the native OS location sheet when access is missing.
 * Never shows a Pawple permission dialog — the OS owns permission UX.
 */
export async function requestForegroundLocationGranted() {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current?.status === 'granted') {
      return true;
    }
    const requested = await Location.requestForegroundPermissionsAsync();
    return requested?.status === 'granted';
  } catch (error) {
    console.log('[LocationPermission] request failed:', error?.message ?? error);
    return false;
  }
}
