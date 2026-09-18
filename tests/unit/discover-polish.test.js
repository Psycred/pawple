import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

describe('Discover polish — paw responsiveness & fail-closed', () => {
  const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
  const paw = readSrc('src/components/DiscoverPawAction.js');
  const mating = readSrc('src/services/mating.js');

  it('updates outbound paw state optimistically before reload', () => {
    assert.match(discovery, /outbound\.add\(key\)/);
    assert.match(discovery, /void load\(\)/);
    assert.match(discovery, /outbound\.delete\(key\)/);
  });

  it('blocks paw when state is unknown or busy', () => {
    assert.match(discovery, /!pawState\.ready/);
    assert.match(discovery, /pawStateKnown=\{pawState\.ready\}/);
    assert.match(paw, /stateKnown = true/);
    assert.match(paw, /buttonUnknown/);
  });

  it('batch-fetches discover paw metadata instead of per-candidate loops', () => {
    assert.match(discovery, /fetchDiscoverPawState/);
    assert.doesNotMatch(discovery, /fetchOutboundPaw/);
    assert.doesNotMatch(discovery, /fetchInboundPaw/);
    assert.match(mating, /export async function fetchDiscoverPawState/);
    assert.match(mating, /\.in\('to_pet_id', ids\)/);
    assert.match(mating, /\.in\('from_pet_id', ids\)/);
  });

  it('fails closed when batch paw lookup is not ok', () => {
    assert.match(mating, /ok: false/);
    assert.match(discovery, /!state\.ok/);
    assert.match(discovery, /ready: false/);
  });
});

describe('Discover polish — loading performance', () => {
  const discoverMoments = readSrc('src/services/discoverMoments.js');

  it('batch-fetches moments with overlaps instead of per-candidate fetchMomentsForPet', () => {
    assert.match(discoverMoments, /\.overlaps\('pet_ids', ids\)/);
    assert.doesNotMatch(discoverMoments, /from '\.\/moments'/);
    assert.doesNotMatch(discoverMoments, /await fetchMomentsForPet/);
    assert.match(discoverMoments, /pickDiscoverMomentForCandidate/);
  });
});

describe('Discover polish — distance & profile fallback', () => {
  const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
  const card = readSrc('src/components/DiscoverMomentCard.js');

  it('passes server distance_km to discover cards', () => {
    assert.match(discovery, /distanceKm=\{item\.distance_km\}/);
    assert.match(card, /distanceKm = null/);
    assert.match(card, /km away/);
    assert.match(card, /navigation/);
    assert.doesNotMatch(card, /Linking/);
    assert.doesNotMatch(card, /directionsLink/);
    assert.doesNotMatch(card, /openMapsLink/);
  });

  it('refines profile fallback with cream scrapbook fill', () => {
    assert.match(card, /profilePhotoWell/);
    assert.match(card, /profilePhotoFrame/);
    assert.match(card, /scrapbookPaperFill/);
    assert.match(card, /resizeMode="contain"/);
  });
});
