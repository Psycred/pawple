/**
 * PAW-222 / PAW-233 — camera capture lifecycle + call-site migration.
 * Run: node --test tests/unit/camera-capture.test.js
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

describe('cameraCapture helper (C1)', () => {
  const source = readSrc('src/lib/cameraCapture.js');

  it('exports single-flight capture + abandon without persistent OS flags', () => {
    assert.match(source, /export async function captureFromCamera/);
    assert.match(source, /export function abandonCameraCapture/);
    assert.match(source, /requestCameraPermissionsAsync/);
    assert.doesNotMatch(source, /current\?\.status === 'denied' && current\.canAskAgain === false/);
    assert.match(source, /status: 'busy'/);
    assert.match(source, /status: 'captured'/);
    assert.match(source, /status: 'canceled'/);
    assert.match(source, /status: 'abandoned'/);
    // PAW-230 veto: never use success/cancelled vocabulary
    assert.doesNotMatch(source, /status:\s*'success'/);
    assert.doesNotMatch(source, /status:\s*'cancelled'/);
    assert.doesNotMatch(source, /hasAskedCamera/);
  });

  it('launches camera immediately after permission without artificial delay', () => {
    const captureBlock = source.slice(
      source.indexOf('export async function captureFromCamera'),
      source.indexOf('export async function captureFromCameraAfterUiDismissed'),
    );
    assert.match(captureBlock, /requestCameraPermissionsAsync/);
    assert.match(captureBlock, /launchCameraAsync/);
    assert.match(captureBlock, /launch_camera_start/);
    assert.doesNotMatch(captureBlock, /InteractionManager/);
    assert.doesNotMatch(captureBlock, /waitForCameraUiDismissed/);
    assert.doesNotMatch(captureBlock, /setTimeout\s*\(/);
    assert.match(
      captureBlock,
      /requestCameraPermissionsAsync\(\)[\s\S]*launchCameraAsync/,
    );
  });

  it('ignores screen_blur abandon while the permission request is in flight', () => {
    assert.match(
      source,
      /reason === 'screen_blur' && \(permissionRequestInFlight \|\| cameraLaunchInFlight\)/,
    );
    assert.match(source, /abandon_skipped_permission_in_flight/);
    assert.match(source, /captureGeneration \+= 1/);
    assert.match(source, /activeCaptureInvocationId/);
    assert.match(source, /clearStaleCameraCaptureMutex/);
  });

  it('uses the same direct launch path when camera access was already granted', () => {
    const captureBlock = source.slice(
      source.indexOf('export async function captureFromCamera'),
      source.indexOf('export async function captureFromCameraAfterUiDismissed'),
    );
    assert.match(captureBlock, /getCameraPermissionsAsync/);
    assert.match(captureBlock, /if \(!granted\)/);
    assert.match(captureBlock, /launchCameraAsync/);
    assert.doesNotMatch(captureBlock, /permissionJustGranted/);
  });
});

describe('camera call sites migrate to captureFromCamera (C2-C5)', () => {
  it('CreateMomentScreen delegates camera and abandons on blur', () => {
    const source = readSrc('src/screens/CreateMomentScreen.js');
    assert.match(source, /captureFromCamera/);
    assert.match(source, /abandonCameraCapture/);
    assert.match(source, /status === 'canceled'/);
    assert.match(source, /status !== 'captured'/);
    assert.doesNotMatch(source, /Alert\.alert\(\s*'Camera'/);
    assert.doesNotMatch(source, /launchCameraAsync/);
    assert.doesNotMatch(source, /getCameraPermissionsAsync/);
  });

  it('OnboardingPetsScreen closes modal then captures; no JIT camera helper', () => {
    const source = readSrc('src/screens/OnboardingPetsScreen.js');
    assert.match(source, /captureFromCamera/);
    assert.match(source, /onSelectSource/);
    assert.match(source, /PhotoPickerModal/);
    assert.match(source, /status === 'canceled'/);
    assert.match(source, /status !== 'captured'/);
    assert.doesNotMatch(source, /requestCameraPermissionJIT/);
    assert.doesNotMatch(source, /launchCameraAsync/);
  });

  it('EditPetScreen uses shared capture helper', () => {
    const source = readSrc('src/screens/EditPetScreen.js');
    assert.match(source, /captureFromCamera/);
    assert.match(source, /status === 'canceled'/);
    assert.match(source, /status !== 'captured'/);
    assert.doesNotMatch(source, /launchCameraAsync/);
    assert.doesNotMatch(source, /resolveCameraPermission/);
  });

  it('PhotoPickerModal hands source after chooser closes — iOS onDismiss, Android after unmount', () => {
    const modal = readSrc('src/components/PhotoPickerModal.js');
    const androidBlock = modal.slice(
      modal.indexOf('function PhotoPickerModalAndroid'),
      modal.indexOf('export default function PhotoPickerModal'),
    );

    assert.match(modal, /onSelectSource/);
    assert.match(modal, /runExit/);
    assert.match(modal, /pendingSourceRef/);
    assert.match(modal, /photoModalPetIndex/);
    assert.match(modal, /pendingSourceRef\.current = \{ source, petIndex: photoModalPetIndex, attemptId \}/);
    assert.match(modal, /onDismiss=\{handleModalDismiss\}/);
    assert.match(modal, /PhotoPickerModalAndroid/);
    assert.match(androidBlock, /pendingDeliveryRef/);
    assert.match(androidBlock, /deliveredRef/);
    assert.match(androidBlock, /pendingDeliveryRef\.current = \{ source, petIndex: photoModalPetIndex, attemptId \}/);
    assert.match(androidBlock, /deliverPendingSelection/);
    assert.match(androidBlock, /handoffInFlightRef/);
    assert.match(androidBlock, /onSelectSourceRef\.current\?\.\(source, petIndex\)/);
    assert.match(androidBlock, /if \(!visible\)/);
    assert.doesNotMatch(androidBlock, /if \(finished && then\)/);
    assert.doesNotMatch(androidBlock, /runExit\(\(\) => \{[\s\S]*Promise\.resolve\(onSelectSource/);
    assert.doesNotMatch(modal, /runExit\(\(\) => \{\s*Promise\.resolve\(onSelectSource/);
    assert.doesNotMatch(modal, /setTimeout\s*\(/);
    assert.doesNotMatch(modal, /InteractionManager/);
  });

  it('OnboardingPetsScreen uses modal-supplied pet index after onClose clears state', () => {
    const onboarding = readSrc('src/screens/OnboardingPetsScreen.js');
    assert.match(onboarding, /photoModalPetIndex=\{photoModalPetIndex\}/);
    assert.match(onboarding, /handlePhotoSourceSelected = async \(source, petIndex\)/);
    assert.match(onboarding, /pickPetPhoto\(petIndex, source\)/);
    assert.doesNotMatch(onboarding, /const index = photoModalPetIndex/);
  });
});

describe('notifications honesty (N1-N5)', () => {
  it('onboarding prompts OS after pet save and skips Final primer', () => {
    const source = readSrc('src/screens/OnboardingPetsScreen.js');
    assert.match(source, /promptNotificationPermissionIfNeeded/);
    assert.match(source, /MainTabs/);
    assert.doesNotMatch(source, /OnboardingFinal/);
  });

  it('Settings routes to Permissions while AccountSheet retains its direct OS path', () => {
    const settings = readSrc('src/screens/SettingsScreen.js');
    const account = readSrc('src/components/AccountSheet.jsx');
    assert.match(settings, /navigation\.navigate\('Permissions'\)/);
    assert.doesNotMatch(settings, /Photo & Media/);
    assert.doesNotMatch(settings, /[Mm]orning-of/);
    assert.match(account, /openAppSettings/);
    assert.doesNotMatch(account, /[Mm]orning-of/);
    assert.doesNotMatch(account, /<Switch/);
  });
});

describe('gallery + product surface locks', () => {
  it('blocks READ_MEDIA_IMAGES and keeps Mating exposed', () => {
    const appJson = readSrc('app.json');
    const phase1a = readSrc('src/config/phase1aSurfaces.js');
    assert.match(appJson, /"blockedPermissions"\s*:\s*\[[^\]]*READ_MEDIA_IMAGES/s);
    assert.match(appJson, /"permissions"\s*:\s*\[[^\]]*CAMERA/s);
    assert.doesNotMatch(
      appJson.match(/"permissions"\s*:\s*\[[^\]]*\]/s)?.[0] ?? '',
      /READ_MEDIA_IMAGES/,
    );
    assert.match(phase1a, /EXPOSE_MATING_SURFACES = true/);
  });
});
