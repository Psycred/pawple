/**
 * PAW-222 invite URL helpers — unit tests.
 * Run: node --test tests/unit/invite-links.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildInviteUrl,
  buildInviteShareMessage,
  buildStoreFallbackUrls,
  parseInviteCodeFromUrl,
  INVITE_WEB_ORIGIN,
} from '../../src/lib/inviteLinks.js';

describe('inviteLinks (PAW-222 I2)', () => {
  it('buildInviteUrl encodes code in path', () => {
    assert.equal(buildInviteUrl('PAW-TEST1'), `${INVITE_WEB_ORIGIN}/invite/PAW-TEST1`);
    assert.equal(buildInviteUrl('@paw-test1'), `${INVITE_WEB_ORIGIN}/invite/PAW-TEST1`);
  });

  it('uses separate configurable platform landing placeholders', () => {
    assert.deepEqual(buildStoreFallbackUrls(), {
      android: `${INVITE_WEB_ORIGIN}/download/android`,
      ios: `${INVITE_WEB_ORIGIN}/download/ios`,
    });
  });

  it('builds the complete invitation with invite URL and install fallback', () => {
    const message = buildInviteShareMessage({ code: 'PAW-XXXX' });
    assert.equal(
      message,
      [
        'Welcome to Pawple — an invite-only app for journaling the life of your furry companion, discovering pet meetups nearby, and finding potential mating partners.',
        '',
        "We're still growing, one pet at a time. Show some love to the furries around you and join Pawple.",
        '',
        `${INVITE_WEB_ORIGIN}/invite/PAW-XXXX`,
        '',
        "Don't have the app yet?",
        'Android · iOS',
      ].join('\n'),
    );
  });

  it('parseInviteCodeFromUrl handles custom scheme and HTTPS', () => {
    assert.equal(parseInviteCodeFromUrl('pawple://invite/PAW-TEST'), 'PAW-TEST');
    assert.equal(parseInviteCodeFromUrl('https://pawple.com/invite/PAW-TEST'), 'PAW-TEST');
    assert.equal(parseInviteCodeFromUrl('https://www.pawple.com/invite/paw-test'), 'PAW-TEST');
    assert.equal(parseInviteCodeFromUrl('https://example.com/invite/PAW-TEST'), null);
    assert.equal(parseInviteCodeFromUrl('https://pawple.com/moment/abc'), null);
  });
});
