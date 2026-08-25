/**
 * Optional Google Maps link validation for meetup directions.
 * Empty/null is always valid. When provided, must be a Google Maps URL.
 */

const APPLE_MAPS_HINT =
  'Apple Maps links do not work on Android. Please use Google Maps.';

const GOOGLE_MAPS_HINT = 'Please use a Google Maps link (google.com/maps or maps.app.goo.gl).';

/**
 * @param {string} [url]
 * @returns {{
 *   isEmpty: boolean,
 *   isValid: boolean,
 *   isAppleMaps: boolean,
 *   value: string|null,
 *   message: string|null,
 * }}
 */
export function validateOptionalGoogleMapsLink(url = '') {
  const trimmed = String(url ?? '').trim();

  if (!trimmed) {
    return {
      isEmpty: true,
      isValid: true,
      isAppleMaps: false,
      value: null,
      message: null,
    };
  }

  const lower = trimmed.toLowerCase();

  const isAppleMaps =
    lower.includes('maps.apple.com') ||
    lower.includes('apple.com/maps') ||
    (lower.includes('apple.com') && !lower.includes('google'));

  if (isAppleMaps) {
    return {
      isEmpty: false,
      isValid: false,
      isAppleMaps: true,
      value: null,
      message: APPLE_MAPS_HINT,
    };
  }

  const isGoogleMaps =
    lower.includes('google.com') || lower.includes('maps.app.goo.gl');

  if (!isGoogleMaps) {
    return {
      isEmpty: false,
      isValid: false,
      isAppleMaps: false,
      value: null,
      message: GOOGLE_MAPS_HINT,
    };
  }

  return {
    isEmpty: false,
    isValid: true,
    isAppleMaps: false,
    value: trimmed,
    message: null,
  };
}

/** @deprecated Use validateOptionalGoogleMapsLink — kept for existing imports. */
export function validateMapLink(url = '') {
  const result = validateOptionalGoogleMapsLink(url);
  return {
    isAppleMaps: result.isAppleMaps,
    isMapLinkValid: result.isValid,
    warningMessage: result.message,
  };
}
