import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

// [PROCESSING] Silent image pipeline for Pawple moments.
//
// Resize + compress + format encoding run for real here (Expo Go compatible).
//
// The perceptual "Pawple treatment" (warmth / saturation / highlights / shadow lift / grain)
// requires a GPU pipeline (react-native-skia or expo-gl) that is NOT available in Expo Go.
// It is kept as a documented config so a development build can apply it later WITHOUT changing
// any call site. We never silently fake the grade.
export const PAWPLE_TREATMENT = {
  warmth: 0.04, // +4% warmth
  saturation: -0.05, // -5% saturation
  highlights: -0.08, // -8% highlights
  shadowLift: 0.04, // +4% shadow lift
  grain: 0.01, // 1% grain
};

const TARGET_WIDTH = 1080; // 4:5 crop → 1080 x 1350
const PET_PHOTO_TARGET_WIDTH = 800; // 1:1 pet avatars from picker
const COMPRESS_QUALITY = 0.8; // 78–82% quality band

/**
 * Process a picked/cropped image for upload.
 * Returns base64 bytes + the chosen container so the uploader can pick the right
 * extension/content-type. WebP is Android-only in expo-image-manipulator; iOS falls back to JPEG.
 */
export async function processImageForPawple(imageUri) {
  const useWebp = Platform.OS === 'android';
  const format = useWebp ? SaveFormat.WEBP : SaveFormat.JPEG;
  console.log('[Moment] Processing image starting', { imageUri, format });

  const result = await manipulateAsync(imageUri, [{ resize: { width: TARGET_WIDTH } }], {
    compress: COMPRESS_QUALITY,
    format,
    base64: true,
  });

  console.log('[Moment] Processing image success', {
    width: result?.width,
    height: result?.height,
    hasBase64: Boolean(result?.base64),
  });

  if (!result?.base64) {
    throw new Error('Image processing failed');
  }

  return {
    uri: result.uri,
    base64: result.base64,
    width: result.width,
    height: result.height,
    extension: useWebp ? 'webp' : 'jpg',
    contentType: useWebp ? 'image/webp' : 'image/jpeg',
  };
}

/**
 * Process a square pet profile photo for upload (onboarding / edit pet).
 * Picker crops to 1:1; we resize and compress for durable Storage URLs.
 */
export async function processImageForPetPhoto(imageUri) {
  const useWebp = Platform.OS === 'android';
  const format = useWebp ? SaveFormat.WEBP : SaveFormat.JPEG;
  console.log('[PetPhoto] Processing image starting', { imageUri, format });

  const result = await manipulateAsync(imageUri, [{ resize: { width: PET_PHOTO_TARGET_WIDTH } }], {
    compress: COMPRESS_QUALITY,
    format,
    base64: true,
  });

  console.log('[PetPhoto] Processing image success', {
    width: result?.width,
    height: result?.height,
    hasBase64: Boolean(result?.base64),
  });

  if (!result?.base64) {
    throw new Error('Pet photo processing failed');
  }

  return {
    uri: result.uri,
    base64: result.base64,
    width: result.width,
    height: result.height,
    extension: useWebp ? 'webp' : 'jpg',
    contentType: useWebp ? 'image/webp' : 'image/jpeg',
  };
}
