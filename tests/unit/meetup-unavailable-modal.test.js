/**
 * 10B-B.6 — unavailable meetup modal copy and Pawple confirm pattern.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const modalSource = readFileSync(
  join(root, 'src/components/MeetupUnavailableModal.js'),
  'utf8',
);

describe('MeetupUnavailableModal', () => {
  it('uses Pawple single-action confirm with required copy', () => {
    assert.match(modalSource, /PawpleConfirmModal/);
    assert.match(modalSource, /Meetup not available anymore/);
    assert.match(modalSource, /confirmLabel="OK"/);
    assert.match(modalSource, /mode="single"/);
  });
});
