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

export const getNotificationPermissionState = async () => {
  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return { status: 'undetermined', canAskAgain: true };
    }
    const current = await Notifications.getPermissionsAsync();
    return {
      status: current?.status ?? 'undetermined',
      canAskAgain: current?.canAskAgain ?? true,
    };
  } catch (error) {
    console.error('[Notification Check Error]', error);
    return { status: 'undetermined', canAskAgain: true };
  }
};

export const checkNotificationStatus = async () => {
  const current = await getNotificationPermissionState();
  return current.status === 'granted';
};

export const requestNotificationPermission = async () => {
  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return false;
    }
    const current = await Notifications.getPermissionsAsync();
    if (current?.status === 'granted') {
      return true;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[Notification Request Error]', error);
    return false;
  }
};

/** OS notification prompt at moment of need — never blocks caller on deny. */
export async function promptNotificationPermissionIfNeeded() {
  try {
    const alreadyGranted = await checkNotificationStatus();
    if (alreadyGranted) {
      const { registerDevicePushTokenIfGranted } = await import('./pushNotifications');
      await registerDevicePushTokenIfGranted();
      return true;
    }
    const granted = await requestNotificationPermission();
    if (granted) {
      const { registerDevicePushTokenIfGranted } = await import('./pushNotifications');
      await registerDevicePushTokenIfGranted();
    }
    return granted;
  } catch (error) {
    console.log('[Notification] prompt skipped:', error?.message ?? error);
    return false;
  }
}
