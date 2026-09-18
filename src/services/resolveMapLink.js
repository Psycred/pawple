import { supabase } from '../config/supabase';
import { isAllowedMapLinkHost, parseMapLinkCoords } from '../lib/mapLinkCoords';

/**
 * Unwrap a maps link via Edge Function; fall back to client parse when offline.
 * @param {string|null|undefined} url
 * @returns {Promise<{ venueLat: number|null, venueLng: number|null, resolvedUrl: string|null }>}
 */
export async function resolveMeetupMapLink(url) {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) {
    return { venueLat: null, venueLng: null, resolvedUrl: null };
  }

  if (!isAllowedMapLinkHost(trimmed)) {
    return { venueLat: null, venueLng: null, resolvedUrl: trimmed };
  }

  try {
    const { data, error } = await supabase.functions.invoke('resolve-map-link', {
      body: { url: trimmed },
    });

    if (error) {
      throw error;
    }

    const venueLat = Number(data?.venueLat ?? data?.venue_lat);
    const venueLng = Number(data?.venueLng ?? data?.venue_lng);
    const resolvedUrl = String(data?.resolvedUrl ?? data?.resolved_url ?? trimmed).trim() || trimmed;

    if (Number.isFinite(venueLat) && Number.isFinite(venueLng)) {
      return { venueLat, venueLng, resolvedUrl };
    }
  } catch (invokeError) {
    console.warn('[resolveMapLink] edge unwrap failed, using client parse:', invokeError?.message ?? invokeError);
  }

  const parsed = parseMapLinkCoords(trimmed);
  return {
    venueLat: parsed?.lat ?? null,
    venueLng: parsed?.lng ?? null,
    resolvedUrl: trimmed,
  };
}
