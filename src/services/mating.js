/**
 * Mating discovery client — PAW-61 / PAW-60 contract.
 * Server-authoritative eligibility, Paw, mutual unlock. No client channel create.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasPassedAgeGate } from '../lib/ageGate';
import {
  INTRO_CHAT_LINK_FORBIDDEN_MESSAGE,
  introductionMessageBodyContainsLink,
} from '../lib/introChatLinkGuard';
import { supabase } from '../config/supabase';
import {
  MATING_CHAT_DISCLAIMER,
  MATING_CHAT_DISCLAIMER_TITLE,
  MATING_COMPANIONSHIP_OFF_CONFIRM_ACTION,
  MATING_COMPANIONSHIP_OFF_CONFIRM_BODY,
  MATING_COMPANIONSHIP_OFF_CONFIRM_CANCEL,
  MATING_COMPANIONSHIP_OFF_CONFIRM_TITLE,
  MATING_DISCOVER_EMPTY_NO_MATCHES_BODY,
  MATING_DISCOVER_EMPTY_NO_MATCHES_TITLE,
  MATING_DISCOVER_EMPTY_STALE_LOCATION_BODY,
  MATING_DISCOVER_EMPTY_STALE_LOCATION_TITLE,
  MATING_DISCOVER_TAB_ACCESSIBILITY_LABEL,
  MATING_DISCOVER_TAB_LABEL,
  MATING_CHAT_TAB_LABEL,
  MATING_FIXED_DISCOVERY_RADIUS_KM,
  MATING_OPT_IN_DISCLAIMER,
  MATING_OPT_IN_DISCLAIMER_TITLE,
  formatMatingChatHeaderTitle,
} from '../content/legalDocuments';

export const MATING_RADIUS_KM_OPTIONS = Object.freeze([5, 10, 25, 50]);
export const DEFAULT_MATING_RADIUS_KM = 25;
/** Phase 1a server-fixed discovery radius (Founder f67e783b). */
export const PHASE1A_MATING_RADIUS_KM = MATING_FIXED_DISCOVERY_RADIUS_KM;
/** Dormant — 5/10/25/50 picker code preserved but not shown as a product choice. */
export const SHOW_MATING_RADIUS_PICKER = false;
export const MATING_DESCRIPTION_MAX = 200;

export {
  MATING_CHAT_DISCLAIMER,
  MATING_CHAT_DISCLAIMER_TITLE,
  MATING_COMPANIONSHIP_OFF_CONFIRM_ACTION,
  MATING_COMPANIONSHIP_OFF_CONFIRM_BODY,
  MATING_COMPANIONSHIP_OFF_CONFIRM_CANCEL,
  MATING_COMPANIONSHIP_OFF_CONFIRM_TITLE,
  MATING_DISCOVER_EMPTY_NO_MATCHES_BODY,
  MATING_DISCOVER_EMPTY_NO_MATCHES_TITLE,
  MATING_DISCOVER_EMPTY_STALE_LOCATION_BODY,
  MATING_DISCOVER_EMPTY_STALE_LOCATION_TITLE,
  MATING_DISCOVER_TAB_ACCESSIBILITY_LABEL,
  MATING_DISCOVER_TAB_LABEL,
  MATING_CHAT_TAB_LABEL,
  MATING_FIXED_DISCOVERY_RADIUS_KM,
  MATING_OPT_IN_DISCLAIMER,
  MATING_OPT_IN_DISCLAIMER_TITLE,
  formatMatingChatHeaderTitle,
};

export { INTRO_CHAT_LINK_FORBIDDEN_MESSAGE, introductionMessageBodyContainsLink };

function throwIntroChatLinkForbidden(cause) {
  const err = new Error('link_sharing_forbidden');
  err.code = 'link_sharing_forbidden';
  err.userMessage = INTRO_CHAT_LINK_FORBIDDEN_MESSAGE;
  if (cause) {
    err.cause = cause;
  }
  throw err;
}

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
function isBenignMatingOpportunitiesError(error) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? error?.hint ?? '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes('does not exist') ||
    message.includes('not found') ||
    message.includes('age_attestation') ||
    message.includes('age_gate')
  );
}

export async function fetchMatingOpportunities(viewerPetId) {
  if (!viewerPetId) {
    return [];
  }

  try {
    await assertClientMatingAgeOk();
  } catch (ageError) {
    if (ageError?.code === 'age_gate_required') {
      return [];
    }
    throw ageError;
  }

  const { data, error } = await supabase.rpc('get_mating_opportunities', {
    viewer_pet_id: viewerPetId,
  });

  if (error) {
    console.error('[Supabase]', error);
    if (isBenignMatingOpportunitiesError(error)) {
      return [];
    }
    const wrapped = new Error(mapRpcError(error, "Couldn't load opportunities."));
    wrapped.cause = error;
    throw wrapped;
  }

  return data ?? [];
}

/**
 * Parent-level list of open pet-pair introduction channels (~km, no human names).
 * @returns {Promise<Array<object>>}
 */
