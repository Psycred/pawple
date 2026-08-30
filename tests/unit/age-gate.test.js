/**
 * PAW-48 — Phase 1 India 18+ age gate math.
 * Run: node --test tests/unit/age-gate.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateAgeYears,
  getMaximumEligibleBirthDate,
  isEligibleBirthDate,
  MINIMUM_ACCOUNT_AGE,
} from '../../src/lib/ageGate.js';

describe('MINIMUM_ACCOUNT_AGE', () => {
  it('is 18 for Phase 1 India launch', () => {
    assert.equal(MINIMUM_ACCOUNT_AGE, 18);
  });
});

describe('calculateAgeYears / isEligibleBirthDate', () => {
  const asOf = new Date(2026, 7, 30); // 30 Aug 2026 local

  it('treats the exact 18th birthday as eligible', () => {
    const edge = getMaximumEligibleBirthDate(18, asOf);
    assert.equal(calculateAgeYears(edge, asOf), 18);
    assert.equal(isEligibleBirthDate(edge), true);
  });

  it('rejects someone who turns 18 tomorrow', () => {
    const almost = new Date(asOf.getFullYear() - 18, asOf.getMonth(), asOf.getDate() + 1);
    assert.equal(calculateAgeYears(almost, asOf), 17);
    assert.equal(isEligibleBirthDate(almost), false);
  });

  it('accepts a clearly adult birth date', () => {
    const adult = new Date(2000, 0, 15);
    assert.ok(calculateAgeYears(adult, asOf) >= 18);
    assert.equal(isEligibleBirthDate(adult), true);
  });

  it('returns null for invalid dates', () => {
    assert.equal(calculateAgeYears(new Date('not-a-date')), null);
    assert.equal(isEligibleBirthDate(new Date('not-a-date')), false);
  });
});
