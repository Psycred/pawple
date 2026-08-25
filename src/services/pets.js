/**
 * Pet profile API — includes meetup community counts from junction tables.
 */

import { supabase } from '../config/supabase';

const PET_PROFILE_SELECT =
  'id, owner_id, name, pet_type, pet_type_custom, breed, age, gender, vaccinated, bio, photo_url, is_looking_for_companion, traits';

const PET_DISCOVERY_SELECT =
  'id, owner_id, name, pet_type, breed, age, gender, photo_url, is_looking_for_companion';

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

  const [hostedRes, participatedRes] = await Promise.all([
    supabase.rpc('get_pet_hosted_count', { target_pet_id: petId }),
    supabase.rpc('get_pet_participated_count', { target_pet_id: petId }),
  ]);

  if (!hostedRes.error && !participatedRes.error) {
    return {
      hosted_count: Number(hostedRes.data ?? 0) || 0,
      participated_count: Number(participatedRes.data ?? 0) || 0,
    };
  }

  if (hostedRes.error) {
    console.warn('[Pet] get_pet_hosted_count unavailable:', hostedRes.error.message);
  }
  if (participatedRes.error) {
    console.warn('[Pet] get_pet_participated_count unavailable:', participatedRes.error.message);
  }

  // Legacy combined RPC fallback.
  const { data, error } = await supabase.rpc('get_pet_meetup_counts', {
    target_pet_id: petId,
  });

  if (!error && data?.length) {
    const row = data[0];
    return {
      hosted_count: Number(row.hosted_count ?? 0) || 0,
      participated_count: Number(row.participated_count ?? 0) || 0,
    };
  }

  if (error) {
    console.warn('[Pet] get_pet_meetup_counts fallback unavailable:', error.message);
  }

  const [hostedTable, participatedTable] = await Promise.all([
    supabase
      .from('meetup_hosts')
      .select('id', { count: 'exact', head: true })
      .eq('pet_id', petId),
    supabase
      .from('meetup_participants')
      .select('id', { count: 'exact', head: true })
      .eq('pet_id', petId),
  ]);

  if (hostedTable.error) {
    console.error('[Supabase]', hostedTable.error);
  }
  if (participatedTable.error) {
    console.error('[Supabase]', participatedTable.error);
  }

  return {
    hosted_count: hostedTable.count ?? 0,
    participated_count: participatedTable.count ?? 0,
  };
}

/**
 * Load a pet profile with calculated meetup counts.
 * Non-owners cannot view pets with discovery turned off.
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

  if (!owner && !discoverable) {
    return null;
  }

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
 * Toggle whether a pet is discoverable in public feed/search.
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
 * Batch lookup for feed/discover privacy — which pet ids are publicly visible.
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
 * Returns true when a pet may appear to the viewer in feed/discover contexts.
 */
export function isPetVisibleToViewer(petMeta, viewerUserId) {
  if (!petMeta) {
    return true;
  }
  if (viewerUserId && String(petMeta.owner_id) === String(viewerUserId)) {
    return true;
  }
  return petMeta.is_looking_for_companion === true;
}
