import { supabase } from '../config/supabase';
import { deleteMomentSharePreview } from '../lib/momentSharePreview';
import { readCachedViewerFeedLocation } from '../lib/viewerFeedLocation';
import { fetchMomentHeartStates } from './momentHearts';

/**
 * Moment data flow for Pawple.
 *
 * One memory = one `moments` row + one uploaded image. Pet attribution is stored
 * denormalized on the row (Phase 1: one pet; Phase 2-ready array shape):
 *   pet_ids   uuid[]  e.g. [selectedPet.id]
 *   pet_names text    e.g. selectedPet.name
 *
 * Feed + pet profiles read pet_names / pet_ids directly — no joins, no moment_pets.
 * Image processing: services/imageProcessor.js; storage: lib/supabase.js.
 *
 * moments(id, user_id, image_url, caption, moment_date, location,
 *         pet_ids uuid[], pet_names text, created_at)
 *
 * Phase 1a: optional `location` is user-entered caption text only — no GPS coords on insert.
 */

/** Phase 1: never link more than two pets to a single moment. */
export const MAX_MOMENT_PETS = 2;
export const DEFAULT_FEED_MOMENT_PAGE_LIMIT = 20;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse YYYY-MM-DD from a DATE column value or ISO string — no Date() / timezone shift.
 * @returns {{ year: string, month: string, day: string } | null}
 */
export function parseMomentDateYmd(value) {
  if (value == null || value === '') {
    return null;
  }
  const s = String(value).trim();
  if (/[A-Za-z]/.test(s)) {
    return null;
  }
  const datePart = s.includes('T') ? s.split('T')[0] : s.slice(0, 10);
  const parts = datePart.split('-');
  if (parts.length !== 3) {
    return null;
  }
  const [year, month, day] = parts;
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) {
    return null;
  }
  const mi = parseInt(month, 10);
  const di = parseInt(day, 10);
  if (mi < 1 || mi > 12 || di < 1 || di > 31) {
    return null;
  }
  return { year, month, day };
}

/**
 * Format stored moment_date for cards: "D MMM YYYY" (e.g. "1 Jun 2026").
 * Pass-through if already display text. Never uses toLocaleDateString() or local Date parsing.
 */
export function formatMomentDate(value) {
  if (!value) {
    return '';
  }
  const s = String(value).trim();
  if (/[A-Za-z]/.test(s)) {
    return s;
  }
  const ymd = parseMomentDateYmd(s);
  if (ymd) {
    const monthIndex = parseInt(ymd.month, 10) - 1;
    return `${parseInt(ymd.day, 10)} ${MONTHS_SHORT[monthIndex]} ${ymd.year}`;
  }
  return s;
}

/** Numeric sort key from YYYY-MM-DD (journal order) without timezone conversion. */
function momentDateYmdSortKey(value) {
  const ymd = parseMomentDateYmd(value);
  if (!ymd) {
    return 0;
  }
  return (
    parseInt(ymd.year, 10) * 10000 +
    parseInt(ymd.month, 10) * 100 +
    parseInt(ymd.day, 10)
  );
}

/**
 * Card date line: only the memory date the user chose (moment_date).
 * Never the posted/created_at timestamp — that stays in the DB for sorting only.
 */
export function formatMomentDisplayDate(moment) {
  return formatMomentDate(moment?.moment_date ?? '');
}

/** Normalize a moments.pet_ids column (uuid[] / jsonb / comma string) into string ids. */
export function normalizePetIds(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('[')) {
      try {
        return JSON.parse(t).map(String);
      } catch {
        // fall through to comma parsing
      }
    }
    return t.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** Feed/MomentCard expects: photo_url, caption, location, memory_date, created_at, pet_names (+ safety ids). */
