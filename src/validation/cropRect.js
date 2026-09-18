function clampCropRect(frame, imageSize) {
  if (!frame?.origin || !frame?.size || !imageSize?.width || !imageSize?.height) {
    return null;
  }

  const originX = Math.max(0, Math.round(frame.origin.x));
  const originY = Math.max(0, Math.round(frame.origin.y));
  const width = Math.max(1, Math.round(frame.size.x));
  const height = Math.max(1, Math.round(frame.size.y));
  const maxWidth = Math.max(1, Math.round(imageSize.width) - originX);
  const maxHeight = Math.max(1, Math.round(imageSize.height) - originY);
  const clampedWidth = Math.min(width, maxWidth);
  const clampedHeight = Math.min(height, maxHeight);

  if (originX >= imageSize.width || originY >= imageSize.height || clampedWidth < 1 || clampedHeight < 1) {
    return null;
  }

  return { originX, originY, width: clampedWidth, height: clampedHeight };
}

module.exports = { clampCropRect };
