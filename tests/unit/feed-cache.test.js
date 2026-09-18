import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('feed cache', () => {
  it('stores a versioned per-user feed snapshot', () => {
    const source = readSrc('src/lib/feedCache.js');
    assert.match(source, /@pawple\/feed_snapshot_v1/);
    assert.match(source, /FEED_CACHE_VERSION = 1/);
    assert.match(source, /String\(parsed\.userId/);
  });

  it('hydrates FeedScreen before the network reload', () => {
    const feed = readSrc('src/screens/FeedScreen.js');
    assert.match(feed, /readCachedFeedSnapshot/);
    assert.match(feed, /writeCachedFeedSnapshot/);
    assert.match(feed, /applyCachedSnapshot/);
    assert.match(feed, /shouldRefreshAfterCacheHydrateRef/);
  });

  it('clears feed cache on per-user local state purge', () => {
    const source = readSrc('src/lib/userLocalState.js');
    assert.match(source, /clearCachedFeedSnapshot/);
  });
});
