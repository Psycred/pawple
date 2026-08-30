/**
 * Honest meetup distance helpers.
 * Contract: never fabricate coordinates or distances in production —
 * omit the label when GPS or venue coords are missing.
 */

import { calculateDistance } from './locationUtils';

/**
 * Format a real distance for UI. Returns null when unavailable (honest omit).
 * @param {number|null|undefined} km
 * @returns {string|null}
 */
export function formatDistanceLabel(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return `${n.toFixed(1)} km away`;
}

/**
 * Distance (km) from viewer GPS to a meetup venue.
 * Requires both real venue coords and real viewer coords — no mock fallbacks.
 * @returns {number|null}
 */
export function computeHonestMeetupDistanceKm(meetup, viewerLat, viewerLng) {
  const mLat = Number(meetup?.location_lat ?? meetup?.lat);
  const mLng = Number(meetup?.location_lng ?? meetup?.lng);
  const uLat = Number(viewerLat);
  const uLng = Number(viewerLng);
  if (![mLat, mLng, uLat, uLng].every((n) => Number.isFinite(n))) {
    return null;
  }
  return calculateDistance(uLat, uLng, mLat, mLng);
}

/**
 * Attach honest distanceKm when computable; otherwise leave unset (omit in UI).
 * Does not invent venue coordinates.
 */
export function withHonestMeetupDistance(meetup, viewerCoords) {
  if (!meetup) {
    return meetup;
  }
  const preset = Number(meetup.distanceKm ?? meetup.distance_km);
  if (Number.isFinite(preset) && preset >= 0) {
    return { ...meetup, distanceKm: preset };
  }
  const distanceKm = computeHonestMeetupDistanceKm(
    meetup,
    viewerCoords?.latitude,
    viewerCoords?.longitude,
  );
  if (distanceKm == null) {
    const { distanceKm: _drop, distance_km: _drop2, ...rest } = meetup;
    return rest;
  }
  return { ...meetup, distanceKm };
}
