/**
 * PAW-188 / PAW-180 — Add Pet camera permission lifecycle.
 * Updated PAW-227; contract lock PAW-236 (QA VETO remediation).
 * Run: node --test tests/unit/add-pet-camera.test.js
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

describe('createMomentPermissions camera surface (PAW-188)', () => {
  const source = readSrc('src/lib/createMomentPermissions.js');

  it('uses OS request only — no custom denied alert helper', () => {
    assert.doesNotMatch(source, /showDeniedAlert/);
    assert.doesNotMatch(source, /Alert\.alert/);
    assert.match(source, /export async function resolveCameraPermission/);
    assert.match(source, /requestCameraPermissionsAsync/);
  });

  it('returns granted, denied, or blocked without UI', () => {
    assert.match(source, /return 'granted'/);
    assert.match(source, /return 'denied'/);
    assert.match(source, /return 'blocked'/);
  });
});

describe('captureFromCamera shared status contract (PAW-236)', () => {
  const helper = readSrc('src/lib/cameraCapture.js');

  it('returns captured / canceled — not success / cancelled', () => {
    assert.match(helper, /status: 'captured'/);
    assert.match(helper, /status: 'canceled'/);
    assert.doesNotMatch(helper, /status:\s*'success'/);
    assert.doesNotMatch(helper, /status:\s*'cancelled'/);
  });
});

describe('OnboardingPetsScreen Add Pet camera flow (PAW-227 / PAW-236)', () => {
  const source = readSrc('src/screens/OnboardingPetsScreen.js');

  it('uses PhotoPickerModal with close-then-capture via onSelectSource', () => {
    assert.match(source, /PhotoPickerModal/);
    assert.match(source, /onSelectSource=\{handlePhotoSourceSelected\}/);
  });

  it('does not use JIT always-request helper', () => {
    assert.doesNotMatch(source, /requestCameraPermissionJIT/);
  });

  it('launches camera directly after modal exit without AfterUiDismissed deferral', () => {
    assert.match(source, /captureFromCamera/);
    assert.doesNotMatch(source, /captureFromCameraAfterUiDismissed/);
    assert.match(source, /status === 'canceled'/);
    assert.match(source, /status !== 'captured'/);
    assert.doesNotMatch(source, /waitForPhotoSourceDismissal/);
    assert.doesNotMatch(source, /showDeniedAlert/);
  });

  it('uses modal-supplied pet index instead of photoModalPetIndex state after onClose', () => {
    assert.match(source, /photoModalPetIndex=\{photoModalPetIndex\}/);
    assert.match(source, /handlePhotoSourceSelected = async \(source, petIndex\)/);
    assert.match(source, /pickPetPhoto\(petIndex, source\)/);
    assert.doesNotMatch(source, /const index = photoModalPetIndex/);
  });

  it('abandons in-flight camera on unmount', () => {
    assert.match(source, /abandonCameraCapture/);
  });

  it('never shows a Pawple camera-permission dialog', () => {
    assert.doesNotMatch(source, /Alert\.alert\(\s*'Camera'/);
    assert.doesNotMatch(source, /Permission was not granted/);
  });
});
