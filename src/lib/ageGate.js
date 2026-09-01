import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Phase 1 India launch age eligibility (Founder decision 2026-08-30).
 * Store content rating may differ; product eligibility is 18+ only.
 */
export const MINIMUM_ACCOUNT_AGE = 18;

/** Device-local confirmation that this install passed the age gate. */
export const AGE_GATE_STORAGE_KEY = '@pawple/age_gate_v1';

/**
 * Whole years of age as of `asOf` (local calendar).
 * Uses date-of-birth math so birthday timing is correct.
 */
export function calculateAgeYears(birthDate, asOf = new Date()) {
  if (!(birthDate instanceof Date) || Number.isNaN(birthDate.getTime())) {
    return null;
  }
  const yearDelta = asOf.getFullYear() - birthDate.getFullYear();
  const monthDelta = asOf.getMonth() - birthDate.getMonth();
  const dayDelta = asOf.getDate() - birthDate.getDate();
  const birthdayPassed = monthDelta > 0 || (monthDelta === 0 && dayDelta >= 0);
  return birthdayPassed ? yearDelta : yearDelta - 1;
}

export function isEligibleBirthDate(birthDate, minimumAge = MINIMUM_ACCOUNT_AGE) {
  const age = calculateAgeYears(birthDate);
  return typeof age === 'number' && age >= minimumAge;
}

/** Latest birth date that still meets minimumAge today. */
export function getMaximumEligibleBirthDate(minimumAge = MINIMUM_ACCOUNT_AGE, asOf = new Date()) {
  return new Date(asOf.getFullYear() - minimumAge, asOf.getMonth(), asOf.getDate());
}

export async function hasPassedAgeGate() {
  try {
    const raw = await AsyncStorage.getItem(AGE_GATE_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw);
    return (
      parsed?.eligible === true &&
      Number(parsed?.minimumAge) === MINIMUM_ACCOUNT_AGE &&
      typeof parsed?.birthDate === 'string'
    );
  } catch (error) {
    console.error('[AgeGate] read failed', error);
    return false;
  }
}

/** ISO date (YYYY-MM-DD) from a successful local age gate, or null. */
export async function getStoredBirthDate() {
  try {
    const raw = await AsyncStorage.getItem(AGE_GATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return typeof parsed?.birthDate === 'string' ? parsed.birthDate : null;
  } catch (error) {
    console.error('[AgeGate] birth date read failed', error);
    return null;
  }
}

/**
 * Persist a successful gate. Stores birth date (ISO date) for auditability on-device.
 * Server attestation is synced separately via ageAttestationSync when authenticated.
 */
export async function recordAgeGatePass(birthDate) {
  if (!isEligibleBirthDate(birthDate)) {
    throw new Error('Birth date does not meet minimum age.');
  }

  const year = birthDate.getFullYear();
  const month = String(birthDate.getMonth() + 1).padStart(2, '0');
  const day = String(birthDate.getDate()).padStart(2, '0');

  const payload = {
    eligible: true,
    minimumAge: MINIMUM_ACCOUNT_AGE,
    birthDate: `${year}-${month}-${day}`,
    confirmedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(AGE_GATE_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}
