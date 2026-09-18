import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

describe('Mating visual refinement — Task 13E', () => {
  const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
  const hub = readSrc('src/screens/MatingChatListScreen.js');
  const thread = readSrc('src/screens/MatingIntroductionChatScreen.js');
  const header = readSrc('src/components/MatingSurfaceHeader.js');
  const threadHeader = readSrc('src/components/ChatThreadHeader.js');
  const legal = readSrc('src/content/legalDocuments.js');
  const tabs = readSrc('src/navigation/BottomTabNavigator.js');

  it('uses Discover title with active-pet context header', () => {
    assert.match(discovery, /MatingSurfaceHeader/);
    assert.match(discovery, /title="Discover"/);
    assert.match(discovery, /variant="discover"/);
    assert.doesNotMatch(discovery, /For \$\{/);
    assert.doesNotMatch(discovery, /orientCard/);
    assert.doesNotMatch(discovery, /To explore/);
    assert.match(header, /PetContextSelector/);
    assert.match(header, /PetSwitchBottomSheet/);
  });

  it('uses Chat title with active-pet context on the hub', () => {
    assert.match(legal, /MATING_CHAT_TAB_LABEL = 'Chat'/);
    assert.match(tabs, /tabBarAccessibilityLabel: 'Chat'/);
    assert.match(hub, /MatingSurfaceHeader/);
    assert.match(hub, /variant="chat"/);
    assert.doesNotMatch(hub, /showBackButton/);
  });

  it('uses primary section headings for Interested and Connected', () => {
    assert.match(hub, /fontFamily: theme\.fonts\.semibold/);
    assert.match(hub, /fontSize: theme\.fontSizes\.md/);
    assert.match(hub, /color: theme\.colors\.text\.primary\.light/);
    assert.doesNotMatch(hub, /letterSpacing: 0\.2/);
    assert.match(hub, /showInterestedSectionEmpty/);
  });

  it('quiets the introduction chat header', () => {
    assert.match(threadHeader, /THREAD_AVATAR_SIZE = 30/);
    assert.match(threadHeader, /size={theme\.fontSizes\.lg}/);
    assert.match(threadHeader, /color={theme\.colors\.text\.secondary\.light}/);
    assert.match(threadHeader, /fontSize: theme\.fontSizes\.md/);
    assert.doesNotMatch(threadHeader, /avatarInitial/);
    assert.match(thread, /color={theme\.colors\.text\.muted\.light}/);
  });

  it('lightens message bubbles and integrates the composer', () => {
    assert.match(thread, /borderRadius: 14/);
    assert.match(thread, /composerSurface/);
    assert.match(thread, /Send/);
    assert.doesNotMatch(thread, /sendBtn/);
    assert.doesNotMatch(thread, /arrow-up/);
    assert.doesNotMatch(thread, /borderTopWidth/);
  });

  it('preserves Task 13A/13B refresh and paw behavior', () => {
    assert.match(hub, /preserveHub/);
    assert.match(hub, /fetchDiscoverPawState/);
    assert.match(hub, /void load\(\)/);
    assert.match(discovery, /preserveResults/);
    assert.match(discovery, /fetchDiscoverPawState/);
  });
});
