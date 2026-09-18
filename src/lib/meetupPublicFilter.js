/**
 * Pure helpers for public meetup list filtering (Fix 2 / PAW-28).
 * No Supabase or React Native dependencies — safe for unit tests.
 *
 * Meetup date/start_time/end_time are venue-local wall-clock values.
 * Phase 1 (India launch) uses Asia/Kolkata for authoritative past checks.
 */

/** @type {'Asia/Kolkata'} */
export const MEETUP_WALL_CLOCK_TIMEZONE = 'Asia/Kolkata';

/** Fixed offset for Asia/Kolkata (no DST). */
export const MEETUP_WALL_CLOCK_UTC_OFFSET = '+05:30';

/**
 * ISO-8601 instant string for meetup end wall-clock in the venue timezone.
 * @param {object} meetup
 */
export function meetupEndWallClockIso(meetup) {
  const dateStr = String(meetup?.date ?? '').split('T')[0];
  const timeStr = String(meetup?.end_time ?? meetup?.start_time ?? '23:59:59').slice(0, 8);
  return `${dateStr}T${timeStr}${MEETUP_WALL_CLOCK_UTC_OFFSET}`;
}

/**
 * Parse meetup date + start_time into epoch ms; null when unparseable.
 * @param {object} meetup
 * @returns {number|null}
 */
export function getMeetupStartTimestamp(meetup) {
  const dateStr = String(meetup?.date ?? '').split('T')[0];
  const timeStr = String(meetup?.start_time ?? '00:00:00').slice(0, 8);
  const parsed = new Date(`${dateStr}T${timeStr}`);
  const ts = parsed.getTime();
  return Number.isNaN(ts) ? null : ts;
}

/**
 * True when a meetup may appear in public Feed/profile lists.
 * Showable = status upcoming (legacy rows without status count as upcoming),
 * scheduled start strictly in the future.
 *
 * Beta rule: meetups disappear when start time is reached — no "happening now"
 * visibility. Uses start > now, not >=.
 *
 * @param {object} meetup
 * @param {number} [nowMs=Date.now()]
 */
export function isShowablePublicMeetup(meetup, nowMs = Date.now()) {
  const status = meetup?.status ?? 'upcoming';
  if (status !== 'upcoming') {
    return false;
  }
  const startTs = getMeetupStartTimestamp(meetup);
  if (startTs == null) {
    return false;
  }
  return startTs > nowMs;
}

/**
 * Client-side filter for public views — upcoming status and future start only.
 * Do not apply to private My Meetups Going/Hosting lists or meetup counts.
 *
 * @param {object[]} meetups
 * @param {number} [nowMs=Date.now()]
 * @returns {object[]}
 */
export function filterShowablePublicMeetups(meetups = [], nowMs = Date.now()) {
  return meetups.filter((meetup) => isShowablePublicMeetup(meetup, nowMs));
}

/** Whether a meetup end (or start) wall-clock time has passed at the venue. */
export function isMeetupPast(meetup, nowMs = Date.now()) {
  if (!meetup?.date) {
    return false;
  }
  if (meetup?.status === 'completed') {
    return true;
  }

  const endAt = new Date(meetupEndWallClockIso(meetup)).getTime();
  return !Number.isNaN(endAt) && endAt < nowMs;
}

/** True when participant_count is frozen (history lock or past/completed meetup). */
export function usesFrozenParticipantCount(meetup) {
  return Boolean(meetup?.history_locked_at) || isMeetupPast(meetup);
}

/**
 * Participant total for display — frozen server count on past/locked meetups;
 * visible embed count for active upcoming meetups.
 * @param {object} meetup
 * @param {number} visibleParticipantCount
 */
export function getMeetupParticipantDisplayCount(meetup, visibleParticipantCount = 0) {
  if (usesFrozenParticipantCount(meetup)) {
    return Number(meetup?.participant_count ?? 0) || 0;
  }
  return visibleParticipantCount;
}
