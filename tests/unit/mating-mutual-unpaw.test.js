import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Mutual UnPaw migration RPC', () => {
  const migration = readSrc('supabase/migrations/20260915170000_unpaw_mutual_introduction.sql');
  const reportMigration = readSrc('supabase/migrations/20260915140000_chat_report_termination.sql');

  it('requires authenticated owned viewer pet and mutual Paw', () => {
    assert.match(migration, /auth\.uid\(\)/);
    assert.match(migration, /p\.owner_id = v_uid/);
    assert.match(migration, /pets_have_mutual_paw\(p_viewer_pet_id, p_other_pet_id\)/);
    assert.match(migration, /not_mutual_paw/);
    assert.match(migration, /forbidden_pet/);
  });

  it('clears both Paw directions and tears down only the open channel', () => {
    assert.match(migration, /mating_clear_paw_between_pets\(p_viewer_pet_id, p_other_pet_id\)/);
    assert.match(
      migration,
      /mating_teardown_open_channel_for_pair\(p_viewer_pet_id, p_other_pet_id\)/,
    );
    assert.doesNotMatch(migration, /mating_teardown_channel_for_pair/);
    assert.doesNotMatch(migration, /delete_open_introduction_chat/);
    assert.doesNotMatch(migration, /withdraw_paw/);
    assert.doesNotMatch(migration, /status = 'frozen'/);
    assert.doesNotMatch(migration, /notification/i);
  });

  it('grants EXECUTE only to authenticated and keeps helpers internal', () => {
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.unpaw_mutual_introduction/);
    assert.match(migration, /TO authenticated/);
    assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.mating_clear_paw_between_pets/);
    assert.doesNotMatch(
      migration,
      /GRANT EXECUTE ON FUNCTION public\.mating_teardown_open_channel_for_pair/,
    );
  });

  it('preserves fresh open channel recreation on later mutual Paw', () => {
    assert.match(reportMigration, /mating_sync_channel_after_paw_insert/);
    assert.match(reportMigration, /mating_teardown_open_channel_for_pair\(NEW\.from_pet_id, NEW\.to_pet_id\)/);
    assert.match(reportMigration, /INSERT INTO public\.mating_introduction_channels/);
  });
});

describe('Mutual UnPaw client flow', () => {
  const hook = readSrc('src/hooks/useMatingUnpawFlow.js');
  const mating = readSrc('src/services/mating.js');
  const confirm = readSrc('src/components/UnpawConfirmSheet.js');
  const profile = readSrc('src/screens/ViewPetProfileScreen.js');
  const chat = readSrc('src/screens/MatingIntroductionChatScreen.js');

  it('branches mutual relationships to unpawMutualIntroduction and one-way to withdrawPaw', () => {
    assert.match(mating, /export async function unpawMutualIntroduction/);
    assert.match(mating, /unpaw_mutual_introduction/);
    assert.match(hook, /queryMutualPaw\(viewerPetId, otherPetId\)/);
    const confirmBody = hook.slice(
      hook.indexOf('const confirmUnpaw = useCallback'),
      hook.indexOf('const dismissReportPrompt'),
    );
    assert.match(confirmBody, /if \(mutualCheck\.mutual\) \{/);
    assert.match(confirmBody, /await unpawMutualIntroduction\(viewerPetId, otherPetId\)/);
    assert.match(confirmBody, /await withdrawPaw\(viewerPetId, otherPetId\)/);
    assert.doesNotMatch(confirmBody, /deleteOpenIntroductionChat/);
  });

  it('keeps requestUnpaw confirmation and existing UnpawConfirmSheet copy', () => {
    assert.match(hook, /requestUnpaw = useCallback\(\(\) => \{\s*setConfirmVisible\(true\)/);
    assert.match(profile, /UnpawConfirmSheet/);
    assert.match(chat, /UnpawConfirmSheet/);
    assert.match(confirm, /MATING_UNPAW_CONFIRM_TITLE/);
    assert.match(confirm, /MATING_UNPAW_CONFIRM_BODY/);
    assert.match(confirm, /MATING_UNPAW_CONFIRM_ACTION/);
    assert.match(confirm, /PawpleConfirmModal/);
    assert.doesNotMatch(hook, /Alert\.alert/);
  });

  it('captures outbound report context before bilateral reset', () => {
    const confirmBody = hook.slice(
      hook.indexOf('const confirmUnpaw = useCallback'),
      hook.indexOf('const dismissReportPrompt'),
    );
    const outboundIdx = confirmBody.indexOf('fetchOutboundPaw(viewerPetId, otherPetId)');
    const mutualIdx = confirmBody.indexOf('queryMutualPaw(viewerPetId, otherPetId)');
    const bilateralIdx = confirmBody.indexOf('unpawMutualIntroduction(viewerPetId, otherPetId)');
    assert.ok(outboundIdx < mutualIdx);
    assert.ok(mutualIdx < bilateralIdx);
  });

  it('keeps Connected-list UnPaw on requestUnpaw rather than direct RPC calls', () => {
    const list = readSrc('src/screens/MatingChatListScreen.js');
    const renderRow = list.slice(list.indexOf('const renderRow'));
    assert.match(renderRow, /unpawFlow\.requestUnpaw\(\)/);
    assert.doesNotMatch(renderRow, /withdrawPaw/);
    assert.doesNotMatch(renderRow, /unpawMutualIntroduction/);
  });
});

describe('One-way UnPaw preservation', () => {
  const hook = readSrc('src/hooks/useMatingUnpawFlow.js');
  const migration = readSrc('supabase/migrations/20260915170000_unpaw_mutual_introduction.sql');

  it('keeps withdraw_paw as the non-mutual path', () => {
    const confirmBody = hook.slice(
      hook.indexOf('const confirmUnpaw = useCallback'),
      hook.indexOf('const dismissReportPrompt'),
    );
    assert.match(confirmBody, /} else \{\s*await withdrawPaw\(viewerPetId, otherPetId\)/);
    assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.withdraw_paw/);
  });
});
