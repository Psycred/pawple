/**
 * 10B-B.6 — unavailable meetup navigation guard.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { openMeetupIfAvailable } from '../../src/lib/openMeetupIfAvailable.js';

const MEETUP_ID = '11111111-1111-4111-8111-111111111111';

describe('openMeetupIfAvailable', () => {
  it('navigates when meetup row exists', async () => {
    let navigated = false;
    const navigation = {
      navigate: (screen, params) => {
        navigated = true;
        assert.equal(screen, 'MeetupDetailsScreen');
        assert.equal(params.meetupId, MEETUP_ID);
        assert.equal(params.meetup.id, MEETUP_ID);
      },
    };

    const ok = await openMeetupIfAvailable({
      navigation,
      meetupId: MEETUP_ID,
      fetchById: async () => ({ id: MEETUP_ID, title: 'Still here' }),
    });

    assert.equal(ok, true);
    assert.equal(navigated, true);
  });

  it('shows unavailable instead of navigating when fetch returns null', async () => {
    let navigated = false;
    let unavailable = false;
    const navigation = {
      navigate: () => {
        navigated = true;
      },
    };

    const ok = await openMeetupIfAvailable({
      navigation,
      meetupId: MEETUP_ID,
      onUnavailable: () => {
        unavailable = true;
      },
      fetchById: async () => null,
    });

    assert.equal(ok, false);
    assert.equal(navigated, false);
    assert.equal(unavailable, true);
  });

  it('allows demo meetup ids without a server fetch', async () => {
    let navigated = false;
    const navigation = {
      navigate: (screen, params) => {
        navigated = true;
        assert.equal(params.meetupId, 'demo-meetup-1');
      },
    };

    const ok = await openMeetupIfAvailable({
      navigation,
      meetupId: 'demo-meetup-1',
      meetup: { id: 'demo-meetup-1', title: 'Demo' },
      fetchById: async () => {
        throw new Error('should not fetch demo meetups');
      },
    });

    assert.equal(ok, true);
    assert.equal(navigated, true);
  });
});
