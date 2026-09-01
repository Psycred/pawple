/**
 * Meetups API helpers — validation, normalization, and Supabase access.
 *
 * ## Database schema (public.meetups)
 *
 * | Column               | Type           | Notes |
 * |----------------------|----------------|-------|
 * | id                   | uuid PK        | |
 * | user_id              | uuid FK        | Creator account |
 * | title                | text           | Required |
 * | date                 | date           | Meetup day |
 * | start_time           | time           | |
 * | end_time             | time           | |
 * | location_lat         | double precision | Nullable |
 * | location_lng         | double precision | Nullable |
 * | google_maps_link     | text           | Optional Google Maps URL |
 * | participation_limit  | integer        | Nullable = unlimited |
 * | open_to              | text           | Open to All \| Dogs Meetup \| Cats Meetup \| Please Specify |
 * | custom_breed_spec    | text           | When open_to = Please Specify |
 * | participant_count    | integer        | Trigger-derived COUNT(*) of meetup_participants |
 * | created_at           | timestamptz    | |
 *
 * ## meetup_hosts
 *
 * | Column     | Type      | Notes |
 * |------------|-----------|-------|
 * | id         | uuid PK   | |
 * | meetup_id  | uuid FK   | → meetups.id |
 * | pet_id     | uuid FK   | → pets.id |
 *
 * ## meetup_participants
 *
 * | Column     | Type      | Notes |
 * |------------|-----------|-------|
 * | id         | uuid PK   | |
 * | meetup_id  | uuid FK   | → meetups.id |
 * | pet_id     | uuid FK   | → pets.id |
 * | joined_at  | timestamptz | |
 *
 * @typedef {'Open to All' | 'Dogs Meetup' | 'Cats Meetup' | 'Please Specify'} MeetupOpenTo
 *
 * @typedef {Object} MeetupParticipant
 * @property {string} id
 * @property {string} meetup_id
 * @property {string} pet_id
 * @property {string} joined_at
 *
 * @typedef {Object} MeetupRecord
 * @property {string} id
 * @property {string} user_id
 * @property {string} title
 * @property {string} date
 * @property {string} start_time
 * @property {string} end_time
 * @property {Array<{pet_id: string, pets?: object}>} [meetup_hosts]
 * @property {Array<{pet_id: string, joined_at?: string, pets?: object}>} [meetup_participants]
 * @property {string} [hosted_by_line]
 * @property {string|null} [google_maps_link]
 * @property {string} [city]
 * @property {number|null} [participation_limit]
 * @property {MeetupOpenTo|null} [open_to]
 * @property {string|null} [custom_breed_spec]
 * @property {number} [participant_count]
 * @property {string} [created_at]
 * @property {number|null} [distanceKm]
 *
 * @typedef {Object} CreateMeetupInput
 * @property {string} userId
 * @property {string} title
 * @property {string} date ISO date YYYY-MM-DD
 * @property {string} startTime HH:MM:SS
 * @property {string} endTime HH:MM:SS
 * @property {string[]} hostPetIds — pet ids saved to meetup_hosts
 * @property {MeetupOpenTo} openTo
 * @property {string} [customBreedSpec]
 * @property {string} [googleMapsLink]
 * @property {number|null} [participationLimit]
 * @property {string} [city] — bulletin-board locality (server-set at insert)
 */

import { supabase } from '../config/supabase';
import {
  joinDemoMeetupWithPets,
  leaveDemoMeetupWithPets,
} from '../data/demoMeetupRsvp';
import {
  filterShowablePublicMeetups,
  getMeetupStartTimestamp,
  isShowablePublicMeetup,
} from '../lib/meetupPublicFilter';
import { filterMeetupsByViewerCity } from '../utils/cityUtils';
import { validateOptionalGoogleMapsLink } from '../utils/mapLinkValidation';
import { formatMeetupHostedByLine } from '../utils/meetupHostDisplay';

export { filterMeetupsByViewerCity };

