/**
 * Client-side mating eligibility helpers — mirror Step 7C product rules for tests/UI.
 * Server RPCs remain authoritative for discovery and Paw writes.
 */

export const MATING_BREED_PREFERENCES = Object.freeze({
  SAME_BREED: 'same_breed',
  ALL_BREEDS: 'all_breeds',
});

export const MATING_BREED_PREFERENCE_OPTIONS = Object.freeze([
  { value: MATING_BREED_PREFERENCES.SAME_BREED, label: 'Same breed' },
  { value: MATING_BREED_PREFERENCES.ALL_BREEDS, label: 'All breeds' },
]);

export const MATING_GENDER_OPTIONS = Object.freeze(['Male', 'Female']);

export const MATING_PHASE1A_RADIUS_KM = 100;

/** Normalize stored gender to canonical Male/Female or empty when invalid. */
export function normalizeMatingGender(gender) {
  const lower = String(gender ?? '').trim().toLowerCase();
  if (lower === 'male') {
    return 'Male';
  }
  if (lower === 'female') {
    return 'Female';
  }
  return '';
}

export function isValidMatingGender(gender) {
  return normalizeMatingGender(gender) !== '';
}

export function areOppositeMatingGenders(genderA, genderB) {
  const a = normalizeMatingGender(genderA).toLowerCase();
  const b = normalizeMatingGender(genderB).toLowerCase();
  return (a === 'male' && b === 'female') || (a === 'female' && b === 'male');
}

export function areSamePetTypes(petTypeA, petTypeB) {
  const a = String(petTypeA ?? '').trim().toLowerCase();
  const b = String(petTypeB ?? '').trim().toLowerCase();
  return a !== '' && a === b;
}

/**
 * Whether viewer breed preference allows a candidate.
 * Legacy/null preference defaults to same_breed (prior server behaviour).
 */
export function breedPreferenceAllows(preference, viewerBreed, candidateBreed) {
  const pref =
    preference === MATING_BREED_PREFERENCES.ALL_BREEDS
      ? MATING_BREED_PREFERENCES.ALL_BREEDS
      : MATING_BREED_PREFERENCES.SAME_BREED;
  if (pref === MATING_BREED_PREFERENCES.ALL_BREEDS) {
    return true;
  }
  const viewer = String(viewerBreed ?? '').trim().toLowerCase();
  const candidate = String(candidateBreed ?? '').trim().toLowerCase();
  return viewer !== '' && candidate !== '' && viewer === candidate;
}

export function isValidMatingBreedPreference(value) {
  return (
    value === MATING_BREED_PREFERENCES.SAME_BREED ||
    value === MATING_BREED_PREFERENCES.ALL_BREEDS
  );
}
