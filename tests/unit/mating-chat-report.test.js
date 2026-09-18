import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Chat report termination', () => {
  const migration = readSrc('supabase/migrations/20260915140000_chat_report_termination.sql');
  const privacyMigration = readSrc(
    'supabase/migrations/20260915150000_chat_report_termination_privacy.sql',
  );
  const mating = readSrc('src/services/mating.js');
  const chat = readSrc('src/screens/MatingIntroductionChatScreen.js');
  const list = readSrc('src/screens/MatingChatListScreen.js');
  const reportSheet = readSrc('src/components/ReportSheet.js');
  const legal = readSrc('src/content/legalDocuments.js');
  const discoverCard = readSrc('src/components/DiscoverMomentCard.js');
  const reports = readSrc('src/services/reports.js');

  it('adds report freeze reason and retains channel evidence on terminate', () => {
    assert.match(migration, /freeze_reason IN \('mutual_broken', 'block', 'opt_out', 'admin', 'report'\)/);
    assert.match(migration, /reported_by_user_id/);
    assert.match(migration, /reporter_chat_dismissed_at/);
    assert.match(migration, /reported_party_acknowledged_at/);
    assert.match(migration, /terminate_introduction_chat_after_report/);
    assert.match(migration, /mating_clear_paw_between_pets/);
    assert.match(migration, /status = 'frozen'/);
    assert.match(migration, /freeze_reason = 'report'/);
    assert.doesNotMatch(
      migration,
      /DELETE FROM public\.mating_introduction_messages[\s\S]*terminate_introduction_chat_after_report/,
    );
  });

  it('preserves report-frozen channels while allowing a fresh open channel on re-mutual Paw', () => {
    assert.match(migration, /mating_teardown_open_channel_for_pair/);
    assert.match(migration, /mating_introduction_channels_open_pair_unique/);
    assert.match(migration, /AND status = 'open'/);
  });

  it('blocks reported party from selecting messages and serves sanitized chat views', () => {
    assert.match(migration, /get_introduction_chat_view/);
    assert.match(migration, /'view', 'ended_anonymous'/);
    assert.match(migration, /'view', 'reporter_frozen'/);
    assert.match(migration, /auth\.uid\(\) <> c\.reported_by_user_id/);
    assert.match(mating, /getIntroductionChatView/);
    assert.match(mating, /terminateIntroductionChatAfterReport/);
    assert.match(mating, /dismissReportedIntroductionChat/);
    assert.match(mating, /consumeReportedIntroductionChatDismissal/);
    assert.match(mating, /flushPendingReportChatDismiss/);
    assert.match(mating, /suppressReportChatDismissLocally/);
    assert.match(mating, /excludeLocallySuppressedReportChatChannels/);
  });

  it('denies reported party direct channel SELECT and strips ended_anonymous list identity', () => {
    assert.match(privacyMigration, /mating_introduction_channels_select_participants/);
    assert.match(privacyMigration, /auth\.uid\(\) <> reported_by_user_id/);
    const endedBranch = privacyMigration.slice(
      privacyMigration.indexOf('UNION ALL'),
      privacyMigration.indexOf('ORDER BY 10'),
    );
    assert.match(endedBranch, /NULL::uuid/);
    assert.doesNotMatch(endedBranch, /INNER JOIN public\.pets/);
    assert.doesNotMatch(endedBranch, /pl\.name/);
    assert.doesNotMatch(endedBranch, /ph\.name/);
  });

  it('terminates chat only after a recent introduction_chat report is filed', () => {
    assert.match(migration, /target_type = 'introduction_chat'/);
    assert.match(migration, /report_required/);
    assert.match(chat, /terminateIntroductionChatAfterReport\(channelId, viewerPetId\)/);
    assert.match(chat, /onSubmitted=\{handleReportSubmitted\}/);
  });

  it('shows reporter thank-you copy and read-only post-report context for A', () => {
    assert.match(legal, /MATING_CHAT_REPORT_DONE_LINES/);
    assert.match(chat, /doneBodyLines=\{MATING_CHAT_REPORT_DONE_LINES\}/);
    assert.match(chat, /chatView === 'open' && channel\?\.status === 'open'/);
    assert.match(chat, /reporter_frozen/);
    assert.match(chat, /consumeReportedIntroductionChatDismissal/);
    assert.match(chat, /showIdentityHeader/);
  });

  it('shows anonymous ended rows and detail for reported party B without identity', () => {
    assert.match(migration, /'ended_anonymous'/);
    assert.match(migration, /list_kind text/);
    assert.match(list, /list_kind === 'ended_anonymous'/);
    assert.match(list, /MATING_CHAT_ENDED_TITLE/);
    assert.match(list, /MATING_CHAT_ENDED_SUBTITLE/);
    assert.match(list, /flushPendingReportChatDismiss/);
    assert.match(list, /excludeLocallySuppressedReportChatChannels/);
    assert.match(list, /getLocallySuppressedReportChatDismissChannelId/);
    assert.match(chat, /chatView === 'ended_anonymous'/);
    assert.match(chat, /MATING_CHAT_ENDED_BODY/);
    assert.match(chat, /MATING_CHAT_BACK_TO_CHAT/);
    assert.match(chat, /clearOtherPartyIdentity/);
    assert.match(chat, /viewReady/);
    const renderRowStart = list.indexOf('const renderRow = ({ item }) => {');
    const anonymousRow = list.slice(
      list.indexOf("if (item.list_kind === 'ended_anonymous')", renderRowStart),
      list.indexOf('const resolved = resolveChannelPets', renderRowStart),
    );
    assert.doesNotMatch(anonymousRow, /openConnectedProfile/);
  });

  it('consumes B one-time state across lifecycle exits and fast sanitized polling', () => {
    assert.match(chat, /AppState\.addEventListener/);
    assert.match(list, /AppState\.addEventListener/);
    assert.match(chat, /beforeRemove/);
    assert.match(chat, /INTRODUCTION_CHAT_VIEW_POLL_MS/);
    assert.doesNotMatch(chat, /8000/);
    assert.match(chat, /flushPendingReportChatDismiss/);
    assert.match(chat, /getLocallySuppressedReportChatDismissChannelId/);
    assert.match(mating, /PENDING_REPORT_CHAT_DISMISS_KEY/);
    assert.match(mating, /suppressReportChatDismissLocally/);
    assert.doesNotMatch(chat, /route\?\.params\?\.otherPetName/);
    assert.doesNotMatch(chat, /fetchIntroductionMessages/);
    assert.doesNotMatch(chat, /fetchIntroductionChannelById/);
  });

  it('locally suppresses dismissed reported-chat channels until server dismiss succeeds', () => {
    assert.match(mating, /await suppressReportChatDismissLocally\(channelId\)/);
    assert.match(mating, /removeItem\(PENDING_REPORT_CHAT_DISMISS_KEY\)/);
    assert.match(list, /excludeLocallySuppressedReportChatChannels/);
    assert.match(chat, /payload\?\.view === 'ended_anonymous'/);
    assert.match(chat, /getLocallySuppressedReportChatDismissChannelId/);
  });

  it('keeps optional ReportSheet block separate from chat report termination', () => {
    assert.match(reportSheet, /blockPet/);
    assert.doesNotMatch(migration, /pet_blocks/);
    assert.doesNotMatch(privacyMigration, /pet_blocks/);
    assert.doesNotMatch(chat, /blockPet\(/);
  });

  it('leaves existing Moment, Meetup, Interested, and Profile report targeting unchanged', () => {
    assert.match(reports, /moment: 'moment'/);
    assert.match(reports, /meetup: 'meetup'/);
    assert.match(reports, /mating_interest: 'mating_interest'/);
    assert.match(reports, /introduction_chat: 'introduction_chat'/);
    assert.match(reports, /pet: 'pet'/);
    assert.match(discoverCard, /hasPawInterestReport/);
    assert.match(discoverCard, /'mating_interest'/);
    assert.match(discoverCard, /'pet'/);
    assert.match(discoverCard, /'moment'/);
    assert.match(list, /targetType="mating_interest"/);
    assert.match(chat, /targetType="introduction_chat"/);
  });
});
