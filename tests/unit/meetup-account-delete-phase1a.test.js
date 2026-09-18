/**
 * 10B-B.6 — Phase 1A meetup account delete migration contracts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migration = readFileSync(
  join(root, 'supabase/migrations/20260913150000_meetup_account_delete_phase1a.sql'),
  'utf8',
);

describe('10B-B.6 meetup account delete migration', () => {
  it('drops abandoned history-lock artifacts', () => {
    assert.match(migration, /DROP COLUMN IF EXISTS history_locked_at/);
    assert.match(migration, /DROP TRIGGER IF EXISTS meetup_participants_leave_guard/);
  });

  it('hard-deletes owned meetups in delete_user_account', () => {
    assert.match(migration, /DELETE FROM public\.meetups WHERE id = ANY \(owned_meetup_ids\)/);
    assert.match(
      migration,
      /OR meetup_id = ANY \(owned_meetup_ids\)/,
    );
  });

  it('does not block account deletion on upcoming hosted meetups', () => {
    assert.doesNotMatch(migration, /account_delete_blocked_upcoming_hosted_meetups/);
    assert.doesNotMatch(migration, /meetups_creator_cleared/);
  });
});
