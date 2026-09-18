import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MEETUP_FEED_RADIUS_KM,
  MOMENT_FEED_RADIUS_KM,
  meetupDistanceKm,
  meetupEffectiveSortKm,
  meetupGpsToCityCentroidKm,
  prepareMeetupFeedPools,
  seededShuffle,
  sortMeetupsByFeedRelevance,
  sortMomentsForFeed,
} from '../../src/lib/feedProximity.js';

const FUTURE = { date: '2027-06-01', start_time: '10:00:00' };

describe('feedProximity', () => {
  it('exposes Phase 2 radius constants', () => {
    assert.equal(MEETUP_FEED_RADIUS_KM, 100);
    assert.equal(MOMENT_FEED_RADIUS_KM, 200);
  });

  it('shuffles meetups globally when viewer has no city context', () => {
    const meetups = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const pools = prepareMeetupFeedPools(meetups, null, false, 12345);
    assert.equal(pools.mode, 'global');
    assert.equal(pools.carouselMeetups.length, 3);
    assert.equal(pools.injectionMeetups.length, 4);
  });

  it('matches meetup city aliases for the viewer current city', () => {
    const meetups = [
      { id: 'bombay', city: 'Bombay', ...FUTURE },
      { id: 'delhi', city: 'Delhi', ...FUTURE },
    ];
    const pools = prepareMeetupFeedPools(
      meetups,
      { profileCity: 'Pune', deviceCity: 'Mumbai' },
      false,
      3,
    );
    assert.equal(pools.mode, 'city');
    assert.deepEqual(pools.injectionMeetups.map((m) => m.id), ['bombay']);
  });

  it('includes meetups within 100 km of the viewer base city', () => {
    const meetups = [
      { id: 'gurgaon', city: 'Gurgaon', ...FUTURE },
      { id: 'chandigarh', city: 'Chandigarh', ...FUTURE },
    ];
    const pools = prepareMeetupFeedPools(
      meetups,
      { profileCity: 'Delhi', deviceCity: null },
      false,
      4,
    );
    assert.equal(pools.mode, 'city');
    assert.deepEqual(pools.injectionMeetups.map((m) => m.id), ['gurgaon']);
  });

  it('always includes the viewer own upcoming meetup outside their city', () => {
    const meetups = [
      { id: 'owned-far', user_id: 'viewer', city: 'Chandigarh', ...FUTURE },
      { id: 'local', city: 'Mumbai', ...FUTURE },
    ];
    const pools = prepareMeetupFeedPools(
      meetups,
      { profileCity: 'Mumbai', deviceCity: 'Mumbai' },
      false,
      5,
      'viewer',
    );
    assert.equal(pools.mode, 'city');
    assert.deepEqual(pools.carouselMeetups.map((m) => m.id), ['owned-far', 'local']);
  });

  it('sorts local moments by distance then newest; hearted pets lead fallback', () => {
    const moments = [
      { id: 'local-old', latitude: 0.01, longitude: 0, created_at: '2026-01-01' },
      { id: 'local-new', latitude: 0.02, longitude: 0, created_at: '2026-02-01' },
      { id: 'far-heart', latitude: 5, longitude: 0, pet_ids: ['pet-a'], created_at: '2026-03-01' },
      { id: 'far-plain', latitude: 6, longitude: 0, pet_ids: ['pet-b'], created_at: '2026-04-01' },
    ];
    const ordered = sortMomentsForFeed(moments, { latitude: 0, longitude: 0 }, {
      locationGranted: true,
      heartedPetIds: new Set(['pet-a']),
      sessionSeed: 99,
    });
    assert.deepEqual(
      ordered.map((m) => m.id),
      ['local-old', 'local-new', 'far-heart', 'far-plain'],
    );
  });

  it('seededShuffle is deterministic for the same seed', () => {
    const items = [1, 2, 3, 4, 5];
    const first = seededShuffle(items, 42).join(',');
    const second = seededShuffle(items, 42).join(',');
    assert.equal(first, second);
    assert.notEqual(first, items.join(','));
  });

  it('ranks by venue distance when viewer GPS and venue coordinates exist', () => {
    const viewer = { latitude: 18.5204, longitude: 73.8567, profileCity: 'Pune', deviceCity: 'Pune' };
    const near = { id: 'near', city: 'Pune', venue_lat: 18.53, venue_lng: 73.86, ...FUTURE };
    const far = { id: 'far', city: 'Pune', venue_lat: 18.62, venue_lng: 73.95, ...FUTURE };
    const ordered = sortMeetupsByFeedRelevance([far, near], { profileCity: 'Pune', deviceCity: 'Pune' }, viewer);
    assert.deepEqual(ordered.map((m) => m.id), ['near', 'far']);
    assert.ok(meetupDistanceKm(near, viewer) < meetupDistanceKm(far, viewer));
  });

  it('ranks no-venue meetups by GPS distance to city centroid', () => {
    const viewer = { latitude: 26.9124, longitude: 75.7873, profileCity: 'Mumbai', deviceCity: 'Jaipur' };
    const local = { id: 'jaipur', city: 'Jaipur', ...FUTURE };
    const far = { id: 'mumbai', city: 'Mumbai', ...FUTURE };
    const localKm = meetupGpsToCityCentroidKm(local, viewer);
    const farKm = meetupGpsToCityCentroidKm(far, viewer);
    assert.ok(localKm != null && farKm != null && localKm < farKm);
    const ordered = sortMeetupsByFeedRelevance(
      [far, local],
      { profileCity: 'Mumbai', deviceCity: 'Jaipur' },
      viewer,
    );
    assert.deepEqual(ordered.map((m) => m.id), ['jaipur', 'mumbai']);
  });

  it('does not let a far venue-coords meetup outrank a nearer no-coords meetup', () => {
    const viewer = { latitude: 26.9124, longitude: 75.7873, profileCity: 'Mumbai', deviceCity: 'Jaipur' };
    const nearbyNoCoords = { id: 'jaipur', city: 'Jaipur', ...FUTURE };
    const farWithCoords = {
      id: 'mumbai-venue',
      city: 'Mumbai',
      venue_lat: 19.076,
      venue_lng: 72.8777,
      ...FUTURE,
    };
    assert.ok(
      meetupEffectiveSortKm(nearbyNoCoords, viewer, { profileCity: 'Mumbai', deviceCity: 'Jaipur' })
        < meetupEffectiveSortKm(farWithCoords, viewer, { profileCity: 'Mumbai', deviceCity: 'Jaipur' }),
    );
    const ordered = sortMeetupsByFeedRelevance(
      [farWithCoords, nearbyNoCoords],
      { profileCity: 'Mumbai', deviceCity: 'Jaipur' },
      viewer,
    );
    assert.deepEqual(ordered.map((m) => m.id), ['jaipur', 'mumbai-venue']);
  });

  it('prioritizes device city over profile city when GPS is unavailable', () => {
    const viewerCities = { profileCity: 'Mumbai', deviceCity: 'Pune' };
    const puneMeetup = { id: 'pune', city: 'Pune', ...FUTURE };
    const mumbaiMeetup = { id: 'mumbai', city: 'Mumbai', ...FUTURE };
    const ordered = sortMeetupsByFeedRelevance(
      [mumbaiMeetup, puneMeetup],
      viewerCities,
      { profileCity: 'Mumbai', deviceCity: 'Pune' },
    );
    assert.deepEqual(ordered.map((m) => m.id), ['pune', 'mumbai']);
  });

  it('keeps profile city usable for relevance when device city is unavailable', () => {
    const meetups = [
      { id: 'gurgaon', city: 'Gurgaon', ...FUTURE },
      { id: 'chandigarh', city: 'Chandigarh', ...FUTURE },
    ];
    const pools = prepareMeetupFeedPools(
      meetups,
      { profileCity: 'Delhi', deviceCity: null },
      false,
      8,
    );
    assert.equal(pools.mode, 'city');
    assert.deepEqual(pools.injectionMeetups.map((m) => m.id), ['gurgaon']);
  });

  it('keeps global fallback when neither profile nor device city is available', () => {
    const meetups = [{ id: 'a', city: 'Mumbai', ...FUTURE }, { id: 'b', city: 'Delhi', ...FUTURE }];
    const pools = prepareMeetupFeedPools(meetups, null, false, 99);
    assert.equal(pools.mode, 'global');
    assert.equal(pools.injectionMeetups.length, 2);
  });
});
