import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Not for me dismiss behavior', () => {
  const migration = readSrc('supabase/migrations/20260915120000_dismiss_incoming_paw.sql');
  const notifications = readSrc('supabase/migrations/20260909120000_account_notifications.sql');
  const mating = readSrc('src/services/mating.js');
  const chat = readSrc('src/screens/MatingChatListScreen.js');
  const profile = readSrc('src/screens/ViewPetProfileScreen.js');
  const card = readSrc('src/components/DiscoverMomentCard.js');
  const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');

  it('adds a recipient-only dismiss RPC that deletes the inbound Paw row', () => {
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.dismiss_incoming_paw/);
    assert.match(migration, /DELETE FROM public\.paw_interests pi/);
    assert.match(migration, /pi\.from_pet_id = dismiss_incoming_paw\.sender_pet_id/);
    assert.match(migration, /pi\.to_pet_id = dismiss_incoming_paw\.recipient_pet_id/);
    assert.match(migration, /pi\.to_owner_id = v_uid/);
    assert.match(migration, /jsonb_build_object\('ok', true, 'deleted', v_deleted\)/);
  });

  it('blocks dismiss when mutual Paw is active', () => {
    assert.match(migration, /pets_have_mutual_paw/);
    assert.match(migration, /mutual_paw_active/);
    assert.doesNotMatch(migration, /mating_clear_paw_between_pets/);
    assert.doesNotMatch(migration, /pet_blocks/);
    assert.doesNotMatch(migration, /reports/);
  });

  it('does not create notifications on dismiss', () => {
    assert.doesNotMatch(migration, /create_account_notification/);
    assert.doesNotMatch(migration, /notify_account_after_paw/);
    assert.match(notifications, /AFTER INSERT ON public\.paw_interests/);
    assert.doesNotMatch(notifications, /AFTER DELETE ON public\.paw_interests/);
  });

  it('exposes dismissIncomingPaw in the mating client service', () => {
    assert.match(mating, /export async function dismissIncomingPaw/);
    assert.match(mating, /rpc\('dismiss_incoming_paw'/);
    assert.match(mating, /export async function fetchInboundPaw/);
  });

  it('wires Interested dismissal and refresh without block or report', () => {
    assert.match(chat, /dismissIncomingPaw\(activePetId, fromPetId\)/);
    assert.match(chat, /handleNotForMe/);
    assert.match(chat, /onNotForMePress=\{\(\) => handleNotForMe\(item\)\}/);
    assert.match(chat, /await load\(\)/);
    assert.doesNotMatch(chat, /blockPet/);
    assert.doesNotMatch(chat, /createReport/);
  });

  it('shows profile dismiss only for inbound non-mutual Paws', () => {
    assert.match(profile, /fetchInboundPaw\(viewedPetId, viewerPetId\)/);
    assert.match(profile, /hasInboundPaw && !mutual/);
    assert.match(profile, /dismissIncomingPaw\(viewerPetId, viewedPetId\)/);
    assert.doesNotMatch(profile, /dismissIncomingPaw[\s\S]*blockPet/);
  });

  it('keeps Discover unchanged and preserves existing Paw-back flow', () => {
    assert.doesNotMatch(discovery, /dismissIncomingPaw/);
    assert.doesNotMatch(discovery, /showNotForMe/);
    assert.match(chat, /expressPaw\(activePetId, fromPetId\)/);
    assert.match(card, /DiscoverPawAction/);
    assert.match(card, /expressed=\{pawExpressed\}/);
    assert.match(card, /onPress=\{onPawPress\}/);
  });
});
