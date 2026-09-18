import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseSupabaseStorageReference,
  SHARE_PREVIEWS_BUCKET,
} from '../../src/lib/storageMediaParse.js';

describe('storage media helpers', () => {
  it('parses public storage URLs', () => {
    const parsed = parseSupabaseStorageReference(
      'https://example.supabase.co/storage/v1/object/public/moments/user-1/photo.jpg',
    );
    assert.deepEqual(parsed, { bucket: 'moments', path: 'user-1/photo.jpg' });
  });

  it('parses bucket:path references', () => {
    const parsed = parseSupabaseStorageReference('share-previews:user-1/moment-share/m1.png');
    assert.equal(parsed.bucket, SHARE_PREVIEWS_BUCKET);
    assert.equal(parsed.path, 'user-1/moment-share/m1.png');
  });

  it('returns null for empty values', () => {
    assert.equal(parseSupabaseStorageReference(''), null);
  });
});
