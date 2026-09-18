import { supabase } from '../config/supabase';
import { collectHeartedPetIdsFromLikesEmbed } from '../lib/heartedPetIds';
import { normalizeMomentHeartState } from '../lib/momentHeartState';

/**
 * Fetches aggregate state without exposing other users' private like rows.
 * The viewer flag remains separate from the permanent Moment-level visual state.
 */
export async function fetchMomentHeartStates(momentIds) {
  const ids = [...new Set((momentIds ?? []).filter(Boolean).map(String))];
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc('get_moment_heart_states', {
    p_moment_ids: ids,
  });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return new Map(
    (data ?? []).map((row) => [String(row.moment_id), normalizeMomentHeartState(row)]),
  );
}

/**
 * Adds one permanent heart. The database unique constraint makes repeat calls
 * idempotent, while the RPC deliberately provides no deletion path.
 */
export async function heartMoment(momentId) {
  if (!momentId) {
    throw new Error('moment_id_required');
  }

  const { data, error } = await supabase.rpc('heart_moment', {
    p_moment_id: momentId,
  });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return normalizeMomentHeartState(data?.[0]);
}

async function fetchViewerHeartedPetIdsLegacy(userId) {
  const { data: likes, error } = await supabase
    .from('likes')
    .select('moment_id')
    .eq('user_id', userId);

  if (error) {
    console.error('[Supabase]', error);
    return new Set();
  }

  const momentIds = [...new Set((likes ?? []).map((row) => row?.moment_id).filter(Boolean))];
  if (!momentIds.length) {
    return new Set();
  }

  const { data: moments, error: momentsError } = await supabase
    .from('moments')
    .select('pet_ids')
    .in('id', momentIds);

  if (momentsError) {
    console.error('[Supabase]', momentsError);
    return new Set();
  }

  const petIds = new Set();
  for (const moment of moments ?? []) {
    const ids = moment?.pet_ids ?? [];
    if (Array.isArray(ids)) {
      ids.forEach((id) => {
        if (id) {
          petIds.add(String(id));
        }
      });
    }
  }
  return petIds;
}

/**
 * Pet ids from moments the viewer has hearted — used for global feed fallback priority.
 */
export async function fetchViewerHeartedPetIds(userId) {
  if (!userId) {
    return new Set();
  }

  try {
    const { data, error } = await supabase
      .from('likes')
      .select('moments(pet_ids)')
      .eq('user_id', userId);

    if (error) {
      console.error('[Supabase]', error);
      return fetchViewerHeartedPetIdsLegacy(userId);
    }

    return collectHeartedPetIdsFromLikesEmbed(data);
  } catch (error) {
    console.error('[Supabase]', error);
    return new Set();
  }
}
