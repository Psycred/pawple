import { isMeetupPast } from './meetupPublicFilter.js';

const MEETUP_REMINDER_TYPE = 'meetup_reminder';

/** Meetup reminder in-app rows stay visible only while the Meetup is still upcoming. */
export function isUpcomingMeetupForReminder(meetup) {
  if (!meetup?.id) {
    return false;
  }
  const status = meetup?.status ?? 'upcoming';
  if (status === 'cancelled') {
    return false;
  }
  return !isMeetupPast(meetup);
}

export function collectMeetupReminderIds(notifications = []) {
  const ids = new Set();
  for (const notification of notifications) {
    if (notification?.type !== MEETUP_REMINDER_TYPE) {
      continue;
    }
    const meetupId = notification?.payload?.meetupId ?? notification?.payload?.meetup_id;
    if (meetupId) {
      ids.add(String(meetupId));
    }
  }
  return [...ids];
}

/**
 * @param {object} notification
 * @param {Map<string, object>} meetupById
 */
export function shouldShowMeetupReminderNotification(notification, meetupById) {
  if (notification?.type !== MEETUP_REMINDER_TYPE) {
    return true;
  }
  const meetupId = String(
    notification?.payload?.meetupId ?? notification?.payload?.meetup_id ?? '',
  );
  if (!meetupId) {
    return true;
  }
  const meetup = meetupById.get(meetupId);
  if (!meetup) {
    return false;
  }
  return isUpcomingMeetupForReminder(meetup);
}

/**
 * Hide completed/cancelled/deleted Meetup reminders; leave other notification types unchanged.
 * @param {object[]} notifications
 * @param {object[]} meetups
 */
export function filterActiveMeetupReminderNotifications(notifications = [], meetups = []) {
  const meetupById = new Map((meetups ?? []).map((meetup) => [String(meetup.id), meetup]));
  return notifications.filter((notification) =>
    shouldShowMeetupReminderNotification(notification, meetupById),
  );
}