export async function fetchMyIntroductionChannels() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return [];
  }

  const { data, error } = await supabase.rpc('list_my_introduction_channels');

  if (error) {
    console.error('[Supabase]', error);
    const wrapped = new Error("Couldn't load chats.");
    wrapped.cause = error;
    throw wrapped;
  }

  return data ?? [];
}

/**
 * Participant-safe chat payload. Report-frozen channels return asymmetric views.
 * @param {string} channelId
 * @returns {Promise<object|null>}
 */
export async function getIntroductionChatView(channelId) {
  if (!channelId) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_introduction_chat_view', {
    p_channel_id: channelId,
  });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  return data ?? null;
}

/**
 * After a filed introduction_chat report: clear mutual Paw and freeze the channel.
 * @param {string} channelId
 * @param {string} reporterPetId
 */
/**
 * User-initiated delete of an open introduction chat — bilateral Paw clear + open teardown.
 * @param {string} channelId
 * @param {string} viewerPetId owned pet participating in the channel
 */
export async function deleteOpenIntroductionChat(channelId, viewerPetId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to continue.');
  }

  const { data, error } = await supabase.rpc('delete_open_introduction_chat', {
    p_channel_id: channelId,
    p_viewer_pet_id: viewerPetId,
  });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  return data;
}

export async function terminateIntroductionChatAfterReport(channelId, reporterPetId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to continue.');
  }

  const { data, error } = await supabase.rpc('terminate_introduction_chat_after_report', {
    p_channel_id: channelId,
    p_reporter_pet_id: reporterPetId,
  });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  return data;
}

/**
 * Locally suppressed channel_id while dismiss_reported_introduction_chat retries.
 * Written before the RPC so B's UI stays hidden even when the network fails.
 */
export const PENDING_REPORT_CHAT_DISMISS_KEY = '@pawple/report_chat_dismiss_pending';

/** Fast poll while a thread is open — reported party must not see stale identity. */
export const INTRODUCTION_CHAT_VIEW_POLL_MS = 1500;

/**
 * Reporter: hide post-report thread from Chat after exit.
 * Reported party: consume one-time anonymous ended state.
 * @param {string} channelId
 */
export async function dismissReportedIntroductionChat(channelId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to continue.');
  }

  const { data, error } = await supabase.rpc('dismiss_reported_introduction_chat', {
    p_channel_id: channelId,
  });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  return data;
}

/**
 * @returns {Promise<string|null>} channel_id locally hidden until dismiss RPC succeeds
 */
export async function getLocallySuppressedReportChatDismissChannelId() {
  const channelId = await AsyncStorage.getItem(PENDING_REPORT_CHAT_DISMISS_KEY);
  const trimmed = String(channelId ?? '').trim();
  return trimmed || null;
}

/**
 * Hide a reported-chat channel locally before attempting server dismiss.
 * @param {string} channelId
 */
export async function suppressReportChatDismissLocally(channelId) {
  if (!channelId) {
    return;
  }
  await AsyncStorage.setItem(PENDING_REPORT_CHAT_DISMISS_KEY, String(channelId));
}

/**
 * Remove locally suppressed report-dismiss channels from list rows.
 * @param {object[]} rows
 * @param {string|null} suppressedChannelId
 */
export function excludeLocallySuppressedReportChatChannels(rows, suppressedChannelId) {
  if (!suppressedChannelId) {
    return rows ?? [];
  }
  const suppressed = String(suppressedChannelId);
  return (rows ?? []).filter(
    (row) => String(row.channel_id ?? row.id ?? '') !== suppressed,
  );
}

/**
 * Retry any dismiss that did not finish before the app was killed.
 */
export async function flushPendingReportChatDismiss() {
  try {
    const channelId = await getLocallySuppressedReportChatDismissChannelId();
    if (!channelId) {
      return;
    }
    await dismissReportedIntroductionChat(channelId);
    await AsyncStorage.removeItem(PENDING_REPORT_CHAT_DISMISS_KEY);
  } catch (e) {
    console.error('[Mating] flush pending report chat dismiss', e);
  }
}

/**
 * Suppress locally, then dismiss — survives background/kill when the RPC cannot finish.
 * @param {string} channelId
 */
export async function consumeReportedIntroductionChatDismissal(channelId) {
  if (!channelId) {
    return null;
  }
  await suppressReportChatDismissLocally(channelId);
  try {
    const result = await dismissReportedIntroductionChat(channelId);
    await AsyncStorage.removeItem(PENDING_REPORT_CHAT_DISMISS_KEY);
    return result;
  } catch (e) {
    console.error('[Mating] consume report chat dismissal', e);
    throw e;
  }
}

/**
 * Discovery context for honest empty states (no coordinates exposed).
 * @param {string} viewerPetId
 * @returns {Promise<{ opted_in: boolean, location_fresh: boolean }>}
 */
