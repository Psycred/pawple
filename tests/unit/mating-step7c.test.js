import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  MATING_BREED_PREFERENCES,
  MATING_PHASE1A_RADIUS_KM,
  areOppositeMatingGenders,
  areSamePetTypes,
  breedPreferenceAllows,
  isValidMatingGender,
  normalizeMatingGender,
} from '../../src/lib/matingEligibility.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

describe('Step 7C eligibility helpers', () => {
  it('requires same pet type', () => {
    assert.equal(areSamePetTypes('dog', 'dog'), true);
    assert.equal(areSamePetTypes('cat', 'cat'), true);
    assert.equal(areSamePetTypes('dog', 'cat'), false);
    assert.equal(areSamePetTypes('', 'dog'), false);
  });

  it('allows only opposite Male/Female pairings', () => {
    assert.equal(areOppositeMatingGenders('Male', 'Female'), true);
    assert.equal(areOppositeMatingGenders('female', 'male'), true);
    assert.equal(areOppositeMatingGenders('Male', 'Male'), false);
    assert.equal(areOppositeMatingGenders('Female', 'Female'), false);
    assert.equal(areOppositeMatingGenders('Other', 'Female'), false);
  });

  it('normalizes gender to Male/Female only', () => {
    assert.equal(normalizeMatingGender('male'), 'Male');
    assert.equal(normalizeMatingGender('Female'), 'Female');
    assert.equal(normalizeMatingGender('Other'), '');
    assert.equal(isValidMatingGender('Male'), true);
    assert.equal(isValidMatingGender('Other'), false);
  });

  it('applies breed preference without hidden ranking', () => {
    assert.equal(
      breedPreferenceAllows(MATING_BREED_PREFERENCES.ALL_BREEDS, 'Beagle', 'Labrador'),
      true,
    );
    assert.equal(
      breedPreferenceAllows(MATING_BREED_PREFERENCES.SAME_BREED, 'Beagle', 'Beagle'),
      true,
    );
    assert.equal(
      breedPreferenceAllows(MATING_BREED_PREFERENCES.SAME_BREED, 'Beagle', 'Labrador'),
      false,
    );
    assert.equal(
      breedPreferenceAllows(MATING_BREED_PREFERENCES.SAME_BREED, '', 'Beagle'),
      false,
    );
    assert.equal(
      breedPreferenceAllows(null, 'Beagle', 'Labrador'),
      false,
    );
  });

  it('keeps Phase 1A radius at 100 km', () => {
    assert.equal(MATING_PHASE1A_RADIUS_KM, 100);
  });
});

describe('Step 7C migration SQL', () => {
  const migration = readSrc(
    'supabase/migrations/20260909150000_mating_step7c_eligibility_preference.sql',
  );

  it('adds mating_breed_preference and pet type gate', () => {
    assert.match(migration, /mating_breed_preference/);
    assert.match(migration, /pets_same_pet_type/);
    assert.match(migration, /deny_reason := 'pet_type'/);
  });

  it('uses breed preference instead of unconditional same-breed gate', () => {
    assert.match(migration, /v_breed_pref := coalesce\(v_from\.mating_breed_preference, 'same_breed'\)/);
    assert.match(migration, /IF v_breed_pref = 'same_breed'/);
  });

  it('orders discovery by distance and excludes only active mutual paws', () => {
    assert.match(migration, /v_radius constant integer := 100/);
    assert.match(migration, /ORDER BY el\.distance_km ASC/);
    assert.match(migration, /pi_ab\.from_pet_id = v_viewer\.id AND pi_ab\.to_pet_id = c\.id/);
    assert.match(migration, /pi_ba\.from_pet_id = c\.id AND pi_ba\.to_pet_id = v_viewer\.id/);
  });

  it('deploys discovery context RPC for production parity', () => {
    assert.match(migration, /get_mating_discovery_context/);
  });
});

describe('Step 7C Mating setup modal flow', () => {
  it('uses one compact setup modal with gender + breed preference', () => {
    const section = readSrc('src/components/MatingSection.js');
    const editPet = readSrc('src/screens/EditPetScreen.js');
    const modal = readSrc('src/components/MatingSetupModal.js');

    assert.match(section, /MatingSetupModal/);
    assert.match(editPet, /MatingSetupModal/);
    assert.doesNotMatch(section, /GenderRequiredModal/);
    assert.match(modal, /Who would you like to meet\?/);
    assert.match(modal, /MATING_BREED_PREFERENCE_OPTIONS/);
    assert.match(
      section,
      /await updatePetGender\(petId, gender\)[\s\S]*?await updatePetMatingBreedPreference/,
    );
  });

  it('keeps gender optional in onboarding with only Male and Female', () => {
    const onboarding = readSrc('src/screens/OnboardingPetsScreen.js');
    assert.match(onboarding, /const GENDER_OPTIONS = \['Male', 'Female'\]/);
    assert.doesNotMatch(onboarding, /'Other'/);
  });
});

describe('Step 7C unpaw UX', () => {
  it('exposes unpaw from profile and chat safety menu', () => {
    const profile = readSrc('src/screens/ViewPetProfileScreen.js');
    const chat = readSrc('src/screens/MatingIntroductionChatScreen.js');
    const hook = readSrc('src/hooks/useMatingUnpawFlow.js');

    assert.match(profile, /useMatingUnpawFlow/);
    assert.match(profile, /UnpawConfirmSheet/);
    assert.match(profile, /UnpawReportPrompt/);
    assert.match(chat, /showUnpaw/);
    assert.match(chat, /unpawFlow\.requestUnpaw/);
    assert.match(hook, /withdrawPaw/);
  });

  it('adds inline Paw on discovery rows', () => {
    const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
    const card = readSrc('src/components/DiscoverMomentCard.js');
    assert.match(discovery, /onPawPress/);
    assert.match(discovery, /expressPaw/);
    assert.match(card, /DiscoverPawAction/);
    assert.doesNotMatch(discovery, /MatingExploreRow/);
  });
});

describe('Step 7C tab and empty states', () => {
  it('keeps Mating tab gated on opt-in only, not match count', () => {
    const tabs = readSrc('src/navigation/BottomTabNavigator.js');
    assert.match(tabs, /activePet\?\.is_looking_for_companion/);
    assert.doesNotMatch(tabs, /opportunities\.length/);
  });

  it('uses Step 7C empty-state copy and location update action', () => {
    const docs = readSrc('src/content/legalDocuments.js');
    const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');
    assert.match(docs, /No matches just yet/);
    assert.match(docs, /We need your location/);
    assert.match(discovery, /MATING_DISCOVER_UPDATE_LOCATION_ACTION/);
    assert.match(discovery, /saveLatestProfileLocation/);
    assert.doesNotMatch(discovery, /profiles\.city/);
  });
});

describe('Step 7C regression guards', () => {
  it('does not change Moment irreversible-heart behaviour', () => {
    const momentCard = readSrc('src/components/MomentCard.js');
    const actionBar = readSrc('src/components/ActionBar.js');
    assert.doesNotMatch(momentCard, /withdrawPaw|unpaw/i);
    assert.doesNotMatch(actionBar, /withdrawPaw|unpaw/i);
  });

  it('keeps Step 7C mating logic isolated from onboarding breed validation', () => {
    const mating = readSrc('src/services/mating.js');
    const migration = readSrc('supabase/migrations/20260909150000_mating_step7c_eligibility_preference.sql');
    assert.doesNotMatch(mating, /requireBreed|petOnboardingValidation/);
    assert.match(migration, /mating_eligible_pair/);
    assert.match(migration, /get_mating_opportunities/);
  });
});
