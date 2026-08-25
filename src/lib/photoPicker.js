import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { openAppSettings } from './permissions';

const DEFAULT_GALLERY_OPTIONS = {
  allowsEditing: true,
  quality: 0.85,
};

function hasGalleryAccess(permission) {
  return permission?.granted === true || permission?.accessPrivileges === 'limited';
}

function showGalleryPermissionAlert() {
  Alert.alert(
    'Photos',
    'Photo access is needed to choose a picture. You can continue without one or enable access in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: openAppSettings },
    ],
  );
}

/**
 * Resolve the current gallery permission without launching the picker.
 * Limited access is valid because the user can still choose an approved photo.
 */
export async function resolveGalleryPermission() {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (hasGalleryAccess(current)) {
    return { granted: true, canAskAgain: current?.canAskAgain !== false };
  }

  if (current?.status === 'undetermined' || current?.canAskAgain !== false) {
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return {
      granted: hasGalleryAccess(requested),
      canAskAgain: requested?.canAskAgain !== false,
    };
  }

  return { granted: false, canAskAgain: false };
}

/**
 * Canonical app-wide gallery picker.
 * Returns the Expo picker result after selection, or null for cancellation/denial.
 */
export async function pickFromGallery(options = {}) {
  try {
    const permission = await resolveGalleryPermission();
    if (!permission.granted) {
      showGalleryPermissionAlert();
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      ...DEFAULT_GALLERY_OPTIONS,
      ...options,
      // Expo SDK 52 expects the MediaType string union, not ImagePicker.MediaType.
      mediaTypes: ['images'],
    });

    if (result.canceled) {
      return null;
    }

    if (!result.assets?.[0]?.uri) {
      Alert.alert('Photo', 'No photo was returned. Please choose another image.');
      return null;
    }

    return result;
  } catch (error) {
    console.error('[PhotoPicker]', error);
    Alert.alert('Photo', 'The photo library could not be opened. Please try again.');
    return null;
  }
}
