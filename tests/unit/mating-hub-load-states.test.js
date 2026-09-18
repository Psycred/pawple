/**
 * Mating Discover/Chat load settling and empty-state wiring.
 * Run: node --test tests/unit/mating-hub-load-states.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Mating Discover load settling', () => {
  const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');

  it('preserves settled results without requiring opportunity count > 0', () => {
    const preserveBlock = discovery.slice(
      discovery.indexOf('const preserveResults ='),
      discovery.indexOf('if (!preserveResults)'),
    );
    assert.doesNotMatch(preserveBlock, /opportunities\.length > 0/);
    assert.match(preserveBlock, /resultsPetIdRef\.current === petId/);
  });

  it('keeps a stable load callback without state-derived useCallback deps', () => {
    assert.match(discovery, /}, \[petId, refreshPawState\]\);/);
    assert.doesNotMatch(discovery, /\[petId, pet, locationFresh/);
    assert.doesNotMatch(discovery, /opportunities\.length, error/);
  });

  it('keeps zero-match PawpleEmptyState reachable after load settles', () => {
    assert.match(discovery, /opportunities\.length === 0/);
    assert.match(discovery, /MATING_DISCOVER_EMPTY_NO_MATCHES_TITLE/);
    assert.match(discovery, /if \(loading\)/);
    assert.match(discovery, /setLoading\(false\)/);
  });
});

describe('Mating Chat hub load settling and empty states', () => {
  const hub = readSrc('src/screens/MatingChatListScreen.js');

  it('preserves settled hub without requiring list counts > 0', () => {
    const preserveBlock = hub.slice(
      hub.indexOf('const preserveHub ='),
      hub.indexOf('if (isRefresh)'),
    );
    assert.doesNotMatch(preserveBlock, /channels\.length > 0/);
    assert.doesNotMatch(preserveBlock, /interestedRows\.length > 0/);
    assert.match(preserveBlock, /hubPetIdRef\.current === activePetId/);
  });

  it('keeps a stable load callback without state-derived useCallback deps', () => {
    assert.match(hub, /}, \[activePetId, loadInterested, user\?\.id\]\);/);
    assert.doesNotMatch(hub, /channels\.length, error, interestedRows\.length/);
  });

  it('uses PawpleEmptyState for Interested, Connected, and fully empty hub', () => {
    assert.match(hub, /hubFullyEmpty/);
    assert.match(hub, /showInterestedSectionEmpty/);
    assert.match(hub, /PawpleEmptyState/);
    assert.match(hub, /No introductions yet\./);
    assert.match(hub, /No introductions right now\./);
    assert.doesNotMatch(hub, /connectedEmpty,/);
  });

  it('shows overall empty state when both sections are empty', () => {
    assert.match(
      hub,
      /hubFullyEmpty \? \([\s\S]*PawpleEmptyState[\s\S]*connectedEmptyTitle/,
    );
  });

  it('shows Interested empty treatment without hiding the section heading', () => {
    const header = hub.slice(
      hub.indexOf('const renderHubHeader = () =>'),
      hub.indexOf('const renderConnectedEmpty = () =>'),
    );
    assert.match(header, /Interested/);
    assert.match(header, /showInterestedSectionEmpty/);
    assert.match(header, /interestedRows\.length > 0/);
  });

  it('shows Connected empty treatment when only Connections is empty', () => {
    assert.match(hub, /ListEmptyComponent=\{renderConnectedEmpty\}/);
    assert.match(hub, /renderConnectedEmpty[\s\S]*PawpleEmptyState/);
  });
});
