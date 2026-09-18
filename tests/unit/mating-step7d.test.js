import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

const migration = readSrc('supabase/migrations/20260909230000_mating_step7d_chat_ux.sql');
const chat = readSrc('src/screens/MatingIntroductionChatScreen.js');
const list = readSrc('src/screens/MatingChatListScreen.js');
const profile = readSrc('src/screens/ViewPetProfileScreen.js');
const tabs = readSrc('src/navigation/BottomTabNavigator.js');

describe('Step 7D chat header and identity', () => {
  it('uses pet-centric thread header without pair title or parent wording', () => {
    assert.match(chat, /ChatThreadHeader/);
    assert.doesNotMatch(chat, /formatMatingChatHeaderTitle/);
    assert.doesNotMatch(chat, /'s parent|With .*parent/i);
    assert.doesNotMatch(list, /'s parent|With .*parent/i);
    assert.doesNotMatch(profile, /'s parent/);
  });

  it('opens ViewPetProfileScreen from header and menu', () => {
    assert.match(chat, /navigate\('ViewPetProfileScreen'/);
    assert.match(chat, /showViewProfile/);
    assert.match(chat, /onViewProfile/);
  });
});

describe('Step 7D composer and thread empty state', () => {
  it('uses Say hello and Message placeholders based on sent history', () => {
    assert.match(chat, /Say hello…/);
    assert.match(chat, /Message…/);
    assert.match(chat, /hasSentMessage/);
  });

  it('shows calm companion empty thread copy', () => {
    assert.match(chat, /MATING_CHAT_EMPTY_COMPANION/);
    assert.match(chat, /MATING_CHAT_EMPTY_SAY_HELLO/);
    assert.doesNotMatch(chat, /It'?s a match/i);
    assert.doesNotMatch(chat, /You matched/i);
  });

  it('renders message timestamps', () => {
    assert.match(chat, /formatMessageTime/);
    assert.match(chat, /item\.created_at/);
  });
});

describe('Step 7D unpaw flow', () => {
  it('defers navigation until report prompt or report sheet completes', () => {
    assert.match(chat, /exitAfterUnpaw/);
    assert.doesNotMatch(chat, /onUnpawComplete:\s*\(\)\s*=>\s*\{[^}]*navigation\.goBack/);
    assert.match(chat, /unpawFlow\.dismissReportPrompt/);
    assert.match(chat, /handleReportClose/);
  });
});

describe('Step 7D Chat list', () => {
  it('keeps Chat tab and hub title aligned', () => {
    assert.match(tabs, /tabBarLabel: 'Chat'/);
    assert.match(tabs, /tabBarAccessibilityLabel: 'Chat'/);
    assert.match(list, /MATING_CHAT_TAB_LABEL/);
    assert.match(list, /MatingSurfaceHeader/);
  });

  it('shows actual message preview and activity sort fields', () => {
    assert.match(list, /last_message_body/);
    assert.match(list, /last_message_at/);
    assert.match(list, /formatChatListTime/);
  });

  it('does not show synthetic preview subtitle when no messages exist', () => {
    assert.doesNotMatch(list, /previewMuted/);
    assert.doesNotMatch(list, /resolved\.myPetName/);
  });
});

describe('Step 7D migration — physical deletion lifecycle', () => {
  it('does not retain conversation history via conversation_generation', () => {
    assert.doesNotMatch(migration, /conversation_generation/);
    assert.doesNotMatch(migration, /mating_introduction_message_set_generation/);
  });

  it('physically deletes channels on unpaw teardown', () => {
    assert.match(migration, /mating_teardown_channel_for_pair/);
    assert.match(migration, /DELETE FROM public\.mating_introduction_channels/);
    assert.match(migration, /mating_freeze_channel_after_paw_delete/);
  });

  it('physically deletes connection data on block', () => {
    assert.match(migration, /mating_teardown_on_block/);
    assert.match(migration, /mating_clear_paw_between_pets/);
    assert.match(migration, /trg_pet_blocks_teardown_mating_on_block/);
  });

  it('does not reopen chat on unblock', () => {
    assert.match(migration, /DROP TRIGGER IF EXISTS trg_pet_blocks_reopen_mating_channels/);
    assert.match(migration, /DROP FUNCTION IF EXISTS public\.mating_try_reopen_after_unblock/);
    assert.doesNotMatch(migration, /CREATE TRIGGER trg_pet_blocks_reopen/);
  });

  it('creates fresh open channel on new mutual Paw', () => {
    assert.match(migration, /mating_sync_channel_after_paw_insert/);
    assert.match(migration, /INSERT INTO public\.mating_introduction_channels/);
  });

  it('physically deletes channels on pet opt-out instead of freezing', () => {
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.mating_on_pet_opt_out/);
    assert.match(migration, /DELETE FROM public\.mating_introduction_channels[\s\S]*pet_low_id = NEW\.id/);
    assert.doesNotMatch(migration, /freeze_reason = 'opt_out'/);
    assert.doesNotMatch(migration, /status = 'frozen'/);
  });

  it('never reopens a retained channel on rematch', () => {
    const syncFn = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.mating_sync_channel_after_paw_insert'),
      migration.indexOf('CREATE OR REPLACE FUNCTION public.mating_introduction_messages_select')
    );
    assert.match(syncFn, /mating_teardown_channel_for_pair/);
    assert.doesNotMatch(syncFn, /ON CONFLICT/);
  });
});

describe('Step 7D migration — destructive helper privileges', () => {
  it('revokes client execute on internal teardown helpers', () => {
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION public\.mating_teardown_channel_for_pair\(uuid, uuid\) FROM PUBLIC/
    );
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION public\.mating_clear_paw_between_pets\(uuid, uuid\) FROM PUBLIC/
    );
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION public\.mating_teardown_channel_for_pair\(uuid, uuid\) FROM anon/
    );
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION public\.mating_teardown_channel_for_pair\(uuid, uuid\) FROM authenticated/
    );
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION public\.mating_clear_paw_between_pets\(uuid, uuid\) FROM anon/
    );
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION public\.mating_clear_paw_between_pets\(uuid, uuid\) FROM authenticated/
    );
    assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.mating_teardown_channel_for_pair/);
    assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.mating_clear_paw_between_pets/);
  });
});

