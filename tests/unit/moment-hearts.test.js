import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { normalizeMomentHeartState } from '../../src/lib/momentHeartState.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('permanent Moment heart state', () => {
  it('uses aggregate count for the visual state independently of the viewer', () => {
    assert.deepEqual(
      normalizeMomentHeartState({ heart_count: 0, viewer_has_hearted: false }),
      {
        heartCount: 0,
        hasEverBeenHearted: false,
        viewerHasHearted: false,
      },
    );
    assert.deepEqual(
      normalizeMomentHeartState({ heart_count: 2, viewer_has_hearted: false }),
      {
        heartCount: 2,
        hasEverBeenHearted: true,
        viewerHasHearted: false,
      },
    );
  });

  it('keeps the icon aggregate-driven and pulses on every tap', () => {
    const card = readSrc('src/components/MomentCard.js');
    const actionBar = readSrc('src/components/ActionBar.js');

    assert.match(card, /isLiked=\{heartCount > 0\}/);
    assert.match(card, /viewerHasHearted \|\| heartInProgressRef\.current/);
    assert.doesNotMatch(card, /setHeartCount\(\(prev\) => !prev\)/);
    assert.match(actionBar, /const handleLike = \(\) => \{\s*runGentleHeartbeat\(scale\);/);
    assert.doesNotMatch(actionBar, /Unlike memory/);
  });

  it('provides only idempotent insertion and disables client deletion', () => {
    const migration = readSrc(
      'supabase/migrations/20260909130000_irreversible_moment_hearts.sql',
    );

    assert.match(
      migration,
      /ON CONFLICT \(user_id, moment_id\) DO NOTHING/,
    );
    assert.match(migration, /DROP POLICY IF EXISTS likes_delete_own/);
    assert.match(migration, /REVOKE DELETE ON TABLE public\.likes FROM authenticated/);
    assert.doesNotMatch(migration, /DELETE FROM public\.likes/);
  });

  it('hydrates both Feed and Profile Moments from the same aggregate RPC', () => {
    const moments = readSrc('src/services/moments.js');
    const feed = readSrc('src/screens/FeedScreen.js');
    const profile = readSrc('src/screens/PetProfileScreen.js');

    assert.match(moments, /fetchMomentHeartStates/);
    assert.match(moments, /const momentsWithHeartState = await withMomentHeartStates\(mapped\)/);
    assert.match(moments, /const momentsWithHeartState = await withMomentHeartStates\(rows\)/);
    assert.doesNotMatch(feed, /\.from\('likes'\)\.delete\(\)/);
    assert.match(profile, /heart_count: Math\.max\(0, Number\(m\.heart_count\) \|\| 0\)/);
  });
});
