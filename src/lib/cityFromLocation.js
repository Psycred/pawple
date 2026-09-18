import * as Location from 'expo-location';
import { fetchApproximateCoords } from './profileLocation';

/**
 * Reverse-geocode coarse coords into a city label for About You.
 * Never exposes lat/lng to the UI.
 */
export async function resolveCityFromCoords(latitude, longitude) {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!results?.length) {
      return null;
    }
    const place = results[0];
    return place.city || place.subregion || place.region || null;
  } catch (error) {
    console.log('[CityFromLocation] reverseGeocode failed:', error?.message ?? error);
    return null;
  }
}

/** Fetch current coarse position and return a city name, or null. */
export async function detectCityName() {
  const coords = await fetchApproximateCoords();
  if (!coords) {
    return null;
  }
  return resolveCityFromCoords(coords.latitude, coords.longitude);
}
