/**
 * Fix 3C — active-pet deletion integrity unit tests.
 * Run: node --test tests/unit/active-pet-integrity.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveActivePetAfterDelete,
  resolveInitialActivePetId,
} from '../../src/lib/activePetIntegrity.js';

const petA = { id: 'a', created_at: '2026-01-01T00:00:00Z' };
const petB = { id: 'b', created_at: '2026-02-01T00:00:00Z' };
const petC = { id: 'c', created_at: '2026-03-01T00:00:00Z' };

describe('resolveInitialActivePetId', () => {
  it('keeps a valid saved active pet', () => {
    assert.equal(resolveInitialActivePetId('b', [petA, petB, petC]), 'b');
  });

  it('heals stale saved id to the oldest remaining pet', () => {
    assert.equal(resolveInitialActivePetId('deleted', [petB, petA]), 'a');
  });

  it('returns null when the user has no pets', () => {
    assert.equal(resolveInitialActivePetId('stale', []), null);
    assert.equal(resolveInitialActivePetId(null, []), null);
  });

  it('picks the oldest pet when nothing is saved', () => {
    assert.equal(resolveInitialActivePetId(null, [petC, petA, petB]), 'a');
  });
});

describe('resolveActivePetAfterDelete', () => {
  it('selects the first remaining canonical userPets pet when deleting the active pet with siblings', () => {
    assert.equal(resolveActivePetAfterDelete('b', 'b', [petC, petA]), 'a');
    assert.equal(resolveActivePetAfterDelete('c', 'c', [petA, petB]), 'a');
  });

  it('clears active pet when deleting the last pet', () => {
    assert.equal(resolveActivePetAfterDelete('a', 'a', []), null);
  });

  it('does not change active pet when deleting a non-active pet', () => {
    assert.equal(resolveActivePetAfterDelete('a', 'b', [petA]), undefined);
    assert.equal(resolveActivePetAfterDelete('a', 'b', [petA, petC]), undefined);
  });
});

describe('Create Moment no-pet safety (static contract)', () => {
  it('CreateMomentScreen must not silently substitute a fake pet name', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../../src/screens/CreateMomentScreen.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /— Tyson/);
    assert.match(source, /Add a pet to frame a moment/);
  });
});

describe('Deletion screens use setPet (static contract)', () => {
  it('EditPetScreen and ManagePetsScreen must not call setActivePetId from context', async () => {
    const { readFile } = await import('node:fs/promises');
    const edit = await readFile(new URL('../../src/screens/EditPetScreen.js', import.meta.url), 'utf8');
    const manage = await readFile(new URL('../../src/screens/ManagePetsScreen.js', import.meta.url), 'utf8');
    assert.match(edit, /setPet/);
    assert.doesNotMatch(edit, /setActivePetId\s*\(/);
    assert.match(manage, /setPet/);
    assert.doesNotMatch(manage, /setActivePetId\s*\(/);
  });
});

describe('pet deletion screen behavior (static contract)', () => {
  it('EditPetScreen refreshes userPets and stays on screen when active pet is deleted with siblings', async () => {
    const { readFile } = await import('node:fs/promises');
    const edit = await readFile(new URL('../../src/screens/EditPetScreen.js', import.meta.url), 'utf8');
    assert.match(edit, /refreshUserPets/);
    assert.match(edit, /resolveActivePetAfterDelete/);
    assert.match(edit, /navigation\.setParams/);
  });

  it('EditPetScreen routes zero pets to main OnboardingPets with profile params', async () => {
    const { readFile } = await import('node:fs/promises');
    const edit = await readFile(new URL('../../src/screens/EditPetScreen.js', import.meta.url), 'utf8');
    assert.match(edit, /await setPet\(null\)/);
    assert.match(edit, /navigate\('OnboardingPets',\s*\{[\s\S]*fullName:[\s\S]*city:/);
    assert.doesNotMatch(edit, /navigateToMainOnboardingPets[\s\S]*mode:\s*'add'/);
  });

  it('ManagePetsScreen refreshes userPets and routes zero pets to main OnboardingPets', async () => {
    const { readFile } = await import('node:fs/promises');
    const manage = await readFile(new URL('../../src/screens/ManagePetsScreen.js', import.meta.url), 'utf8');
    assert.match(manage, /refreshUserPets/);
    assert.match(manage, /!remaining\?\.length/);
    assert.match(manage, /navigate\('OnboardingPets',\s*\{[\s\S]*fullName:[\s\S]*city:/);
    assert.match(manage, /\.order\('created_at',\s*\{\s*ascending:\s*false\s*\}\)/);
  });

  it('ManagePetsScreen add-pet flow still uses mode add', async () => {
    const { readFile } = await import('node:fs/promises');
    const manage = await readFile(new URL('../../src/screens/ManagePetsScreen.js', import.meta.url), 'utf8');
    assert.match(manage, /goToAdd[\s\S]*mode:\s*'add'/);
  });
});
