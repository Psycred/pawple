/**
 * PAW-105 — client mirror of introduction_message_body_contains_link.
 * Run: node --test tests/unit/intro-chat-link-guard.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { introductionMessageBodyContainsLink } from '../../src/lib/introChatLinkGuard.js';

describe('introductionMessageBodyContainsLink', () => {
  it('rejects explicit http/https URLs', () => {
    assert.equal(introductionMessageBodyContainsLink('See https://example.com'), true);
    assert.equal(introductionMessageBodyContainsLink('See http://example.com/path'), true);
  });

  it('rejects www prefix', () => {
    assert.equal(introductionMessageBodyContainsLink('Check www.example.com'), true);
  });

  it('rejects bare domain + common TLD', () => {
    assert.equal(introductionMessageBodyContainsLink('Visit example.com later'), true);
    assert.equal(introductionMessageBodyContainsLink('email me at foo.io'), true);
  });

  it('allows phone numbers and plain text', () => {
    assert.equal(
      introductionMessageBodyContainsLink('Call me at 9876543210 when you are free'),
      false,
    );
    assert.equal(
      introductionMessageBodyContainsLink('Sounds good — meet at the park this weekend?'),
      false,
    );
  });

  it('returns false for empty input', () => {
    assert.equal(introductionMessageBodyContainsLink(''), false);
    assert.equal(introductionMessageBodyContainsLink('   '), false);
    assert.equal(introductionMessageBodyContainsLink(null), false);
  });
});
