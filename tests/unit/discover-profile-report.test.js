import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Discover profile-card reporting', () => {
  const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
  const card = readSrc('src/components/DiscoverMomentCard.js');
  const reports = readSrc('src/services/reports.js');
  const reportSheet = readSrc('src/components/ReportSheet.js');
  const migration = readSrc('supabase/migrations/20260915130000_reports_pet_target_type.sql');
  const chat = readSrc('src/screens/MatingChatListScreen.js');

  const reportBlock = card.slice(
    card.indexOf('const hasPawInterestReport'),
    card.indexOf('const openMenu'),
  );

  it('allows pet as a report target type in client and database', () => {
    assert.match(reports, /pet: 'pet'/);
    assert.match(migration, /'pet'/);
    assert.match(migration, /reports_target_type_check/);
    assert.match(reportSheet, /targetType === 'pet'/);
    assert.match(reportSheet, /Report pet/);
  });

  it('uses pet + candidate pet ID for profile cards without a Paw row', () => {
    assert.match(reportBlock, /hasPawInterestReport\s*\?\s*'mating_interest'/);
    assert.match(reportBlock, /: isMoment\s*\n\s*\? 'moment'\s*\n\s*: 'pet'/);
    assert.match(reportBlock, /: resolvedPetId/);
  });

  it('uses mating_interest + pawInterestId when a directional Paw exists', () => {
    assert.match(reportBlock, /hasPawInterestReport\s*\?\s*pawInterestId/);
    assert.match(discovery, /fetchDiscoverPawState/);
    assert.match(discovery, /interestByCandidate: state\.interestByCandidate/);
    const mating = readSrc('src/services/mating.js');
    assert.match(mating, /interestByCandidate\[candidateKey\] = row\.id/);
  });

  it('passes pawInterestId only to Discover profile cards', () => {
    assert.match(discovery, /pawInterestId=\{hasMoment \? null : pawState\.interestByCandidate\[candidateId\]/);
  });

  it('keeps featured Moment reporting unchanged on Discover', () => {
    assert.match(reportBlock, /isMoment\s*\?\s*'moment'/);
    assert.match(reportBlock, /isMoment\s*\?\s*momentId/);
    assert.match(reportBlock, /momentOwnerId/);
    assert.match(discovery, /onProfileReportSubmitted=\{\s*hasMoment \? undefined/);
  });

  it('keeps report available on every Discover card', () => {
    assert.match(card, /showReport/);
    assert.doesNotMatch(card, /showReport=\{/);
  });

  it('removes only the reported profile card after a successful report', () => {
    assert.match(discovery, /dismissReportedProfileCard/);
    assert.match(discovery, /setOpportunities\(\(prev\)/);
    assert.match(card, /onProfileReportSubmitted/);
    assert.match(card, /!isMoment && result\?\.demo === false/);
    assert.match(card, /onSubmitted=\{\(result\)/);
  });

  it('does not remove the card on cancel or failed report', () => {
    assert.match(card, /result\?\.demo === false/);
    assert.doesNotMatch(discovery, /dismissIncomingPaw/);
    assert.doesNotMatch(discovery, /blockPet/);
    assert.doesNotMatch(discovery, /pet_blocks/);
  });

  it('reloads Discover from fetchMatingOpportunities so reported pets can return', () => {
    assert.match(discovery, /fetchMatingOpportunities\(petId\)/);
    assert.match(discovery, /useFocusEffect/);
    assert.doesNotMatch(discovery, /suppression/);
    assert.doesNotMatch(discovery, /reject/);
    assert.doesNotMatch(discovery, /hideList/);
  });

  it('preserves Interested mating_interest reporting with inbound paw ID', () => {
    assert.match(chat, /pawInterestId=\{item\.id\}/);
    assert.doesNotMatch(chat, /onProfileReportSubmitted/);
  });

  it('preserves Paw and Block wiring on Discover cards', () => {
    assert.match(discovery, /onPawPress=\{\(\) => handleRowPaw\(item\)\}/);
    assert.match(discovery, /onPetBlocked=\{\(\) => load\(\)\}/);
    assert.match(discovery, /expressPaw/);
    assert.match(discovery, /useMatingUnpawFlow/);
  });
});
