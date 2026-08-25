import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1350;
const COMPRESS = 0.8;

function getImageSize(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
}

/**
 * Map viewport framing (cover + pan + pinch) to a source-image crop, then export 4:5.
 */
export function computeCropRect({
  imageWidth,
  imageHeight,
  viewportWidth,
  viewportHeight,
  totalScale,
  translateX,
  translateY,
}) {
  const displayedW = imageWidth * totalScale;
  const displayedH = imageHeight * totalScale;
  const left = viewportWidth / 2 + translateX - displayedW / 2;
  const top = viewportHeight / 2 + translateY - displayedH / 2;

  const visLeft = Math.max(0, -left);
  const visTop = Math.max(0, -top);
  const visRight = Math.min(displayedW, viewportWidth - left);
  const visBottom = Math.min(displayedH, viewportHeight - top);

  const cropDisplayW = Math.max(1, visRight - visLeft);
  const cropDisplayH = Math.max(1, visBottom - visTop);

  let originX = visLeft / totalScale;
  let originY = visTop / totalScale;
  let width = cropDisplayW / totalScale;
  let height = cropDisplayH / totalScale;

  originX = Math.max(0, Math.min(originX, imageWidth - 1));
  originY = Math.max(0, Math.min(originY, imageHeight - 1));
  width = Math.max(1, Math.min(width, imageWidth - originX));
  height = Math.max(1, Math.min(height, imageHeight - originY));

  return {
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export async function exportMomentImage({
  uri,
  imageWidth,
  imageHeight,
  viewportWidth,
  viewportHeight,
  totalScale,
  translateX,
  translateY,
}) {
  const crop = computeCropRect({
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
    totalScale,
    translateX,
    translateY,
  });

  const actions = [
    { crop },
    { resize: { width: EXPORT_WIDTH, height: EXPORT_HEIGHT } },
  ];

  let format = ImageManipulator.SaveFormat.WEBP;
  try {
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: COMPRESS,
      format,
    });
    return result.uri;
  } catch {
    format = ImageManipulator.SaveFormat.JPEG;
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: COMPRESS,
      format,
    });
    return result.uri;
  }
}

export async function exportMomentImageFromFraming({
  uri,
  viewportWidth,
  viewportHeight,
  totalScale,
  translateX,
  translateY,
}) {
  const { width, height } = await getImageSize(uri);
  return exportMomentImage({
    uri,
    imageWidth: width,
    imageHeight: height,
    viewportWidth,
    viewportHeight,
    totalScale,
    translateX,
    translateY,
  });
}
