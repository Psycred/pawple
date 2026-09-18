/**
 * Phase 1a bulletin-board city matching — coarse locality only.
 * Phase A.1: alias map + 100 km centroid radius via indianCityRegistry.
 */

import {
  citiesMatchWithinRadius,
  isMeetupCityRelevantToViewer,
  normalizeCityLookupKey,
  resolveCanonicalCityKey,
} from './indianCityRegistry.js';

/** @param {string|null|undefined} city */
export function normalizeCityKey(city) {
  return normalizeCityLookupKey(city);
}

/**
 * Same city — exact spelling, alias (Bombay/Mumbai), or within default 100 km.
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @param {number} [radiusKm=100]
 */
export function citiesMatch(a, b, radiusKm = 100) {
  return citiesMatchWithinRadius(a, b, radiusKm);
}

/**
 * Canonical city string for profile/onboarding save — trim and collapse whitespace.
 * Preserves user casing; matching uses normalizeCityKey.
 * @returns {string|null}
 */
export function normalizeCityForSave(city) {
  const collapsed = String(city ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return collapsed || null;
}

/** Display label for meetup cards — returns null when city is missing. */
export function formatCityBadge(city) {
  return normalizeCityForSave(city);
}

/**
 * Keep meetups relevant to the viewer's base and/or current city.
 * @param {object[]} meetups
 * @param {string|null|undefined} viewerCity
 * @param {number} [radiusKm=100]
 */
export function filterMeetupsByViewerCity(meetups = [], viewerCity, radiusKm = 100) {
  if (!normalizeCityKey(viewerCity)) {
    return [];
  }
  return meetups.filter((meetup) =>
    isMeetupCityRelevantToViewer(
      meetup?.city,
      { profileCity: viewerCity, deviceCity: null },
      radiusKm,
    ),
  );
}

export {
  isMeetupCityRelevantToViewer,
  resolveCanonicalCityKey,
  normalizeCityLookupKey,
};
