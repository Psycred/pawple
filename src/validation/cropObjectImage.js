import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { clampCropRect } from './cropRect';

export function getImageSize(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
}

export async function cropObjectImage(uri, frame, imageSize) {
  const size = imageSize || (await getImageSize(uri));
  const crop = clampCropRect(frame, size);
  if (!crop) {
    return null;
  }

  const result = await manipulateAsync(uri, [{ crop }], {
    compress: 1,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}
