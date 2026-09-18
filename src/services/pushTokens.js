import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

const PUSH_TOKEN_STORAGE_KEY = '@pawple:expoPushToken';

export async function getCachedDevicePushToken() {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.log('[PushTokens] cache read failed:', error?.message ?? error);
    return null;
  }
}

async function cacheDevicePushToken(token) {
  try {
    if (token) {
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    } else {
      await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    console.log('[PushTokens] cache write failed:', error?.message ?? error);
  }
}

function resolvePushPlatform() {
  if (Platform.OS === 'ios') {
    return 'ios';
  }
  if (Platform.OS === 'android') {
    return 'android';
  }
  if (Platform.OS === 'web') {
    return 'web';
  }
  return null;
}

export async function syncNotificationPreferenceToProfile(granted) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return false;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ notification_enabled: Boolean(granted) })
    .eq('id', user.id);

  if (error) {
    console.error('[Supabase]', error);
    return false;
  }

  return true;
}

export async function upsertDevicePushToken(expoPushToken) {
  const token = String(expoPushToken ?? '').trim();
  if (!token) {
    return false;
  }

  const { error } = await supabase.rpc('upsert_device_push_token', {
    p_expo_push_token: token,
    p_platform: resolvePushPlatform(),
  });

  if (error) {
    console.error('[Supabase]', error);
    return false;
  }

  await cacheDevicePushToken(token);
  return true;
}

export async function removeDevicePushToken(expoPushToken) {
  const token = String(expoPushToken ?? '').trim();
  if (!token) {
    await cacheDevicePushToken(null);
    return true;
  }

  const { error } = await supabase.rpc('remove_device_push_token', {
    p_expo_push_token: token,
  });

  if (error) {
    console.error('[Supabase]', error);
    return false;
  }

  await cacheDevicePushToken(null);
  return true;
}

export async function unregisterCachedDevicePushToken() {
  const cached = await getCachedDevicePushToken();
  if (!cached) {
    return true;
  }
  return removeDevicePushToken(cached);
}
