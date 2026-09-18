/**
 * Moment/Meetup link sharing passes pawple.app HTTPS links in message text and,
 * when available, attaches the already-captured preview PNG to native share.
 * Run: node --test tests/unit/share-public-link.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  buildPublicShareUrl,
  PUBLIC_SHARE_ORIGIN,
} from '../../src/lib/publicShareLinks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shareEngine = readFileSync(join(root, 'src/utils/shareFeedPost.js'), 'utf8');

function extractFunctionBody(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) {
    return '';
  }
  const nextExport = source.indexOf('\nexport ', start + 1);
  return nextExport > start ? source.slice(start, nextExport) : source.slice(start);
}

describe('sharePublicLink message and fallback behaviour', () => {
  const sharePublicLinkFn = extractFunctionBody(
    shareEngine,
    'export async function sharePublicLink',
  );

  it('keeps caption plus canonical HTTPS link in the share message body', () => {
    assert.match(shareEngine, /const message = text \? `\$\{text\}\\n\\n\$\{link\}` : link;/);
  });

  it('falls back to text plus HTTPS link when no imageUri is available', () => {
    assert.match(sharePublicLinkFn, /if \(Platform\.OS === 'ios'\) \{[\s\S]*?url: link/);
    assert.match(sharePublicLinkFn, /RNShare\.open\(\{[\s\S]*?url: link/);
  });
});

describe('sharePublicLink image-aware native payload', () => {
  const sharePublicLinkFn = extractFunctionBody(
    shareEngine,
    'export async function sharePublicLink',
  );

  it('accepts an optional captured preview image URI', () => {
    assert.match(shareEngine, /export async function sharePublicLink\(\{ caption, displayUrl, imageUri \}\)/);
    assert.match(sharePublicLinkFn, /resolveShareableImageUri\(imageUri\)/);
  });

  it('attaches the local PNG to native share while keeping the HTTPS URL in message', () => {
    assert.match(sharePublicLinkFn, /url: shareableImageUri/);
    assert.match(sharePublicLinkFn, /type: imageMimeType\(shareableImageUri\)/);
    assert.match(sharePublicLinkFn, /useInternalStorage: true/);
    assert.match(sharePublicLinkFn, /message,/);
  });
});

describe('Moment and Meetup share entry points', () => {
  it('uses canonical HTTPS builders for displayUrl', () => {
    assert.match(shareEngine, /buildPublicShareUrl\('moment',\s*id\)/);
    assert.match(shareEngine, /buildPublicShareUrl\('meetup',\s*id\)/);
    assert.equal(
      buildPublicShareUrl('moment', 'abc-123'),
      `${PUBLIC_SHARE_ORIGIN}/moment/abc-123`,
    );
    assert.equal(
      buildPublicShareUrl('meetup', 'meet-9'),
      `${PUBLIC_SHARE_ORIGIN}/meetup/meet-9`,
    );
  });

  it('still uploads preview cards before sharing the link', () => {
    assert.match(shareEngine, /uploadMomentSharePreview\(ownerId, id, capturedUri\)/);
    assert.match(shareEngine, /uploadMeetupSharePreview\(ownerId, id, capturedUri\)/);
  });

  it('passes the same captured PNG URI into sharePublicLink for Moment and Meetup', () => {
    const momentShareFn = extractFunctionBody(
      shareEngine,
      'export async function shareMomentWithPreview',
    );
    const meetupShareFn = extractFunctionBody(
      shareEngine,
      'export async function shareMeetupWithPreview',
    );

    assert.match(momentShareFn, /let capturedUri = null;/);
    assert.match(momentShareFn, /imageUri: capturedUri/);
    assert.match(meetupShareFn, /let capturedUri = null;/);
    assert.match(meetupShareFn, /imageUri: capturedUri/);
  });
});

describe('unrelated feed demo sharing remains image-first', () => {
  it('keeps shareFeedPost as a separate image-sharing path', () => {
    assert.match(shareEngine, /export async function shareFeedPost\(post\)/);
    assert.match(shareEngine, /url: shareableUri/);
    assert.doesNotMatch(shareEngine, /shareFeedPost[\s\S]*?sharePublicLink/);
  });
});
