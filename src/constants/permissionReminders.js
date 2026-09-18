/** Seven-day cadence for in-app permission reminders (Phase 4). */
export const PERMISSION_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export const LOCATION_REMINDER_COPY_A =
  'Help Pawple feel local. Approximate location helps you discover moments and meetups nearby.';

export const LOCATION_REMINDER_COPY_B =
  'Pawple uses your approximate location to bring the nearest moments and meetups to you. Your location is never shared with other members or outside the app.';

export const NOTIFICATION_REMINDER_COPY =
  'Notifications help you stay aware of meetups and quiet Pawple updates. Enable them when you\'re ready.';

export const PERMISSION_REMINDER_FOCUS = Object.freeze({
  LOCATION: 'location',
  NOTIFICATIONS: 'notifications',
});
