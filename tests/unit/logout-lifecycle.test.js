/**
 * PAW-151 / PAW-153 — logout lifecycle copy and session helper contract.
 * Run: node --test tests/unit/logout-lifecycle.test.js
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

describe('AccountLifecycleModal Founder copy', () => {
  const source = readSrc('src/components/AccountLifecycleModal.js');

  it('uses Founder-approved logout strings', () => {
    assert.match(source, /title:\s*'Leaving Pawple\?'/);
    assert.match(source, /lead:\s*"We'll miss you and your pet\."/);
    assert.match(source, /body:\s*'You can always come back\.'/);
    assert.match(source, /confirmLabel:\s*'Log out'/);
    assert.match(source, /cancelLabel:\s*'Stay'/);
  });

  it('uses delete confirm and goodbye variants', () => {
    assert.match(source, /delete_confirm:/);
    assert.match(source, /delete_success:/);
    assert.match(source, /confirmLabel:\s*'Delete my account'/);
    assert.match(source, /cancelLabel:\s*'Keep my account'/);
    assert.match(source, /confirmLabel:\s*'Close'/);
  });
});

describe('logout entry points', () => {
  it('Settings opens lifecycle confirm instead of direct signOut', () => {
    const source = readSrc('src/screens/SettingsScreen.js');
    assert.match(source, /openLogoutConfirm/);
    assert.doesNotMatch(source, /supabase\.auth\.signOut/);
    assert.doesNotMatch(source, /navigation\.reset/);
  });

  it('UserSheet routes logout through AuthContext confirm', () => {
    const source = readSrc('src/components/UserSheet.js');
    assert.match(source, /openLogoutConfirm/);
    assert.doesNotMatch(source, /supabase\.auth\.signOut/);
  });

  it('AccountSheet renders Log out and wires through onLogout', () => {
    const source = readSrc('src/components/AccountSheet.jsx');
    assert.match(source, /Log out/);
    assert.match(source, /runAndClose\(onLogout\)/);
  });

  it('FeedScreen hides the gear, shows notifications, and does not mount UserSheet', () => {
    const source = readSrc('src/screens/FeedScreen.js');
    assert.match(source, /import AppHeader from '\.\.\/components\/AppHeader'/);
    assert.doesNotMatch(source, /import UserSheet from '\.\.\/components\/UserSheet'/);
    assert.match(source, /<AppHeader[\s\S]*showSettings=\{false\}[\s\S]*showNotifications[\s\S]*hasUnreadNotifications/);
    assert.doesNotMatch(source, /<UserSheet/);
  });

  it('Settings opens delete lifecycle confirm instead of direct RPC', () => {
    const source = readSrc('src/screens/SettingsScreen.js');
    assert.match(source, /openDeleteConfirm/);
    assert.doesNotMatch(source, /deleteAccount\(/);
    assert.doesNotMatch(source, /delete_user_account/);
  });

  it('UserSheet routes delete through AuthContext confirm', () => {
    const source = readSrc('src/components/UserSheet.js');
    assert.match(source, /openDeleteConfirm/);
    assert.doesNotMatch(source, /deleteAccount\(/);
  });
});

describe('delete account wiring', () => {
  it('AuthContext invokes deleteAccount then signOutUser without double sign-out', () => {
    const source = readSrc('src/contexts/AuthContext.js');
    const confirmDelete = source.slice(
      source.indexOf('const confirmDeleteAccount'),
      source.indexOf('const closeDeleteGoodbye'),
    );
    assert.match(confirmDelete, /await deleteAccount\(\{ signOutAfter: false \}\)/);
    assert.match(confirmDelete, /await signOutUser\(currentUserId\)/);
    assert.match(confirmDelete, /setLifecycleModal\('delete_success'\)/);
    assert.match(confirmDelete, /resetAuthState\(\)/);
  });

  it('AuthContext mounts three lifecycle modals from one provider', () => {
    const source = readSrc('src/contexts/AuthContext.js');
    assert.match(source, /variant="logout_confirm"/);
    assert.match(source, /variant="delete_confirm"/);
    assert.match(source, /variant="delete_success"/);
  });

  it('deleteAccount helper uses RPC only (no service role)', () => {
    const source = readSrc('src/lib/deleteAccount.js');
    assert.match(source, /rpc\('delete_user_account'\)/);
    assert.doesNotMatch(source, /service_role/);
    assert.doesNotMatch(source, /SUPABASE_SERVICE/);
  });
});

describe('authSession signOutUser order', () => {
  const source = readSrc('src/lib/authSession.js');

  it('revokes global session before local purge', () => {
    const globalIndex = source.indexOf("signOut({ scope: 'global' })");
    const localIndex = source.indexOf("signOut({ scope: 'local' })");
    assert.ok(globalIndex >= 0, 'expected global signOut');
    assert.ok(localIndex >= 0, 'expected local signOut');
    assert.ok(globalIndex < localIndex, 'global signOut must run before local signOut');
  });

  it('stops auto-refresh and verifies session cleared', () => {
    assert.match(source, /stopAutoRefresh\(\)/);
    assert.match(source, /ensureSessionCleared\(\)/);
  });
});

describe('CTO PAW-152 required fixes', () => {
  it('exposes beginSignIn for every session-establishment path', () => {
    const authContext = readSrc('src/contexts/AuthContext.js');
    const welcomeScreen = readSrc('src/screens/WelcomeScreen.js');
    assert.match(authContext, /beginSignIn/);
    assert.match(authContext, /startAutoRefresh\(\)/);
    // Wave 5 §1: OAuth lives on Welcome, not the legacy Auth redirect route.
    assert.match(welcomeScreen, /beginSignIn\(\)/);
  });

  it('blocks auth listener session resurrection while signing out', () => {
    const source = readSrc('src/contexts/AuthContext.js');
    const listener = source.slice(
      source.indexOf('onAuthStateChange'),
      source.indexOf('const linkingSubscription'),
    );
    assert.match(listener, /signingOutRef\.current/);
    assert.doesNotMatch(listener, /event === 'SIGNED_IN'/);
  });

  it('UnderAgeDecline uses AuthContext.signOut instead of parallel reset', () => {
    const source = readSrc('src/screens/UnderAgeDeclineScreen.js');
    assert.match(source, /signOut/);
    assert.doesNotMatch(source, /navigation\.reset/);
    assert.doesNotMatch(source, /supabase\.auth\.signOut/);
    assert.doesNotMatch(source, /clearPerUserLocalState/);
  });

  it('keeps logout modal open until signOut completes', () => {
    const source = readSrc('src/contexts/AuthContext.js');
    const confirmLogout = source.slice(
      source.indexOf('const confirmLogout'),
      source.indexOf('const openDeleteConfirm'),
    );
    const signOutCall = confirmLogout.indexOf('await signOut()');
    const modalClose = confirmLogout.indexOf('setLifecycleModal(null)');
    assert.ok(signOutCall >= 0 && modalClose >= 0);
    assert.ok(signOutCall < modalClose, 'modal should close only after signOut');
  });
});

describe('App navigator guest remount', () => {
  it('remounts stack when user becomes null', () => {
    const source = readSrc('App.js');
    assert.match(source, /key=\{user\?\.id \?\? 'guest'\}/);
    assert.match(source, /initialRouteName=\{initialRoute\}/);
    assert.match(source, /!user\s*\?\s*'Welcome'/);
  });

  it('resets navigation to Welcome when user becomes null', () => {
    const source = readSrc('App.js');
    assert.match(source, /resetToUnauthenticatedEntry\(\)/);
  });

  it('defines a canonical unauthenticated entry reset helper', () => {
    const source = readSrc('src/navigation/resetToUnauthenticatedEntry.js');
    assert.match(source, /UNAUTHENTICATED_ENTRY_ROUTE = 'Welcome'/);
    assert.match(source, /CommonActions\.reset/);
  });
});

describe('PAW-180 V1.1 entry-point requirement', () => {
  it('resetAuthState clears session and resets navigation to Welcome', () => {
    const source = readSrc('src/contexts/AuthContext.js');
    const resetAuthState = source.slice(
      source.indexOf('const resetAuthState'),
      source.indexOf('/** Clear the logout guard'),
    );
    assert.match(resetAuthState, /resetToUnauthenticatedEntry\(\)/);
  });

  it('delete goodbye closes on Welcome without authenticated back stack', () => {
    const authContext = readSrc('src/contexts/AuthContext.js');
    const closeDelete = authContext.slice(
      authContext.indexOf('const closeDeleteGoodbye'),
      authContext.indexOf('const value = useMemo'),
    );
    assert.match(closeDelete, /resetToUnauthenticatedEntry\(\)/);

    const welcome = readSrc('src/screens/WelcomeScreen.js');
    assert.match(welcome, /BackHandler/);
    assert.match(welcome, /hardwareBackPress/);
  });

  it('Welcome stack screen disables back gesture into authenticated history', () => {
    const source = readSrc('App.js');
    assert.match(source, /name="Welcome"[\s\S]*gestureEnabled: false/);
  });
});