export {
  filterShowablePublicMeetups,
  getMeetupStartTimestamp,
  isShowablePublicMeetup,
};
/** @deprecated Use isShowablePublicMeetup */
export const isShowableMeetup = isShowablePublicMeetup;
/** @deprecated Use filterShowablePublicMeetups */
export const filterShowableMeetups = filterShowablePublicMeetups;

export const MEETUP_OPEN_TO_OPTIONS = [
  'Open to All',
  'Dogs Meetup',
  'Cats Meetup',
  'Please Specify',
];

/** Validates participation_limit when provided. */
export function validateParticipationLimit(raw) {
  if (raw == null || raw === '') {
    return { valid: true, value: null };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return { valid: false, error: 'Participation limit must be a positive whole number.' };
  }
  return { valid: true, value: n };
}

/** Validates optional Google Maps link — empty allowed; Google URLs only when provided. */
export function validateGoogleMapsLink(url = '') {
  const result = validateOptionalGoogleMapsLink(url);
  if (!result.isValid) {
    return { valid: false, error: result.message || 'Please use a Google Maps link.' };
  }
  return { valid: true, value: result.value };
}

/**
 * Build only the normalized public.meetups row.
 * Host pets are written separately to meetup_hosts after this row exists.
 * @param {CreateMeetupInput} input
 */
export function buildMeetupInsertPayload(input) {
  const limitResult = validateParticipationLimit(input.participationLimit);
  if (!limitResult.valid) {
    throw new Error(limitResult.error);
  }

  const linkResult = validateGoogleMapsLink(input.googleMapsLink);
  if (!linkResult.valid) {
    throw new Error(linkResult.error);
  }

  const openTo = input.openTo || 'Open to All';
  const customBreedSpec =
    openTo === 'Please Specify' ? input.customBreedSpec?.trim() || null : null;
  const mapsLink = linkResult.value;

  return {
    user_id: input.userId,
    title: input.title.trim(),
    date: input.date,
    start_time: input.startTime,
    end_time: input.endTime,
    open_to: openTo,
    custom_breed_spec: customBreedSpec,
    google_maps_link: mapsLink,
    participation_limit: limitResult.value,
  };
}

/** Shared meetup fields for update (no creator / participant_count). */
export function buildMeetupUpdatePayload(input) {
  const limitResult = validateParticipationLimit(input.participationLimit);
  if (!limitResult.valid) {
    throw new Error(limitResult.error);
  }

  const linkResult = validateGoogleMapsLink(input.googleMapsLink);
  if (!linkResult.valid) {
    throw new Error(linkResult.error);
  }

  const openTo = input.openTo || 'Open to All';
  const customBreedSpec =
    openTo === 'Please Specify' ? input.customBreedSpec?.trim() || null : null;
  const mapsLink = linkResult.value;

  return {
    title: input.title.trim(),
    date: input.date,
    start_time: input.startTime,
    end_time: input.endTime,
    open_to: openTo,
    custom_breed_spec: customBreedSpec,
    google_maps_link: mapsLink,
    participation_limit: limitResult.value,
  };
}

/** Normalize a DB row for UI consumption. */
export function normalizeMeetupRow(row) {
  if (!row) {
    return null;
  }

  const openTo = row.open_to ?? 'Open to All';
  const customBreedSpec = row.custom_breed_spec ?? null;
  const mapsLink = row.google_maps_link ?? null;

  const hostRows = Array.isArray(row.meetup_hosts) ? row.meetup_hosts : [];
  const participantRows = Array.isArray(row.meetup_participants)
    ? row.meetup_participants
    : [];
  const participantTotal = Number(row.participant_count ?? 0) || 0;

  const normalized = {
    ...row,
    open_to: openTo,
    custom_breed_spec: customBreedSpec,
    google_maps_link: mapsLink,
    participant_count: participantTotal,
    participation_limit: row.participation_limit ?? null,
    meetup_hosts: hostRows,
    meetup_participants: participantRows,
  };

  normalized.hosted_by_line = formatMeetupHostedByLine(normalized);
  return normalized;
}

const MEETUP_SELECT =
  '*, meetup_hosts(pet_id, pets(id, name, breed, photo_url, owner_id)), meetup_participants(pet_id, joined_at, pets(id, name, breed, photo_url, owner_id))';

