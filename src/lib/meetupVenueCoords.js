/**
 * Venue pin on a meetup — from maps-link unwrap (venue_lat/lng), not device GPS.
 */

/** @param {object|null|undefined} meetup @returns {{ latitude: number, longitude: number } | null} */
export function getMeetupVenueCoords(meetup) {
  if (!meetup) {
    return null;
  }

  const venueLat = Number(meetup.venue_lat ?? meetup.venueLat);
  const venueLng = Number(meetup.venue_lng ?? meetup.venueLng);
  if (Number.isFinite(venueLat) && Number.isFinite(venueLng)) {
    return { latitude: venueLat, longitude: venueLng };
  }

  const legacyLat = Number(meetup.location_lat ?? meetup.lat);
  const legacyLng = Number(meetup.location_lng ?? meetup.lng);
  if (Number.isFinite(legacyLat) && Number.isFinite(legacyLng)) {
    return { latitude: legacyLat, longitude: legacyLng };
  }

  return null;
}
