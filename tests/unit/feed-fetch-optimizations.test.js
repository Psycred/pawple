import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { collectHeartedPetIdsFromLikesEmbed } from '../../src/lib/heartedPetIds.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('MW3 feed fetch optimizations', () => {
  it('collects hearted pet ids from a single likes → moments embed', () => {
    const petIds = collectHeartedPetIdsFromLikesEmbed([
      { moments: { pet_ids: ['pet-a', 'pet-b'] } },
      { moments: { pet_ids: ['pet-b', 'pet-c'] } },
      { moments: null },
    ]);

    assert.deepEqual([...petIds].sort(), ['pet-a', 'pet-b', 'pet-c']);
  });

  it('uses a lean feed meetup select without heavy participant pet embeds', () => {
    const source = readSrc('src/services/meetups.js');
    const feedSelect = source.match(
      /const FEED_MEETUP_SELECT\s*=\s*'([^']+)'/,
    )?.[1];

    assert.ok(feedSelect, 'FEED_MEETUP_SELECT constant is defined');
    assert.match(source, /fetchMeetupsForFeed/);
    assert.doesNotMatch(feedSelect, /photo_url/);
    assert.doesNotMatch(feedSelect, /owner_id/);
    assert.doesNotMatch(feedSelect, /pets\([^)]*breed/);
    assert.match(feedSelect, /meetup_hosts\(pet_id, pets\(id, name\)\)/);
    assert.match(source, /\.or\('status\.is\.null,status\.eq\.upcoming'\)/);
  });

  it('loads Feed in one auth pass and parallelizes feed fetches', () => {
    const feed = readSrc('src/screens/FeedScreen.js');

    assert.match(feed, /fetchMeetupsForFeed\(\)/);
    assert.match(feed, /fetchBlockedPetIds\(userId\)/);
    assert.match(feed, /fetchFeedMoments\(userId, null/);
    assert.match(feed, /sortFeedMoments\(/);
    assert.doesNotMatch(feed, /fetchMeetups\(\)/);
  });

  it('allows blocked-pet fetch to reuse a known user id', () => {
    const blocks = readSrc('src/services/blocks.js');

    assert.match(blocks, /export async function fetchBlockedPetIds\(userId = null\)/);
    assert.match(blocks, /eq\('blocker_user_id', resolvedUserId\)/);
  });
});