export async function fetchMatingDiscoveryContext(viewerPetId) {
  if (!viewerPetId) {
    return { opted_in: false, location_fresh: false };
  }

  const { data, error } = await supabase.rpc('get_mating_discovery_context', {
    viewer_pet_id: viewerPetId,
  });

  if (error) {
    console.error('[Supabase]', error);
    // RPC may not be deployed yet — avoid false stale-location empty.
    return { opted_in: true, location_fresh: true };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    opted_in: Boolean(row?.opted_in),
    location_fresh: Boolean(row?.location_fresh),
  };
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
 * Bilateral mutual UnPaw — clears both Paw directions and open channel only.
 * @param {string} viewerPetId owned pet initiating UnPaw
 * @param {string} otherPetId the other pet in the mutual pair
 */
export async function unpawMutualIntroduction(viewerPetId, otherPetId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to continue.');
  }

  const { data, error } = await supabase.rpc('unpaw_mutual_introduction', {
    p_viewer_pet_id: viewerPetId,
    p_other_pet_id: otherPetId,
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
 * Inbound Paw from another pet toward an owned recipient pet.
 */
export async function fetchInboundPaw(fromPetId, toPetId) {
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
 * Batch paw metadata for Discover cards — two queries regardless of candidate count.
 * Outbound rows win for interestByCandidate (report target alignment).
 * @returns {{ ok: boolean, outbound: Set<string>, interestByCandidate: Record<string, string> }}
 */
export async function fetchDiscoverPawState(viewerPetId, candidatePetIds) {
  const viewerKey = String(viewerPetId ?? '');
  const ids = [...new Set((candidatePetIds ?? []).map(String).filter(Boolean))];
  const empty = { ok: true, outbound: new Set(), interestByCandidate: {} };

  if (!viewerKey || !ids.length) {
    return empty;
  }

  const [outboundRes, inboundRes] = await Promise.all([
    supabase
      .from('paw_interests')
      .select('id, from_pet_id, to_pet_id')
      .eq('from_pet_id', viewerKey)
      .in('to_pet_id', ids),
    supabase
      .from('paw_interests')
      .select('id, from_pet_id, to_pet_id')
      .eq('to_pet_id', viewerKey)
      .in('from_pet_id', ids),
  ]);

  if (outboundRes.error || inboundRes.error) {
    console.error('[Supabase]', outboundRes.error ?? inboundRes.error);
    return { ok: false, outbound: new Set(), interestByCandidate: {} };
  }

  const outbound = new Set();
  const interestByCandidate = {};

  for (const row of outboundRes.data ?? []) {
    const candidateKey = String(row.to_pet_id);
    outbound.add(candidateKey);
    interestByCandidate[candidateKey] = row.id;
  }

  for (const row of inboundRes.data ?? []) {
    const candidateKey = String(row.from_pet_id);
    if (!interestByCandidate[candidateKey]) {
      interestByCandidate[candidateKey] = row.id;
    }
  }

  return { ok: true, outbound, interestByCandidate };
}

/**
 * Recipient dismisses one inbound Paw quietly (Not for me).
 * Deletes only the sender→recipient row. No notification.
 */
export async function dismissIncomingPaw(recipientPetId, senderPetId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to continue.');
  }

  const { data, error } = await supabase.rpc('dismiss_incoming_paw', {
    recipient_pet_id: recipientPetId,
    sender_pet_id: senderPetId,
  });

  if (error) {
    console.error('[Supabase]', error);
    const msg = String(error?.message ?? error?.hint ?? '');
    if (msg.includes('mutual_paw_active')) {
      const wrapped = new Error('mutual_paw_active');
      wrapped.userMessage = "Couldn't dismiss this introduction.";
      wrapped.cause = error;
      throw wrapped;
    }
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
 * Inbound Paw rows for the Chat hub Interested carousel (not owner profile UI).
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
 * Server-derived mutuality with explicit RPC trust for fail-closed filters.
 * @returns {Promise<{ mutual: boolean, ok: boolean }>}
 */
export async function queryMutualPaw(petA, petB) {
  if (!petA || !petB) {
    return { mutual: false, ok: true };
  }
  const { data, error } = await supabase.rpc('pets_have_mutual_paw', {
    pet_x: petA,
    pet_y: petB,
  });
  if (error) {
    console.error('[Supabase]', error);
    return { mutual: false, ok: false };
  }
  return { mutual: Boolean(data), ok: true };
}

/**
 * Server-derived mutuality — UI must still fail closed on channel status.
 */
export async function petsHaveMutualPaw(petA, petB) {
  const { mutual, ok } = await queryMutualPaw(petA, petB);
  if (!ok) {
    return false;
  }
  return mutual;
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
  if (introductionMessageBodyContainsLink(trimmed)) {
    throwIntroChatLinkForbidden();
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
    const msg = String(error?.message ?? error?.hint ?? error?.details ?? '');
    if (msg.includes('link_sharing_forbidden')) {
      throwIntroChatLinkForbidden(error);
    }
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
