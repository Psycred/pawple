/**
 * @deprecated Prefer `locationManager.js` for new code.
 * Thin wrappers kept for onboarding + CreateMoment compatibility.
 */
import {
  captureLocationOnUserConsent,
  getCachedLocation,
  getValidLocation,
} from './locationManager';

/**
 * Pre-permission → OS dialog → GPS. Call ONLY from explicit user tap (onboarding).
 * @returns {{ granted: boolean, coords: import('./locationManager').LocationCoords|null }}
 */
export async function requestAndCaptureDeviceLocation() {
  return captureLocationOnUserConsent();
}

/** Last cached device location (no prompt). */
export async function getStoredDeviceLocation() {
  return getCachedLocation();
}

export { getValidLocation };
