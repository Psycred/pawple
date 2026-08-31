/**
 * Mating discovery client — PAW-61 / PAW-60 contract.
 * Server-authoritative eligibility, Paw, mutual unlock. No client channel create.
 */

import { hasPassedAgeGate } from '../lib/ageGate';
import { supabase } from '../config/supabase';

export const MATING_RADIUS_KM_OPTIONS = Object.freeze([5, 10, 25, 50]);
export const DEFAULT_MATING_RADIUS_KM = 25;
export const MATING_DESCRIPTION_MAX = 200;

export const MATING_CHAT_DISCLAIMER =
  'Sharing personal details (address, phone, exact meeting spot) is at your discretion. Pawple encourages public, pet-friendly first meetups. Pawple is not responsible for chat exchanges.';

function orderedPetPair(petA, petB) {
  const a = String(petA);
  const b = String(petB);
  return a < b ? { petLowId: a, petHighId: b } : { petLowId: b, petHighId: a };
}

function mapRpcError(error, fallback = 'Something went wrong.') {
  const msg = String(error?.message ?? error?.hint ?? '');
  if (msg.includes('paw_rate_limited')) {
    return 'Take a pause before expressing more interest.';
  }
  if (msg.includes('not_eligible')) {
    return "Couldn't express interest right now.";
  }
  if (msg.includes('age_attestation_required') || msg.includes('age')) {
    return 'Mating is for accounts 18 and over.';
  }
  if (msg.includes('forbidden_pet') || msg.includes('not_authenticated')) {
    return 'Sign in to continue.';
  }
  return fallback;
}

/** Client fail-closed before mating-critical actions (server residual until PAW-53). */
export async function assertClientMatingAgeOk() {
  const ok = await hasPassedAgeGate();
  if (!ok) {
    const err = new Error('age_gate_required');
    err.code = 'age_gate_required';
    err.userMessage = 'Mating is for accounts 18 and over.';
    throw err;
  }
}

/**
 * @param {string} viewerPetId
 * @returns {Promise<Array<object>>}
 */
export async function fetchMatingOpportunities(viewerPetId) {
  await assertClientMatingAgeOk();
  if (!viewerPetId) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_mating_opportunities', {
    viewer_pet_id: viewerPetId,
  });

  if (error) {
    console.error('[Supabase]', error);
    const wrapped = new Error(mapRpcError(error, "Couldn't load opportunities."));
    wrapped.cause = error;
    throw wrapped;
  }

  return data ?? [];
}

/**
 * Directional Paw from owned pet → other pet.
 */
export async function expressPaw(fromPetId, toPetId) {
  await assertClientMatingAgeOk();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to continue.');
  }

  const { data, error } = await supabase.rpc('express_paw', {
    from_pet_id: fromPetId,
    to_pet_id: toPetId,
  });

  if (error) {
    console.error('[Supabase]', error);
    const wrapped = new Error(mapRpcError(error));
    wrapped.cause = error;
    throw wrapped;
  }
  return data;
}

export async function withdrawPaw(fromPetId, toPetId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to continue.');
  }

  const { data, error } = await supabase.rpc('withdraw_paw', {
    from_pet_id: fromPetId,
    to_pet_id: toPetId,
  });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  return data;
}

/**
 * Whether active pet has Pawed the target (outbound).
 */
