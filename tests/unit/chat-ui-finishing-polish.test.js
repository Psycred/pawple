import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

describe('Chat UI finishing polish — Task 13C', () => {
  const hub = readSrc('src/screens/MatingChatListScreen.js');
  const legal = readSrc('src/content/legalDocuments.js');

  it('shows Interested empty treatment while keeping the section heading', () => {
    const header = hub.slice(
      hub.indexOf('const renderHubHeader = () =>'),
      hub.indexOf('const renderConnectedEmpty = () =>'),
    );
    assert.match(header, /Interested/);
    assert.match(header, /showInterestedSectionEmpty/);
    assert.match(header, /PawpleEmptyState/);
    assert.doesNotMatch(header, /interestedPlaceholder/);
    assert.match(header, /Connected/);
  });

  it('uses PetContextSelector for Connected avatar fallback', () => {
    const row = hub.slice(
      hub.indexOf('const renderRow = ({ item }) =>'),
      hub.indexOf('return (', hub.indexOf('<ScreenWrapper')),
    );
    assert.match(hub, /import PetContextSelector from '\.\.\/components\/PetContextSelector'/);
    assert.match(row, /<PetContextSelector photoUrl=\{null\} size=\{48\} \/>/);
    assert.doesNotMatch(row, /avatarInitial/);
    assert.doesNotMatch(row, /petInitial/);
  });

  it('does not add distance to Interested cards without new data plumbing', () => {
    const interested = hub.slice(
      hub.indexOf('const renderInterestedItem = useCallback'),
      hub.indexOf('const renderHubHeader = () =>'),
    );
    assert.doesNotMatch(interested, /distanceKm/);
    assert.doesNotMatch(hub, /fetchMatingOpportunities/);
  });

  it('removes paw emoji from empty introduction thread copy', () => {
    assert.match(legal, /MATING_CHAT_EMPTY_COMPANION = 'You found a companion'/);
    assert.doesNotMatch(legal, /MATING_CHAT_EMPTY_COMPANION = 'You found a companion 🐾'/);
  });

  it('adds pull-to-refresh on the hub FlatList only', () => {
    assert.match(hub, /refreshControl=\{/);
    assert.match(hub, /onRefresh=\{\(\) => void load\(\{ isRefresh: true \}\)\}/);
    assert.doesNotMatch(readSrc('src/screens/MatingIntroductionChatScreen.js'), /RefreshControl/);
  });

  it('preserves Task 13A invisible refresh and Task 13B Interested paw behavior', () => {
    assert.match(hub, /preserveHub/);
    assert.match(hub, /fetchDiscoverPawState/);
    assert.match(hub, /pawStateKnown=\{pawState\.ready\}/);
    assert.match(hub, /void load\(\)/);
  });
});
