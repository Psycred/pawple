import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { meetupDistanceKm } from '../../src/lib/feedProximity.js';
import {
  computeHonestMeetupDistanceKm,
  enrichMeetupsWithVenueDistance,
  withHonestMeetupDistance,
} from '../../src/utils/distanceUtils.js';

describe('meetup venue distance', () => {
  const meetup = {
    id: 'm1',
    venue_lat: 19.076,
    venue_lng: 72.8777,
    location_lat: null,
    location_lng: null,
  };

  const viewer = { latitude: 19.0, longitude: 72.8 };

  it('uses venue_lat/lng before legacy location columns', () => {
    const km = computeHonestMeetupDistanceKm(meetup, viewer.latitude, viewer.longitude);
    assert.ok(km != null && km < 20);
  });

  it('attaches distanceKm for feed consumers without fabricating values', () => {
    const enriched = withHonestMeetupDistance(meetup, viewer);
    assert.ok(Number.isFinite(enriched.distanceKm));
    assert.ok(enriched.distanceKm < 20);
  });

  it('enriches meetup arrays for carousel and inline feed rows', () => {
    const rows = enrichMeetupsWithVenueDistance([meetup], viewer);
    assert.ok(Number.isFinite(rows[0].distanceKm));
  });

  it('sort helper reads venue coords for feed ordering', () => {
    const near = { venue_lat: 19.01, venue_lng: 72.81 };
    const far = { venue_lat: 20.5, venue_lng: 72.81 };
    const nearKm = meetupDistanceKm(near, viewer);
    const farKm = meetupDistanceKm(far, viewer);
    assert.ok(nearKm != null && farKm != null && nearKm < farKm);
  });

  it('omits distance when viewer GPS is unavailable', () => {
    const enriched = withHonestMeetupDistance(meetup, null);
    assert.equal(enriched.distanceKm, undefined);
  });
});