/**
 * Fetch meetups with normalized host and participant pet embeds.
 * @returns {Promise<MeetupRecord[]>}
 */
export async function fetchMeetups() {
  const { data, error } = await supabase
    .from('meetups')
    .select(MEETUP_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return (data ?? []).map(normalizeMeetupRow);
}

/**
 * Hosted meetups for a user — SAFE for public profile views.
 * Only returns rows where creator (`user_id`) matches the viewed user.
 * Never includes meetups where the user is only a participant.
 */
export async function fetchPublicHostedMeetups(creatorUserId) {
  return fetchHostingMeetups(creatorUserId);
}

/** @alias fetchPublicHostedMeetups — creator-only meetups. */
export async function fetchHostingMeetups(creatorUserId) {
  if (!creatorUserId) {
    return [];
  }
  const { data, error } = await supabase
    .from('meetups')
    .select(MEETUP_SELECT)
    .eq('user_id', creatorUserId)
    .order('date', { ascending: true });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return (data ?? []).map((row) =>
    normalizeMeetupRow({ ...row, is_hosting: true }),
  );
}

/**
 * Going / RSVP meetups — PRIVATE. Only callable for the signed-in user's own profile.
 * @param {string} userId — profile owner whose Going list is requested
 * @param {{ viewerUserId?: string }} [options] — must match userId or returns []
 */
export async function fetchGoingMeetups(userId, options = {}) {
  if (!userId) {
    return [];
  }

  const viewerUserId = options.viewerUserId ?? userId;
  if (String(viewerUserId) !== String(userId)) {
    console.warn('[Meetup] Privacy: blocked Going/RSVP fetch for another user');
    return [];
  }

  const { data, error } = await supabase
    .from('meetup_participants')
    .select(
      `meetup_id, pet_id, meetups(${MEETUP_SELECT}), pets!inner(owner_id)`,
    )
    .eq('pets.owner_id', userId);

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  const rows = (data ?? [])
    .map((row) => row.meetups)
    .filter(Boolean)
    .map((meetup) =>
      normalizeMeetupRow({
        ...meetup,
        viewer_joined: true,
        joined: true,
      }),
    );

  // A user with multiple attending pets still gets one meetup card.
  return [...new Map(rows.map((meetup) => [String(meetup.id), meetup])).values()];
}

const MEETUP_PET_EMBED = `meetups(${MEETUP_SELECT})`;

function getMeetupSortTimestamp(meetup) {
  return getMeetupStartTimestamp(meetup) ?? Number.MAX_SAFE_INTEGER;
}

/** Sort meetups by date + start_time ascending (soonest first). */
export function sortMeetupsByDateAsc(meetups = []) {
  return [...meetups].sort(
    (a, b) => getMeetupSortTimestamp(a) - getMeetupSortTimestamp(b),
  );
}

/** Keep only upcoming meetups (treat missing status as upcoming for legacy rows). */
export function filterUpcomingMeetups(meetups = []) {
  return meetups.filter((meetup) => {
    const status = meetup?.status ?? 'upcoming';
    return status === 'upcoming';
  });
}

async function fetchMeetupRowsFromJunction(table, petId, hosting = false) {
  const embed = MEETUP_PET_EMBED;

  let { data, error } = await supabase
    .from(table)
    .select(`meetup_id, pet_id, ${embed.replace('meetups(', 'meetups!inner(')}`)
    .eq('pet_id', petId)
    .eq('meetups.status', 'upcoming');

  if (error && /status/i.test(error.message ?? '')) {
    ({ data, error } = await supabase
      .from(table)
      .select(`meetup_id, pet_id, ${embed}`)
      .eq('pet_id', petId));
  }

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return (data ?? [])
    .map((row) => row.meetups)
    .filter(Boolean)
    .map((meetup) => {
      const normalized = normalizeMeetupRow(
        hosting ? { ...meetup, is_hosting: true } : meetup,
      );
      if (!hosting) {
        return { ...normalized, viewer_joined: true, joined: true };
      }
      return normalized;
    });
}

/**
 * Meetups where a pet appears in meetup_participants (Going).
 * @param {string} petId
 */
export async function fetchPetParticipatingMeetups(petId) {
  if (!petId) {
    return [];
  }

  const rows = await fetchMeetupRowsFromJunction('meetup_participants', petId, false);
  return sortMeetupsByDateAsc(filterUpcomingMeetups(rows));
}

/**
 * Meetups where a pet appears in meetup_hosts (Hosting).
 * @param {string} petId
 */
export async function fetchPetHostingMeetupsByPet(petId) {
  if (!petId) {
    return [];
  }

  const rows = await fetchMeetupRowsFromJunction('meetup_hosts', petId, true);
  return sortMeetupsByDateAsc(filterUpcomingMeetups(rows));
}

/** Resolve hosting pet ids from the normalized create payload. */
function resolveHostPetIds(input) {
  const source = input?.hostPetIds ?? [];
  if (!Array.isArray(source)) {
    return [];
  }
  return [...new Set(source.map(String).filter(Boolean))];
}

/**
 * Create a meetup row.
 * @param {CreateMeetupInput} input
 * @returns {Promise<MeetupRecord>}
 */
export async function createMeetup(input) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }

  const payload = buildMeetupInsertPayload({ ...input, userId: user.id });

  const petIds = resolveHostPetIds(input);

  if (petIds.length === 0) {
    throw new Error('Choose at least one pet who is hosting.');
  }

  const optionalColumns = [
    'participation_limit',
    'google_maps_link',
    'open_to',
    'custom_breed_spec',
  ];

  let attempt = { ...payload };
  let error;
  let data;

  for (let i = 0; i <= optionalColumns.length; i += 1) {
    ({ data, error } = await supabase.from('meetups').insert(attempt).select('*').single());
    if (!error) {
      break;
    }
    const offending = optionalColumns.find(
      (col) => col in attempt && new RegExp(col, 'i').test(error.message ?? ''),
    );
    if (!offending) {
      break;
    }
    console.warn(`[Meetup] ${offending} column missing — retrying without it.`);
    const { [offending]: _omit, ...rest } = attempt;
    attempt = rest;
  }

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  const hostRows = petIds.map((petId) => ({
    meetup_id: data.id,
    pet_id: petId,
  }));

  const { error: hostError } = await supabase.from('meetup_hosts').insert(hostRows);
  if (hostError) {
    console.error('[Supabase]', hostError);
    await supabase.from('meetups').delete().eq('id', data.id);
    throw hostError;
  }

  // Refetch the normalized row after host triggers enroll host pets as participants.
  const refreshed = await fetchMeetupById(data.id);
  if (!refreshed) {
    throw new Error('Meetup could not be refreshed.');
  }
  return refreshed;
}

