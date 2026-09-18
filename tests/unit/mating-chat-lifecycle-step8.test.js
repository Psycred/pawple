import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Step 8 chat lifecycle', () => {
  const chat = readSrc('src/screens/MatingIntroductionChatScreen.js');
  const mating = readSrc('src/services/mating.js');
  const list = readSrc('src/screens/MatingChatListScreen.js');
  const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
  const profile = readSrc('src/screens/ViewPetProfileScreen.js');

  it('exits unavailable remote channels back to Chat instead of LoadErrorRetry', () => {
    assert.match(chat, /handleChannelUnavailable/);
    assert.match(chat, /isUnavailablePayload/);
    assert.match(chat, /navigation\.goBack\(\)/);
    assert.match(chat, /exitAfterUnpawRef\.current/);
    assert.match(chat, /chatView === 'unavailable' && exitAfterUnpaw/);
    assert.match(chat, /handleChannelUnavailable[\s\S]*setError\(false\)/);
  });

  it('exits the thread after a successful block from Chat', () => {
    const blockHandler = chat.slice(
      chat.indexOf('<BlockConfirmSheet'),
      chat.indexOf('<UnpawConfirmSheet'),
    );
    assert.match(blockHandler, /onBlocked=\{\(\) => \{/);
    assert.match(blockHandler, /exitChat\(\)/);
    assert.doesNotMatch(blockHandler, /onBlocked[\s\S]*load\(\)/);
  });

  it('preserves reporter_frozen and ended_anonymous report flows', () => {
    assert.match(chat, /reporter_frozen/);
    assert.match(chat, /ended_anonymous/);
    assert.match(chat, /terminateIntroductionChatAfterReport/);
    assert.match(chat, /Introduction is paused\./);
    assert.match(chat, /handleReportSubmitted/);
    assert.match(chat, /consumeReportedIntroductionChatDismissal/);
    assert.match(chat, /exitAfterUnpaw\) \{\s*exitChat\(\)/);
  });

  it('defers unavailable exit during local unPaw report handling', () => {
    assert.match(chat, /setExitAfterUnpaw\(true\)/);
    assert.match(chat, /if \(exitAfterUnpawRef\.current\) \{\s*return;\s*\}/);
    assert.match(chat, /unpawFlow\.dismissReportPrompt/);
  });
});

describe('Step 8 Interested mutual fail-closed', () => {
  const mating = readSrc('src/services/mating.js');
  const list = readSrc('src/screens/MatingChatListScreen.js');

  it('exposes queryMutualPaw with explicit RPC trust', () => {
    assert.match(mating, /export async function queryMutualPaw/);
    assert.match(mating, /return \{ mutual: false, ok: false \}/);
    assert.match(mating, /petsHaveMutualPaw[\s\S]*queryMutualPaw/);
  });

  it('excludes Interested pets when mutual check fails', () => {
    const interestedLoop = list.slice(
      list.indexOf('for (const row of inbound)'),
      list.indexOf('setInterestedRows(nonMutual)'),
    );
    assert.match(interestedLoop, /queryMutualPaw\(viewerPetId, fromPetId\)/);
    assert.match(interestedLoop, /!mutualCheck\.ok \|\| mutualCheck\.mutual/);
  });

  it('keeps notification prompt on successful mutual paw from Interested', () => {
    assert.match(list, /petsHaveMutualPaw\(activePetId, fromPetId\)/);
    assert.match(list, /promptNotificationPermissionIfNeeded/);
  });
});

describe('Step 8 cleanup', () => {
  it('removes unused pawState.mutual from discovery', () => {
    const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
    assert.doesNotMatch(discovery, /pawState\.mutual/);
    assert.doesNotMatch(discovery, /mutual: new Set\(\)/);
  });

  it('updates stale Interested comment in mating service', () => {
    const mating = readSrc('src/services/mating.js');
    assert.match(mating, /Chat hub Interested carousel/);
    assert.doesNotMatch(mating, /Interest in \[Pet Name\]/);
  });

  it('drops obsolete MatingExploreRow runtime component', () => {
    const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
    assert.doesNotMatch(discovery, /MatingExploreRow/);
    let threw = false;
    try {
      readSrc('src/components/MatingExploreRow.js');
    } catch (e) {
      threw = e?.code === 'ENOENT';
    }
    assert.equal(threw, true, 'MatingExploreRow.js should be deleted');
  });

  it('removes obsolete ViewPetProfile frozen-channel note', () => {
    const profile = readSrc('src/screens/ViewPetProfileScreen.js');
    assert.doesNotMatch(profile, /channel\.status === 'frozen'/);
    assert.doesNotMatch(profile, /frozenNote/);
    assert.match(profile, /introductionOpen/);
  });
});
