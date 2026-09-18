import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Delete Chat migration RPC', () => {
  const migration = readSrc('supabase/migrations/20260915160000_delete_open_introduction_chat.sql');
  const reportMigration = readSrc('supabase/migrations/20260915140000_chat_report_termination.sql');

  it('requires authenticated channel participant with owned viewer pet', () => {
    assert.match(migration, /auth\.uid\(\)/);
    assert.match(migration, /v_uid NOT IN \(c\.owner_low_id, c\.owner_high_id\)/);
    assert.match(migration, /p_viewer_pet_id NOT IN \(c\.pet_low_id, c\.pet_high_id\)/);
    assert.match(migration, /p\.owner_id = v_uid/);
    assert.match(migration, /forbidden_channel/);
    assert.match(migration, /forbidden_pet/);
  });

  it('rejects non-open channels', () => {
    assert.match(migration, /c\.status <> 'open'/);
    assert.match(migration, /channel_not_open/);
  });

  it('clears both Paw directions and tears down only the open channel', () => {
    assert.match(migration, /mating_clear_paw_between_pets\(c\.pet_low_id, c\.pet_high_id\)/);
    assert.match(migration, /mating_teardown_open_channel_for_pair\(c\.pet_low_id, c\.pet_high_id\)/);
    assert.doesNotMatch(migration, /mating_teardown_channel_for_pair/);
    assert.doesNotMatch(migration, /withdraw_paw/);
    assert.doesNotMatch(migration, /pet_blocks/);
    assert.doesNotMatch(migration, /terminate_introduction_chat_after_report/);
    assert.doesNotMatch(migration, /status = 'frozen'/);
  });

  it('grants EXECUTE only to authenticated and keeps helpers internal', () => {
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.delete_open_introduction_chat/);
    assert.match(migration, /TO authenticated/);
    assert.match(migration, /REVOKE ALL ON FUNCTION public\.delete_open_introduction_chat/);
    assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.mating_clear_paw_between_pets/);
    assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.mating_teardown_open_channel_for_pair/);
  });

  it('reuses existing mutual-Paw fresh channel recreation on rematch', () => {
    assert.match(reportMigration, /mating_sync_channel_after_paw_insert/);
    assert.match(reportMigration, /mating_teardown_open_channel_for_pair\(NEW\.from_pet_id, NEW\.to_pet_id\)/);
    assert.match(reportMigration, /INSERT INTO public\.mating_introduction_channels/);
  });
});

