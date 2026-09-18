import { supabase } from '../config/supabase';
import { profilePhotoDateFromStorageUrl } from '../lib/storageMediaParse';
import { pickDiscoverMomentForCandidate } from '../utils/discoverMomentRotation';

/**
 * One query for all candidate pets — journal ordering without per-pet heart enrichment.
 * @param {string[]} petIds
 */
async function fetchMomentsOverlappingPets(petIds) {
  const ids = [...new Set((petIds ?? []).map(String).filter(Boolean))];
  if (!ids.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('moments')
    .select('*')
    .overlaps('pet_ids', ids)
    .order('moment_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return (data ?? []).map((m) => ({
    ...m,
    photo_url: m.image_url ?? m.photo_url ?? null,
  }));
}

/**
 * Featured moment per discovery candidate (client-side until RPC returns card content).
 * @param {string[]} candidatePetIds
 * @param {string} viewerPetId active / exploring pet
 * @returns {Promise<Map<string, object>>} candidatePetId → moment row
 */
export async function fetchDiscoverMomentMap(candidatePetIds, viewerPetId) {
  const ids = [...new Set((candidatePetIds ?? []).map(String).filter(Boolean))];
  const result = new Map();
  if (!ids.length || !viewerPetId) {
    return result;
  }

  try {
    const moments = await fetchMomentsOverlappingPets(ids);
    for (const candidateId of ids) {
      const picked = pickDiscoverMomentForCandidate(moments, viewerPetId, candidateId);
      if (picked) {
        result.set(candidateId, picked);
      }
    }
  } catch (error) {
    console.error('[discoverMoments] batch fetch failed', error);
  }

  return result;
}

/**
 * Profile metadata for discover fallback cards (not part of moment rotation).
 * @param {string[]} candidatePetIds
 * @returns {Promise<Map<string, { ownerId: string, photoDate: string|null }>>}
 */
export async function fetchDiscoverProfileMeta(candidatePetIds) {
  const ids = [...new Set((candidatePetIds ?? []).map(String).filter(Boolean))];
  const result = new Map();
  if (!ids.length) {
    return result;
  }

  try {
    const { data, error } = await supabase
      .from('pets')
      .select('id, owner_id, photo_url')
      .in('id', ids);

    if (error) {
      console.error('[Supabase]', error);
      return result;
    }

    for (const row of data ?? []) {
      result.set(String(row.id), {
        ownerId: row.owner_id != null ? String(row.owner_id) : null,
        photoDate: profilePhotoDateFromStorageUrl(row.photo_url),
      });
    }
  } catch (error) {
    console.error('[discoverMoments] profile meta failed', error);
  }

  return result;
}
