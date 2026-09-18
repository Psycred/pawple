/**
 * Onboarding photo picker validates after crop confirmation, before state commit.
 * Run: node --test tests/unit/onboarding-photo-picker-validation.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Onboarding photo picker validation timing', () => {
  const onboarding = readSrc('src/screens/OnboardingPetsScreen.js');

  it('awaits approvePickedPhotoUri before committing photoUri to onboarding state', () => {
    assert.match(onboarding, /const commitPickedPetPhoto = useCallback/);
    assert.match(
      onboarding,
      /const allowed = await approvePickedPhotoUri\(uri,[\s\S]*?if \(!allowed\) \{[\s\S]*?return false;[\s\S]*?updatePetField\(index, 'photoUri', uri\)/,
    );
  });

  it('does not commit rejected photos or run background-only validation', () => {
    assert.doesNotMatch(onboarding, /validatePetPhotoInBackground/);
    assert.doesNotMatch(onboarding, /void validatePetPhotoInBackground/);
    assert.doesNotMatch(onboarding, /updatePetField\(index, 'photoUri', uri\);[\s\S]*?approvePickedPhotoUri/);
  });

  it('shows validating state while the gate runs', () => {
    assert.match(onboarding, /setPhotoValidatingPetIndex\(index\)/);
    assert.match(onboarding, /photoValidatingPetIndex === index/);
  });
});

describe('Other surfaces keep existing picker-time validation', () => {
  const editPet = readSrc('src/screens/EditPetScreen.js');
  const createMoment = readSrc('src/screens/CreateMomentScreen.js');

  it('Edit Pet still blocks before setPhotoUri', () => {
    assert.match(
      editPet,
      /const allowed = await approvePickedPhotoUri\([\s\S]*?if \(!allowed\) \{[\s\S]*?setPhotoUri/,
    );
  });

  it('Create Moment still blocks before setImageUri', () => {
    assert.match(
      createMoment,
      /const allowed = await approvePickedPhotoUri\(asset\.uri,[\s\S]*?if \(!allowed\) \{[\s\S]*?setImageUri/,
    );
  });
});

describe('Photo rejection copy', () => {
  const gate = readSrc('src/lib/photoValidationGate.js');

  it('NSFW rejection explains explicit content calmly', () => {
    assert.match(gate, /\[REASON\.NSFW_DETECTED\]: \{[\s\S]*?title: "This photo can't be used\."[\s\S]*?message: 'Choose a photo without explicit content\.'/);
    assert.doesNotMatch(gate, /NSFW_DETECTED[\s\S]*?inappropriate|nude|porn/i);
  });

  it('NO_ANIMAL rejection copy is unchanged', () => {
    assert.match(
      gate,
      /\[REASON\.NO_ANIMAL\]: \{[\s\S]*?title: "That doesn't look like a pet\."[\s\S]*?message: 'Choose another photo'/,
    );
  });
});