describe('Delete Chat client wiring', () => {
  const chat = readSrc('src/screens/MatingIntroductionChatScreen.js');
  const mating = readSrc('src/services/mating.js');
  const sheet = readSrc('src/components/DeleteChatConfirmSheet.js');
  const legal = readSrc('src/content/legalDocuments.js');
  const menu = readSrc('src/components/ContentSafetyMenu.js');

  it('shows Delete chat only for open introduction chat', () => {
    assert.match(chat, /canDeleteChat/);
    assert.match(chat, /chatView === 'open' && channel\?\.status === 'open'/);
    assert.match(chat, /showDelete=\{canDeleteChat\}/);
    assert.match(chat, /deleteLabel="Delete chat"/);
  });

  it('hides Delete chat for reporter_frozen and ended_anonymous states', () => {
    assert.doesNotMatch(
      chat,
      /showDelete=\{[^}]*reporter_frozen/,
    );
    assert.doesNotMatch(
      chat,
      /showDelete=\{[^}]*ended_anonymous/,
    );
    assert.match(chat, /chatView === 'ended_anonymous'/);
    assert.match(chat, /reporter_frozen/);
  });

  it('uses DeleteChatConfirmSheet with destructive confirmation copy', () => {
    assert.match(chat, /DeleteChatConfirmSheet/);
    assert.match(sheet, /MATING_DELETE_CHAT_CONFIRM_TITLE/);
    assert.match(sheet, /formatMatingDeleteChatConfirmBody/);
    assert.match(sheet, /confirmTone="danger"/);
    assert.match(legal, /Delete chat\?/);
    assert.match(legal, /You'll both need to Paw again to chat/);
    assert.match(legal, /MATING_DELETE_CHAT_CONFIRM_ACTION = 'Delete chat'/);
    assert.match(legal, /MATING_DELETE_CHAT_CONFIRM_CANCEL = 'Cancel'/);
  });

  it('calls the dedicated RPC and exits Chat on success', () => {
    assert.match(mating, /deleteOpenIntroductionChat/);
    assert.match(mating, /delete_open_introduction_chat/);
    assert.match(sheet, /deleteOpenIntroductionChat\(channelId, viewerPetId\)/);
    const deletedHandler = chat.slice(
      chat.indexOf('<DeleteChatConfirmSheet'),
      chat.indexOf('<UnpawConfirmSheet'),
    );
    assert.match(deletedHandler, /onDeleted=\{\(\) => \{/);
    assert.match(deletedHandler, /exitChat\(\)/);
  });

  it('keeps cancel as a close-only path without deleting', () => {
    assert.match(sheet, /onClose=\{handleClose\}/);
    const handleCloseBody = sheet.slice(
      sheet.indexOf('const handleClose = useCallback'),
      sheet.indexOf('const handleConfirm = useCallback'),
    );
    assert.doesNotMatch(handleCloseBody, /deleteOpenIntroductionChat/);
    const closeHandler = chat.slice(
      chat.indexOf('<DeleteChatConfirmSheet'),
      chat.indexOf('<UnpawConfirmSheet'),
    );
    assert.match(closeHandler, /onClose=\{\(\) => setDeleteChatOpen\(false\)\}/);
    const onCloseProp = closeHandler.match(/onClose=\{[^}]+\}/)?.[0] ?? '';
    assert.doesNotMatch(onCloseProp, /exitChat/);
  });

  it('shows a concise error and stays in-thread on RPC failure', () => {
    assert.match(sheet, /Couldn't delete this chat\./);
    const confirmBody = sheet.slice(
      sheet.indexOf('const handleConfirm = useCallback'),
      sheet.indexOf('return ('),
    );
    const catchBody = confirmBody.slice(
      confirmBody.indexOf('} catch (e)'),
      confirmBody.indexOf('} finally'),
    );
    assert.match(catchBody, /Couldn't delete this chat\./);
    assert.doesNotMatch(catchBody, /onDeleted\?\.\(\)/);
  });

  it('does not send notifications from delete flow', () => {
    assert.doesNotMatch(migrationSrc(), /notification/i);
    assert.doesNotMatch(sheet, /notification/i);
    const deleteRpc = mating.slice(
      mating.indexOf('export async function deleteOpenIntroductionChat'),
      mating.indexOf('export async function terminateIntroductionChatAfterReport'),
    );
    assert.doesNotMatch(deleteRpc, /notification/i);
  });

  it('preserves existing Unpaw, Report, Block, and View Profile actions', () => {
    assert.match(chat, /showUnpaw=\{canDeleteChat\}/);
    assert.match(chat, /showReport/);
    assert.match(chat, /showBlock=\{Boolean\(otherPetId\)\}/);
    assert.match(chat, /showViewProfile/);
    assert.match(chat, /unpawFlow\.requestUnpaw/);
    assert.match(chat, /setReportOpen\(true\)/);
    assert.match(chat, /setBlockOpen\(true\)/);
    assert.match(chat, /BlockConfirmSheet/);
    assert.match(chat, /UnpawConfirmSheet/);
    assert.match(chat, /terminateIntroductionChatAfterReport/);
    const deleteRpc = mating.slice(
      mating.indexOf('export async function deleteOpenIntroductionChat'),
      mating.indexOf('export async function terminateIntroductionChatAfterReport'),
    );
    assert.doesNotMatch(deleteRpc, /withdraw_paw/);
  });

  it('does not change shared ContentSafetyMenu behavior', () => {
    assert.match(menu, /showDelete = false/);
    assert.match(menu, /showUnpaw = false/);
    assert.match(menu, /showViewProfile \?/);
    assert.match(menu, /showUnpaw \?/);
    assert.match(menu, /showReport \?/);
    assert.match(menu, /showBlock \?/);
  });
});

function migrationSrc() {
  return readSrc('supabase/migrations/20260915160000_delete_open_introduction_chat.sql');
}
