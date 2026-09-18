import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Chat hub stage 5 profile discovery cleanup', () => {
  const section = readSrc('src/components/MatingSection.js');
  const tabs = readSrc('src/navigation/BottomTabNavigator.js');
  const app = readSrc('App.js');

  it('removes the legacy For Pet outbound entry from MatingSection', () => {
    assert.doesNotMatch(section, /For \$\{displayName\}/);
    assert.doesNotMatch(section, /openDiscovery/);
    assert.doesNotMatch(section, /MatingDiscoveryScreen/);
    assert.doesNotMatch(section, /exploreLink/);
    assert.doesNotMatch(section, /useNavigation/);
  });

  it('keeps Mating heading, Open to Mating toggle, and PetTraits on profile', () => {
    assert.match(section, /sectionTitle[\s\S]*Mating/);
    assert.match(section, /Open to Mating/);
    assert.match(section, /PetTraitsSection/);
    assert.match(section, /MatingSetupModal/);
  });

  it('keeps Discover tab wired to MatingDiscoveryScreen', () => {
    assert.match(tabs, /import MatingDiscoveryScreen from '\.\.\/screens\/MatingDiscoveryScreen'/);
    assert.match(tabs, /name="MatingDiscoverTab"/);
    assert.match(tabs, /component={MatingDiscoveryScreen}/);
    assert.match(tabs, /initialParams=\{\{ fromTab: true \}\}/);
    assert.match(tabs, /tabBarLabel: 'Discover'/);
  });

  it('removes the legacy stack route to MatingDiscoveryScreen from App', () => {
    assert.doesNotMatch(app, /name="MatingDiscoveryScreen"/);
    assert.doesNotMatch(app, /import MatingDiscoveryScreen/);
  });
});
