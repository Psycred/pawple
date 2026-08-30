/**
 * Phase-1 content reports (Founder F / PAW-47).
 * Filed in the name of a reporter pet; flags the human account (reported_user_id).
 * Mating-session targets are deferred — schema only allows moment | meetup.
 */

import { supabase } from '../config/supabase';

/** Calm reason labels aligned with Community Guidelines v1 — no AI moderation claims. */
export const REPORT_REASONS = [
  { id: 'nudity', label: 'Nudity or sexual content' },
  { id: 'hate', label: 'Hate or harassment' },
  { id: 'violence', label: 'Violence or animal abuse' },
  { id: 'minors', label: 'Minors at risk' },
  { id: 'spam', label: 'Spam or scam' },
  { id: 'misinfo', label: 'Harmful misinformation' },
  { id: 'other', label: 'Something else' },
];

export const REPORT_TARGET_TYPES = Object.freeze({
  moment: 'moment',
  meetup: 'meetup',
});

/**
 * @param {{
 *   reporterPetId: string,
 *   targetType: 'moment' | 'meetup',
 *   targetId: string,
 *   reportedUserId: string,
 *   reason: string,
 *   details?: string | null,
 * }} input
 */
export async function createReport(input) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sign in to report.');
  }

  const reporterPetId = String(input?.reporterPetId ?? '').trim();
  const targetType = String(input?.targetType ?? '').trim();
  const targetId = String(input?.targetId ?? '').trim();
  const reportedUserId = String(input?.reportedUserId ?? '').trim();
  const reason = String(input?.reason ?? '').trim();
  const detailsRaw = input?.details != null ? String(input.details).trim() : '';

  if (!reporterPetId) {
    throw new Error('Choose a pet to report as.');
  }
  if (targetType !== 'moment' && targetType !== 'meetup') {
    throw new Error('Unsupported report target.');
  }
  if (!targetId) {
    throw new Error('Missing content to report.');
  }
  if (!reportedUserId) {
    throw new Error('Missing account to flag.');
  }
  if (!reason) {
    throw new Error('Choose a reason.');
  }
  if (String(reportedUserId) === String(user.id)) {
    throw new Error('You cannot report your own content.');
  }

  const payload = {
    reporter_user_id: user.id,
    reporter_pet_id: reporterPetId,
    target_type: targetType,
    target_id: targetId,
    reported_user_id: reportedUserId,
    reason,
    details: detailsRaw || null,
    status: 'open',
  };

  const { data, error } = await supabase.from('reports').insert(payload).select('id').single();
  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }
  return data;
}
