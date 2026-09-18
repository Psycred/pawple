import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Chat hub stage 4 profile cleanup', () => {
  const section = readSrc('src/components/MatingSection.js');
  const chat = readSrc('src/screens/MatingChatListScreen.js');
  const matingService = readSrc('src/services/mating.js');

  it('removes the old Interest in Pet section from MatingSection', () => {
    assert.doesNotMatch(section, /Interest in \$\{displayName\}/);
    assert.doesNotMatch(section, /fetchInboundInterest/);
    assert.doesNotMatch(section, /MatingExploreRow/);
    assert.doesNotMatch(section, /loadInterest/);
    assert.doesNotMatch(section, /openInterestSafety/);
    assert.doesNotMatch(section, /ReportSheet/);
    assert.doesNotMatch(section, /BlockConfirmSheet/);
    assert.doesNotMatch(section, /ContentSafetyMenu/);
  });

  it('keeps Open to Mating and PetTraits on the profile About section', () => {
    assert.match(section, /sectionTitle[\s\S]*Mating/);
    assert.match(section, /Open to Mating/);
    assert.match(section, /PetTraitsSection/);
    assert.match(section, /MatingSetupModal/);
  });

  it('retains fetchInboundInterest in mating service for Chat Interested', () => {
    assert.match(matingService, /export async function fetchInboundInterest/);
    assert.match(chat, /fetchInboundInterest\(viewerPetId\)/);
  });
});
