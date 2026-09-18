import {
  LOCATION_REMINDER_COPY_A,
  LOCATION_REMINDER_COPY_B,
  NOTIFICATION_REMINDER_COPY,
  PERMISSION_REMINDER_FOCUS,
} from '../constants/permissionReminders.js';
import { NOTIFICATION_TYPES } from '../constants/accountNotifications.js';
import { isPermissionReminderChannelDue } from './permissionReminderState.js';

export const LOCAL_PERMISSION_REMINDER_PREFIX = 'local:permission_reminder:';

export function isPermissionReminderType(type) {
  return (
    type === NOTIFICATION_TYPES.PERMISSION_REMINDER_LOCATION ||
    type === NOTIFICATION_TYPES.PERMISSION_REMINDER_NOTIFICATIONS
  );
}

export function getLocalPermissionReminderId(kind) {
  return `${LOCAL_PERMISSION_REMINDER_PREFIX}${kind}`;
}

function buildReminder({
  type,
  body,
  focusKey,
  createdAt,
}) {
  return {
    id: getLocalPermissionReminderId(type),
    userId: null,
    fromUserId: null,
    type,
    eventKey: null,
    targetPetId: null,
    actorPetId: null,
    pawInterestId: null,
    channelId: null,
    messageId: null,
    title: '',
    body,
    payload: { focusKey, isLocalPermissionReminder: true },
    isRead: false,
    readAt: null,
    createdAt,
    isLocal: true,
  };
}

export function getLocationReminderCopy(variant = 0) {
  return variant === 1 ? LOCATION_REMINDER_COPY_B : LOCATION_REMINDER_COPY_A;
}

/**
 * Build in-app permission reminder rows for the notification centre.
 */
export function buildPermissionReminderNotifications({
  locationGranted = false,
  notificationsGranted = false,
  state,
  now = Date.now(),
}) {
  const reminders = [];

  if (
    !locationGranted &&
    isPermissionReminderChannelDue(state?.location, now)
  ) {
    reminders.push(
      buildReminder({
        type: NOTIFICATION_TYPES.PERMISSION_REMINDER_LOCATION,
        body: getLocationReminderCopy(state?.locationVariant ?? 0),
        focusKey: PERMISSION_REMINDER_FOCUS.LOCATION,
        createdAt: new Date(now).toISOString(),
      }),
    );
  }

  if (
    !notificationsGranted &&
    isPermissionReminderChannelDue(state?.notifications, now)
  ) {
    reminders.push(
      buildReminder({
        type: NOTIFICATION_TYPES.PERMISSION_REMINDER_NOTIFICATIONS,
        body: NOTIFICATION_REMINDER_COPY,
        focusKey: PERMISSION_REMINDER_FOCUS.NOTIFICATIONS,
        createdAt: new Date(now).toISOString(),
      }),
    );
  }

  return reminders;
}

export function permissionReminderChannelForType(type) {
  if (type === NOTIFICATION_TYPES.PERMISSION_REMINDER_LOCATION) {
    return 'location';
  }
  if (type === NOTIFICATION_TYPES.PERMISSION_REMINDER_NOTIFICATIONS) {
    return 'notifications';
  }
  return null;
}
