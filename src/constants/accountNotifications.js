export const NOTIFICATION_TYPES = Object.freeze({
  PAW_RECEIVED: 'paw_received',
  PAW_RESPONSE: 'paw_response',
  CHAT_MESSAGE: 'chat_message',
  APP_ANNOUNCEMENT: 'app_announcement',
  /** Phase 4 — in-app permission reminders (client-scheduled). */
  PERMISSION_REMINDER_LOCATION: 'permission_reminder_location',
  PERMISSION_REMINDER_NOTIFICATIONS: 'permission_reminder_notifications',
  /** Phase 5 — server-created meetup events (types reserved). */
  MEETUP_GUEST_JOINED: 'meetup_guest_joined',
  MEETUP_NEARBY: 'meetup_nearby',
  MEETUP_REMINDER: 'meetup_reminder',
});
