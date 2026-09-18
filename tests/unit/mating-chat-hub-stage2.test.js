import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Chat hub stage 2 structure', () => {
  const list = readSrc('src/screens/MatingChatListScreen.js');
  const tabs = readSrc('src/navigation/BottomTabNavigator.js');

  it('renders Interested and Connected section headings', () => {
    assert.match(list, /sectionTitle[\s\S]*Interested/);
    assert.match(list, /sectionTitle[\s\S]*Connected/);
    assert.match(list, /ListHeaderComponent=\{renderHubHeader\}/);
  });

  it('shows Interested empty treatment instead of hiding the section', () => {
    assert.match(list, /showInterestedSectionEmpty/);
    assert.match(list, /PawpleEmptyState/);
    assert.doesNotMatch(list, /interestedPlaceholder/);
  });

  it('keeps Connected data source, ordering, and navigation unchanged', () => {
    assert.match(list, /fetchMyIntroductionChannels/);
    assert.match(list, /last_message_at/);
    assert.match(list, /opened_at/);
    assert.match(list, /navigate\('MatingIntroductionChatScreen'/);
    assert.match(list, /formatChatListTime/);
  });

  it('keeps Connected empty state copy under the Connected section', () => {
    assert.match(list, /ListEmptyComponent=\{renderConnectedEmpty\}/);
    assert.match(list, /No introductions yet\./);
    assert.match(list, /No introductions right now\./);
    assert.match(list, /renderConnectedEmpty[\s\S]*PawpleEmptyState/);
  });

  it('keeps loading and error handling for Connected fetch', () => {
    assert.match(list, /LoadErrorRetry/);
    assert.match(list, /ActivityIndicator/);
  });

  it('keeps Chat tab visible for opted-in pets without channel gating', () => {
    assert.match(tabs, /setShowChatTab\(true\)/);
    assert.doesNotMatch(tabs, /fetchMyIntroductionChannels/);
    assert.doesNotMatch(tabs, /activePetHasChannel/);
  });
});
