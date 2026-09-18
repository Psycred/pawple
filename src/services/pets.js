/**
 * Pet profile API — includes meetup community counts from junction tables.
 */

import { supabase } from '../config/supabase';
import { getDemoMeetupsForFeed } from '../data/demoFeed';
import {
  applyDemoMeetupRsvp,
  getDemoParticipatedMeetupCountForPet,
} from '../data/demoMeetupRsvp';

const PET_PROFILE_SELECT =
  'id, owner_id, name, pet_type, pet_type_custom, breed, age, gender, vaccinated, bio, photo_url, is_looking_for_companion, mating_breed_preference, mating_description, traits';

const PET_DISCOVERY_SELECT =
  'id, owner_id, name, pet_type, breed, age, gender, photo_url, is_looking_for_companion, mating_description';

function isPetOwner(pet, viewerUserId) {
  return Boolean(
    pet?.owner_id && viewerUserId && String(pet.owner_id) === String(viewerUserId),
  );
}

/**
 * Count meetups where this pet is in meetup_hosts / meetup_participants.
 * @param {string} petId
 * @returns {Promise<{ hosted_count: number, participated_count: number }>}
 */
export async function fetchPetMeetupCounts(petId) {
  if (!petId) {
    return { hosted_count: 0, participated_count: 0 };
  }

  const [hostedTable, participatedTable] = await Promise.all([
    supabase
      .from('meetup_hosts')
      .select('id, meetups!inner(status)', { count: 'exact', head: true })
      .eq('pet_id', petId)
      .neq('meetups.status', 'cancelled'),
    supabase
      .from('meetup_participants')
      .select('id, meetups!inner(status)', { count: 'exact', head: true })
      .eq('pet_id', petId)
      .neq('meetups.status', 'cancelled'),
  ]);

  if (hostedTable.error) {
    console.error('[Supabase]', hostedTable.error);
    throw hostedTable.error;
  }
  if (participatedTable.error) {
    console.error('[Supabase]', participatedTable.error);
    throw participatedTable.error;
  }

  const petKey = String(petId);
  const demoHostedCount = getDemoMeetupsForFeed()
    .map((meetup) => applyDemoMeetupRsvp(meetup))
    .filter((meetup) => meetup?.status !== 'cancelled')
    .filter((meetup) =>
      (meetup.meetup_hosts ?? []).some(
        (row) => String(row?.pet_id ?? '') === petKey,
      ),
    ).length;
  const demoParticipatedCount =
    getDemoParticipatedMeetupCountForPet(petKey);

  return {
    hosted_count: (hostedTable.count ?? 0) + demoHostedCount,
    participated_count:
      (participatedTable.count ?? 0) + demoParticipatedCount,
  };
}

/**
 * Load a pet profile with calculated meetup counts.
 * Companion opt-in is display/Discover-filter only — it must not hide profiles.
 *
 * @param {string} petId
 * @param {string|null} [viewerUserId]
 * @returns {Promise<{
 *   pet: object|null,
 *   ownerCity: string|null,
 *   hosted_count: number,
 *   participated_count: number,
 *   isOwner: boolean,
 *   isDiscoverable: boolean,
 * }|null>}
 */
export async function fetchPetProfile(petId, viewerUserId = null) {
  if (!petId) {
    return null;
  }

  let resolvedViewerId = viewerUserId;
  if (!resolvedViewerId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    resolvedViewerId = user?.id ?? null;
  }

  const { data: pet, error } = await supabase
    .from('pets')
    .select(PET_PROFILE_SELECT)
    .eq('id', petId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  if (!pet) {
    return null;
  }

  const owner = isPetOwner(pet, resolvedViewerId);
  const discoverable = Boolean(pet.is_looking_for_companion);

  let ownerCity = null;
  if (pet.owner_id) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('city')
      .eq('id', pet.owner_id)
      .maybeSingle();
    ownerCity = ownerProfile?.city ?? null;
  }

  const { hosted_count, participated_count } = await fetchPetMeetupCounts(petId);

  return {
    pet,
    ownerCity,
    hosted_count,
    participated_count,
    isOwner: owner,
    isDiscoverable: discoverable,
  };
}

