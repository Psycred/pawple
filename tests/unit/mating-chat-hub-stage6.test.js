import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Chat hub stage 6 Connected conversation list', () => {
  const list = readSrc('src/screens/MatingChatListScreen.js');

  it('renders Connected as a lean conversation row without DiscoverMomentCard', () => {
    const renderRowBlock = list.slice(list.indexOf('const renderRow'));
    assert.match(renderRowBlock, /styles\.row/);
    assert.match(renderRowBlock, /styles\.previewRow/);
    assert.doesNotMatch(renderRowBlock, /DiscoverMomentCard/);
    assert.doesNotMatch(list, /row:[\s\S]*backgroundColor: theme\.colors\.background\.card/);
  });

  it('shows pet avatar, name, latest message, and timestamp in the Connected row', () => {
    assert.match(list, /resolved\.otherPhotoUrl/);
    assert.match(list, /resolved\.otherPetName/);
    assert.match(list, /item\.last_message_body/);
    assert.match(list, /formatChatListTime\(item\.last_message_at\)/);
  });

  it('shows a subtle sage-green Paw for mutual Connected relationships', () => {
    const renderRowBlock = list.slice(list.indexOf('const renderRow'));
    assert.match(renderRowBlock, /name="paw"/);
    assert.match(renderRowBlock, /color={theme\.colors\.brand\.sage\.value}/);
    assert.doesNotMatch(renderRowBlock, /pawExpressed/);
    assert.doesNotMatch(renderRowBlock, /DiscoverPawAction/);
  });

  it('keeps Connected ordering and data source unchanged', () => {
    assert.match(list, /fetchMyIntroductionChannels/);
    assert.match(list, /sortedChannels = useMemo/);
    assert.match(list, /last_message_at \?\? a\.opened_at/);
    assert.match(list, /return bTime - aTime/);
  });

  it('keeps conversation-row navigation to MatingIntroductionChatScreen', () => {
    assert.match(list, /openThread/);
    assert.match(list, /navigate\('MatingIntroductionChatScreen'/);
    assert.match(list, /onPress=\{\(\) => openThread\(item, resolved\)\}/);
  });

  it('opens the other pet profile from avatar and name without changing chat navigation', () => {
    assert.match(list, /openConnectedProfile/);
    assert.match(list, /navigate\('ViewPetProfileScreen'/);
    assert.match(list, /petId: resolved\.otherPetId/);
    assert.match(list, /viewerPetId: resolved\.myPetId/);
    assert.match(list, /onPress=\{\(\) => openConnectedProfile\(resolved\)\}/);
  });

  it('keeps Connected empty state and Interested carousel unchanged', () => {
    assert.match(list, /ListEmptyComponent=\{renderConnectedEmpty\}/);
    assert.match(list, /No introductions yet\./);
    assert.match(list, /No introductions right now\./);
    assert.match(list, /DiscoverMomentCard/);
    assert.match(list, /renderInterestedItem/);
  });
});
