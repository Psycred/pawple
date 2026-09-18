/**
 * Resolve Indian city spellings to canonical keys + centroids for feed matching.
 */

import { INDIAN_CITY_ENTRIES } from '../data/indianCities.js';
import { calculateDistance } from './locationUtils.js';

/** @param {string|null|undefined} city */
export function normalizeCityLookupKey(city) {
  const collapsed = String(city ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,''`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+city$/i, '')
    .trim();
  return collapsed;
}

const ALIAS_TO_KEY = new Map();
const KEY_TO_CENTROID = new Map();

for (const entry of INDIAN_CITY_ENTRIES) {
  KEY_TO_CENTROID.set(entry.key, { lat: entry.lat, lng: entry.lng, name: entry.name });
  const aliasSet = new Set([entry.key, ...(entry.aliases ?? [])]);
  for (const alias of aliasSet) {
    const lookupKey = normalizeCityLookupKey(alias);
    if (lookupKey) {
      ALIAS_TO_KEY.set(lookupKey, entry.key);
    }
  }
}

/**
 * Canonical registry key, or null when the city is not in our list.
 * @param {string|null|undefined} city
 * @returns {string|null}
 */
export function resolveCanonicalCityKey(city) {
  const lookupKey = normalizeCityLookupKey(city);
  if (!lookupKey) {
    return null;
  }
  return ALIAS_TO_KEY.get(lookupKey) ?? null;
}

/**
 * @param {string|null|undefined} city
 * @returns {{ lat: number, lng: number, name: string } | null}
 */
export function getCityCentroid(city) {
  const canonical = resolveCanonicalCityKey(city);
  if (!canonical) {
    return null;
  }
  return KEY_TO_CENTROID.get(canonical) ?? null;
}

/**
 * Same city (aliases) or within radiusKm between known centroids.
 * Falls back to exact normalized spelling when centroids are unknown.
 */
export function citiesMatchWithinRadius(cityA, cityB, radiusKm = 100) {
  const lookupA = normalizeCityLookupKey(cityA);
  const lookupB = normalizeCityLookupKey(cityB);
  if (!lookupA || !lookupB) {
    return false;
  }
  if (lookupA === lookupB) {
    return true;
  }

  const canonicalA = resolveCanonicalCityKey(cityA);
  const canonicalB = resolveCanonicalCityKey(cityB);
  if (canonicalA && canonicalB && canonicalA === canonicalB) {
    return true;
  }

  const centroidA = getCityCentroid(cityA);
  const centroidB = getCityCentroid(cityB);
  if (centroidA && centroidB) {
    const km = calculateDistance(centroidA.lat, centroidA.lng, centroidB.lat, centroidB.lng);
    return km <= radiusKm;
  }

  return false;
}

/**
 * @param {string|null|undefined} meetupCity
 * @param {{ profileCity?: string|null, deviceCity?: string|null }} viewerCities
 * @param {number} [radiusKm=100]
 */
export function isMeetupCityRelevantToViewer(meetupCity, viewerCities = {}, radiusKm = 100) {
  const meetupKey = normalizeCityLookupKey(meetupCity);
  if (!meetupKey) {
    return false;
  }

  const references = [viewerCities.deviceCity, viewerCities.profileCity]
    .map((city) => String(city ?? '').trim())
    .filter(Boolean);

  if (!references.length) {
    return false;
  }

  return references.some((viewerCity) =>
    citiesMatchWithinRadius(meetupCity, viewerCity, radiusKm),
  );
}

/**
 * Minimum centroid distance from meetup city to viewer reference cities.
 * @returns {number}
 */
export function minMeetupCityDistanceKm(meetupCity, viewerCities = {}) {
  const meetupCentroid = getCityCentroid(meetupCity);
  if (!meetupCentroid) {
    return Number.POSITIVE_INFINITY;
  }

  let minKm = Number.POSITIVE_INFINITY;
  for (const viewerCity of [viewerCities.deviceCity, viewerCities.profileCity]) {
    if (!viewerCity) {
      continue;
    }
    if (citiesMatchWithinRadius(meetupCity, viewerCity, 0)) {
      return 0;
    }
    const viewerCentroid = getCityCentroid(viewerCity);
    if (!viewerCentroid) {
      continue;
    }
    const km = calculateDistance(
      meetupCentroid.lat,
      meetupCentroid.lng,
      viewerCentroid.lat,
      viewerCentroid.lng,
    );
    minKm = Math.min(minKm, km);
  }
  return minKm;
}
