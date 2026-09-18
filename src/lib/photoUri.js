/** Shared URI helpers — kept separate to avoid petPhotoUpload ↔ photoValidationGate cycles. */

export function isRemotePhotoUrl(uri) {
  if (typeof uri !== 'string') {
    return false;
  }
  const trimmed = uri.trim();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

export function isLocalPhotoUri(uri) {
  if (typeof uri !== 'string') {
    return false;
  }
  const trimmed = uri.trim();
  return trimmed.startsWith('file://') || trimmed.startsWith('content://');
}
