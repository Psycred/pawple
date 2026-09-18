import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

describe('Chat refresh polish — Task 13A', () => {
  const hub = readSrc('src/screens/MatingChatListScreen.js');
  const thread = readSrc('src/screens/MatingIntroductionChatScreen.js');

  it('skips full-page hub loading when preserving visible content on refresh', () => {
    assert.match(hub, /preserveHub/);
    assert.match(hub, /if \(!preserveHub\)/);
    assert.match(hub, /hubPetIdRef/);
    assert.match(hub, /channels\.length > 0 \|\| interestedRows\.length > 0/);
  });

  it('retains last hub content when a background refresh fails', () => {
    const catchBlock = hub.slice(
      hub.indexOf('} catch (e) {'),
      hub.indexOf('} finally {', hub.indexOf('} catch (e) {')),
    );
    assert.match(catchBlock, /if \(!preserveHub\)/);
    assert.match(catchBlock, /setError\(true\)/);
    assert.match(catchBlock, /setChannels\(\[\]\)/);
  });

  it('keeps hub FlatList mounted during background refresh', () => {
    assert.match(hub, /loading \?/);
    assert.match(hub, /<FlatList/);
  });

  it('pull-to-refresh uses background hub refresh without full-page loading', () => {
    assert.match(hub, /RefreshControl/);
    assert.match(hub, /load\(\{ isRefresh: true \}\)/);
    assert.match(hub, /isRefresh \|\|/);
    assert.match(hub, /setRefreshing\(false\)/);
  });

  it('distinguishes initial thread load from background focus refresh', () => {
    assert.match(thread, /load\(\{ background: true \}\)/);
    assert.match(thread, /background = false/);
    assert.match(thread, /preserveThread/);
    assert.match(thread, /loadedChannelIdRef/);
    assert.match(thread, /viewReadyRef/);
  });

  it('does not reset thread UI on background refresh', () => {
    assert.match(thread, /if \(!preserveThread\)/);
    assert.doesNotMatch(
      thread,
      /if \(!preserveThread\)[\s\S]*setViewReady\(false\)[\s\S]*clearOtherPartyIdentity\(\)[\s\S]*setLoading\(true\)/,
    );
    assert.match(thread, /clearOtherPartyIdentity\(\)/);
    assert.match(thread, /setViewReady\(false\)/);
  });

  it('retains loaded thread content when background load fails', () => {
    const catchBlock = thread.slice(
      thread.indexOf('} catch (e) {', thread.indexOf('const load = useCallback')),
      thread.indexOf('} finally {', thread.indexOf('const load = useCallback')),
    );
    assert.match(catchBlock, /if \(!preserveThread\)/);
    assert.match(catchBlock, /setError\(true\)/);
  });

  it('preserves existing refreshChatView polling on focus', () => {
    assert.match(thread, /setInterval\(refreshChatView, INTRODUCTION_CHAT_VIEW_POLL_MS\)/);
    assert.match(thread, /INTRODUCTION_CHAT_VIEW_POLL_MS/);
  });
});
