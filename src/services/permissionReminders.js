import { isForegroundLocationGranted } from '../lib/locationPermission.js';
import {
  buildPermissionReminderNotifications,
  permissionReminderChannelForType,
} from '../lib/permissionReminderScheduler.js';
import {
  loadPermissionReminderState,
  savePermissionReminderState,
  snoozePermissionReminderChannel,
  syncGrantedChannelState,
} from '../lib/permissionReminderState.js';
import { NOTIFICATION_TYPES } from '../constants/accountNotifications.js';
import { checkNotificationStatus } from '../lib/notifications.js';

async function loadNotificationsModule() {
  try {
    return await import('expo-notifications');
  } catch (error) {
    console.error('[permissionReminders] notifications module unavailable', error);
    return null;
  }
}

/** Optional OS banner when location reminder is due and push permission exists. */
async function maybePresentLocationReminderPush(body) {
  const notificationsGranted = await checkNotificationStatus();
  if (!notificationsGranted || !body) {
    return;
  }

  const Notifications = await loadNotificationsModule();
  if (!Notifications?.presentNotificationAsync) {
    return;
  }

  try {
    await Notifications.presentNotificationAsync({
      title: 'Pawple',
      body,
      sound: false,
    });
  } catch (error) {
    console.log('[permissionReminders] local push skipped:', error?.message ?? error);
  }
}

/**
 * Evaluate permission state, persist scheduler bookkeeping, return inbox rows.
 */
export async function syncPermissionReminders(userId) {
  if (!userId) {
    return [];
  }

  const now = Date.now();
  const [locationGranted, notificationsGranted, state] = await Promise.all([
    isForegroundLocationGranted(),
    checkNotificationStatus(),
    loadPermissionReminderState(userId),
  ]);

  let nextState = syncGrantedChannelState(state, 'location', locationGranted, now);
  nextState = syncGrantedChannelState(nextState, 'notifications', notificationsGranted, now);

  const reminders = buildPermissionReminderNotifications({
    locationGranted,
    notificationsGranted,
    state: nextState,
    now,
  });

  await savePermissionReminderState(userId, nextState);

  const locationReminder = reminders.find(
    (item) => item.type === NOTIFICATION_TYPES.PERMISSION_REMINDER_LOCATION,
  );
  if (locationReminder?.body) {
    await maybePresentLocationReminderPush(locationReminder.body);
  }

  return reminders;
}

/** Snooze a reminder channel for seven days ("Not now" or after Ok). */
export async function snoozePermissionReminder(userId, type) {
  const channel = permissionReminderChannelForType(type);
  if (!userId || !channel) {
    return;
  }

  const state = await loadPermissionReminderState(userId);
  const nextState = snoozePermissionReminderChannel(state, channel);
  await savePermissionReminderState(userId, nextState);
}
