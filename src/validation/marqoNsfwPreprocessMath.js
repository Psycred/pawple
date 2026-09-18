/** Marqo nsfw-image-detection-384 expects 384×384 RGB input. */
const MARQO_NSFW_INPUT_SIZE = 384;

/** timm crop_pct for the Marqo NSFW model. */
const MARQO_NSFW_CROP_PCT = 1.0;

/**
 * Marqo/timm preprocessing: resize the shorter edge to `targetSize / cropPct`,
 * then center-crop a square of `targetSize`.
 */
function computeMarqoCenterCropRect(width, height, targetSize = MARQO_NSFW_INPUT_SIZE) {
  const originX = Math.max(0, Math.floor((width - targetSize) / 2));
  const originY = Math.max(0, Math.floor((height - targetSize) / 2));
  const cropWidth = Math.min(targetSize, width);
  const cropHeight = Math.min(targetSize, height);
  return { originX, originY, width: cropWidth, height: cropHeight };
}

/**
 * Pure helper — chooses resize axis for timm-style shorter-edge scaling.
 */
function computeMarqoResizeAction(
  width,
  height,
  targetSize = MARQO_NSFW_INPUT_SIZE,
  cropPct = MARQO_NSFW_CROP_PCT,
) {
  const resizeEdge = Math.round(targetSize / cropPct);
  if (width >= height) {
    return { resize: { height: resizeEdge } };
  }
  return { resize: { width: resizeEdge } };
}

module.exports = {
  MARQO_NSFW_INPUT_SIZE,
  MARQO_NSFW_CROP_PCT,
  computeMarqoCenterCropRect,
  computeMarqoResizeAction,
};
