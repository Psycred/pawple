import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERMISSION_REMINDER_INTERVAL_MS } from '../constants/permissionReminders.js';

const STORAGE_PREFIX = '@pawple:permissionReminders:';

function storageKey(userId) {
  return `${STORAGE_PREFIX}${String(userId)}`;
}

function defaultChannelState(now = Date.now()) {
  return {
    nextEligibleAt: now + PERMISSION_REMINDER_INTERVAL_MS,
    wasGranted: false,
  };
}

export function createDefaultPermissionReminderState(now = Date.now()) {
  return {
    anchoredAt: now,
    locationVariant: 0,
    location: defaultChannelState(now),
    notifications: defaultChannelState(now),
  };
}

export function normalizePermissionReminderState(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') {
    return createDefaultPermissionReminderState(now);
  }

  return {
    anchoredAt: Number(raw.anchoredAt) || now,
    locationVariant: Number(raw.locationVariant) === 1 ? 1 : 0,
    location: {
      nextEligibleAt: Number(raw.location?.nextEligibleAt) || now + PERMISSION_REMINDER_INTERVAL_MS,
      wasGranted: Boolean(raw.location?.wasGranted),
    },
    notifications: {
      nextEligibleAt: Number(raw.notifications?.nextEligibleAt) || now + PERMISSION_REMINDER_INTERVAL_MS,
      wasGranted: Boolean(raw.notifications?.wasGranted),
    },
  };
}

export async function loadPermissionReminderState(userId) {
  if (!userId) {
    return createDefaultPermissionReminderState();
  }

  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) {
      return createDefaultPermissionReminderState();
    }
    return normalizePermissionReminderState(JSON.parse(raw));
  } catch (error) {
    console.error('[permissionReminderState] load failed', error);
    return createDefaultPermissionReminderState();
  }
}

export async function savePermissionReminderState(userId, state) {
  if (!userId || !state) {
    return;
  }

  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch (error) {
    console.error('[permissionReminderState] save failed', error);
  }
}

export async function clearPermissionReminderState(userId) {
  if (!userId) {
    return;
  }

  try {
    await AsyncStorage.removeItem(storageKey(userId));
  } catch (error) {
    console.error('[permissionReminderState] clear failed', error);
  }
}

export function snoozePermissionReminderChannel(state, channel, now = Date.now()) {
  const next = normalizePermissionReminderState(state, now);
  next[channel] = {
    ...next[channel],
    nextEligibleAt: now + PERMISSION_REMINDER_INTERVAL_MS,
  };
  if (channel === 'location') {
    next.locationVariant = next.locationVariant === 1 ? 0 : 1;
  }
  return next;
}

export function syncGrantedChannelState(state, channel, granted, now = Date.now()) {
  const next = normalizePermissionReminderState(state, now);
  const current = next[channel];

  if (granted) {
    next[channel] = {
      ...current,
      wasGranted: true,
    };
    return next;
  }

  if (current.wasGranted) {
    next[channel] = {
      wasGranted: false,
      nextEligibleAt: now,
    };
  }

  return next;
}

export function isPermissionReminderChannelDue(channelState, now = Date.now()) {
  return Number(channelState?.nextEligibleAt ?? 0) <= now;
}