function toFeedMoment(moment, petNames = '') {
  const lat = moment.location_lat ?? moment.latitude ?? moment.lat;
  const lng = moment.location_lng ?? moment.longitude ?? moment.lng ?? moment.lon;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return {
    id: moment.id,
    photo_url: moment.image_url ?? moment.photo_url ?? null,
    caption: moment.caption ?? '',
    location: moment.location ?? '',
    memory_date: formatMomentDisplayDate(moment),
    created_at: moment.created_at ?? '',
    pet_names: petNames,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    // Safety (PAW-47): report flags human account; block filters by pet_ids.
    user_id: moment.user_id ?? null,
    pet_ids: normalizePetIds(moment.pet_ids),
    moment_date: moment.moment_date ?? null,
  };
}

async function withMomentHeartStates(moments) {
  if (!moments.length) {
    return moments;
  }

  try {
    const stateByMomentId = await fetchMomentHeartStates(moments.map((moment) => moment.id));
    return moments.map((moment) => {
      const state = stateByMomentId.get(String(moment.id));
      return {
        ...moment,
        heart_count: state?.heartCount ?? 0,
        viewer_has_hearted: state?.viewerHasHearted ?? false,
      };
    });
  } catch {
    // Keep Moment loading resilient while a backend migration is being deployed.
    return moments.map((moment) => ({
      ...moment,
      heart_count: Math.max(0, Number(moment?.heart_count) || 0),
      viewer_has_hearted: Boolean(moment?.viewer_has_hearted),
    }));
  }
}

/**
 * Normalize pet_names input for insert.
 * Phase 1: single pet → plain text (e.g. "Tyson").
 * Phase 2: multiple pets → "Tyson, Luna" (comma-separated, max 2).
 */
function normalizePetNamesForInsert(petNames) {
  if (typeof petNames === 'string' && petNames.trim()) {
    return petNames.trim();
  }
  if (!Array.isArray(petNames) || !petNames.length) {
    return null;
  }
  const names = petNames.map((n) => String(n).trim()).filter(Boolean).slice(0, MAX_MOMENT_PETS);
  if (!names.length) {
    return null;
  }
  return names.length === 1 ? names[0] : names.join(', ');
}

