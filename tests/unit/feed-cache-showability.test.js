/**
 * Regression: cached Feed meetups must pass the same showability gate as fresh loads.
 * Run: node --test tests/unit/feed-cache-showability.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { filterShowablePublicMeetups } from '../../src/lib/meetupPublicFilter.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixedNow = new Date('2026-08-30T14:00:00').getTime();

/** Mirrors applyCachedSnapshot meetup hydration — authoritative showability gate only. */
function hydrateCachedMeetups(meetups, nowMs = fixedNow) {
  return filterShowablePublicMeetups(meetups ?? [], nowMs);
}

const futureUpcoming = {
  id: 'future',
  status: 'upcoming',
  date: '2026-09-01',
  start_time: '10:00:00',
  city: 'Mumbai',
};

const joinedHostUpcoming = {
  id: 'joined-host',
  status: 'upcoming',
  date: '2026-09-02',
  start_time: '11:00:00',
  city: 'Mumbai',
  user_id: 'active-host-user',
  meetup_hosts: [{ pet_id: 'host-pet-1', pets: { name: 'Tyson' } }],
  meetup_participants: [{ pet_id: 'viewer-pet', pets: { name: 'Luna' } }],
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

const startedUpcoming = {
  id: 'started',
  status: 'upcoming',
  date: '2026-08-30',
  start_time: '13:00:00',
};

const invalidDate = {
  id: 'invalid',
  status: 'upcoming',
  date: '',
  start_time: '10:00:00',
};

describe('cached Feed meetup hydration', () => {
  it('keeps a cached upcoming meetup with a future start time', () => {
    const hydrated = hydrateCachedMeetups([futureUpcoming]);
    assert.deepEqual(hydrated.map((m) => m.id), ['future']);
  });

  it('removes a cached cancelled meetup', () => {
    const hydrated = hydrateCachedMeetups([futureUpcoming, cancelledFuture]);
    assert.deepEqual(hydrated.map((m) => m.id), ['future']);
  });

  it('removes a cached completed meetup', () => {
    const hydrated = hydrateCachedMeetups([futureUpcoming, completedFuture]);
    assert.deepEqual(hydrated.map((m) => m.id), ['future']);
  });

  it('removes a cached meetup whose start time has passed', () => {
    const hydrated = hydrateCachedMeetups([futureUpcoming, startedUpcoming]);
    assert.deepEqual(hydrated.map((m) => m.id), ['future']);
  });

  it('removes a cached meetup with invalid or unparseable date/time', () => {
    const hydrated = hydrateCachedMeetups([futureUpcoming, invalidDate]);
    assert.deepEqual(hydrated.map((m) => m.id), ['future']);
  });

  it('keeps a valid joined/host meetup that is otherwise upcoming', () => {
    const hydrated = hydrateCachedMeetups([joinedHostUpcoming]);
    assert.deepEqual(hydrated.map((m) => m.id), ['joined-host']);
  });

  it('filters a mixed stale cache snapshot down to only showable meetups', () => {
    const hydrated = hydrateCachedMeetups([
      futureUpcoming,
      joinedHostUpcoming,
      cancelledFuture,
      completedFuture,
      startedUpcoming,
      invalidDate,
    ]);
    assert.deepEqual(hydrated.map((m) => m.id), ['future', 'joined-host']);
  });
});

describe('FeedScreen cache hydration contract (static)', () => {
  it('applyCachedSnapshot reuses filterShowablePublicMeetups on cached meetups', () => {
    const feed = readFileSync(join(root, 'src/screens/FeedScreen.js'), 'utf8');
    const applyBlock = feed.slice(
      feed.indexOf('const applyCachedSnapshot'),
      feed.indexOf('const loadFeed'),
    );
    assert.match(applyBlock, /setMeetups\s*\(\s*filterShowablePublicMeetups\s*\(\s*cached\.meetups/);
  });

  it('fresh loadFeed filtering path is unchanged', () => {
    const feed = readFileSync(join(root, 'src/screens/FeedScreen.js'), 'utf8');
    const loadStart = feed.indexOf('const loadFeed = useCallback');
    const focusStart = feed.indexOf('  useFocusEffect(', loadStart);
    const loadBlock = feed.slice(loadStart, focusStart);
    assert.match(loadBlock, /nextMeetups = filterShowablePublicMeetups/);
    assert.doesNotMatch(
      loadBlock,
      /readCachedFeedSnapshot/,
      'fresh load must not depend on cache read for showability filtering',
    );
  });
});
