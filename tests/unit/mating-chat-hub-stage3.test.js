import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Chat hub stage 3 Interested carousel', () => {
  const list = readSrc('src/screens/MatingChatListScreen.js');

  it('loads inbound interest via fetchInboundInterest for the active pet', () => {
    assert.match(list, /fetchInboundInterest\(viewerPetId\)/);
    assert.match(list, /loadInterested\(activePetId/);
  });

  it('renders a horizontal FlatList with DiscoverMomentCard', () => {
    assert.match(list, /horizontal/);
    assert.match(list, /DiscoverMomentCard/);
    assert.match(list, /renderInterestedItem/);
  });

  it('orders inbound interest newest-first and excludes mutual Paws', () => {
    assert.match(list, /queryMutualPaw\(viewerPetId, fromPetId\)/);
    assert.match(list, /!mutualCheck\.ok \|\| mutualCheck\.mutual/);
    assert.doesNotMatch(list, /nonMutual\.reverse\(/);
  });

  it('enriches inbound pets with discover moment and profile helpers', () => {
    assert.match(list, /fetchDiscoverMomentMap/);
    assert.match(list, /fetchDiscoverProfileMeta/);
  });

  it('uses batch viewer-relative outbound Paw state for pawExpressed', () => {
    assert.match(list, /fetchDiscoverPawState\(viewerPetId, fromIds\)/);
    assert.doesNotMatch(list, /fetchOutboundPaw/);
    assert.match(list, /pawExpressed=\{pawState\.outbound\.has\(candidateId\)\}/);
    assert.match(list, /pawStateKnown=\{pawState\.ready\}/);
  });

  it('preserves profile navigation with pawInterestId', () => {
    assert.match(list, /navigate\('ViewPetProfileScreen'/);
    assert.match(list, /source: 'interest'/);
    assert.match(list, /pawInterestId: item\?\.id/);
  });

  it('supports Paw-back and unpaw through expressPaw and useMatingUnpawFlow', () => {
    assert.match(list, /expressPaw\(activePetId, fromPetId\)/);
    assert.match(list, /useMatingUnpawFlow/);
    assert.match(list, /UnpawConfirmSheet/);
  });

  it('refreshes Interested on screen focus after Paw-back', () => {
    assert.match(list, /useFocusEffect/);
    assert.match(list, /load\(\)/);
    assert.match(list, /await load\(\)/);
  });

  it('keeps Connected behavior unchanged from stage 2', () => {
    assert.match(list, /fetchMyIntroductionChannels/);
    assert.match(list, /last_message_at/);
    assert.match(list, /opened_at/);
    assert.match(list, /navigate\('MatingIntroductionChatScreen'/);
    assert.match(list, /ListEmptyComponent=\{renderConnectedEmpty\}/);
    assert.match(list, /No introductions yet\./);
  });

  it('does not change notification routing in this screen', () => {
    assert.doesNotMatch(list, /openAccountNotification/);
    assert.doesNotMatch(list, /create_account_notification/);
  });
});
