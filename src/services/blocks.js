/**
 * Phase-1 pet profile blocks (Founder F / PAW-47).
 * A user blocks another pet profile; list is private to the blocker.
 */

import { supabase } from '../config/supabase';
import {
  filterPetsNotBlocked,
  isBlockedByPetIds,
} from '../lib/petBlockVisibility.js';

export { filterPetsNotBlocked, isBlockedByPetIds };

/**
 * @param {string|null} [userId] — when omitted, resolves the signed-in user
 * @returns {Promise<string[]>} blocked pet ids for the signed-in user
 */
export async function fetchBlockedPetIds(userId = null) {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    resolvedUserId = user?.id ?? null;
  }
  if (!resolvedUserId) {
    return [];
  }

  const { data, error } = await supabase
    .from('pet_blocks')
    .select('blocked_pet_id')
    .eq('blocker_user_id', resolvedUserId);

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return (data ?? [])
    .map((row) => String(row.blocked_pet_id ?? '').trim())
    .filter(Boolean);
}

/**
 * Blocked pets with display fields for Privacy settings.
 * @returns {Promise<Array<{ id: string, blocked_pet_id: string, created_at: string, pet: object|null }>>}
 */
export async function fetchBlockedPets() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from('pet_blocks')
    .select('id, blocked_pet_id, created_at, pets:blocked_pet_id(id, name, photo_url, breed)')
    .eq('blocker_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    blocked_pet_id: row.blocked_pet_id,
    created_at: row.created_at,
    pet: row.pets ?? null,
  }));
}

/**
 * @param {string} blockedPetId
 */
export async function blockPet(blockedPetId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to block a pet.');
  }

  const petId = String(blockedPetId ?? '').trim();
  if (!petId) {
    throw new Error('Missing pet to block.');
  }

  // Never block your own pets.
  const { data: owned, error: ownedError } = await supabase
    .from('pets')
    .select('id')
    .eq('id', petId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (ownedError) {
    console.error('[Supabase]', ownedError);
    throw ownedError;
  }
  if (owned?.id) {
    throw new Error('You cannot block your own pet.');
  }

  const { data, error } = await supabase
    .from('pet_blocks')
    .insert({
      blocker_user_id: user.id,
      blocked_pet_id: petId,
    })
    .select('id')
    .single();

  if (error) {
    // Unique violation — already blocked; treat as success for calm UX.
    if (error.code === '23505') {
      return { id: null, alreadyBlocked: true };
    }
    console.error('[Supabase]', error);
    throw error;
  }

  return { id: data?.id ?? null, alreadyBlocked: false };
}

/**
 * @param {string} blockedPetId
 */
export async function unblockPet(blockedPetId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to unblock.');
  }

  const petId = String(blockedPetId ?? '').trim();
  if (!petId) {
    throw new Error('Missing pet to unblock.');
  }

  const { error } = await supabase
    .from('pet_blocks')
    .delete()
    .eq('blocker_user_id', user.id)
    .eq('blocked_pet_id', petId);

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
}