/**
 * Update an existing meetup and replace its host pets.
 * @param {string} meetupId
 * @param {CreateMeetupInput} input
 * @returns {Promise<MeetupRecord>}
 */
export async function updateMeetup(meetupId, input) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }
  if (!meetupId) {
    throw new Error('Meetup is required.');
  }

  const petIds = resolveHostPetIds(input);
  if (petIds.length === 0) {
    throw new Error('Choose at least one pet who is hosting.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('meetups')
    .select('id, user_id')
    .eq('id', meetupId)
    .maybeSingle();

  if (existingError) {
    console.error('[Supabase]', existingError);
    throw existingError;
  }

  if (!existing || String(existing.user_id) !== String(user.id)) {
    throw new Error('You can only edit meetups you created.');
  }

  const payload = buildMeetupUpdatePayload(input);

  const optionalColumns = [
    'participation_limit',
    'google_maps_link',
    'open_to',
    'custom_breed_spec',
  ];

  let attempt = { ...payload };
  let error;

  for (let i = 0; i <= optionalColumns.length; i += 1) {
    ({ error } = await supabase
      .from('meetups')
      .update(attempt)
      .eq('id', meetupId)
      .eq('user_id', user.id));
    if (!error) {
      break;
    }
    const offending = optionalColumns.find(
      (col) => col in attempt && new RegExp(col, 'i').test(error.message ?? ''),
    );
    if (!offending) {
      break;
    }
    console.warn(`[Meetup] update ${offending} column missing — retrying without it.`);
    const { [offending]: _omit, ...rest } = attempt;
    attempt = rest;
  }

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  const { error: deleteHostsError } = await supabase
    .from('meetup_hosts')
    .delete()
    .eq('meetup_id', meetupId);

  if (deleteHostsError) {
    console.error('[Supabase]', deleteHostsError);
    throw deleteHostsError;
  }

  const hostRows = petIds.map((petId) => ({
    meetup_id: meetupId,
    pet_id: petId,
  }));

  const { error: hostError } = await supabase.from('meetup_hosts').insert(hostRows);
  if (hostError) {
    console.error('[Supabase]', hostError);
    throw hostError;
  }

  const refreshed = await fetchMeetupById(meetupId);
  if (!refreshed) {
    throw new Error('Meetup could not be refreshed.');
  }
  return { ...refreshed, is_hosting: true };
}

/**
 * RSVP a pet to a meetup (insert into meetup_participants).
 * @param {string} meetupId
 * @param {string} petId
 * @returns {Promise<{ joined: boolean }>}
 */
export async function joinMeetup(meetupId, petId) {
  return joinMeetupWithPets(meetupId, [petId]);
}

/**
 * Cancel a pet's RSVP (remove from meetup_participants).
 * @param {string} meetupId
 * @param {string} petId
 * @returns {Promise<{ joined: boolean }>}
 */
export async function leaveMeetup(meetupId, petId) {
  return leaveMeetupWithPets(meetupId, [petId]);
}

/**
 * Pet ids from a meetup that belong to the signed-in user (any of ownedPetIds).
 * Used for viewer_joined / "You're Going" state across multiple pets.
 * @param {object} meetup
 * @param {string[]} ownedPetIds
 * @returns {string[]}
 */
export function extractViewerJoinedPetIds(meetup, ownedPetIds = []) {
  const attendeeIds = new Set(extractMeetupAttendeePetIds(meetup));
  return (ownedPetIds ?? [])
    .map(String)
    .filter((id) => attendeeIds.has(id));
}

/**
 * True when ANY of the user's pets appear in meetup_participants.
 * @param {object} meetup
 * @param {string[]} ownedPetIds
 * @returns {boolean}
 */
export function hasViewerJoinedMeetup(meetup, ownedPetIds = []) {
  return extractViewerJoinedPetIds(meetup, ownedPetIds).length > 0;
}

/**
 * RSVP multiple pets to a meetup (upsert — skips pets already joined).
 * @param {string} meetupId
 * @param {string[]} petIdsArray
 * @param {{ meetup?: object, viewerPets?: object[] }} [demoContext]
 * @returns {Promise<{ joined: boolean, petIds: string[], meetup: MeetupRecord }>}
 */
export async function joinMeetupWithPets(meetupId, petIdsArray, demoContext = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }
  if (!meetupId) {
    throw new Error('Meetup is required.');
  }

  const petIds = [...new Set((petIdsArray ?? []).map(String).filter(Boolean))];

  if (isDemoMeetupId(meetupId)) {
    if (
      !__DEV__ ||
      !demoContext.meetup ||
      String(demoContext.meetup.id) !== String(meetupId)
    ) {
      throw new Error('Demo meetups are previews. RSVP requires a saved meetup.');
    }
    const refreshedMeetup = joinDemoMeetupWithPets(
      demoContext.meetup,
      demoContext.viewerPets ?? [],
      petIds,
    );
    return { joined: petIds.length > 0, petIds, meetup: refreshedMeetup };
  }

  if (petIds.length === 0) {
    throw new Error('Choose at least one pet to bring.');
  }

  const { data: ownedPets, error: petsError } = await supabase
    .from('pets')
    .select('id')
    .eq('owner_id', user.id)
    .in('id', petIds);

  if (petsError) {
    console.error('[Supabase]', petsError);
    throw petsError;
  }

  const ownedIds = new Set((ownedPets ?? []).map((row) => String(row.id)));
  if (ownedIds.size !== petIds.length) {
    throw new Error('One or more pets do not belong to your account.');
  }

  const rows = petIds.map((petId) => ({
    meetup_id: meetupId,
    pet_id: petId,
  }));

  // The composite conflict target makes retries safe without a pre-read.
  // Database triggers remain solely responsible for participant_count.
  const { error } = await supabase.from('meetup_participants').upsert(rows, {
    onConflict: 'meetup_id,pet_id',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  const refreshedMeetup = await fetchMeetupById(meetupId);
  if (!refreshedMeetup) {
    throw new Error('Meetup could not be refreshed.');
  }

  return { joined: true, petIds, meetup: refreshedMeetup };
}

/**
 * Remove multiple pets from a meetup (RSVP cancel).
 * @param {string} meetupId
 * @param {string[]} petIdsArray
 * @param {{ meetup?: object, viewerPets?: object[] }} [demoContext]
 * @returns {Promise<{ joined: boolean, petIds: string[], meetup?: MeetupRecord }>}
 */
export async function leaveMeetupWithPets(meetupId, petIdsArray, demoContext = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }
  if (!meetupId) {
    throw new Error('Meetup is required.');
  }

  const petIds = [...new Set((petIdsArray ?? []).map(String).filter(Boolean))];
  if (petIds.length === 0) {
    const refreshedMeetup = isDemoMeetupId(meetupId)
      ? null
      : await fetchMeetupById(meetupId);
    return { joined: false, petIds: [], meetup: refreshedMeetup };
  }

  if (isDemoMeetupId(meetupId)) {
    if (
      !__DEV__ ||
      !demoContext.meetup ||
      String(demoContext.meetup.id) !== String(meetupId)
    ) {
      throw new Error('Demo meetups are previews. RSVP requires a saved meetup.');
    }
    const refreshedMeetup = leaveDemoMeetupWithPets(
      demoContext.meetup,
      demoContext.viewerPets ?? [],
      petIds,
    );
    return { joined: false, petIds, meetup: refreshedMeetup };
  }

  const { data: ownedPets, error: petsError } = await supabase
    .from('pets')
    .select('id')
    .eq('owner_id', user.id)
    .in('id', petIds);

  if (petsError) {
    console.error('[Supabase]', petsError);
    throw petsError;
  }

  const ownedIds = new Set((ownedPets ?? []).map((row) => String(row.id)));
  const allowedPetIds = petIds.filter((id) => ownedIds.has(String(id)));
  if (allowedPetIds.length === 0) {
    throw new Error('No valid pets to remove.');
  }

  // Host pets stay on the meetup until Edit or Cancel — leave only removes joiners.
  const { data: hostRows, error: hostsError } = await supabase
    .from('meetup_hosts')
    .select('pet_id')
    .eq('meetup_id', meetupId)
    .in('pet_id', allowedPetIds);

  if (hostsError) {
    console.error('[Supabase]', hostsError);
    throw hostsError;
  }

  const hostPetIds = new Set((hostRows ?? []).map((row) => String(row.pet_id)));
  const removablePetIds = allowedPetIds.filter(
    (petId) => !hostPetIds.has(String(petId)),
  );
  if (removablePetIds.length === 0) {
    throw new Error('Hosting pets must be changed from Edit or Cancel Event.');
  }

  const { error } = await supabase
    .from('meetup_participants')
    .delete()
    .eq('meetup_id', meetupId)
    .in('pet_id', removablePetIds);

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  const refreshedMeetup = await fetchMeetupById(meetupId);
  if (!refreshedMeetup) {
    throw new Error('Meetup could not be refreshed.');
  }

  return { joined: false, petIds: removablePetIds, meetup: refreshedMeetup };
}

/** True when id is not a Supabase UUID (demo / seed rows). */
export function isDemoMeetupId(meetupId) {
  return !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(meetupId ?? ''),
  );
}

