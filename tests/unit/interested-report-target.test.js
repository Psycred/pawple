import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Interested report target correction', () => {
  const chat = readSrc('src/screens/MatingChatListScreen.js');
  const card = readSrc('src/components/DiscoverMomentCard.js');
  const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');

  it('passes inbound paw_interests.id from Interested into DiscoverMomentCard', () => {
    assert.match(chat, /pawInterestId=\{item\.id\}/);
  });

  it('reports mating_interest with pawInterestId even when variant is moment', () => {
    assert.match(card, /pawInterestId = null/);
    assert.match(card, /hasPawInterestReport/);
    assert.match(card, /hasPawInterestReport\s*\?\s*'mating_interest'/);
    assert.match(card, /hasPawInterestReport\s*\?\s*pawInterestId/);
    assert.match(card, /hasPawInterestReport \|\| !isMoment/);
  });

  it('uses pawInterestId as report target when inbound Paw id is provided', () => {
    const reportBlock = card.slice(
      card.indexOf('const hasPawInterestReport'),
      card.indexOf('const openMenu'),
    );
    assert.match(reportBlock, /reportTargetId = hasPawInterestReport\s*\n\s*\?\s*pawInterestId/);
    assert.match(reportBlock, /reportAccountId = hasPawInterestReport \|\| !isMoment/);
    assert.match(card, /targetType=\{reportTargetType\}/);
    assert.match(card, /targetId=\{reportTargetId\}/);
    assert.match(card, /reportedUserId=\{reportAccountId\}/);
  });

  it('preserves Discover moment reporting when pawInterestId is absent on moment cards', () => {
    assert.match(discovery, /pawInterestId=\{hasMoment \? null/);
    assert.match(card, /isMoment\s*\?\s*'moment'/);
    assert.match(card, /isMoment\s*\?\s*momentId/);
    assert.match(card, /momentOwnerId/);
  });
});
