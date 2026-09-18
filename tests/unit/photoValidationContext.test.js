/**
 * Photo validation provider must not remount app children when ML engine activates.
 * Run: node --test tests/unit/photoValidationContext.test.js
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

describe('PhotoValidationContext mount stability', () => {
  const source = readSrc('src/contexts/PhotoValidationContext.js');

  it('loads ML engine as a sibling instead of wrapping children', () => {
    assert.match(source, /function PhotoValidationEngine/);
    assert.match(source, /PhotoValidationContext\.Provider value=\{contextValue\}\>\{children\}/);
    assert.match(source, /engineActive \? \(/);
    assert.doesNotMatch(
      source,
      /if \(!engineActive\) \{\s*return \(\s*<PhotoValidationContext\.Provider/,
    );
    assert.doesNotMatch(source, /onValidationChange/);
    assert.doesNotMatch(source, /setEngineValidation/);
  });

  it('OnboardingPets abandons camera on blur, not unmount', () => {
    const onboarding = readSrc('src/screens/OnboardingPetsScreen.js');
    assert.match(onboarding, /useFocusEffect/);
    assert.match(onboarding, /abandonCameraCapture\('screen_blur'/);
    assert.doesNotMatch(onboarding, /abandonCameraCapture\('unmount'/);
  });

  it('OnboardingPets uses single scroll with legal row and photo lead section', () => {
    const onboarding = readSrc('src/screens/OnboardingPetsScreen.js');
    assert.doesNotMatch(onboarding, /stickyFooter/);
    assert.match(onboarding, /KeyboardAvoidingView/);
    assert.match(onboarding, /await approvePickedPhotoUri\(uri,/);
    assert.match(onboarding, /updatePetField\(index, 'photoUri', uri\)/);
    assert.match(onboarding, /renderPetPhotoSection/);
    assert.match(onboarding, /LegalConsentRow/);
    assert.match(onboarding, /photoSectionLead/);
  });
});
