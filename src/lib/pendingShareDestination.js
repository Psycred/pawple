import AsyncStorage from '@react-native-async-storage/async-storage';

const PRE_AUTH_KEY = 'pawple.pendingShareDestination.preAuth';
const userKey = (userId) => `pawple.pendingShareDestination.${String(userId)}`;

function normalizeDestination(destination) {
  const type = String(destination?.type ?? '').trim().toLowerCase();
  const id = String(destination?.id ?? '').trim();
  if (!['moment', 'meetup'].includes(type) || !id) {
    return null;
  }
  return {
    type,
    id,
    openedAt: Number(destination?.openedAt) || Date.now(),
  };
}

async function readDestination(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? normalizeDestination(JSON.parse(raw)) : null;
  } catch (error) {
    console.log('[DeepLink] Could not read pending destination:', error?.message);
    return null;
  }
}

export async function storePendingShareDestination(userId, destination) {
  const normalized = normalizeDestination(destination);
  if (!normalized) {
    return null;
  }

  const key = userId ? userKey(userId) : PRE_AUTH_KEY;
  await AsyncStorage.setItem(key, JSON.stringify(normalized));
  return normalized;
}

export async function getPendingShareDestination(userId) {
  if (!userId) {
    return readDestination(PRE_AUTH_KEY);
  }

  const savedForUser = await readDestination(userKey(userId));
  if (savedForUser) {
    return savedForUser;
  }

  const preAuth = await readDestination(PRE_AUTH_KEY);
  if (!preAuth) {
    return null;
  }

  await AsyncStorage.setItem(userKey(userId), JSON.stringify(preAuth));
  await AsyncStorage.removeItem(PRE_AUTH_KEY);
  return preAuth;
}

export async function clearPendingShareDestination(userId) {
  const keys = [PRE_AUTH_KEY];
  if (userId) {
    keys.push(userKey(userId));
  }
  await AsyncStorage.multiRemove(keys);
}