/**
 * Toggle companion Discover listing for a pet (not feed/profile visibility).
 * Owner-only — enforced by RLS on pets update.
 */
export async function updatePetCompanionDiscovery(petId, isLookingForCompanion) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }
  if (!petId) {
    throw new Error('Pet is required.');
  }

  const { data, error } = await supabase
    .from('pets')
    .update({ is_looking_for_companion: Boolean(isLookingForCompanion) })
    .eq('id', petId)
    .eq('owner_id', user.id)
    .select(PET_PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  if (!data) {
    throw new Error('Could not update this pet.');
  }

  return data;
}

/**
 * Persist the prerequisite gender before a separate mating opt-in update.
 * Keeping these writes sequential prevents a failed gender save from enabling discovery.
 */
export async function updatePetGender(petId, gender) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }
  if (!petId) {
    throw new Error('Pet is required.');
  }

  const normalizedGender = String(gender ?? '').trim();
  if (!normalizedGender) {
    throw new Error('Gender is required.');
  }

  const { data, error } = await supabase
    .from('pets')
    .update({ gender: normalizedGender })
    .eq('id', petId)
    .eq('owner_id', user.id)
    .select(PET_PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  if (!data) {
    throw new Error('Could not update this pet.');
  }

  return data;
}

/**
 * Persist personality traits for a pet profile.
 */
export async function updatePetTraits(petId, traits) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }
  if (!petId) {
    throw new Error('Pet is required.');
  }

  const normalizedTraits = Array.isArray(traits)
    ? traits
        .filter((trait) => typeof trait === 'string' && trait.trim())
        .map((trait) => trait.trim())
        .slice(0, 5)
    : [];

  const { data, error } = await supabase
    .from('pets')
    .update({ traits: normalizedTraits })
    .eq('id', petId)
    .eq('owner_id', user.id)
    .select(PET_PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  if (!data) {
    throw new Error('Could not update this pet.');
  }

  return data;
}

/**
 * Persist the Step 7C breed scope preference (same_breed | all_breeds).
 */
export async function updatePetMatingBreedPreference(petId, breedPreference) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }
  if (!petId) {
    throw new Error('Pet is required.');
  }
  if (breedPreference !== 'same_breed' && breedPreference !== 'all_breeds') {
    throw new Error('Choose a valid breed preference.');
  }

  const { data, error } = await supabase
    .from('pets')
    .update({ mating_breed_preference: breedPreference })
    .eq('id', petId)
    .eq('owner_id', user.id)
    .select(PET_PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  if (!data) {
    throw new Error('Could not update this pet.');
  }

  return data;
}

/**
 * Pets visible in public Discover surfaces (companion discovery ON).
 * Excludes the viewer's own pets by default.
 */
export async function fetchDiscoverablePets(options = {}) {
  const { viewerUserId = null, limit = 50 } = options;

  let query = supabase
    .from('pets')
    .select(PET_DISCOVERY_SELECT)
    .eq('is_looking_for_companion', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (viewerUserId) {
    query = query.neq('owner_id', viewerUserId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return data ?? [];
}

/**
 * Batch lookup of pet companion metadata (Discover filter / badge display).
 * Companion does not gate feed or profile visibility.
 * @param {string[]} petIds
 * @param {string|null} viewerUserId
 * @returns {Promise<Map<string, { owner_id: string, is_looking_for_companion: boolean }>>}
 */
export async function fetchPetDiscoveryMap(petIds, viewerUserId = null) {
  const uniqueIds = [...new Set((petIds ?? []).map(String).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('pets')
    .select('id, owner_id, is_looking_for_companion')
    .in('id', uniqueIds);

  if (error) {
    console.error('[Supabase]', error);
    return new Map();
  }

  const map = new Map();
  for (const row of data ?? []) {
    map.set(String(row.id), {
      owner_id: row.owner_id,
      is_looking_for_companion: Boolean(row.is_looking_for_companion),
    });
  }
  return map;
}

/**
 * Feed/profile visibility for a pet.
 * Companion opt-in is Discover-only — never hide community feed/profile rows.
 */
export function isPetVisibleToViewer(_petMeta, _viewerUserId) {
  return true;
}
