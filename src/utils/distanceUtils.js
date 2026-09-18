/**
 * Honest meetup distance helpers.
 * Contract: never fabricate coordinates or distances in production —
 * omit the label when GPS or venue coords are missing.
 */

import { getMeetupVenueCoords } from '../lib/meetupVenueCoords.js';
import { calculateDistance } from './locationUtils.js';

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

function hasViewerGps(viewerCoords) {
  const lat = Number(viewerCoords?.latitude);
  const lng = Number(viewerCoords?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

/**
 * Distance (km) from viewer GPS to a meetup venue pin.
 * Uses venue_lat/lng from maps-link unwrap first.
 * @returns {number|null}
 */
export function computeHonestMeetupDistanceKm(meetup, viewerLat, viewerLng) {
  const venue = getMeetupVenueCoords(meetup);
  const uLat = Number(viewerLat);
  const uLng = Number(viewerLng);
  if (!venue || !Number.isFinite(uLat) || !Number.isFinite(uLng)) {
    return null;
  }
  return calculateDistance(uLat, uLng, venue.latitude, venue.longitude);
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

/**
 * Precompute distanceKm on meetup rows for feed / carousel consumers.
 * MeetupCard reads meetup.distanceKm when present (display wired separately).
 */
export function enrichMeetupsWithVenueDistance(meetups = [], viewerLocation = null) {
  if (!Array.isArray(meetups) || !meetups.length) {
    return meetups;
  }
  const viewerCoords = hasViewerGps(viewerLocation)
    ? {
        latitude: viewerLocation.latitude,
        longitude: viewerLocation.longitude,
      }
    : null;
  if (!viewerCoords) {
    return meetups;
  }
  return meetups.map((meetup) => withHonestMeetupDistance(meetup, viewerCoords));
}
