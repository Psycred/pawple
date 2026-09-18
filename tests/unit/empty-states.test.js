/**
 * Empty-state copy and error/empty distinction.
 * Run: node --test tests/unit/empty-states.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  FEED_EMPTY_BODY,
  FEED_EMPTY_TITLE,
  MATING_DISCOVER_EMPTY_NO_MATCHES_BODY,
  MATING_DISCOVER_EMPTY_NO_MATCHES_TITLE,
  PET_JOURNAL_EMPTY_BODY,
  PET_JOURNAL_EMPTY_TITLE,
} from '../../src/content/legalDocuments.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('approved empty-state copy', () => {
  it('uses Moment Mating no-match copy', () => {
    assert.equal(MATING_DISCOVER_EMPTY_NO_MATCHES_TITLE, 'No matches just yet');
    assert.match(
      MATING_DISCOVER_EMPTY_NO_MATCHES_BODY,
      /There aren't any pets nearby to connect with right now/,
    );
  });

  it('uses Feed empty copy', () => {
    assert.equal(FEED_EMPTY_TITLE, 'Nothing to see just yet');
    assert.match(FEED_EMPTY_BODY, /Your Pawple community is still waking up/);
  });

  it('uses Pet Journal Moment terminology', () => {
    assert.equal(PET_JOURNAL_EMPTY_TITLE, 'Their story starts here');
    assert.match(PET_JOURNAL_EMPTY_BODY, /Add a Moment to keep track/);
  });
});

describe('empty vs error wiring', () => {
  it('Mating discovery shows empty copy for zero opportunities', () => {
    const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
    assert.match(discovery, /MATING_DISCOVER_EMPTY_NO_MATCHES_TITLE/);
    assert.match(discovery, /opportunities\.length === 0/);
    assert.match(discovery, /loadSequenceRef/);
    assert.match(discovery, /PawpleEmptyState/);
  });

  it('Mating discovery keeps LoadErrorRetry for genuine failures only', () => {
    const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
    assert.match(discovery, /if \(error\)[\s\S]*LoadErrorRetry/);
    assert.doesNotMatch(
      discovery,
      /opportunities\.length === 0[\s\S]*LoadErrorRetry/,
    );
  });

  it('Feed distinguishes load error from genuine empty', () => {
    const feed = readSrc('src/screens/FeedScreen.js');
    assert.match(feed, /loadError[\s\S]*LoadErrorRetry/);
    assert.match(feed, /FEED_EMPTY_TITLE/);
    assert.match(feed, /!loadError/);
    assert.match(feed, /PawpleEmptyState/);
  });

  it('Pet Journal uses PawpleEmptyState on successful empty journal', () => {
    const profile = readSrc('src/screens/PetProfileScreen.js');
    assert.match(profile, /PET_JOURNAL_EMPTY_TITLE/);
    assert.match(profile, /feedMoments\.length === 0[\s\S]*PawpleEmptyState/);
  });
});
