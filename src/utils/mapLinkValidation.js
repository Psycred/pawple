/**
 * Optional maps link validation for meetup directions.
 * Empty/null is always valid. When provided, must be Google or Apple Maps.
 */

const MAPS_HINT =
  'Please use a Google Maps or Apple Maps link (google.com/maps, maps.app.goo.gl, or maps.apple.com).';

/**
 * @param {string} [url]
 * @returns {{
 *   isEmpty: boolean,
 *   isValid: boolean,
 *   isAppleMaps: boolean,
 *   isGoogleMaps: boolean,
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
      isGoogleMaps: false,
      value: null,
      message: null,
    };
  }

  const lower = trimmed.toLowerCase();

  const isAppleMaps =
    lower.includes('maps.apple.com') ||
    lower.includes('apple.com/maps') ||
    (lower.includes('apple.com') && !lower.includes('google'));

  const isGoogleMaps =
    lower.includes('google.com') ||
    lower.includes('maps.app.goo.gl') ||
    lower.includes('goo.gl/maps');

  if (!isAppleMaps && !isGoogleMaps) {
    return {
      isEmpty: false,
      isValid: false,
      isAppleMaps: false,
      isGoogleMaps: false,
      value: null,
      message: MAPS_HINT,
    };
  }

  return {
    isEmpty: false,
    isValid: true,
    isAppleMaps,
    isGoogleMaps,
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
