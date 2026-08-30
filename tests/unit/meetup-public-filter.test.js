/**
 * Fix 2 / PAW-28 — public showable meetup filter unit tests.
 * Run: node --test tests/unit/meetup-public-filter.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterShowablePublicMeetups,
  getMeetupStartTimestamp,
  isShowablePublicMeetup,
} from '../../src/lib/meetupPublicFilter.js';

const fixedNow = new Date('2026-08-30T14:00:00').getTime();

const futureUpcoming = {
  id: 'future',
  status: 'upcoming',
  date: '2026-09-01',
  start_time: '10:00:00',
};

const startedUpcoming = {
  id: 'started',
  status: 'upcoming',
  date: '2026-08-30',
  start_time: '13:00:00',
};

const cancelledFuture = {
  id: 'cancelled',
  status: 'cancelled',
  date: '2026-09-01',
  start_time: '10:00:00',
};

const completedFuture = {
  id: 'completed',
  status: 'completed',
  date: '2026-09-01',
  start_time: '10:00:00',
};

const exactStart = {
  id: 'exact-start',
  status: 'upcoming',
  date: '2026-08-30',
  start_time: '14:00:00',
};

const legacyNoStatus = {
  id: 'legacy',
  date: '2026-09-15',
  start_time: '09:30:00',
};

const invalidDate = {
  id: 'invalid',
  status: 'upcoming',
  date: '',
  start_time: '10:00:00',
};

describe('getMeetupStartTimestamp', () => {
  it('combines date and start_time into epoch ms', () => {
    const ts = getMeetupStartTimestamp(futureUpcoming);
    assert.equal(ts, new Date('2026-09-01T10:00:00').getTime());
  });

  it('returns null for unparseable date/time', () => {
    assert.equal(getMeetupStartTimestamp(invalidDate), null);
  });
});

describe('isShowablePublicMeetup', () => {
  it('includes future upcoming meetups', () => {
    assert.equal(isShowablePublicMeetup(futureUpcoming, fixedNow), true);
  });

  it('excludes meetups whose start time has passed', () => {
    assert.equal(isShowablePublicMeetup(startedUpcoming, fixedNow), false);
  });

  it('excludes cancelled meetups', () => {
    assert.equal(isShowablePublicMeetup(cancelledFuture, fixedNow), false);
  });

  it('excludes completed meetups', () => {
    assert.equal(isShowablePublicMeetup(completedFuture, fixedNow), false);
  });

  it('excludes meetups at exact start time (beta: disappear when start is reached)', () => {
    assert.equal(isShowablePublicMeetup(exactStart, fixedNow), false);
  });

  it('treats missing status as upcoming for legacy rows', () => {
    assert.equal(isShowablePublicMeetup(legacyNoStatus, fixedNow), true);
  });

  it('excludes rows with unparseable start datetime', () => {
    assert.equal(isShowablePublicMeetup(invalidDate, fixedNow), false);
  });
});

describe('filterShowablePublicMeetups', () => {
  it('keeps only upcoming, non-cancelled meetups with future start times', () => {
    const input = [
      futureUpcoming,
      startedUpcoming,
      cancelledFuture,
      completedFuture,
      exactStart,
      legacyNoStatus,
      invalidDate,
    ];
    const filtered = filterShowablePublicMeetups(input, fixedNow);
    assert.deepEqual(
      filtered.map((m) => m.id),
      ['future', 'legacy'],
    );
  });

  it('returns an empty array for empty input', () => {
    assert.deepEqual(filterShowablePublicMeetups([], fixedNow), []);
  });
});

describe('meetups.js re-exports (static contract)', () => {
  it('exports filterShowablePublicMeetups for PAW-29 consumers', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(
      new URL('../../src/services/meetups.js', import.meta.url),
      'utf8',
    );
    assert.match(source, /export\s*\{[^}]*filterShowablePublicMeetups/);
    assert.doesNotMatch(source, /export function filterShowableMeetups/);
  });

  it('does not apply filter inside private pet meetup fetch paths', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(
      new URL('../../src/services/meetups.js', import.meta.url),
      'utf8',
    );
    const participatingBlock = source.slice(
      source.indexOf('export async function fetchPetParticipatingMeetups'),
      source.indexOf('export async function fetchPetHostingMeetupsByPet'),
    );
    const hostingBlock = source.slice(
      source.indexOf('export async function fetchPetHostingMeetupsByPet'),
      source.indexOf('/** Resolve hosting pet ids'),
    );
    assert.doesNotMatch(participatingBlock, /filterShowablePublicMeetups/);
    assert.doesNotMatch(hostingBlock, /filterShowablePublicMeetups/);
  });
});
