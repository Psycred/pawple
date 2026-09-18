/**
 * Shared Meetup reminder timing + copy (Phase 1A / 10B-B.7a).
 * Meetup date/start_time are wall-clock values; fire times use recipient IANA timezone.
 */

export const MEETUP_REMINDER_EVENING_HOUR = 20;
export const MEETUP_REMINDER_MORNING_HOUR = 8;
/** Start times at or after this (minutes from midnight) use 8:00 AM morning slot. */
export const MEETUP_REMINDER_LATE_MORNING_START_MINUTES = 10 * 60;
export const MEETUP_REMINDER_KINDS = Object.freeze({
  EVENING_BEFORE: 'evening-before',
  MORNING_OF: 'morning-of',
});

/**
 * @returns {string|null} IANA timezone from the device, or null when unavailable.
 */
export function getDeviceIanaTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz.trim() ? tz.trim() : null;
  } catch {
    return null;
  }
}

/**
 * @param {string|null|undefined} timezone
 * @returns {boolean}
 */
export function isValidIanaTimezone(timezone) {
  const trimmed = String(timezone ?? '').trim();
  if (!trimmed) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string|null|undefined} dateStr YYYY-MM-DD
 * @returns {string|null}
 */
export function parseMeetupDateOnly(dateStr) {
  const part = String(dateStr ?? '').split('T')[0];
  const match = part.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return part;
}

/**
 * @param {string|null|undefined} timeStr HH:MM or HH:MM:SS
 * @returns {{ hours: number, minutes: number } | null}
 */
export function parseMeetupWallClockTime(timeStr) {
  const raw = String(timeStr ?? '').slice(0, 8);
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return { hours, minutes };
}

export function meetupStartMinutesFromMidnight(startTime) {
  const parsed = parseMeetupWallClockTime(startTime);
  if (!parsed) {
    return null;
  }
  return parsed.hours * 60 + parsed.minutes;
}

/**
 * Format meetup start_time for reminder copy — e.g. "2:30 PM".
 * @param {string|null|undefined} startTime
 */
export function formatMeetupReminderClockTime(startTime) {
  const parsed = parseMeetupWallClockTime(startTime);
  if (!parsed) {
    return 'the scheduled time';
  }
  const period = parsed.hours >= 12 ? 'PM' : 'AM';
  const hour12 = parsed.hours % 12 || 12;
  const minutes = String(parsed.minutes).padStart(2, '0');
  return `${hour12}:${minutes} ${period}`;
}

/**
 * Format meetup date for reminder copy — e.g. "15 Oct 2026".
 * @param {string|null|undefined} dateStr
 */
export function formatMeetupReminderDate(dateStr) {
  const iso = parseMeetupDateOnly(dateStr);
  if (!iso) {
    return 'the scheduled date';
  }
  const [year, month, day] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return utc.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * @param {'host'|'joiner'} role
 * @param {{ city?: string|null, date?: string|null, start_time?: string|null }} meetup
 */
export function buildMeetupReminderBody(meetup, role) {
  const city = String(meetup?.city ?? '').trim() || 'your city';
  const timeLabel = formatMeetupReminderClockTime(meetup?.start_time);
  const dateLabel = formatMeetupReminderDate(meetup?.date);

  if (role === 'host') {
    return `You're hosting a Meetup in ${city} at ${timeLabel} on ${dateLabel}.`;
  }
  return `You have an upcoming Meetup in ${city} at ${timeLabel} on ${dateLabel}.`;
}

export function buildMeetupReminderEventKey(meetupId, role, kind) {
  return `meetup-reminder:${String(meetupId)}:${role}:${kind}`;
}

function getTimezoneOffsetMinutesAt(utcDate, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(utcDate);
  const mapped = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      mapped[part.type] = part.value;
    }
  }
  const asUtc = Date.UTC(
    Number(mapped.year),
    Number(mapped.month) - 1,
    Number(mapped.day),
    Number(mapped.hour),
    Number(mapped.minute),
    Number(mapped.second),
  );
  return (asUtc - utcDate.getTime()) / 60000;
}

function addDaysToIsoDate(isoDate, dayDelta) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + dayDelta);
  return utc.toISOString().slice(0, 10);
}

/**
 * Wall-clock local time in recipient timezone → UTC Date.
 * @param {string} isoDate YYYY-MM-DD
 * @param {number} hours 0-23
 * @param {number} minutes 0-59
 * @param {string} timeZone IANA
 */
