/**
 * Phase 1a city-only meetup discovery — unit tests.
 * Run: node --test tests/unit/city-utils.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  citiesMatch,
  filterMeetupsByViewerCity,
  formatCityBadge,
  normalizeCityForSave,
  normalizeCityKey,
} from '../../src/utils/cityUtils.js';

describe('normalizeCityKey', () => {
  it('lowercases and trims', () => {
    assert.equal(normalizeCityKey('  Mumbai  '), 'mumbai');
  });

  it('returns empty for blank input', () => {
    assert.equal(normalizeCityKey(''), '');
    assert.equal(normalizeCityKey(null), '');
  });
});

describe('citiesMatch', () => {
  it('matches case-insensitive trimmed cities', () => {
    assert.equal(citiesMatch('Mumbai', ' mumbai '), true);
  });

  it('rejects empty viewer or meetup city', () => {
    assert.equal(citiesMatch('', 'Mumbai'), false);
    assert.equal(citiesMatch('Mumbai', ''), false);
  });
});

describe('normalizeCityForSave', () => {
  it('trims and collapses internal whitespace', () => {
    assert.equal(normalizeCityForSave('  New   Delhi  '), 'New Delhi');
  });

  it('returns null for blank input', () => {
    assert.equal(normalizeCityForSave(''), null);
    assert.equal(normalizeCityForSave('   '), null);
  });
});

describe('formatCityBadge', () => {
  it('returns trimmed city or null', () => {
    assert.equal(formatCityBadge('  Bengaluru '), 'Bengaluru');
    assert.equal(formatCityBadge(''), null);
  });
});

describe('filterMeetupsByViewerCity', () => {
  const meetups = [
    { id: 'a', city: 'Mumbai' },
    { id: 'b', city: 'Delhi' },
    { id: 'c', city: ' mumbai ' },
  ];

  it('keeps same-city meetups only', () => {
    const filtered = filterMeetupsByViewerCity(meetups, 'Mumbai');
    assert.deepEqual(filtered.map((m) => m.id), ['a', 'c']);
  });

  it('returns empty when viewer city is unset', () => {
    assert.deepEqual(filterMeetupsByViewerCity(meetups, ''), []);
  });
});
