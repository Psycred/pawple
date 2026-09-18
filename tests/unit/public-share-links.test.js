import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PUBLIC_SHARE_ORIGIN,
  buildMeetupShareOgUrl,
  buildMomentShareOgUrl,
  buildPublicShareUrl,
  parseShareDestination,
} from '../../src/lib/publicShareLinks.js';

describe('public Moment and Meetup share links', () => {
  it('builds centrally configured pawple.app HTTPS URLs', () => {
    assert.equal(PUBLIC_SHARE_ORIGIN, 'https://pawple.app');
    assert.equal(
      buildPublicShareUrl('moment', 'moment id'),
      'https://pawple.app/moment/moment%20id',
    );
    assert.equal(
      buildPublicShareUrl('meetup', 'meetup-id'),
      'https://pawple.app/meetup/meetup-id',
    );
  });

  it('parses public HTTPS destinations', () => {
    assert.deepEqual(
      parseShareDestination('https://pawple.app/moment/moment%20id'),
      { type: 'moment', id: 'moment id' },
    );
    assert.deepEqual(
      parseShareDestination('https://pawple.app/meetup/meetup-id'),
      { type: 'meetup', id: 'meetup-id' },
    );
  });

  it('retains legacy custom-scheme support', () => {
    assert.deepEqual(parseShareDestination('pawple://moment/abc'), {
      type: 'moment',
      id: 'abc',
    });
    assert.deepEqual(parseShareDestination('pawple://meetup/xyz'), {
      type: 'meetup',
      id: 'xyz',
    });
  });

  it('builds moment OG share URLs for messenger previews', () => {
    const previous = process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    assert.equal(
      buildMomentShareOgUrl('moment-id'),
      'https://example.supabase.co/functions/v1/moment-share?id=moment-id',
    );
    assert.equal(
      buildMomentShareOgUrl('moment-id', 'user-abc'),
      'https://example.supabase.co/functions/v1/moment-share?id=moment-id&preview=user-abc',
    );
    process.env.EXPO_PUBLIC_SUPABASE_URL = previous;
  });

  it('builds meetup OG share URLs for messenger previews', () => {
    const previous = process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    assert.equal(
      buildMeetupShareOgUrl('meetup-id'),
      'https://example.supabase.co/functions/v1/meetup-share?id=meetup-id',
    );
    assert.equal(
      buildMeetupShareOgUrl('meetup-id', 'user-abc'),
      'https://example.supabase.co/functions/v1/meetup-share?id=meetup-id&preview=user-abc',
    );
    process.env.EXPO_PUBLIC_SUPABASE_URL = previous;
  });

  it('rejects unrelated hosts, paths, and schemes', () => {
    assert.equal(parseShareDestination('https://pawple.com/moment/abc'), null);
    assert.equal(parseShareDestination('https://example.com/meetup/xyz'), null);
    assert.equal(parseShareDestination('http://pawple.app/moment/abc'), null);
    assert.equal(parseShareDestination('https://pawple.app/invite/CODE'), null);
  });
});
