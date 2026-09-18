import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function renderRowSlices(list) {
  const renderRowStart = list.indexOf('const renderRow');
  const renderRowBlock = list.slice(renderRowStart);
  const endedStart = renderRowBlock.indexOf("if (item.list_kind === 'ended_anonymous')");
  const endedEnd = renderRowBlock.indexOf('const resolved = resolveChannelPets');
  return {
    endedAnonymous: renderRowBlock.slice(endedStart, endedEnd),
    openConnected: renderRowBlock.slice(endedEnd),
  };
}

describe('Connected-list UnPaw access', () => {
  const list = readSrc('src/screens/MatingChatListScreen.js');
  const { endedAnonymous, openConnected } = renderRowSlices(list);

  it('adds trailing more-horizontal only on normal open Connected rows', () => {
    assert.match(openConnected, /name="more-horizontal"/);
    assert.doesNotMatch(endedAnonymous, /more-horizontal/);
    assert.doesNotMatch(endedAnonymous, /connectedMenuPress/);
  });

  it('opens ContentSafetyMenu with only Unpaw exposed', () => {
    assert.match(list, /ContentSafetyMenu/);
    assert.match(list, /visible={connectedSafetyOpen}/);
    assert.match(list, /showUnpaw/);
    assert.match(list, /showReport=\{false\}/);
    assert.match(list, /showBlock=\{false\}/);
    assert.doesNotMatch(list, /showDelete/);
    assert.doesNotMatch(list, /showViewProfile/);
    assert.doesNotMatch(list, /onReport=/);
    assert.doesNotMatch(list, /onBlock=/);
    assert.doesNotMatch(list, /deleteOpenIntroductionChat/);
  });

  it('routes Unpaw through requestUnpaw without direct service or RPC calls', () => {
    assert.match(list, /unpawFlow\.requestUnpaw\(\)/);
    assert.doesNotMatch(openConnected, /withdrawPaw/);
    assert.doesNotMatch(openConnected, /unpawMutualIntroduction/);
    assert.doesNotMatch(openConnected, /unpaw_mutual_introduction/);
    assert.match(list, /UnpawConfirmSheet/);
    assert.match(list, /UnpawReportPrompt/);
    assert.match(list, /useMatingUnpawFlow/);
  });

  it('sets unpaw target before opening the Connected safety menu', () => {
    const menuOpenBlock = openConnected.slice(
      openConnected.indexOf('setUnpawTargetId(resolved.otherPetId)'),
      openConnected.indexOf('connectedMenuPress'),
    );
    assert.match(menuOpenBlock, /setReportPetName\(resolved\.otherPetName/);
    assert.match(menuOpenBlock, /setConnectedSafetyOpen\(true\)/);
  });

  it('keeps avatar and name profile navigation intact', () => {
    assert.match(openConnected, /onPress=\{\(\) => openConnectedProfile\(resolved\)\}/);
    assert.match(list, /const openConnectedProfile = useCallback/);
    assert.match(list, /navigate\('ViewPetProfileScreen'/);
    assert.match(list, /petId: resolved\.otherPetId/);
    assert.match(list, /viewerPetId: resolved\.myPetId/);
  });

  it('keeps row body navigation to the chat thread', () => {
    assert.match(openConnected, /onPress=\{\(\) => openThread\(item, resolved\)\}/);
    assert.match(list, /const openThread = useCallback/);
    assert.match(list, /navigate\('MatingIntroductionChatScreen'/);
    const threadClose = openConnected.indexOf('</Pressable>', openConnected.indexOf('openThread(item, resolved)'));
    const menuIdx = openConnected.indexOf('more-horizontal');
    assert.ok(threadClose < menuIdx);
  });

  it('keeps decorative sage Paw non-interactive', () => {
    const pawBlock = openConnected.slice(
      openConnected.indexOf('<Ionicons'),
      openConnected.indexOf('</Pressable>', openConnected.indexOf('previewRow')),
    );
    assert.match(pawBlock, /name="paw"/);
    assert.match(pawBlock, /color={theme\.colors\.brand\.sage\.value}/);
    assert.doesNotMatch(pawBlock, /onPress/);
    assert.doesNotMatch(pawBlock, /DiscoverPawAction/);
  });

  it('isolates the trailing menu press outside the chat thread pressable', () => {
    assert.match(openConnected, /connectedMenuPress/);
    assert.match(openConnected, /hitSlop=\{12\}/);
  });

  it('preserves Connected sorting, preview, and refresh behavior', () => {
    assert.match(list, /sortedChannels = useMemo/);
    assert.match(list, /last_message_at \?\? a\.opened_at/);
    assert.match(list, /return bTime - aTime/);
    assert.match(list, /item\.last_message_body/);
    assert.match(list, /formatChatListTime\(item\.last_message_at\)/);
    assert.match(list, /useFocusEffect/);
    assert.match(list, /fetchMyIntroductionChannels/);
  });

  it('preserves ended_anonymous row behavior without the menu control', () => {
    assert.match(endedAnonymous, /openEndedAnonymousThread/);
    assert.match(endedAnonymous, /MATING_CHAT_ENDED_TITLE/);
    assert.doesNotMatch(endedAnonymous, /openConnectedProfile/);
    assert.doesNotMatch(endedAnonymous, /ContentSafetyMenu/);
  });
});
