/**
 * Repeated Camera/Gallery interaction fixes (A+B+C).
 * Run: node --test tests/unit/photo-picker-repeated-interaction.test.js
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

function androidModalBlock(modal) {
  return modal.slice(
    modal.indexOf('function PhotoPickerModalAndroid'),
    modal.indexOf('export default function PhotoPickerModal'),
  );
}

describe('PhotoPickerModal repeated-interaction fixes (A+B)', () => {
  const modal = readSrc('src/components/PhotoPickerModal.js');
  const android = androidModalBlock(modal);
  const onboarding = readSrc('src/screens/OnboardingPetsScreen.js');

  it('1-2. first Camera/Gallery selection still hands off to onSelectSource after close', () => {
    assert.match(modal, /onSelectSource\('camera'\)/);
    assert.match(modal, /onSelectSource\('gallery'\)/);
    assert.match(android, /deliverPendingSelection/);
    assert.match(android, /onSelectSourceRef\.current\?\.\(source, petIndex\)/);
    assert.match(onboarding, /onSelectSource=\{handlePhotoSourceSelected\}/);
    assert.match(onboarding, /pickFromGallery/);
    assert.match(onboarding, /captureFromCamera/);
  });

  it('3-8. chooser can be used again after prior Camera/Gallery handoff completes', () => {
    assert.match(android, /actionInFlight\.current = false/);
    assert.match(android, /handoffInFlightRef/);
    assert.match(
      android,
      /if \(!handoffInFlightRef\.current\) \{[\s\S]*?pendingDeliveryRef\.current = null/,
    );
    assert.match(android, /handoffInFlightRef\.current = false/);
    assert.match(android, /deliverPendingSelection\(\)/);
  });

  it('9. double-tap during active chooser exit is still prevented', () => {
    assert.match(android, /if \(actionInFlight\.current\) \{[\s\S]*?return;/);
    assert.match(android, /actionInFlight\.current = true/);
    assert.match(iosModalBlock(modal), /if \(actionInFlight\.current\) \{[\s\S]*?return;/);
  });

  it('10. pending source is not lost when visible becomes true during handoff', () => {
    assert.match(android, /handoffInFlightRef\.current = true/);
    assert.match(
      android,
      /if \(visible\) \{[\s\S]*?if \(!handoffInFlightRef\.current\) \{[\s\S]*?pendingDeliveryRef\.current = null/,
    );
    assert.match(android, /runExit\(\(\) => \{[\s\S]*?deliverPendingSelection\(\)/);
  });

  it('12. no arbitrary timeout was introduced in PhotoPickerModal', () => {
    assert.doesNotMatch(modal, /setTimeout\s*\(/);
    assert.doesNotMatch(modal, /InteractionManager/);
    assert.doesNotMatch(modal, /360/);
  });
});

function iosModalBlock(modal) {
  return modal.slice(
    modal.indexOf('function PhotoPickerModalIOS'),
    modal.indexOf('function PhotoPickerModalAndroid'),
  );
}

describe('cameraCapture stale mutex fix (C)', () => {
  const source = readSrc('src/lib/cameraCapture.js');
  const onboarding = readSrc('src/screens/OnboardingPetsScreen.js');

  it('11. genuine overlapping camera launch is still rejected', () => {
    assert.match(source, /activeCaptureInvocationId/);
    assert.match(source, /isLegitimateCameraCaptureMutexHeld/);
    assert.match(source, /capture_rejected_busy/);
    assert.match(source, /overlap: true/);
    assert.match(source, /status: 'busy', traceId, overlap: true/);
  });

  it('clears stale mutex flags when no active invocation is holding them', () => {
    assert.match(source, /clearStaleCameraCaptureMutex/);
    assert.match(source, /capture_stale_mutex_cleared/);
    assert.match(source, /activeCaptureInvocationId = null/);
  });

  it('12. no arbitrary timeout was introduced in cameraCapture', () => {
    const captureBlock = source.slice(
      source.indexOf('export async function captureFromCamera'),
      source.indexOf('export async function captureFromCameraAfterUiDismissed'),
    );
    assert.doesNotMatch(captureBlock, /setTimeout\s*\(/);
    assert.doesNotMatch(captureBlock, /InteractionManager/);
    assert.doesNotMatch(captureBlock, /waitForCameraUiDismissed/);
  });

  it('onboarding still uses captureFromCamera without AfterUiDismissed deferral', () => {
    const pickBlock = onboarding.slice(
      onboarding.indexOf('const pickPetPhoto = async'),
      onboarding.indexOf('const saveOnboarding = async'),
    );
    assert.match(pickBlock, /captureFromCamera/);
    assert.doesNotMatch(pickBlock, /captureFromCameraAfterUiDismissed/);
    assert.doesNotMatch(pickBlock, /setTimeout\s*\(/);
  });
});

describe('scope guard — other flows untouched', () => {
  const editPet = readSrc('src/screens/EditPetScreen.js');
  const createMoment = readSrc('src/screens/CreateMomentScreen.js');
  const onboarding = readSrc('src/screens/OnboardingPetsScreen.js');

  it('Edit Pet and Create Moment were not modified for onboarding focus/AppState (D)', () => {
    assert.doesNotMatch(editPet, /AppState\.addEventListener/);
    assert.doesNotMatch(createMoment, /AppState\.addEventListener/);
    assert.doesNotMatch(
      editPet,
      /useFocusEffect\([\s\S]*?setPhotoSourceOpen\(false\)/,
    );
    assert.match(onboarding, /AppState\.addEventListener/);
    assert.match(
      onboarding,
      /useFocusEffect\([\s\S]*?setPhotoModalVisible\(false\)/,
    );
  });
});
