const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
const { getImageSize } = require('./cropObjectImage');
const {
  MARQO_NSFW_INPUT_SIZE,
  MARQO_NSFW_CROP_PCT,
  computeMarqoCenterCropRect,
  computeMarqoResizeAction,
} = require('./marqoNsfwPreprocessMath');

/**
 * Bake EXIF orientation into pixel data via expo-image-manipulator (Glide on Android,
 * orientation fix on iOS) before computing crop geometry.
 */
async function normalizeExifOrientation(uri) {
  return manipulateAsync(uri, [], {
    compress: 1,
    format: SaveFormat.PNG,
  });
}

/**
 * Prepare a local image URI for Marqo NSFW inference:
 * - EXIF orientation baked into pixels
 * - shorter-edge resize (crop_pct=1.0)
 * - center square crop
 * - exact 384×384 output (RGB via PNG)
 *
 * Normalization `(pixel/255 - 0.5) / 0.5` is applied by ML Kit from model metadata
 * when the uint8 bitmap is classified — this module does not emit float tensors.
 */
async function preprocessMarqoNsfwImage(uri, deps = {}) {
  if (!uri) {
    throw new Error('Image URI is required for Marqo NSFW preprocessing');
  }

  const resolveImageSize = deps.getImageSize || getImageSize;
  const oriented = await normalizeExifOrientation(uri);
  const sourceWidth = oriented.width;
  const sourceHeight = oriented.height;

  if (!sourceWidth || !sourceHeight) {
    const measured = await resolveImageSize(oriented.uri);
    if (!measured?.width || !measured?.height) {
      throw new Error('Could not read image dimensions for Marqo NSFW preprocessing');
    }
    oriented.width = measured.width;
    oriented.height = measured.height;
  }

  const resizeAction = computeMarqoResizeAction(oriented.width, oriented.height);
  const resized = await manipulateAsync(oriented.uri, [resizeAction], {
    compress: 1,
    format: SaveFormat.PNG,
  });

  const cropRect = computeMarqoCenterCropRect(resized.width, resized.height);
  let currentUri = resized.uri;
  let currentWidth = resized.width;
  let currentHeight = resized.height;

  if (cropRect.width < resized.width || cropRect.height < resized.height) {
    const cropped = await manipulateAsync(resized.uri, [{ crop: cropRect }], {
      compress: 1,
      format: SaveFormat.PNG,
    });
    currentUri = cropped.uri;
    currentWidth = cropped.width;
    currentHeight = cropped.height;
  }

  if (currentWidth !== MARQO_NSFW_INPUT_SIZE || currentHeight !== MARQO_NSFW_INPUT_SIZE) {
    const final = await manipulateAsync(
      currentUri,
      [{ resize: { width: MARQO_NSFW_INPUT_SIZE, height: MARQO_NSFW_INPUT_SIZE } }],
      {
        compress: 1,
        format: SaveFormat.PNG,
      },
    );
    currentUri = final.uri;
    currentWidth = final.width;
    currentHeight = final.height;
  }

  return {
    uri: currentUri,
    width: currentWidth,
    height: currentHeight,
    preprocessing: {
      inputSize: MARQO_NSFW_INPUT_SIZE,
      cropPct: MARQO_NSFW_CROP_PCT,
      cropMode: 'center',
      interpolationRequested: 'bicubic',
      interpolationApplied: 'platform_default_bilinear',
      exifOrientationCorrected: true,
      normalization: 'delegated_to_mlkit_metadata',
      normalizationFormula: '(pixel/255 - 0.5) / 0.5',
      sourceDimensions: { width: sourceWidth, height: sourceHeight },
      orientedUri: oriented.uri,
    },
  };
}

module.exports = {
  MARQO_NSFW_INPUT_SIZE,
  MARQO_NSFW_CROP_PCT,
  computeMarqoCenterCropRect,
  computeMarqoResizeAction,
  preprocessMarqoNsfwImage,
};