export async function fetchOutboundPaw(fromPetId, toPetId) {
  if (!fromPetId || !toPetId) {
    return null;
  }

  const { data, error } = await supabase
    .from('paw_interests')
    .select('id, from_pet_id, to_pet_id, created_at')
    .eq('from_pet_id', fromPetId)
    .eq('to_pet_id', toPetId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  return data;
}

/**
 * Any directional paw_interests row between two pets (outbound or inbound).
 * Used for mating_interest report target_id alignment.
 */
export async function fetchPawInterestForPair(viewerPetId, viewedPetId) {
  if (!viewerPetId || !viewedPetId) {
    return null;
  }
  const outbound = await fetchOutboundPaw(viewerPetId, viewedPetId);
  if (outbound) {
    return outbound;
  }
  return fetchOutboundPaw(viewedPetId, viewerPetId);
}

/**
 * Transparent inbound interest for an owned pet (Interest in [Pet Name]).
 * @param {string} toPetId owned pet receiving interest
 */
export async function fetchInboundInterest(toPetId) {
  if (!toPetId) {
    return [];
  }

  const { data, error } = await supabase
    .from('paw_interests')
    .select('id, created_at, from_pet_id, to_pet_id, from_owner_id, to_owner_id')
    .eq('to_pet_id', toPetId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  const rows = data ?? [];
  const fromIds = [...new Set(rows.map((r) => r.from_pet_id).filter(Boolean))];
  if (fromIds.length === 0) {
    return rows;
  }

  const { data: pets, error: petsError } = await supabase
    .from('pets')
    .select(
      'id, name, breed, gender, age, photo_url, mating_description, is_looking_for_companion',
    )
    .in('id', fromIds);

  if (petsError) {
    console.error('[Supabase]', petsError);
    return rows.map((row) => ({ ...row, from_pet: { id: row.from_pet_id, name: 'Pet' } }));
  }

  const byId = new Map((pets ?? []).map((p) => [String(p.id), p]));
  return rows.map((row) => ({
    ...row,
    from_pet: byId.get(String(row.from_pet_id)) ?? { id: row.from_pet_id, name: 'Pet' },
  }));
}

/**
 * Server-derived mutuality — UI must still fail closed on channel status.
 */
export async function petsHaveMutualPaw(petA, petB) {
  if (!petA || !petB) {
    return false;
  }
  const { data, error } = await supabase.rpc('pets_have_mutual_paw', {
    pet_x: petA,
    pet_y: petB,
  });
  if (error) {
    console.error('[Supabase]', error);
    return false;
  }
  return Boolean(data);
}

/**
 * SELECT only — never INSERT channels from the client.
 */
export async function fetchIntroductionChannelForPair(petA, petB) {
  if (!petA || !petB) {
    return null;
  }
  const { petLowId, petHighId } = orderedPetPair(petA, petB);

  const { data, error } = await supabase
    .from('mating_introduction_channels')
    .select(
      'id, pet_low_id, pet_high_id, owner_low_id, owner_high_id, status, freeze_reason, opened_at, frozen_at',
    )
    .eq('pet_low_id', petLowId)
    .eq('pet_high_id', petHighId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  return data;
}

export async function fetchIntroductionChannelById(channelId) {
  if (!channelId) {
    return null;
  }
  const { data, error } = await supabase
    .from('mating_introduction_channels')
    .select(
      'id, pet_low_id, pet_high_id, owner_low_id, owner_high_id, status, freeze_reason, opened_at, frozen_at',
    )
    .eq('id', channelId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  return data;
}

export async function fetchIntroductionMessages(channelId) {
  if (!channelId) {
    return [];
  }
  const { data, error } = await supabase
    .from('mating_introduction_messages')
    .select('id, channel_id, sender_user_id, body, created_at')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  return data ?? [];
}

/**
 * Compose fails closed when RLS denies (frozen / no mutual / not participant).
 */
export async function sendIntroductionMessage(channelId, body) {
  await assertClientMatingAgeOk();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to continue.');
  }

  const trimmed = String(body ?? '').trim();
  if (!trimmed) {
    throw new Error('Message is empty.');
  }

  const { data, error } = await supabase
    .from('mating_introduction_messages')
    .insert({
      channel_id: channelId,
      sender_user_id: user.id,
      body: trimmed.slice(0, 2000),
    })
    .select('id, channel_id, sender_user_id, body, created_at')
    .single();

  if (error) {
    console.error('[Supabase]', error);
    const wrapped = new Error("Couldn't send. Introduction may no longer be open.");
    wrapped.cause = error;
    throw wrapped;
  }
  return data;
}

export async function fetchMatingRadiusKm() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return DEFAULT_MATING_RADIUS_KM;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('mating_discovery_radius_km')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    return DEFAULT_MATING_RADIUS_KM;
  }

  const km = Number(data?.mating_discovery_radius_km);
  return MATING_RADIUS_KM_OPTIONS.includes(km) ? km : DEFAULT_MATING_RADIUS_KM;
}

export async function updateMatingRadiusKm(radiusKm) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to continue.');
  }

  const km = Number(radiusKm);
  if (!MATING_RADIUS_KM_OPTIONS.includes(km)) {
    throw new Error('Choose a valid distance.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ mating_discovery_radius_km: km })
    .eq('id', user.id)
    .select('mating_discovery_radius_km')
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  return data?.mating_discovery_radius_km ?? km;
}

export async function updateMatingDescription(petId, description) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to continue.');
  }
  if (!petId) {
    throw new Error('Pet is required.');
  }

  const trimmed = String(description ?? '').trim().slice(0, MATING_DESCRIPTION_MAX);
  const { data, error } = await supabase
    .from('pets')
    .update({ mating_description: trimmed || null })
    .eq('id', petId)
    .eq('owner_id', user.id)
    .select('id, mating_description')
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

/** Approximate distance label — omit when unavailable; never fabricate. */
export function formatDistanceKm(distanceKm) {
  if (distanceKm == null || !Number.isFinite(Number(distanceKm))) {
    return null;
  }
  const n = Math.round(Number(distanceKm));
  if (n < 1) {
    return '~1 km';
  }
  return `~${n} km`;
}
