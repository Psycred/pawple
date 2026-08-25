/**
 * Distance helpers for meetup cards, with mock fallbacks so distances still
 * render in development when GPS is denied/unavailable.
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
 * Stable mock coordinates near the city center, seeded so a given meetup always
 * maps to the same spot (used when a meetup has no real coordinates).
 */
export function getMockMeetupCoords(seed = 0) {
  const h = hashSeed(seed);
  const latOffset = ((h % 100) / 100 - 0.5) * 0.08; // ~±4.4 km
  const lngOffset = (((h >> 3) % 100) / 100 - 0.5) * 0.08;
  return {
    latitude: MOCK_USER_LOCATION.latitude + latOffset,
    longitude: MOCK_USER_LOCATION.longitude + lngOffset,
  };
}

function hashSeed(seed) {
  const str = String(seed);
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

/** Bangalore-area mock venues — offset from mock user so distance is never 0 km. */
export const MOCK_MEETUP_VENUES = [
  { location_lat: 12.985, location_lng: 77.61 },
  { location_lat: 12.98, location_lng: 77.6 },
  { location_lat: 12.965, location_lng: 77.59 },
];

function hasMeetupCoords(meetup) {
  const lat = Number(meetup?.location_lat ?? meetup?.lat);
  const lng = Number(meetup?.location_lng ?? meetup?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

/** Attach mock venue coordinates when a meetup row has none (testing / legacy rows). */
export function enrichMeetupWithMockCoords(meetup, index = 0) {
  if (hasMeetupCoords(meetup)) {
    return meetup;
  }
  const venue = MOCK_MEETUP_VENUES[index % MOCK_MEETUP_VENUES.length];
  return {
    ...meetup,
    location_lat: venue.location_lat,
    location_lng: venue.location_lng,
  };
}

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
