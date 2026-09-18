import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  checkNotificationStatus,
  getNotificationPermissionState,
} from './notifications.js';
import {
  getCachedDevicePushToken,
  removeDevicePushToken,
  syncNotificationPreferenceToProfile,
  upsertDevicePushToken,
} from '../services/pushTokens';

const ANDROID_DEFAULT_CHANNEL_ID = 'pawple-account';

async function loadNotificationsModule() {
  try {
    return await import('expo-notifications');
  } catch (error) {
    console.error('[PushNotifications] module unavailable', error);
    return null;
  }
}

function resolveExpoProjectId() {
  const fromConfig =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    null;

  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  return fromEnv || fromConfig || null;
}

async function ensureAndroidNotificationChannel(Notifications) {
  if (Platform.OS !== 'android' || !Notifications?.setNotificationChannelAsync) {
    return;
  }

  await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL_ID, {
    name: 'Pawple',
    importance: Notifications.AndroidImportance?.DEFAULT ?? 3,
    vibrationPattern: [0, 180],
    lightColor: '#8FAF9B',
  });
}

export async function resolveExpoPushToken() {
  const Notifications = await loadNotificationsModule();
  if (!Notifications?.getExpoPushTokenAsync) {
    return null;
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    console.log('[PushNotifications] Expo projectId missing — token registration skipped');
    return null;
  }

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResult?.data?.trim() || null;
  } catch (error) {
    console.log('[PushNotifications] token fetch failed:', error?.message ?? error);
    return null;
  }
}

/**
 * Register the current device for OS push when permission is granted.
 * Also mirrors the OS state into profiles.notification_enabled.
 */
export async function registerDevicePushTokenIfGranted() {
  const granted = await checkNotificationStatus();
  await syncNotificationPreferenceToProfile(granted);

  if (!granted) {
    return false;
  }

  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return false;
  }

  await ensureAndroidNotificationChannel(Notifications);
  const expoPushToken = await resolveExpoPushToken();
  if (!expoPushToken) {
    return false;
  }

  return upsertDevicePushToken(expoPushToken);
}

export async function syncDevicePushRegistration() {
  const permission = await getNotificationPermissionState();
  const granted = permission.status === 'granted';
  await syncNotificationPreferenceToProfile(granted);

  if (!granted) {
    const cachedToken = await getCachedDevicePushToken();
    if (cachedToken) {
      await removeDevicePushToken(cachedToken);
    }
    return false;
  }

  return registerDevicePushTokenIfGranted();
}

export async function presentForegroundPushFallback(notification) {
  if (!notification?.title || AppState.currentState === 'active') {
    return;
  }

  const granted = await checkNotificationStatus();
  if (!granted) {
    return;
  }

  const Notifications = await loadNotificationsModule();
  if (!Notifications?.scheduleNotificationAsync) {
    return;
  }

  await ensureAndroidNotificationChannel(Notifications);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body || '',
      data: {
        notificationId: notification.id,
        type: notification.type,
        targetPetId: notification.targetPetId,
        actorPetId: notification.actorPetId,
        channelId: notification.channelId,
        pawInterestId: notification.pawInterestId,
        ...notification.payload,
      },
    },
    trigger: null,
  });
}

export async function configurePushNotificationHandlers({ onNotificationResponse } = {}) {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return () => {};
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      onNotificationResponse?.(response);
    },
  );

  return () => {
    responseSubscription.remove();
  };
}
