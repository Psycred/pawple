/**
 * Phase 1a + A.1 city matching — unit tests.
 * Run: node --test tests/unit/city-utils.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  citiesMatch,
  filterMeetupsByViewerCity,
  formatCityBadge,
  isMeetupCityRelevantToViewer,
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

  it('matches common aliases', () => {
    assert.equal(citiesMatch('Bombay', 'Mumbai'), true);
    assert.equal(citiesMatch('Bengaluru', 'Bangalore'), true);
    assert.equal(citiesMatch('Kolkata', 'Calcutta'), true);
    assert.equal(citiesMatch('Dehradoon', 'Dehradun'), true);
    assert.equal(citiesMatch('Prayagraj', 'Allahabad'), true);
    assert.equal(citiesMatch('Varanasi', 'Banaras'), true);
    assert.equal(citiesMatch('Varanasi', 'Benares'), true);
  });

  it('matches exact normalized city spellings when not aliased', () => {
    assert.equal(citiesMatch('  Pune  ', 'pune'), true);
    assert.equal(citiesMatch('Mumbi', 'Mumbai'), false);
  });

  it('matches cities within 100 km via centroids', () => {
    assert.equal(citiesMatch('Delhi', 'Gurgaon'), true);
    assert.equal(citiesMatch('Delhi', 'Chandigarh'), false);
  });

  it('rejects empty viewer or meetup city', () => {
    assert.equal(citiesMatch('', 'Mumbai'), false);
    assert.equal(citiesMatch('Mumbai', ''), false);
  });
});

describe('isMeetupCityRelevantToViewer', () => {
  it('matches current city or base city', () => {
    assert.equal(
      isMeetupCityRelevantToViewer('Bombay', {
        profileCity: 'Pune',
        deviceCity: 'Mumbai',
      }),
      true,
    );
    assert.equal(
      isMeetupCityRelevantToViewer('Gurgaon', {
        profileCity: 'Delhi',
        deviceCity: 'Mumbai',
      }),
      true,
    );
    assert.equal(
      isMeetupCityRelevantToViewer('Chandigarh', {
        profileCity: 'Delhi',
        deviceCity: 'Mumbai',
      }),
      false,
    );
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
    { id: 'c', city: 'Bombay' },
    { id: 'd', city: 'Gurgaon' },
  ];

  it('keeps same-city and alias meetups', () => {
    const filtered = filterMeetupsByViewerCity(meetups, 'Mumbai');
    assert.deepEqual(filtered.map((m) => m.id), ['a', 'c']);
  });

  it('keeps meetups within 100 km of the viewer city', () => {
    const filtered = filterMeetupsByViewerCity(meetups, 'Delhi');
    assert.deepEqual(filtered.map((m) => m.id), ['b', 'd']);
  });

  it('returns empty when viewer city is unset', () => {
    assert.deepEqual(filterMeetupsByViewerCity(meetups, ''), []);
  });
});
