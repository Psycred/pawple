import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Not for me UI affordance', () => {
  const action = readSrc('src/components/MatingNotForMeAction.js');
  const profile = readSrc('src/screens/ViewPetProfileScreen.js');
  const chat = readSrc('src/screens/MatingChatListScreen.js');
  const card = readSrc('src/components/DiscoverMomentCard.js');
  const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
  const pawButton = readSrc('src/components/MatingPawButton.js');
  const pawAction = readSrc('src/components/DiscoverPawAction.js');

  it('renders the exact restrained label copy', () => {
    assert.match(action, /Not for me/);
    assert.match(action, /theme\.colors\.feedback\.error\.value/);
    assert.match(action, /fontSize: theme\.fontSizes\.xs/);
    assert.match(action, /onPress=\{onPress\}/);
  });

  it('shows Not for me on inbound View Pet Profile Paw area only', () => {
    assert.match(profile, /import MatingNotForMeAction/);
    assert.match(profile, /canPaw \?/);
    assert.match(profile, /styles\.pawRow/);
    assert.match(profile, /hasInboundPaw && !mutual/);
    assert.match(profile, /<MatingNotForMeAction onPress=\{handleNotForMe\}/);
  });

  it('shows Not for me on Interested cards only', () => {
    assert.match(chat, /showNotForMe/);
    assert.match(chat, /onNotForMePress/);
    assert.match(card, /showNotForMe = false/);
    assert.match(card, /showNotForMe \?/);
    assert.match(card, /<MatingNotForMeAction onPress=\{onNotForMePress\}/);
  });

  it('does not show Not for me in Discover feed cards', () => {
    assert.doesNotMatch(discovery, /showNotForMe/);
    assert.doesNotMatch(discovery, /MatingNotForMeAction/);
    assert.doesNotMatch(discovery, /Not for me/);
  });

  it('keeps existing Paw components unchanged', () => {
    assert.doesNotMatch(pawButton, /Not for me/);
    assert.doesNotMatch(pawAction, /Not for me/);
    assert.match(profile, /onPress=\{handlePaw\}/);
    assert.match(card, /DiscoverPawAction/);
    assert.match(card, /expressed=\{pawExpressed\}/);
    assert.match(card, /onPress=\{onPawPress\}/);
  });
});
