import * as ImagePicker from 'expo-image-picker';

function hasGalleryAccess(permission) {
  return permission?.granted === true || permission?.accessPrivileges === 'limited';
}

/** Current camera permission without opening an OS prompt. */
export async function getCameraPermissionState() {
  try {
    const current = await ImagePicker.getCameraPermissionsAsync();
    return {
      status: current?.status ?? 'undetermined',
      canAskAgain: current?.canAskAgain ?? true,
    };
  } catch {
    return { status: 'undetermined', canAskAgain: true };
  }
}

/**
 * OS camera prompt at moment of need — no custom primer or Pawple skip dialog.
 * @returns {'granted'|'denied'|'blocked'}
 */
export async function resolveCameraPermission() {
  try {
    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current?.granted) {
      return 'granted';
    }
    const requested = await ImagePicker.requestCameraPermissionsAsync();
    if (requested?.granted) {
      return 'granted';
    }
    if (requested?.canAskAgain === false) {
      return 'blocked';
    }
    return 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * OS photo-library prompt at moment of need — no custom primer or Pawple skip dialog.
 * @returns {'granted'|'denied'|'blocked'}
 */
export async function resolvePhotoLibraryPermission() {
  try {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (hasGalleryAccess(current)) {
      return 'granted';
    }
    if (current?.status === 'denied' && current.canAskAgain === false) {
      return 'blocked';
    }
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (hasGalleryAccess(requested)) {
      return 'granted';
    }
    if (requested?.canAskAgain === false) {
      return 'blocked';
    }
    return 'denied';
  } catch {
    return 'denied';
  }
}

/** @returns {boolean} true only when status is granted */
export function handlePermissionResult(_kind, status, _context = 'default') {
  return status === 'granted';
}
