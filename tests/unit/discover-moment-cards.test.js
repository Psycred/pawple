import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  DISCOVER_MOMENT_ROTATION_MS,
  filterDiscoverEligibleMoments,
  pickDiscoverMomentForCandidate,
} from '../../src/utils/discoverMomentRotation.js';
import { profilePhotoDateFromStorageUrl } from '../../src/lib/storageMediaParse.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

const viewerPetId = 'viewer-pet-uuid';
const candidatePetId = 'candidate-pet-uuid';

describe('discover moment rotation', () => {
  it('excludes moments tagged with the viewer pet', () => {
    const moments = [
      {
        id: 'm1',
        pet_ids: [candidatePetId],
        image_url: 'https://example.com/a.jpg',
      },
      {
        id: 'm2',
        pet_ids: [candidatePetId, viewerPetId],
        image_url: 'https://example.com/b.jpg',
      },
    ];

    const eligible = filterDiscoverEligibleMoments(moments, candidatePetId, viewerPetId);
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].id, 'm1');
  });

  it('keeps the same featured moment within a 7-day bucket', () => {
    const nowMs = Date.UTC(2026, 8, 10, 12, 0, 0);
    const bucketStart =
      Math.floor(nowMs / DISCOVER_MOMENT_ROTATION_MS) * DISCOVER_MOMENT_ROTATION_MS;
    const moments = [
      { id: 'a', pet_ids: [candidatePetId], image_url: 'a.jpg' },
      { id: 'b', pet_ids: [candidatePetId], image_url: 'b.jpg' },
      { id: 'c', pet_ids: [candidatePetId], image_url: 'c.jpg' },
    ];

    const first = pickDiscoverMomentForCandidate(
      moments,
      viewerPetId,
      candidatePetId,
      bucketStart + 1_000,
    );
    const second = pickDiscoverMomentForCandidate(
      moments,
      viewerPetId,
      candidatePetId,
      bucketStart + 86_400_000,
    );
    assert.equal(first.id, second.id);
  });

  it('can rotate after the 7-day bucket changes', () => {
    const bucketStart = Date.UTC(2026, 8, 10, 12, 0, 0);
    const moments = [
      { id: 'a', pet_ids: [candidatePetId], image_url: 'a.jpg' },
      { id: 'b', pet_ids: [candidatePetId], image_url: 'b.jpg' },
      { id: 'c', pet_ids: [candidatePetId], image_url: 'c.jpg' },
    ];

    const picks = new Set(
      [0, 1, 2].map((offset) =>
        pickDiscoverMomentForCandidate(
          moments,
          viewerPetId,
          candidatePetId,
          bucketStart + offset * DISCOVER_MOMENT_ROTATION_MS,
        ).id,
      ),
    );
    assert.ok(picks.size > 1, 'rotation should surface more than one moment across buckets');
  });
});

describe('profile fallback photo date', () => {
  const ownerId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const uploadedAtMs = 1_728_768_000_000;
  const photoUrl = `https://example.supabase.co/storage/v1/object/public/pet-photos/${ownerId}/${uploadedAtMs}.jpg`;

  it('derives ISO date from the storage path filename timestamp', () => {
    const photoDate = profilePhotoDateFromStorageUrl(photoUrl);
    assert.equal(photoDate, new Date(uploadedAtMs).toISOString());
  });

  it('returns null for non-storage or non-timestamp URLs', () => {
    assert.equal(profilePhotoDateFromStorageUrl(null), null);
    assert.equal(profilePhotoDateFromStorageUrl('https://example.com/photo.jpg'), null);
    assert.equal(
      profilePhotoDateFromStorageUrl(`pet-photos:${ownerId}/legacy-name.jpg`),
      null,
    );
  });
});

describe('discover moment card UI wiring', () => {
  const discoverMoments = readSrc('src/services/discoverMoments.js');
  const card = readSrc('src/components/DiscoverMomentCard.js');
  const paw = readSrc('src/components/DiscoverPawAction.js');
  const screen = readSrc('src/screens/MatingDiscoveryScreen.js');
  const feedTreatment = readSrc('src/components/FeedImageTreatment.js');

  it('keeps Paw outside the card with report/block only', () => {
    assert.match(card, /import DiscoverPawAction from '\.\/DiscoverPawAction'/);
    assert.match(card, /ContentSafetyMenu/);
    assert.match(card, /ReportSheet/);
    assert.match(card, /BlockConfirmSheet/);
    assert.doesNotMatch(card, /from '\.\/ActionBar'/);
    assert.doesNotMatch(card, /from '\.\/ShareCard'/);
  });

  it('uses profile fallback with centered square photo and contain treatment', () => {
    assert.match(card, /variant === 'moment'/);
    assert.match(card, /resizeMode="contain"/);
    assert.match(card, /squareStage/);
    assert.match(feedTreatment, /resizeMode = 'cover'/);
  });

  it('uses pet UUID for profile navigation only on the pet name', () => {
    assert.match(card, /onPetPress=\{handlePetPress\}/);
    assert.match(card, /accessibilityRole="link"/);
    assert.doesNotMatch(card, /onPress=\{onOpenProfile\}/);
  });

  it('shows expressed Paw styling only from the passed viewer state', () => {
    assert.match(paw, /expressed && stateKnown \? 'paw' : 'paw-outline'/);
    assert.match(screen, /pawExpressed=\{pawState\.outbound\.has\(candidateId\)\}/);
    assert.match(screen, /pawStateKnown=\{pawState\.ready\}/);
  });

  it('loads featured moments and profile meta without changing discovery RPC', () => {
    assert.match(screen, /fetchDiscoverMomentMap/);
    assert.match(screen, /fetchDiscoverProfileMeta/);
    assert.match(screen, /variant=\{hasMoment \? 'moment' : 'profile'\}/);
    assert.doesNotMatch(screen, /MatingExploreRow/);
    assert.doesNotMatch(screen, /get_mating_opportunities/);
  });

  it('derives profile fallback date from storage path only', () => {
    const storageParse = readSrc('src/lib/storageMediaParse.js');
    assert.match(discoverMoments, /profilePhotoDateFromStorageUrl/);
    assert.match(discoverMoments, /select\('id, owner_id, photo_url'\)/);
    assert.doesNotMatch(discoverMoments, /updated_at/);
    assert.doesNotMatch(discoverMoments, /select\('id, owner_id, photo_url, created_at/);
    assert.match(storageParse, /parseSupabaseStorageReference/);
    assert.match(storageParse, /profilePhotoDateFromStorageUrl/);
  });
});
