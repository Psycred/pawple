/**
 * Step 21C.3 — share-previews 24h retention contracts.
 * Run: node --test tests/unit/share-preview-retention.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

const migration = readSrc('supabase/migrations/20260916120000_share_preview_retention_24h.sql');
const shareEngine = readSrc('src/utils/shareFeedPost.js');
const momentPreview = readSrc('src/lib/momentSharePreview.js');
const moments = readSrc('src/services/moments.js');
const deleteAccount = readSrc('src/lib/deleteAccount.js');

describe('share-preview retention migration', () => {
  it('defines a 24-hour cleanup cutoff on storage.objects.created_at', () => {
    assert.match(migration, /cleanup_expired_share_previews/);
    assert.match(
      migration,
      /created_at\s*<\s*timezone\('utc',\s*now\(\)\)\s*-\s*interval\s*'24 hours'/,
    );
    assert.match(migration, /bucket_id = 'share-previews'/);
  });

  it('schedules daily cleanup at midnight UTC when pg_cron is available', () => {
    assert.match(migration, /cleanup-expired-share-previews/);
    assert.match(migration, /'0 0 \* \* \*'/);
    assert.match(migration, /SELECT public\.cleanup_expired_share_previews\(\)/);
  });

  it('includes share-previews in account-deletion storage cleanup', () => {
    assert.match(migration, /bucket_id IN \('moments', 'pet-photos', 'share-previews'\)/);
  });
});

describe('share-preview client contracts', () => {
  it('keeps the moment preview path convention', () => {
    assert.match(momentPreview, /MOMENT_SHARE_PREVIEW_RETENTION_HOURS = 24/);
    assert.match(momentPreview, /buildMomentSharePreviewPath/);
    assert.match(momentPreview, /`\$\{ownerId\}\/moment-share\/\$\{id\}\.png`/);
  });

  it('still uploads preview on link share and removes before upload for fresh created_at', () => {
    assert.match(shareEngine, /uploadMomentSharePreview\(ownerId, id, capturedUri\)/);
    assert.match(momentPreview, /\.remove\(\[filePath\]\)/);
    assert.match(momentPreview, /upsert:\s*true/);
  });

  it('does not upload preview on Instagram share', () => {
    const instagramShareBody = shareEngine.slice(
      shareEngine.indexOf('export async function shareMomentInstagramImage'),
      shareEngine.indexOf('export async function shareMomentWithPreview'),
    );
    assert.doesNotMatch(instagramShareBody, /uploadMomentSharePreview/);
  });

  it('cleans up preview on moment delete without failing the RPC', () => {
    assert.match(moments, /deleteMomentSharePreview/);
    assert.match(moments, /share preview cleanup skipped/);
    assert.match(momentPreview, /export async function deleteMomentSharePreview/);
  });

  it('includes share-previews in client account-delete storage purge', () => {
    assert.match(deleteAccount, /SHARE_PREVIEWS_BUCKET/);
    assert.match(deleteAccount, /'moments', PET_PHOTOS_BUCKET, SHARE_PREVIEWS_BUCKET/);
  });

  it('does not add share-completion detection to the share sheet', () => {
    assert.doesNotMatch(shareEngine, /shareCompleted/);
    assert.doesNotMatch(shareEngine, /onShareSuccess/);
    assert.match(shareEngine, /failOnCancel:\s*false/);
  });
});