/** Insert the single moment record and return the created row. */
export async function createMoment({
  userId,
  imageUrl,
  caption,
  momentDate,
  location,
  locationLat = null,
  locationLng = null,
  petIds = [],
  petNames,
}) {
  // Phase 1: [selectedPet.id]. Phase 2-ready: up to two UUIDs, never hardcoded.
  const normalizedPetIds = [...new Set(petIds.filter(Boolean).map(String))].slice(0, MAX_MOMENT_PETS);
  const petNamesText = normalizePetNamesForInsert(petNames);

  const lat = Number(locationLat);
  const lng = Number(locationLng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const basePayload = {
    user_id: userId,
    image_url: imageUrl,
    caption: caption?.trim() || null,
    moment_date: momentDate,
    location: location?.trim() || null,
    ...(hasCoords ? { location_lat: lat, location_lng: lng } : {}),
    pet_ids: normalizedPetIds,
    pet_names: petNamesText,
    created_at: new Date().toISOString(),
  };

  let response = await supabase.from('moments').insert(basePayload).select().single();

  // Self-heal: retry without missing denormalized columns so saves never break.
  if (response.error?.code === 'PGRST204') {
    const msg = response.error?.message ?? '';
    if (/pet_names/i.test(msg)) {
      console.warn('[Moment] moments.pet_names column missing — retrying without it.');
      const { pet_names, ...rest } = basePayload;
      response = await supabase.from('moments').insert(rest).select().single();
    } else if (/pet_ids/i.test(msg)) {
      console.warn('[Moment] moments.pet_ids column missing — retrying without it.');
      const { pet_ids, ...rest } = basePayload;
      response = await supabase.from('moments').insert(rest).select().single();
    } else if (/location_lat|location_lng/i.test(msg)) {
      console.warn('[Moment] moments location columns missing — retrying without coords.');
      const { location_lat, location_lng, ...rest } = basePayload;
      response = await supabase.from('moments').insert(rest).select().single();
    }
  }

  console.log('[Moment] moments.insert response', {
    data: response.data,
    error: response.error,
    status: response.status,
    statusText: response.statusText,
  });

  if (response.error) {
    console.error('[Moment] moments.insert error', {
      message: response.error?.message,
      code: response.error?.code,
      details: response.error?.details,
      hint: response.error?.hint,
    });
    throw response.error;
  }
  return response.data;
}

/**
 * Update caption, memory date, and location on an owned moment.
 * Photo and pet attribution stay unchanged.
 */
export async function updateMoment(momentId, { caption, momentDate, location }) {
  if (!momentId) {
    throw new Error('Missing moment id.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.error('[Supabase]', authError);
    throw authError;
  }
  if (!user?.id) {
    throw new Error('Not signed in.');
  }

  const payload = {
    caption: caption?.trim() || null,
    moment_date: momentDate,
    location: location?.trim() || null,
  };

  const { data, error } = await supabase
    .from('moments')
    .update(payload)
    .eq('id', momentId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return data;
}

/** Delete an owned moment row (RLS enforces user_id). */
export async function deleteMoment(momentId) {
  if (!momentId) {
    throw new Error('Missing moment id.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.error('[Supabase]', authError);
    throw authError;
  }
  if (!user?.id) {
    throw new Error('Not signed in.');
  }

  const { error } = await supabase
    .from('moments')
    .delete()
    .eq('id', momentId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  try {
    await deleteMomentSharePreview(user.id, momentId);
  } catch (previewError) {
    console.warn('[moments] share preview cleanup skipped', previewError);
  }
}

/** Link one moment to up to two pets (unique constraint dedupes server-side). */
export async function linkMomentToPets(momentId, petIds = []) {
  const unique = [...new Set(petIds.filter(Boolean).map(String))].slice(0, MAX_MOMENT_PETS);
  if (!unique.length) {
    return [];
  }

  const rows = unique.map((petId) => ({ moment_id: momentId, pet_id: petId }));
  const response = await supabase.from('moment_pets').insert(rows).select();

  console.log('[Moment] moment_pets.insert response', {
    rows,
    data: response.data,
    error: response.error,
    status: response.status,
    statusText: response.statusText,
  });

  if (response.error) {
    console.error('[Moment] moment_pets.insert error', {
      message: response.error?.message,
      code: response.error?.code,
      details: response.error?.details,
      hint: response.error?.hint,
    });
    throw response.error;
  }
  return response.data ?? [];
}

/** Earth radius in km for Haversine distance (Phase 2 when moments store lat/lng). */
const EARTH_RADIUS_KM = 6371;

/**
 * Haversine distance in km between two WGS84 points.
 * Returns null if any coordinate is missing or invalid.
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const a1 = Number(lat1);
  const o1 = Number(lon1);
  const a2 = Number(lat2);
  const o2 = Number(lon2);
  if (![a1, o1, a2, o2].every((n) => Number.isFinite(n))) {
    return null;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(a2 - a1);
  const dLon = toRad(o2 - o1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return EARTH_RADIUS_KM * c;
}

/**
 * Viewer location for feed proximity sorting.
 * Wave 5 §2: device cache from About You capture; city-only fallback when declined.
 */
export async function fetchUserFeedLocation(userId) {
  if (!userId) {
    return null;
  }
  try {
    const cached = await readCachedViewerFeedLocation();
    const { data, error } = await supabase.from('profiles').select('city').eq('id', userId).single();
    if (error) {
      console.log('[moments] fetchUserFeedLocation failed:', error?.message);
    }
    const profileCity = String(data?.city ?? '').trim() || null;
    const deviceCity = String(cached?.city ?? '').trim() || null;
    // Legacy `city` field — device city when available, else profile (moments GPS sort).
    const city = deviceCity ?? profileCity;
    return {
      city,
      profileCity,
      deviceCity,
      latitude: cached?.latitude ?? null,
      longitude: cached?.longitude ?? null,
    };
  } catch (e) {
    console.log('[moments] fetchUserFeedLocation error', e);
    return null;
  }
}

function momentCreatedAtMs(moment) {
  const raw = moment?.created_at ?? moment?.createdAt ?? '';
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function compareCreatedAtDesc(a, b) {
  return momentCreatedAtMs(b) - momentCreatedAtMs(a);
}

/** True when both viewer and at least one moment have coordinates for distance sort. */
function canSortFeedByDistance(moments, userLocation) {
  if (userLocation?.latitude == null || userLocation?.longitude == null) {
    return false;
  }
  return moments.some((m) => {
    const lat = m?.latitude ?? m?.lat;
    const lng = m?.longitude ?? m?.lng ?? m?.lon;
    return lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  });
}

/** Distance in km from viewer to a moment; null if coordinates unavailable. */
function distanceKmToMoment(moment, userLocation) {
  if (userLocation?.latitude == null || userLocation?.longitude == null) {
    return null;
  }
  const lat = moment?.latitude ?? moment?.lat;
  const lng = moment?.longitude ?? moment?.lng ?? moment?.lon;
  if (lat == null || lng == null) {
    return null;
  }
  return haversineDistanceKm(userLocation.latitude, userLocation.longitude, lat, lng);
}

/**
 * Feed sort: primary distance (closest first), secondary created_at DESC.
 * Phase 1 fallback (no moment lat/lng yet): all moments, newest first only.
 */
export function sortFeedMoments(moments, userLocation = null) {
  const list = [...moments];
  if (!list.length) {
    return list;
  }

  if (canSortFeedByDistance(list, userLocation)) {
    return list.sort((a, b) => {
      const da = distanceKmToMoment(a, userLocation) ?? Number.POSITIVE_INFINITY;
      const db = distanceKmToMoment(b, userLocation) ?? Number.POSITIVE_INFINITY;
      if (da !== db) {
        return da - db;
      }
      return compareCreatedAtDesc(a, b);
    });
  }

  // Phase 1: no coordinate-based distance — recency only.
  return list.sort(compareCreatedAtDesc);
}

/** id → name for a set of pet ids. */
async function fetchPetNamesById(petIds) {
  const nameById = new Map();
  if (!petIds.length) {
    return nameById;
  }
  try {
    const { data: pets } = await supabase.from('pets').select('id, name').in('id', petIds);
    for (const p of pets ?? []) {
      nameById.set(String(p.id), p.name);
    }
  } catch (e) {
    console.log('[moments] pets name lookup failed', e);
  }
  return nameById;
}

/**
 * Read one share-linked Moment without changing Feed/Profile pagination queries.
 * RLS remains the authority for whether the signed-in viewer may see it.
 */
export async function fetchMomentById(momentId) {
  if (!momentId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('moments')
      .select('*')
      .eq('id', momentId)
      .maybeSingle();

    if (error) {
      console.error('[Supabase]', error);
      throw error;
    }
    if (!data) {
      return null;
    }

    let petNames = String(data.pet_names ?? '').trim();
    if (!petNames) {
      const petIds = normalizePetIds(data.pet_ids);
      const nameById = await fetchPetNamesById(petIds);
      petNames = petIds
        .map((id) => nameById.get(String(id)))
        .filter(Boolean)
        .join(', ');
    }

    const [moment] = await withMomentHeartStates([
      toFeedMoment(data, petNames),
    ]);
    return moment ?? null;
  } catch (error) {
    console.error('[moments] fetchMomentById failed:', error);
    throw error;
  }
}

/**
 * Feed moments: current user + everyone (small early community).
 * No joins — pet attribution from pet_names / pet_ids on the row.
 * Sorted by proximity when lat/lng exist (Phase 2); otherwise created_at DESC (Phase 1).
 */
/**
 * Companion opt-in must not hide Moments from the community feed.
 * Kept as a pass-through so feed pagination stays stable if filters return later.
 */
async function filterMomentsByPetDiscovery(rows, _viewerUserId) {
  return rows;
}

/**
 * Fetch one created_at-descending page of real Feed Moments.
 * `hasMore` is based on the raw database page so discovery filtering cannot
 * accidentally mark a partially visible page as the end of the dataset.
 */
export async function fetchFeedMoments(
  userId = null,
  userLocation = null,
  page = 0,
  limit = DEFAULT_FEED_MOMENT_PAGE_LIMIT,
) {
  const location = userLocation ?? (userId ? await fetchUserFeedLocation(userId) : null);
  const safePage = Math.max(0, Math.floor(Number(page) || 0));
  const safeLimit = Math.max(1, Math.floor(Number(limit) || DEFAULT_FEED_MOMENT_PAGE_LIMIT));
  const rangeStart = safePage * safeLimit;
  const rangeEnd = rangeStart + safeLimit - 1;

  const { data, error } = await supabase
    .from('moments')
    .select('*')
    .order('created_at', { ascending: false })
    .range(rangeStart, rangeEnd);

  if (error) {
    // Legacy fallback table.
    const fallback = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false })
      .range(rangeStart, rangeEnd);
    const fallbackRows = fallback.data ?? [];
    const legacy = await withMomentHeartStates(
      fallbackRows.map((m) => toFeedMoment(m, m.pet_names ?? '')),
    );
    return {
      moments: sortFeedMoments(legacy, location),
      hasMore: fallbackRows.length === safeLimit,
    };
  }

  const rows = data ?? [];
  const visibleRows = await filterMomentsByPetDiscovery(rows, userId);

  // Only older rows missing pet_names need a pet_ids → pets.name lookup.
  const fallbackIds = new Set();
  for (const m of visibleRows) {
    if (!String(m.pet_names ?? '').trim()) {
      normalizePetIds(m.pet_ids).forEach((id) => fallbackIds.add(String(id)));
    }
  }
  const nameById = fallbackIds.size ? await fetchPetNamesById([...fallbackIds]) : new Map();

  const mapped = visibleRows.map((m) => {
    let names = String(m.pet_names ?? '').trim()
      ? String(m.pet_names).split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (!names.length) {
      names = normalizePetIds(m.pet_ids)
        .map((id) => nameById.get(String(id)))
        .filter(Boolean);
    }
    return toFeedMoment(m, names.join(', '));
  });

  const momentsWithHeartState = await withMomentHeartStates(mapped);

  return {
    moments: sortFeedMoments(momentsWithHeartState, location),
    hasMore: rows.length === safeLimit,
  };
}

/** Sort key for pet profile journal: moment_date (memory date), else created_at date part only. */
function journalSortMs(moment) {
  const key = momentDateYmdSortKey(moment?.moment_date);
  if (key) {
    return key;
  }
  const posted = moment?.created_at;
  if (posted) {
    return momentDateYmdSortKey(String(posted).split('T')[0]) || 0;
  }
  return 0;
}

/** Journal order: newest memory date first; legacy rows without moment_date use created_at. */
function sortPetProfileMoments(rows) {
  return [...rows].sort((a, b) => journalSortMs(b) - journalSortMs(a));
}

/**
 * Moments for one pet (pet profile journal).
 * Sorted by moment_date DESC (journal), with created_at as tiebreaker / legacy fallback.
 * Parameterized only — petId is passed in, never hardcoded. No joins, no moment_pets.
 */
export async function fetchMomentsForPet(petId) {
  if (!petId) {
    return [];
  }

  const { data, error } = await supabase
    .from('moments')
    .select('*')
    .contains('pet_ids', [petId])
    .order('moment_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.log('[moments] fetchMomentsForPet failed:', error?.message);
    return [];
  }

  const rows = (data ?? []).map((m) => ({ ...m, photo_url: m.image_url ?? m.photo_url ?? null }));
  const momentsWithHeartState = await withMomentHeartStates(rows);
  return sortPetProfileMoments(momentsWithHeartState);
}

/** Feed attribution: "— Tyson" or "— Tyson & Peter" (Phase 1 cap: 2). */
export function buildPetAttribution(names = []) {
  const list = names.filter(Boolean);
  if (list.length === 1) {
    return `— ${list[0]}`;
  }
  if (list.length >= 2) {
    return `— ${list[0]} & ${list[1]}`;
  }
  return '';
}
