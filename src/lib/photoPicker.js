import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { resolvePhotoLibraryPermission } from './createMomentPermissions';
import { logPhotoFlow } from './photoFlowDiagnostics';

const DEFAULT_GALLERY_OPTIONS = {
  allowsEditing: true,
  quality: 0.85,
};

function hasGalleryAccess(permission) {
  return permission?.granted === true || permission?.accessPrivileges === 'limited';
}

/**
 * Android 13+ (API 33+) uses the System Photo Picker — broad READ_MEDIA_IMAGES is not required
 * for one-shot picks (Play Photo/Video policy). Do not add a media permission prompt on API 33+
 * merely because Expo's media-library permission object reports "not granted".
 */
function androidUsesSystemPhotoPickerWithoutMediaPermission() {
  return Platform.OS === 'android' && Number(Platform.Version) >= 33;
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

  if (androidUsesSystemPhotoPickerWithoutMediaPermission()) {
    return { granted: true, canAskAgain: true };
  }

  if (current?.status === 'undetermined' || current?.canAskAgain !== false) {
    const status = await resolvePhotoLibraryPermission();
    return {
      granted: status === 'granted',
      canAskAgain: status !== 'blocked',
    };
  }

  return { granted: false, canAskAgain: false };
}

/**
 * Canonical app-wide gallery picker.
 * OS prompt at first add-photo tap — no custom primer.
 * Android 13+ (API 33+): Expo ImagePicker uses the System Photo Picker;
 * broad READ_MEDIA_IMAGES is not required for one-shot pick (Play Photo/Video policy).
 * Do not add a media permission prompt solely because Expo's permission object is unset.
 * Returns the Expo picker result after selection, or null for cancellation/denial.
 */
export async function pickFromGallery(options = {}) {
  logPhotoFlow('pick_from_gallery_start');
  try {
    const permission = await resolveGalleryPermission();
    logPhotoFlow('permission_resolve_return', {
      phase: 'gallery',
      granted: permission.granted,
      canAskAgain: permission.canAskAgain,
    });
    if (!permission.granted) {
      return null;
    }

    logPhotoFlow('native_launch_start', { launcher: 'launchImageLibraryAsync' });
    const launchStartedAt = Date.now();
    const result = await ImagePicker.launchImageLibraryAsync({
      ...DEFAULT_GALLERY_OPTIONS,
      ...options,
      // Expo SDK 52 expects the MediaType string union, not ImagePicker.MediaType.
      mediaTypes: ['images'],
    });
    logPhotoFlow('native_launch_return', {
      launcher: 'launchImageLibraryAsync',
      launchElapsedMs: Date.now() - launchStartedAt,
      canceled: Boolean(result?.canceled),
      assetCount: result?.assets?.length ?? 0,
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
