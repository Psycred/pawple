import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Best-effort settings deep-link with safe fallback.
 */
export async function openAppSettings() {
  try {
    await Linking.openSettings();
  } catch (_error) {
    Alert.alert('Permissions', 'Please open system settings and enable access for Pawple.');
  }
}

/**
 * JIT camera permission request for pet photos/posts.
 */
export async function requestCameraPermissionJIT() {
  try {
    const result = await ImagePicker.requestCameraPermissionsAsync();
    return result?.granted === true;
  } catch (_error) {
    return false;
  }
}

/**
 * JIT location permission request for nearby pet-parent discovery.
 * Delegates to the centralized location manager.
 */
export async function requestLocationPermissionJIT() {
  try {
    const { getLocationPermissionState, getValidLocation } = await import('./locationManager');
    const { status } = await getLocationPermissionState();
    if (status === 'granted') {
      return true;
    }
    const result = await getValidLocation({ requestIfNeeded: true, preferCache: true });
    return result.status === 'granted';
  } catch (_error) {
    return false;
  }
}

