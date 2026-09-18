/**
 * Phase 1 — permission timing, mating gate, feed prep (no Phase 2 feed engines).
 * Run: node --test tests/unit/phase1-permissions-feed-prep.test.js
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

describe('Phase 1 location permission', () => {
  it('always requests OS when not granted on About You continue', () => {
    const source = readSrc('src/lib/profileLocation.js');
    assert.match(source, /if \(permission\.status !== 'granted'\)/);
    assert.doesNotMatch(source, /status === 'undetermined'/);
  });

  it('captures moment coords only when permission already granted', () => {
    const source = readSrc('src/lib/profileLocation.js');
    assert.match(source, /export async function captureMomentCoordsIfGranted/);
    assert.doesNotMatch(source, /captureMomentCoordsIfGranted[\s\S]{0,200}requestForegroundPermissionsAsync/);
  });

  it('refreshes profile location on app foreground when onboarding complete', () => {
    const auth = readSrc('src/contexts/AuthContext.js');
    assert.match(auth, /refreshProfileLocationOnAppOpen/);
    assert.match(auth, /AppState/);
  });
});

describe('Phase 1 mating location gate', () => {
  it('MatingSection blocks opt-in without foreground location', () => {
    const source = readSrc('src/components/MatingSection.js');
    assert.match(source, /MatingLocationGateModal/);
    assert.match(source, /isForegroundLocationGranted/);
  });
});

describe('Phase 1 feed prep', () => {
  it('FeedScreen removes city gate banner', () => {
    const source = readSrc('src/screens/FeedScreen.js');
    assert.doesNotMatch(source, /Add your city in profile settings/);
    assert.doesNotMatch(source, /viewerCityMissing/);
  });

  it('OnboardingUserScreen shows Required badge on Birthday', () => {
    const source = readSrc('src/screens/OnboardingUserScreen.js');
    assert.match(source, /Birthday[\s\S]{0,80}RequiredBadge/);
  });

  it('createMoment accepts coarse location coords', () => {
    const moments = readSrc('src/services/moments.js');
    assert.match(moments, /locationLat/);
    assert.match(moments, /location_lat/);
  });
});

describe('Phase 1 notification prompts', () => {
  it('exports shared prompt helper and uses at key moments', () => {
    const notifications = readSrc('src/lib/notifications.js');
    assert.match(notifications, /export async function promptNotificationPermissionIfNeeded/);
    assert.match(readSrc('src/screens/OnboardingPetsScreen.js'), /promptNotificationPermissionIfNeeded/);
    assert.match(readSrc('src/services/meetups.js'), /promptNotificationPermissionIfNeeded/);
    assert.match(readSrc('src/components/MatingSection.js'), /promptNotificationPermissionIfNeeded/);
  });
});
