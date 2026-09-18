import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

describe('Chat Interested paw polish — Task 13B', () => {
  const hub = readSrc('src/screens/MatingChatListScreen.js');

  it('updates outbound paw state optimistically before background reload', () => {
    const handler = hub.slice(
      hub.indexOf('const handleInterestedPaw = useCallback'),
      hub.indexOf('const handleInterestedDismiss = useCallback'),
    );
    assert.match(handler, /outbound\.add\(key\)/);
    assert.match(handler, /void load\(\)/);
    assert.match(handler, /outbound\.delete\(key\)/);
    assert.match(handler, /if \(hadOutbound\)/);
  });

  it('blocks interested paw when state is unknown or busy', () => {
    const handler = hub.slice(
      hub.indexOf('const handleInterestedPaw = useCallback'),
      hub.indexOf('const handleInterestedDismiss = useCallback'),
    );
    assert.match(handler, /!pawState\.ready/);
    assert.match(hub, /pawStateKnown=\{pawState\.ready\}/);
  });

  it('batch-fetches interested paw state instead of per-row outbound lookups', () => {
    const loadInterested = hub.slice(
      hub.indexOf('const loadInterested = useCallback'),
      hub.indexOf('const load = useCallback'),
    );
    assert.match(loadInterested, /fetchDiscoverPawState\(viewerPetId, fromIds\)/);
    assert.doesNotMatch(loadInterested, /fetchOutboundPaw/);
    assert.doesNotMatch(
      loadInterested,
      /for \(const row of inbound\)[\s\S]*fetchOutboundPaw/,
    );
  });

  it('fails closed when batch paw lookup is not ok', () => {
    const loadInterested = hub.slice(
      hub.indexOf('const loadInterested = useCallback'),
      hub.indexOf('const load = useCallback'),
    );
    assert.match(loadInterested, /!pawResult\.ok/);
    assert.match(loadInterested, /ready: false/);
    assert.match(loadInterested, /preserveKnownOnFailure/);
  });

  it('preserves known paw state on background hub refresh failure', () => {
    assert.match(hub, /loadInterested\(activePetId, \{ preserveKnownOnFailure: preserveHub \}\)/);
  });

  it('preserves mutual-paw transition and unpaw flow', () => {
    assert.match(hub, /petsHaveMutualPaw\(activePetId, fromPetId\)/);
    assert.match(hub, /promptNotificationPermissionIfNeeded/);
    assert.match(hub, /unpawFlow\.requestUnpaw/);
    assert.match(hub, /queryMutualPaw\(viewerPetId, fromPetId\)/);
  });

  it('does not change Discover or Connected sections', () => {
    assert.doesNotMatch(hub, /MatingDiscoveryScreen/);
    assert.match(hub, /fetchMyIntroductionChannels/);
    assert.match(hub, /renderConnectedEmpty/);
    assert.match(hub, /No introductions yet\./);
    const renderRowStart = hub.indexOf('const renderRow =');
    const connectedRender = hub.slice(
      renderRowStart,
      hub.indexOf('ListEmptyComponent={renderConnectedEmpty}', renderRowStart),
    );
    assert.doesNotMatch(connectedRender, /pawStateKnown/);
    assert.doesNotMatch(connectedRender, /fetchDiscoverPawState/);
  });
});
