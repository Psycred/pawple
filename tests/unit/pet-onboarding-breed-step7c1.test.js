import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  getPetFieldErrors,
  hasValidBreed,
  isPetValid,
} from '../../src/lib/petOnboardingValidation.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const onboardingPets = readFileSync(join(root, 'src/screens/OnboardingPetsScreen.js'), 'utf8');
const onboardingValidation = readFileSync(join(root, 'src/lib/petOnboardingValidation.js'), 'utf8');

const basePet = {
  name: 'Tyson',
  pet_type: 'dog',
  pet_type_custom: '',
  breed: '',
};

describe('Step 7C.1 breed validation', () => {
  it('rejects empty, whitespace-only, and missing breed when required', () => {
    assert.equal(hasValidBreed(''), false);
    assert.equal(hasValidBreed('   '), false);
    assert.equal(hasValidBreed(null), false);
    assert.equal(hasValidBreed(undefined), false);

    assert.equal(isPetValid({ ...basePet, breed: '' }, { requireBreed: true }), false);
    assert.equal(isPetValid({ ...basePet, breed: '   ' }, { requireBreed: true }), false);
    assert.equal(getPetFieldErrors({ ...basePet, breed: '' }, { requireBreed: true }).breed, 'Please enter a breed.');
  });

  it('allows valid breed and optional breed when not required', () => {
    assert.equal(hasValidBreed('Golden Retriever'), true);
    assert.equal(isPetValid({ ...basePet, breed: 'Golden Retriever' }, { requireBreed: true }), true);
    assert.equal(isPetValid({ ...basePet, breed: '' }, { requireBreed: false }), true);
    assert.equal(getPetFieldErrors({ ...basePet, breed: '' }, { requireBreed: false }).breed, undefined);
  });

  it('still requires name and pet type alongside breed', () => {
    assert.equal(
      isPetValid({ ...basePet, name: '', breed: 'Poodle' }, { requireBreed: true }),
      false,
    );
    assert.equal(
      isPetValid(
        { ...basePet, pet_type: 'other', pet_type_custom: '', breed: 'Mixed' },
        { requireBreed: true },
      ),
      false,
    );
    assert.equal(
      isPetValid(
        { ...basePet, pet_type: 'other', pet_type_custom: 'Rabbit', breed: 'Mini Lop' },
        { requireBreed: true },
      ),
      true,
    );
  });
});

describe('Step 7C.1 onboarding UX contract', () => {
  it('marks Breed Required during onboarding only', () => {
    assert.match(onboardingPets, /requiredFieldLabel\}>Breed<\/Text>[\s\S]*?<RequiredBadge/);
    assert.match(onboardingPets, /requireBreed: !isManageCrudMode/);
    assert.match(onboardingPets, /petErrors\.breed && styles\.inputError/);
    assert.match(onboardingValidation, /errors\.breed = 'Please enter a breed\.'/);
    assert.doesNotMatch(onboardingPets, /getPetFieldErrors\(activePet, \{ requireBreed: true \}\)/);
  });

  it('does not alter manage add/edit breed optionality', () => {
    assert.match(onboardingPets, /isManageCrudMode \? \(/);
    assert.match(onboardingPets, /styles\.labelOptional}>Breed<\/Text>/);
    assert.match(onboardingPets, /const activePetErrors = getPetFieldErrors\(activePet\)/);
  });
});
