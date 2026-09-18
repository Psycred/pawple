import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('active-pet Mating navigation', () => {
  const tabs = readSrc('src/navigation/BottomTabNavigator.js');

  it('uses the active pet opt-in rather than any owned pet', () => {
    assert.match(tabs, /\.eq\('id', activePetId\)/);
    assert.match(tabs, /activePet\?\.is_looking_for_companion/);
    assert.match(tabs, /matingStateIsForActivePet && showDiscoverTab/);
  });

  it('shows Chat whenever the active pet is opted into Mating', () => {
    assert.match(
      tabs,
      /matingStateIsForActivePet && showDiscoverTab && showChatTab/,
    );
    assert.match(tabs, /if \(!activePetOpenToMating\) \{\s*setShowChatTab\(false\)/s);
    assert.match(tabs, /setShowChatTab\(true\)/);
    assert.doesNotMatch(tabs, /fetchMyIntroductionChannels/);
    assert.doesNotMatch(tabs, /activePetHasChannel/);
  });

  it('uses the approved labels and restrained icon treatment without Map', () => {
    assert.match(tabs, /tabBarLabel: 'Discover'/);
    assert.match(tabs, /tabBarLabel: 'Chat'/);
    assert.match(tabs, /name="message-circle"/);
    assert.doesNotMatch(tabs, /tabBarLabel: 'Map'|name="Map/);
  });

  it('uses the active pet profile photo and name in the profile tab', () => {
    assert.match(tabs, /const \{ activePetId, activePet \} = useActivePet\(\)/);
    assert.match(tabs, /photoUrl=\{activePet\?\.photo_url\}/);
    assert.match(tabs, /name=\{activePet\?\.name\}/);
    assert.match(tabs, /tabBarLabel: petTabLabel/);
  });
});

describe('Feed notifications entry', () => {
  it('shows the bell and registers the Notifications route', () => {
    const feed = readSrc('src/screens/FeedScreen.js');
    const app = readSrc('App.js');
    const screen = readSrc('src/screens/NotificationsScreen.js');

    assert.match(feed, /showNotifications/);
    assert.match(app, /name="Notifications"/);
    assert.match(screen, /You&apos;re all caught up/);
  });
});

describe('Mating terminology', () => {
  it('removes the old companionship label from user-facing Mating surfaces', () => {
    const surfaces = [
      'src/components/MatingSection.js',
      'src/components/PetCompanionCommunitySection.js',
      'src/screens/PetProfileScreen.js',
      'src/screens/ViewPetProfileScreen.js',
      'src/screens/MatingDiscoveryScreen.js',
      'src/content/legalDocuments.js',
    ];

    for (const surface of surfaces) {
      assert.doesNotMatch(readSrc(surface), /Open to Companionship/);
    }
  });
});
