/**
 * Phase 3 — completed meetup card + blocked pets hidden in meetup participant UI.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  filterPetsNotBlocked,
  isBlockedByPetIds,
} from '../../src/lib/petBlockVisibility.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Phase 3 block visibility helpers', () => {
  it('filterPetsNotBlocked removes blocked pet rows', () => {
    const pets = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const filtered = filterPetsNotBlocked(pets, new Set(['b']));
    assert.deepEqual(filtered.map((p) => p.id), ['a']);
  });

  it('isBlockedByPetIds detects any blocked host pet', () => {
    assert.equal(isBlockedByPetIds(['host-1', 'host-2'], new Set(['host-2'])), true);
    assert.equal(isBlockedByPetIds(['host-1'], new Set(['joiner-1'])), false);
  });
});

describe('Phase 3 meetup UI wiring', () => {
  it('MeetupCard shows Completed CTA for past meetups', () => {
    const source = readSrc('src/components/MeetupCard.js');
    assert.match(source, /isMeetupPast/);
    assert.match(source, /Completed/);
  });

  it('MeetupDetailsScreen filters participants and hosts by block list', () => {
    const source = readSrc('src/screens/MeetupDetailsScreen.js');
    assert.match(source, /extractVisibleMeetupParticipantPets/);
    assert.match(source, /extractVisibleMeetupHostPetIds/);
    assert.match(source, /fetchBlockedPetIds/);
    assert.match(source, /handlePetBlocked/);
  });

  it('meetups service exports viewer-scoped participant helpers', () => {
    const source = readSrc('src/services/meetups.js');
    assert.match(source, /export function extractVisibleMeetupParticipantPets/);
    assert.match(source, /export function extractVisibleMeetupHostPetIds/);
  });
});