describe('Step 7D migration — block visibility', () => {
  it('enforces pet profile block visibility server-side', () => {
    assert.match(migration, /pet_is_blocked_for_viewer/);
    assert.match(migration, /DROP POLICY IF EXISTS pets_select_visible/);
    assert.match(migration, /NOT public\.pet_is_blocked_for_viewer\(id\)/);
  });

  it('enforces Feed moment block visibility server-side', () => {
    assert.match(migration, /moment_has_blocked_pet_for_viewer/);
    assert.match(migration, /DROP POLICY IF EXISTS moments_select_authenticated/);
  });

  it('hides blocked pets from meetup participant and host lists', () => {
    assert.match(migration, /meetup_participants_select_authenticated/);
    assert.match(migration, /meetup_hosts_select_authenticated/);
    assert.match(migration, /NOT public\.pet_is_blocked_for_viewer\(pet_id\)/);
  });

  it('excludes blocked pets from Chat list RPC', () => {
    assert.match(migration, /list_my_introduction_channels/);
    assert.match(migration, /NOT public\.pet_is_blocked_for_viewer/);
  });
});

describe('Step 7D migration — notifications', () => {
  it('uses companion wording for mutual Paw', () => {
    assert.match(migration, /You found a companion/);
    assert.doesNotMatch(migration, /It'?s a match/i);
    assert.doesNotMatch(migration, /You matched/i);
  });

  it('uses actual message body for chat notifications', () => {
    assert.match(migration, /p_body => NEW\.body/);
    assert.doesNotMatch(migration, /Open the introduction with/);
  });
});

describe('Step 7D profile CTA', () => {
  it('uses pet-centric introduction wording', () => {
    const legal = readSrc('src/content/legalDocuments.js');
    assert.match(legal, /formatMatingIntroProfileCta/);
    assert.match(profile, /formatMatingIntroProfileCta/);
  });
});

describe('Step 7D safety menu', () => {
  it('orders View Profile before Unpaw, Report, and Block in the sheet UI', () => {
    const menu = readSrc('src/components/ContentSafetyMenu.js');
    const sheet = menu.slice(menu.indexOf('return ('));
    const viewIdx = sheet.indexOf('showViewProfile ?');
    const unpawIdx = sheet.indexOf('showUnpaw ?');
    const reportIdx = sheet.indexOf('showReport ?');
    const blockIdx = sheet.indexOf('showBlock ?');
    assert.ok(viewIdx < unpawIdx);
    assert.ok(unpawIdx < reportIdx);
    assert.ok(reportIdx < blockIdx);
  });
});
