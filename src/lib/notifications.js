/**
 * Safe notification helpers for Settings. Uses guarded dynamic imports to
 * avoid runtime crashes when the notifications module is unavailable.
 */

async function loadNotificationsModule() {
  try {
    const Notifications = await import('expo-notifications');
    return Notifications;
  } catch (error) {
    console.error('[Notification Module Error]', error);
    return null;
  }
}

export const checkNotificationStatus = async () => {
  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return false;
    }
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[Notification Check Error]', error);
    return false;
  }
};

export const requestNotificationPermission = async () => {
  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return false;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[Notification Request Error]', error);
    return false;
  }
};
