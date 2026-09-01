/**
 * Phase 1a bulletin-board city matching — coarse locality only.
 * Normalize with lower(trim(city)) equality per CTO architecture §3.2.
 */

/** @param {string|null|undefined} city */
export function normalizeCityKey(city) {
  const trimmed = String(city ?? '').trim();
  return trimmed ? trimmed.toLowerCase() : '';
}

/** @param {string|null|undefined} a @param {string|null|undefined} b */
export function citiesMatch(a, b) {
  const keyA = normalizeCityKey(a);
  const keyB = normalizeCityKey(b);
  return Boolean(keyA && keyB && keyA === keyB);
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
 * Keep meetups in the viewer's city for public discovery surfaces.
 * @param {object[]} meetups
 * @param {string|null|undefined} viewerCity
 */
export function filterMeetupsByViewerCity(meetups = [], viewerCity) {
  const viewerKey = normalizeCityKey(viewerCity);
  if (!viewerKey) {
    return [];
  }
  return meetups.filter((meetup) => citiesMatch(meetup?.city, viewerCity));
}