/**
 * Host pet ids from the normalized meetup_hosts embed.
 * @param {object} meetup
 * @returns {string[]}
 */
export function extractMeetupHostPetIds(meetup) {
  return (meetup?.meetup_hosts ?? [])
    .map((row) => row?.pet_id)
    .filter(Boolean)
    .map(String);
}

function petFromParticipantRow(row) {
  const pet = row?.pets;
  const id = pet?.id ?? row?.pet_id;
  if (!id) {
    return null;
  }
  return {
    id: String(id),
    name: String(pet?.name ?? '').trim() || 'Pet',
    breed: pet?.breed ?? null,
    photo_url: pet?.photo_url ?? null,
  };
}

/**
 * Every attending pet from the normalized meetup_participants embed.
 * The returned list matches the rows represented by participant_count.
 * @returns {Array<{ id: string, name: string, breed?: string, photo_url?: string|null }>}
 */
export function extractMeetupParticipantPets(meetup) {
  const seen = new Set();
  const pets = [];
  const rows = meetup?.meetup_participants ?? [];

  for (const row of rows) {
    const pet = petFromParticipantRow(row);
    if (!pet || seen.has(pet.id)) {
      continue;
    }
    seen.add(pet.id);
    pets.push(pet);
  }

  return pets;
}

/**
 * Joiners only — pets in meetup_participants who are NOT hosts.
 * Hosts appear under "Hosted by"; this list is for RSVPs beyond hosting.
 * @returns {Array<{ id: string, name: string, breed?: string, photo_url?: string|null }>}
 */
