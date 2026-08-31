/**
 * Distance helpers for meetup cards.
 * When viewer GPS is unavailable, distance falls back to a fixed mock user
 * location so UI can still render — meetup coords are never fabricated.
 */

// Mock "current" location for development (Cubbon Park, Bangalore).
const MOCK_USER_LOCATION = { latitude: 12.9716, longitude: 77.5946 };

// Log the mock notice only once per session to avoid console spam on re-render.
let mockNoticeLogged = false;

/**
 * Great-circle distance in kilometers between two coordinates (Haversine).
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Fixed mock user location for development/testing. */
export function getMockLocation() {
  return { ...MOCK_USER_LOCATION };
}

/**
 * Bangalore-area mock venues for demo/seed data only.
 * Production Feed paths must never attach these to real meetup rows.
 */
export const MOCK_MEETUP_VENUES = [
  { location_lat: 12.985, location_lng: 77.61 },
  { location_lat: 12.98, location_lng: 77.6 },
  { location_lat: 12.965, location_lng: 77.59 },
];

/** Precompute distanceKm for a meetup using viewer GPS or mock user location. */
export function computeMeetupDistanceKm(meetup, viewerLat, viewerLng) {
  const lat = meetup?.location_lat ?? meetup?.lat;
  const lng = meetup?.location_lng ?? meetup?.lng;
  return getDistanceToMeetup(lat, lng, viewerLat, viewerLng);
}

/**
 * Distance (km) from the user to a meetup.
 * - Both coords present → real calculated distance.
 * - User coords missing → distance from the mock user location (dev fallback).
 * - Meetup coords missing → null (caller decides on a "nearby" fallback).
 */
export function getDistanceToMeetup(meetupLat, meetupLng, userLat, userLng) {
  const mLat = Number(meetupLat);
  const mLng = Number(meetupLng);
  if (!Number.isFinite(mLat) || !Number.isFinite(mLng)) {
    return null;
  }

  let uLat = Number(userLat);
  let uLng = Number(userLng);
  if (!Number.isFinite(uLat) || !Number.isFinite(uLng)) {
    const mock = getMockLocation();
    uLat = mock.latitude;
    uLng = mock.longitude;
    if (!mockNoticeLogged) {
      console.log('[Location] Using mock location for development');
      mockNoticeLogged = true;
    }
  }

  return calculateDistance(uLat, uLng, mLat, mLng);
}
