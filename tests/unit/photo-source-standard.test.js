import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Shared PhotoPickerModal chooser', () => {
  const modal = readSrc('src/components/PhotoPickerModal.js');

  it('exposes calm Camera, Gallery, and Cancel actions only', () => {
    assert.match(modal, /onSelectSource\('camera'\)/);
    assert.match(modal, /onSelectSource\('gallery'\)/);
    assert.match(modal, />[\s\S]*Camera[\s\S]*</);
    assert.match(modal, />[\s\S]*Gallery[\s\S]*</);
    assert.match(modal, />[\s\S]*Cancel[\s\S]*</);
    assert.doesNotMatch(modal, /📸|🖼️|🐾/);
    assert.doesNotMatch(modal, /Skip for Now/);
    assert.doesNotMatch(modal, /Alert\.alert/);
    assert.doesNotMatch(modal, /setTimeout\s*\(/);
  });

  it('delivers onSelectSource after chooser closes — iOS via onDismiss, Android after unmount', () => {
    const androidBlock = modal.slice(
      modal.indexOf('function PhotoPickerModalAndroid'),
      modal.indexOf('export default function PhotoPickerModal'),
    );

    assert.match(modal, /PhotoPickerModalIOS/);
    assert.match(modal, /PhotoPickerModalAndroid/);
    assert.match(modal, /onDismiss=\{handleModalDismiss\}/);
    assert.match(modal, /styles\.androidOverlay/);
    assert.match(androidBlock, /pendingDeliveryRef/);
    assert.match(androidBlock, /deliveredRef/);
    assert.match(androidBlock, /pendingDeliveryRef\.current = \{ source, petIndex: photoModalPetIndex, attemptId \}/);
    assert.match(androidBlock, /deliverPendingSelection/);
    assert.match(androidBlock, /handoffInFlightRef/);
    assert.match(androidBlock, /onSelectSourceRef\.current\?\.\(source, petIndex\)/);
    assert.match(androidBlock, /if \(!visible\)/);
    assert.doesNotMatch(androidBlock, /if \(finished && then\)/);
    assert.doesNotMatch(androidBlock, /runExit\(\(\) => \{[\s\S]*Promise\.resolve\(onSelectSource/);
    assert.doesNotMatch(modal, /setTimeout\s*\(/);
    assert.doesNotMatch(modal, /InteractionManager/);
  });

  it('delivers Android camera and gallery source exactly once on first tap', () => {
    const androidBlock = modal.slice(
      modal.indexOf('function PhotoPickerModalAndroid'),
      modal.indexOf('export default function PhotoPickerModal'),
    );

    assert.match(modal, /onSelectSource\('camera'\)/);
    assert.match(modal, /onSelectSource\('gallery'\)/);
    assert.match(androidBlock, /const selectSource = \(source\) =>/);
    assert.match(androidBlock, /deliveredRef\.current = true/);
    assert.match(androidBlock, /pendingDeliveryRef\.current = null/);
    assert.match(androidBlock, /usePhotoPickerAnimationsAndroid/);
  });
});

describe('Active photo flows use PhotoPickerModal', () => {
  const onboarding = readSrc('src/screens/OnboardingPetsScreen.js');
  const editPet = readSrc('src/screens/EditPetScreen.js');
  const createMoment = readSrc('src/screens/CreateMomentScreen.js');

  it('Onboarding / Add Pet opens the shared chooser from PawPhotoFrame', () => {
    assert.match(onboarding, /PhotoPickerModal/);
    assert.match(onboarding, /openPetPhotoOptions/);
    assert.match(onboarding, /setPhotoModalVisible\(true\)/);
    assert.doesNotMatch(onboarding, /Alert\.alert\('Add a photo'/);
  });

  it('Edit Pet opens the shared chooser instead of Alert.alert', () => {
    assert.match(editPet, /PhotoPickerModal/);
    assert.match(editPet, /setPhotoSourceOpen\(true\)/);
    assert.match(editPet, /onSelectSource=\{handlePhotoSourceSelected\}/);
    assert.doesNotMatch(editPet, /Alert\.alert\('Add a photo'/);
  });

  it('Create Moment uses the shared chooser for add and change photo', () => {
    assert.match(createMoment, /PhotoPickerModal/);
    assert.match(createMoment, /setPhotoSourceOpen\(true\)/);
    assert.match(createMoment, /Add photo/);
    assert.match(createMoment, /accessibilityLabel="Change photo"/);
    assert.doesNotMatch(createMoment, /showChangeSheet/);
    assert.doesNotMatch(createMoment, /handlePickImage\('camera'\)/);
    assert.doesNotMatch(createMoment, /Alert\.alert\('Add a photo'/);
  });
});

describe('Downstream crop and processing preserved', () => {
  const onboarding = readSrc('src/screens/OnboardingPetsScreen.js');
  const editPet = readSrc('src/screens/EditPetScreen.js');
  const createMoment = readSrc('src/screens/CreateMomentScreen.js');

  it('keeps 1:1 pet photo picker options', () => {
    assert.match(onboarding, /aspect: \[1, 1\]/);
    assert.match(editPet, /aspect: \[1, 1\]/);
    assert.match(onboarding, /approvePickedPhotoUri/);
    assert.match(editPet, /approvePickedPhotoUri/);
    assert.match(editPet, /resolvePetPhotoUrl/);
  });

  it('keeps 4:5 moment picker options and save pipeline', () => {
    assert.match(createMoment, /aspect: \[4, 5\]/);
    assert.match(createMoment, /MOMENT_PICKER_OPTIONS/);
    assert.match(createMoment, /approvePickedPhotoUri/);
    assert.match(createMoment, /processImageForPawple/);
    assert.match(createMoment, /uploadToSupabase/);
    assert.doesNotMatch(createMoment, /aspect: \[4, 4\]/);
    assert.doesNotMatch(createMoment, /aspect: \[1, 1\]/);
  });

  it('keeps shared pick/capture helpers after chooser selection', () => {
    assert.match(onboarding, /pickFromGallery/);
    assert.match(onboarding, /captureFromCamera/);
    assert.match(editPet, /pickFromGallery/);
    assert.match(editPet, /captureFromCamera/);
    assert.match(createMoment, /pickFromGallery/);
    assert.match(createMoment, /captureFromCamera/);
    assert.doesNotMatch(onboarding, /captureFromCameraAfterUiDismissed/);
    assert.doesNotMatch(editPet, /captureFromCameraAfterUiDismissed/);
    assert.doesNotMatch(createMoment, /captureFromCameraAfterUiDismissed/);
  });
});

describe('Obsolete chooser cleanup', () => {
  it('removes unused PhotoSourceSheet and presentPhotoSourceChooser', () => {
    const picker = readSrc('src/lib/photoPicker.js');
    assert.doesNotMatch(picker, /presentPhotoSourceChooser/);
    let threw = false;
    try {
      readSrc('src/components/PhotoSourceSheet.js');
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
  });
});
