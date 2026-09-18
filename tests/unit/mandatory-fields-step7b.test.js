import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

describe('Step 7B Required field treatment', () => {
  it('uses one quiet, token-based Required badge without warning styling', () => {
    const badge = readSrc('src/components/RequiredBadge.js');

    assert.match(badge, />\s*Required\s*</);
    assert.match(badge, /theme\.colors\.brand\.sageLight\.light/);
    assert.match(badge, /theme\.colors\.brand\.sageDark\.light/);
    assert.doesNotMatch(badge, /feedback\.error|danger|>\s*\*\s*</);
  });

  it('marks manually entered account fields and preserves natural DOB/legal UX', () => {
    const onboarding = readSrc('src/screens/OnboardingUserScreen.js');
    const profile = readSrc('src/screens/EditProfileScreen.js');
    const invite = readSrc('src/screens/InviteCodeScreen.js');

    assert.match(onboarding, /<Text style=\{styles\.label\}>Name<\/Text>\s*<RequiredBadge/);
    assert.match(onboarding, /<Text style=\{styles\.label\}>City<\/Text>\s*<RequiredBadge/);
    assert.doesNotMatch(onboarding, /Birthday\.<\/Text>\s*<RequiredBadge/);
    assert.match(profile, /nextErrors\.city = 'Please enter your city\.'/);
    assert.match(profile, /city:\s*city\.trim\(\),/);
    assert.match(invite, /Invite code[\s\S]*?<RequiredBadge/);
    assert.match(invite, /showInviteErrorModal\('Enter your invite code'\)/);
  });

  it('validates pet name, type, Other, and onboarding breed while keeping manage/edit breed optional', () => {
    const onboardingPets = readSrc('src/screens/OnboardingPetsScreen.js');
    const onboardingValidation = readSrc('src/lib/petOnboardingValidation.js');
    const editPet = readSrc('src/screens/EditPetScreen.js');

    assert.match(onboardingValidation, /errors\.name = 'Please enter a pet name\.'/);
    assert.match(onboardingValidation, /errors\.pet_type = 'Please choose a pet type\.'/);
    assert.match(onboardingValidation, /pet\.pet_type === 'other' && !pet\.pet_type_custom\?\.trim\(\)/);
    assert.match(onboardingValidation, /errors\.breed = 'Please enter a breed\.'/);
    assert.match(onboardingPets, /requireBreed: !isManageCrudMode/);
    assert.match(onboardingPets, /disabled=\{loading\}/);
    assert.doesNotMatch(onboardingPets, /disabled=\{loading \|\| \(!isManageCrudMode/);
    assert.match(editPet, /petType === 'other' && !petTypeCustom\.trim\(\)/);
    assert.doesNotMatch(editPet, /!petTypeCustom\.trim\(\) && !breed\.trim\(\)/);
    assert.match(editPet, /gender:\s*gender \|\| null/);
  });
});

describe('Step 7B Moment and Meetup policy', () => {
  it('allows a photo, pet, and date Moment without caption or location', () => {
    const moment = readSrc('src/screens/CreateMomentScreen.js');
    const service = readSrc('src/services/moments.js');

    assert.match(moment, /if \(!imageUri\)/);
    assert.match(moment, /if \(selectedPetIds\.length === 0\)/);
    assert.doesNotMatch(moment, /if \(!trimmedCaption\)/);
    assert.doesNotMatch(moment, /if \(!trimmedLocation\)/);
    assert.match(service, /caption:\s*caption\?\.trim\(\) \|\| null/);
    assert.match(service, /location:\s*location\?\.trim\(\) \|\| null/);
  });

  it('marks only user-entered Meetup requirements and validates participation', () => {
    const meetup = readSrc('src/screens/CreateMeetupScreen.js');
    const requiredLabels = [
      ...meetup.matchAll(
        /<FieldLabel required[^>]*>\s*([^<]+?)\s*<\/FieldLabel>/g,
      ),
    ].map((match) => match[1].trim());

    assert.deepEqual(requiredLabels, [
      'Meetup name',
      'City',
      'Where?',
      'Maximum participants',
    ]);
    assert.match(meetup, /fieldErrors\.participation = message/);
    assert.match(meetup, /!Number\.isInteger\(parsedLimit\) \|\| parsedLimit <= 0/);
    assert.match(meetup, /cityEditedRef\.current/);
    assert.match(meetup, /description:\s*description\.trim\(\) \|\| null/);
  });
});

describe('Step 7B Open to Mating prerequisite', () => {
  it('saves gender before attempting to enable discovery', () => {
    const section = readSrc('src/components/MatingSection.js');
    const editPet = readSrc('src/screens/EditPetScreen.js');
    const service = readSrc('src/services/pets.js');

    assert.match(section, /MatingSetupModal/);
    assert.match(
      section,
      /await updatePetGender\(petId, gender\)[\s\S]*?await updatePetMatingBreedPreference/,
    );
    assert.match(
      editPet,
      /await updatePetGender\(petId, nextGender\)[\s\S]*?await updatePetMatingBreedPreference/,
    );
    assert.match(service, /export async function updatePetGender/);
    assert.match(service, /\.eq\('owner_id', user\.id\)/);
  });

  it('keeps existing action-level chat and report validation', () => {
    const chat = readSrc('src/screens/MatingIntroductionChatScreen.js');
    const report = readSrc('src/components/ReportSheet.js');

    assert.match(chat, /Boolean\(draft\.trim\(\)\)/);
    assert.match(chat, /disabled=\{!canSend\}/);
    assert.match(report, /if \(busy \|\| !reasonId\)/);
    assert.match(report, /placeholder="Optional note"/);
  });
});
