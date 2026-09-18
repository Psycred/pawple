import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCarouselMeetups,
  buildMeetupInjectionRows,
} from '../../src/utils/meetupFeedLogic.js';

const moments = (count) =>
  Array.from({ length: count }, (_, index) => ({ id: `moment-${index + 1}` }));
const FUTURE = { date: '2027-06-01', start_time: '10:00:00' };
const MUMBAI_FEED = { profileCity: 'Mumbai', deviceCity: 'Mumbai' };
const meetups = (...ids) =>
  ids.map((id) => ({
    id,
    city: 'Mumbai',
    ...FUTURE,
  }));
const inlineIds = (rows) =>
  rows.filter((row) => row.type === 'meetup').map((row) => String(row.data.id));

function assertCooldown(sequence, cooldown) {
  sequence.forEach((id, index) => {
    const recent = sequence.slice(Math.max(0, index - cooldown), index);
    assert.ok(!recent.includes(id), `${id} repeated inside cooldown at index ${index}`);
  });
}

describe('Meetup Feed composition', () => {
  it('pins the viewer hosted meetup first, then fills carousel by city relevance', () => {
    const source = [
      { id: 'far-owned', user_id: 'viewer', city: 'Chandigarh', ...FUTURE },
      { id: 'nearest', city: 'Mumbai', ...FUTURE },
      { id: 'second', city: 'Bombay', ...FUTURE },
      { id: 'third', city: 'Navi Mumbai', ...FUTURE },
    ];
    const result = buildCarouselMeetups(
      source,
      'viewer',
      3,
      MUMBAI_FEED,
      { locationGranted: false },
    );

    assert.deepEqual(result.ids, ['far-owned', 'nearest', 'second']);
  });

  it('inserts exactly one individual Meetup after every nine Moments', () => {
    const allMeetups = meetups('A', 'B', 'C', 'D');
    const rows = buildMeetupInjectionRows({
      moments: moments(20),
      allMeetups,
      carouselIds: ['A', 'B', 'C'],
      userLocation: MUMBAI_FEED,
      locationGranted: false,
      sessionSeed: 7,
      currentUserId: null,
    }).rows;

    assert.deepEqual(
      rows.map((row) => row.type),
      [
        ...Array(9).fill('moment'),
        'meetup',
        ...Array(9).fill('moment'),
        'meetup',
        ...Array(2).fill('moment'),
      ],
    );
  });

  it('shows unseen Meetups before beginning stable repetition', () => {
    const args = {
      moments: moments(54),
      allMeetups: meetups('A', 'B', 'C', 'D', 'E'),
      carouselIds: ['A', 'B', 'C'],
      userLocation: { latitude: 0, longitude: 0 },
      locationGranted: true,
      sessionSeed: 11,
    };
    const first = inlineIds(buildMeetupInjectionRows(args).rows);
    const second = inlineIds(buildMeetupInjectionRows(args).rows);

    assert.deepEqual(first.slice(0, 2), ['D', 'E']);
    assert.deepEqual(first, second);
    assert.equal(first.length, 6);
  });

  it('keeps three other cards between repeats when four or more exist', () => {
    const carouselIds = ['A', 'B', 'C'];
    const inline = inlineIds(
      buildMeetupInjectionRows({
        moments: moments(90),
        allMeetups: meetups('A', 'B', 'C', 'D', 'E'),
        carouselIds,
        userLocation: MUMBAI_FEED,
        locationGranted: false,
        sessionSeed: 13,
        currentUserId: null,
      }).rows,
    );

    assertCooldown([...carouselIds, ...inline], 3);
  });

  it('adapts fairly for one, two, and three available Meetups', () => {
    const one = inlineIds(
      buildMeetupInjectionRows({
        moments: moments(36),
        allMeetups: meetups('A'),
        carouselIds: ['A'],
        userLocation: MUMBAI_FEED,
        locationGranted: false,
        sessionSeed: 17,
        currentUserId: null,
      }).rows,
    );
    assert.deepEqual(one, ['A', 'A', 'A', 'A']);

    const two = inlineIds(
      buildMeetupInjectionRows({
        moments: moments(36),
        allMeetups: meetups('A', 'B'),
        carouselIds: ['A', 'B'],
        userLocation: MUMBAI_FEED,
        locationGranted: false,
        sessionSeed: 19,
        currentUserId: null,
      }).rows,
    );
    assert.deepEqual(two, ['A', 'B', 'A', 'B']);

    const three = inlineIds(
      buildMeetupInjectionRows({
        moments: moments(54),
        allMeetups: meetups('A', 'B', 'C'),
        carouselIds: ['A', 'B', 'C'],
        userLocation: MUMBAI_FEED,
        locationGranted: false,
        sessionSeed: 23,
        currentUserId: null,
      }).rows,
    );
    assertCooldown(['A', 'B', 'C', ...three], 2);
  });
});
