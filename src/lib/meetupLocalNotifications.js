/**
 * Meetup reminder helpers — server-scheduled via meetup_reminder_schedules + push.
 * Local expo scheduling removed (Phase 1A 10B-B.7); reminders use recipient latest_timezone on the backend.
 */

import {
  buildMeetupReminderBody,
  computeEveningBeforeReminderFireAt,
  computeMeetupReminderScheduleSlots,
  computeMorningOfReminderFireAt,
  getDeviceIanaTimezone,
} from './meetupReminderTime';

export {
  buildMeetupReminderBody,
  computeEveningBeforeReminderFireAt,
  computeMeetupReminderScheduleSlots,
  computeMorningOfReminderFireAt,
  getDeviceIanaTimezone,
};

/** @deprecated Server schedules reminders — kept for call-site compatibility. */
export async function scheduleMeetupMorningReminder(_meetup) {
  return undefined;
}

/** @deprecated Server cancels reminders on leave/cancel — kept for call-site compatibility. */
export async function cancelMeetupMorningReminder(_meetupId) {
  return undefined;
}
