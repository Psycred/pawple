import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { openAppSettings } from './permissions';
import { resolveGalleryPermission } from './photoPicker';

const MESSAGES = {
  camera: {
    title: 'Camera',
    body: 'Camera access helps capture moments with your pet.',
  },
  library: {
    title: 'Photos',
    body: 'Photo access helps upload memories from your gallery.',
  },
};

function showDeniedAlert(kind) {
  const { title, body } = MESSAGES[kind];
  Alert.alert(title, body, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: openAppSettings },
  ]);
}

/**
 * Check current status, request only when needed, open picker if granted.
 * @returns {'granted'|'denied'|'blocked'}
 */
export async function resolveCameraPermission() {
  try {
    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current?.granted) {
      return 'granted';
    }
    if (current?.status === 'denied' && current.canAskAgain === false) {
      return 'blocked';
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

export async function resolvePhotoLibraryPermission() {
  try {
    const permission = await resolveGalleryPermission();
    return permission.granted ? 'granted' : permission.canAskAgain ? 'denied' : 'blocked';
  } catch {
    return 'denied';
  }
}

export function handlePermissionResult(kind, status) {
  if (status === 'granted') {
    return true;
  }
  if (status === 'blocked' || status === 'denied') {
    showDeniedAlert(kind);
  }
  return false;
}
