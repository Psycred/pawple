import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Settings permissions management', () => {
  const screen = readSrc('src/screens/PermissionsScreen.js');

  it('shows exactly Location, Camera, and Notifications', () => {
    const keys = [...screen.matchAll(/key: '(location|camera|notifications)'/g)].map(
      (match) => match[1],
    );

    assert.deepEqual(keys, ['location', 'camera', 'notifications']);
    assert.doesNotMatch(screen, /Photo Library|Photo & Media|Media Library|Contacts|Microphone/);
  });

  it('reads native state without requesting on screen open', () => {
    const refreshBlock = screen.slice(
      screen.indexOf('const refreshPermissions'),
      screen.indexOf('useEffect(() =>'),
    );

    assert.match(refreshBlock, /getLocationPermissionState\(\)/);
    assert.match(refreshBlock, /getCameraPermissionState\(\)/);
    assert.match(refreshBlock, /getNotificationPermissionState\(\)/);
    assert.doesNotMatch(refreshBlock, /requestLocationPermission\(\)/);
    assert.doesNotMatch(refreshBlock, /resolveCameraPermission\(/);
    assert.doesNotMatch(refreshBlock, /requestNotificationPermission\(\)/);
  });

  it('requests when possible and opens native Settings only when required', () => {
    assert.match(screen, /current\.canAskAgain === false/);
    assert.match(screen, /await requestLocationPermission\(\)/);
    assert.match(screen, /await resolveCameraPermission\('settings'\)/);
    assert.match(screen, /await requestNotificationPermission\(\)/);
    assert.match(screen, /await openAppSettings\(\)/);
  });

  it('refreshes on navigation focus and when the app becomes active', () => {
    assert.match(screen, /useFocusEffect\(/);
    assert.match(screen, /AppState\.addEventListener\('change'/);
    assert.match(screen, /nextState === 'active'/);
    assert.match(screen, /refreshPermissions\(\)/);
  });

  it('uses canAskAgain from each existing native permission layer', () => {
    const location = readSrc('src/lib/locationManager.js');
    const camera = readSrc('src/lib/createMomentPermissions.js');
    const notifications = readSrc('src/lib/notifications.js');

    assert.match(location, /Location\.getForegroundPermissionsAsync\(\)/);
    assert.match(location, /Location\.requestForegroundPermissionsAsync\(\)/);
    assert.match(camera, /ImagePicker\.getCameraPermissionsAsync\(\)/);
    assert.match(camera, /ImagePicker\.requestCameraPermissionsAsync\(\)/);
    assert.match(notifications, /Notifications\.getPermissionsAsync\(\)/);
    assert.match(notifications, /Notifications\.requestPermissionsAsync\(\)/);
    for (const source of [location, camera, notifications]) {
      assert.match(source, /canAskAgain/);
    }
  });

  it('registers the screen in the existing root stack', () => {
    const app = readSrc('App.js');
    assert.match(app, /import PermissionsScreen from '\.\/src\/screens\/PermissionsScreen'/);
    assert.match(app, /name="Permissions"\s+component=\{PermissionsScreen\}/);
  });
});
