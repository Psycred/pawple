/**
 * PAW-227 / PAW-222 — Camera lifecycle + invite link builders.
 * Run: node --test tests/unit/paw222-beta-hardening-frontend.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  buildInviteShareMessage,
  buildInviteUrl,
  buildStoreFallbackUrls,
  INVITE_EMAIL_SUBJECT,
  INVITE_SHARE_EMAIL_SUBJECT,
} from '../../src/lib/inviteLinks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('inviteLinks (I2)', () => {
  it('encodes code in HTTPS invite path', () => {
    assert.equal(buildInviteUrl('paw-test'), 'https://pawple.com/invite/PAW-TEST');
    assert.equal(buildInviteUrl('@PAW-3600'), 'https://pawple.com/invite/PAW-3600');
  });

  it('uses separate platform landing placeholders', () => {
    const stores = buildStoreFallbackUrls();
    assert.equal(stores.android, 'https://pawple.com/download/android');
    assert.equal(stores.ios, 'https://pawple.com/download/ios');
    assert.notEqual(stores.android, stores.ios);
  });

  it('builds warm share message with invite URL and install fallback', () => {
    const message = buildInviteShareMessage({ code: 'PAW-ABCD' });
    assert.match(
      message,
      /Welcome to Pawple — an invite-only app for journaling the life of your furry companion/,
    );
    assert.match(message, /We're still growing, one pet at a time/);
    assert.match(message, /https:\/\/pawple\.com\/invite\/PAW-ABCD/);
    assert.match(message, /Don't have the app yet\?/);
    assert.match(message, /Android · iOS/);
    assert.equal(INVITE_SHARE_EMAIL_SUBJECT, "You're invited to Pawple");
    assert.equal(INVITE_EMAIL_SUBJECT, INVITE_SHARE_EMAIL_SUBJECT);
  });
});

describe('cameraCapture module (C1)', () => {
  const source = readSrc('src/lib/cameraCapture.js');

  it('exports single-flight capture and abandon', () => {
    assert.match(source, /export async function captureFromCamera/);
    assert.match(source, /export function abandonCameraCapture/);
    assert.match(source, /status: 'busy'/);
    assert.match(source, /status: 'captured'/);
    assert.match(source, /status: 'canceled'/);
    assert.doesNotMatch(source, /status:\s*'success'/);
    assert.doesNotMatch(source, /status:\s*'cancelled'/);
    assert.match(source, /launchCameraAsync/);
  });

  it('launches camera immediately after permission without artificial delay', () => {
    const captureBlock = source.slice(
      source.indexOf('export async function captureFromCamera'),
      source.indexOf('export async function captureFromCameraAfterUiDismissed'),
    );
    assert.match(captureBlock, /requestCameraPermissionsAsync/);
    assert.match(captureBlock, /launchCameraAsync/);
    assert.doesNotMatch(captureBlock, /InteractionManager/);
    assert.doesNotMatch(captureBlock, /waitForCameraUiDismissed/);
    assert.doesNotMatch(captureBlock, /setTimeout\s*\(/);
  });

  it('skips screen_blur abandon while permission request is in flight', () => {
    assert.match(
      source,
      /reason === 'screen_blur' && \(permissionRequestInFlight \|\| cameraLaunchInFlight\)/,
    );
    assert.match(source, /clearStaleCameraCaptureMutex/);
  });
});

describe('CreateMomentScreen camera (C2)', () => {
  const source = readSrc('src/screens/CreateMomentScreen.js');

  it('delegates camera to captureFromCamera and abandons on blur', () => {
    assert.match(source, /captureFromCamera/);
    assert.match(source, /abandonCameraCapture/);
    assert.match(source, /useFocusEffect/);
    assert.match(source, /status === 'canceled'/);
    assert.match(source, /status !== 'captured'/);
    assert.doesNotMatch(source, /getCameraPermissionsAsync/);
  });
});

describe('OnboardingPetsScreen camera + notifications (C3/N1)', () => {
  const source = readSrc('src/screens/OnboardingPetsScreen.js');

  it('uses shared capture and closes modal via onSelectSource', () => {
    assert.match(source, /captureFromCamera/);
    assert.match(source, /onSelectSource=\{handlePhotoSourceSelected\}/);
    assert.match(source, /status === 'canceled'/);
    assert.match(source, /status !== 'captured'/);
    assert.doesNotMatch(source, /requestCameraPermissionJIT/);
  });

  it('requests OS notifications after successful pet submit then MainTabs', () => {
    assert.match(source, /promptNotificationPermissionIfNeeded/);
    assert.match(source, /navigation\.replace\('MainTabs'/);
    assert.doesNotMatch(source, /navigation\.replace\('OnboardingFinal'/);
  });
});

describe('PhotoPickerModal (C4)', () => {
  const source = readSrc('src/components/PhotoPickerModal.js');

  it('hands source to parent after chooser closes — iOS onDismiss, Android after unmount', () => {
    const androidBlock = source.slice(
      source.indexOf('function PhotoPickerModalAndroid'),
      source.indexOf('export default function PhotoPickerModal'),
    );

    assert.match(source, /onSelectSource/);
    assert.match(source, /runExit/);
    assert.match(source, /pendingSourceRef/);
    assert.match(source, /photoModalPetIndex/);
    assert.match(source, /pendingSourceRef\.current = \{ source, petIndex: photoModalPetIndex, attemptId \}/);
    assert.match(source, /onDismiss=\{handleModalDismiss\}/);
    assert.match(source, /PhotoPickerModalAndroid/);
    assert.match(androidBlock, /pendingDeliveryRef/);
    assert.match(androidBlock, /deliveredRef/);
    assert.match(androidBlock, /deliverPendingSelection/);
    assert.match(androidBlock, /handoffInFlightRef/);
    assert.match(androidBlock, /onSelectSourceRef\.current\?\.\(source, petIndex\)/);
    assert.match(androidBlock, /if \(!visible\)/);
    assert.doesNotMatch(androidBlock, /if \(finished && then\)/);
    assert.doesNotMatch(androidBlock, /runExit\(\(\) => \{[\s\S]*Promise\.resolve\(onSelectSource/);
    assert.doesNotMatch(source, /runExit\(\(\) => \{\s*Promise\.resolve\(onSelectSource/);
    assert.doesNotMatch(source, /setTimeout\s*\(/);
    assert.doesNotMatch(source, /InteractionManager/);
    assert.doesNotMatch(source, /await onTakePhoto/);
  });
});

describe('EditPetScreen camera (C5)', () => {
  const source = readSrc('src/screens/EditPetScreen.js');

  it('uses captureFromCamera', () => {
    assert.match(source, /captureFromCamera/);
    assert.match(source, /status === 'canceled'/);
    assert.match(source, /status !== 'captured'/);
    assert.doesNotMatch(source, /resolveCameraPermission/);
  });
});

describe('notifications honesty (N3–N5)', () => {
  it('Settings routes permission management to the dedicated native-backed screen', () => {
    const source = readSrc('src/screens/SettingsScreen.js');
    assert.match(source, /title="Permissions"/);
    assert.match(source, /navigation\.navigate\('Permissions'\)/);
    assert.doesNotMatch(source, /Photo & Media/);
    assert.doesNotMatch(source, /[Mm]orning-of/);
    assert.doesNotMatch(source, /requestNotificationPermission/);
  });

  it('AccountSheet opens settings without Switch or morning-of copy', () => {
    const source = readSrc('src/components/AccountSheet.jsx');
    assert.match(source, /openAppSettings/);
    assert.doesNotMatch(source, /\bSwitch\b/);
    assert.doesNotMatch(source, /[Mm]orning-of/);
  });

  it('NotificationNudge has no morning-of body', () => {
    const source = readSrc('src/components/NotificationNudge.js');
    assert.doesNotMatch(source, /[Mm]orning-of/);
  });
});

describe('invites share + parse (I1/I3/I5)', () => {
  it('InviteSheet uses canonical invite helpers with WhatsApp and Copy Link only', () => {
    const source = readSrc('src/components/InviteSheet.js');
    assert.match(source, /buildInviteShareMessage/);
    assert.match(source, /buildInviteUrl/);
    assert.doesNotMatch(source, /Share\.share/);
    assert.doesNotMatch(source, /handleShareEmail/);
    assert.match(source, /Clipboard\.setStringAsync\(inviteUrl\)/);
    assert.match(source, /Your invite/);
    assert.match(source, /currentInvite\.code/);
  });

  it('App parses HTTPS pawple.com invite URLs', () => {
    const source = readSrc('App.js');
    assert.match(source, /parseInviteCodeFromUrl|pawple\.com/);
    assert.match(source, /rememberPendingInvite/);
  });

  it('InviteCodeScreen hydrates pending invite', () => {
    const source = readSrc('src/screens/InviteCodeScreen.js');
    assert.match(source, /getPendingInvite/);
    assert.match(source, /pendingInviteCode/);
    assert.doesNotMatch(source, /@PAW-3600/);
  });
});

describe('hard locks', () => {
  it('exposes the approved Mating surfaces', () => {
    const source = readSrc('src/config/phase1aSurfaces.js');
    assert.match(source, /export const EXPOSE_MATING_SURFACES = true/);
  });

  it('G1 retains system photo picker short-circuit', () => {
    const source = readSrc('src/lib/photoPicker.js');
    assert.match(source, /Platform\.Version\) >= 33/);
    assert.match(source, /System Photo Picker/);
  });
});