export function wallClockToUtcDate(isoDate, hours, minutes, timeZone) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offsetMinutes = getTimezoneOffsetMinutesAt(noonUtc, timeZone);
  const fireUtcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - offsetMinutes * 60 * 1000;
  return new Date(fireUtcMs);
}

/**
 * Evening-before: 8:00 PM on the calendar day before the Meetup date.
 */
export function computeEveningBeforeReminderFireAt(meetup, recipientTimezone, nowMs = Date.now()) {
  const isoDate = parseMeetupDateOnly(meetup?.date);
  const tz = String(recipientTimezone ?? '').trim();
  if (!isoDate || !isValidIanaTimezone(tz)) {
    return null;
  }
  const previousDay = addDaysToIsoDate(isoDate, -1);
  const fireAt = wallClockToUtcDate(
    previousDay,
    MEETUP_REMINDER_EVENING_HOUR,
    0,
    tz,
  );
  if (fireAt.getTime() <= nowMs) {
    return null;
  }
  return fireAt;
}

/**
 * Morning-of: before 10:00 AM start → 2 hours before start; otherwise 8:00 AM on Meetup date.
 */
export function computeMorningOfReminderFireAt(meetup, recipientTimezone, nowMs = Date.now()) {
  const isoDate = parseMeetupDateOnly(meetup?.date);
  const tz = String(recipientTimezone ?? '').trim();
  const startMinutes = meetupStartMinutesFromMidnight(meetup?.start_time);
  if (!isoDate || !isValidIanaTimezone(tz) || startMinutes == null) {
    return null;
  }

  let fireAt;
  if (startMinutes < MEETUP_REMINDER_LATE_MORNING_START_MINUTES) {
    const parsed = parseMeetupWallClockTime(meetup.start_time);
    const totalMinutes = parsed.hours * 60 + parsed.minutes - 120;
    if (totalMinutes < 0) {
      const minutesFromMidnight = 24 * 60 + totalMinutes;
      const previousDay = addDaysToIsoDate(isoDate, -1);
      fireAt = wallClockToUtcDate(
        previousDay,
        Math.floor(minutesFromMidnight / 60),
        minutesFromMidnight % 60,
        tz,
      );
    } else {
      fireAt = wallClockToUtcDate(
        isoDate,
        Math.floor(totalMinutes / 60),
        totalMinutes % 60,
        tz,
      );
    }
  } else {
    fireAt = wallClockToUtcDate(isoDate, MEETUP_REMINDER_MORNING_HOUR, 0, tz);
  }

  if (fireAt.getTime() <= nowMs) {
    return null;
  }
  return fireAt;
}

function fireTimesEqual(a, b) {
  if (!a || !b) {
    return false;
  }
  return Math.abs(a.getTime() - b.getTime()) < 60_000;
}

/**
 * Exactly two reminder slots when both are valid and distinct.
 * @returns {Array<{ kind: string, fireAt: Date, eventKey: string }>}
 */
export function computeMeetupReminderScheduleSlots(
  meetup,
  role,
  recipientTimezone,
  nowMs = Date.now(),
) {
  const meetupId = meetup?.id;
  if (!meetupId || (role !== 'host' && role !== 'joiner')) {
    return [];
  }

  const evening = computeEveningBeforeReminderFireAt(meetup, recipientTimezone, nowMs);
  let morning = computeMorningOfReminderFireAt(meetup, recipientTimezone, nowMs);

  if (evening && morning && fireTimesEqual(evening, morning)) {
    morning = null;
  }

  const slots = [];
  if (evening) {
    slots.push({
      kind: MEETUP_REMINDER_KINDS.EVENING_BEFORE,
      fireAt: evening,
      eventKey: buildMeetupReminderEventKey(meetupId, role, MEETUP_REMINDER_KINDS.EVENING_BEFORE),
    });
  }
  if (morning) {
    slots.push({
      kind: MEETUP_REMINDER_KINDS.MORNING_OF,
      fireAt: morning,
      eventKey: buildMeetupReminderEventKey(meetupId, role, MEETUP_REMINDER_KINDS.MORNING_OF),
    });
  }
  return slots;
}

/** @deprecated Use computeMorningOfReminderFireAt or computeMeetupReminderScheduleSlots */
export function computeMeetupReminderFireAt(meetup, recipientTimezone, nowMs = Date.now()) {
  return computeMorningOfReminderFireAt(meetup, recipientTimezone, nowMs);
}

/** @deprecated Use MEETUP_REMINDER_MORNING_HOUR */
export const MEETUP_REMINDER_LOCAL_HOUR = MEETUP_REMINDER_MORNING_HOUR;
