/**
 * Pure helpers for public meetup list filtering (Fix 2 / PAW-28).
 * No Supabase or React Native dependencies — safe for unit tests.
 */

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