export function extractMeetupJoinerPets(meetup) {
  const hostIds = new Set(extractMeetupHostPetIds(meetup));
  const seen = new Set();
  const pets = [];
  const rows = meetup?.meetup_participants ?? [];

  for (const row of rows) {
    const pet = petFromParticipantRow(row);
    if (!pet || hostIds.has(pet.id) || seen.has(pet.id)) {
      continue;
    }
    seen.add(pet.id);
    pets.push(pet);
  }

  return pets;
}

/**
 * All attending pet ids (hosts + joiners) from meetup_participants embed.
 * Used to determine if the active pet has joined.
 * @returns {string[]}
 */
export function extractMeetupAttendeePetIds(meetup) {
  const rows = meetup?.meetup_participants ?? [];
  return rows
    .map((row) => String(row?.pet_id ?? row?.pets?.id ?? ''))
    .filter(Boolean);
}

/**
 * Fetch a single meetup with hosts and participants embedded.
 * @param {string} meetupId
 * @returns {Promise<MeetupRecord|null>}
 */
export async function fetchMeetupById(meetupId) {
  if (!meetupId) {
    return null;
  }

  const { data, error } = await supabase
    .from('meetups')
    .select(MEETUP_SELECT)
    .eq('id', meetupId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return data ? normalizeMeetupRow(data) : null;
}

/**
 * Cancel a meetup (creator only). Assumes `status` column exists.
 * @param {string} meetupId
 */
export async function cancelMeetup(meetupId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }
  if (!meetupId) {
    throw new Error('Meetup is required.');
  }

  const { data, error } = await supabase
    .from('meetups')
    .update({ status: 'cancelled' })
    .eq('id', meetupId)
    .eq('user_id', user.id)
    .select('id, status');

  if (error) {
    if (/status/i.test(error.message ?? '')) {
      throw new Error('Cancel is not available until the status migration is applied.');
    }
    console.error('[Supabase]', error);
    throw error;
  }

  // Confirm the update actually cancelled this creator's row (RLS / race safe).
  if (!Array.isArray(data) || data.length !== 1 || data[0]?.status !== 'cancelled') {
    throw new Error('Meetup could not be cancelled. It may no longer be available.');
  }

  return { cancelled: true, meetupId: String(data[0].id) };
}

/** Whether a meetup date/time has passed. */
export function isMeetupPast(meetup) {
  if (!meetup?.date) {
    return false;
  }
  if (meetup?.status === 'completed') {
    return true;
  }

  const dateStr = String(meetup.date).split('T')[0];
  const timeStr = String(meetup.end_time ?? meetup.start_time ?? '23:59:59').slice(0, 8);
  const endAt = new Date(`${dateStr}T${timeStr}`);
  return !Number.isNaN(endAt.getTime()) && endAt.getTime() < Date.now();
}
