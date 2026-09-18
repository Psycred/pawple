import AsyncStorage from '@react-native-async-storage/async-storage';

const FEED_CACHE_KEY = '@pawple/feed_snapshot_v1';
const FEED_CACHE_VERSION = 1;
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeIdList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map(String).filter(Boolean);
}

/**
 * Read the last successful Feed snapshot for the signed-in user.
 * Returns null when missing, stale, or owned by another account.
 */
export async function readCachedFeedSnapshot(userId) {
  if (!userId) {
    return null;
  }

  try {
    const raw = await AsyncStorage.getItem(FEED_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (parsed?.version !== FEED_CACHE_VERSION) {
      return null;
    }
    if (String(parsed.userId ?? '') !== String(userId)) {
      return null;
    }
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > MAX_CACHE_AGE_MS) {
      return null;
    }

    return {
      userId: String(parsed.userId),
      cachedAt: parsed.cachedAt,
      meetups: Array.isArray(parsed.meetups) ? parsed.meetups : [],
      realMoments: Array.isArray(parsed.realMoments) ? parsed.realMoments : [],
      blockedPetIds: normalizeIdList(parsed.blockedPetIds),
      userFeedLocation: parsed.userFeedLocation ?? null,
      locationGranted: Boolean(parsed.locationGranted),
      heartedPetIds: normalizeIdList(parsed.heartedPetIds),
      momentPage: Number.isFinite(parsed.momentPage) ? parsed.momentPage : 0,
      hasMoreMoments: Boolean(parsed.hasMoreMoments),
    };
  } catch (error) {
    console.log('[FeedCache] read failed:', error?.message ?? error);
    return null;
  }
}

/** Persist the latest successful Feed page for instant cold-start paint. */
export async function writeCachedFeedSnapshot(userId, snapshot) {
  if (!userId || !snapshot) {
    return;
  }

  try {
    const payload = {
      version: FEED_CACHE_VERSION,
      userId: String(userId),
      cachedAt: Date.now(),
      meetups: Array.isArray(snapshot.meetups) ? snapshot.meetups : [],
      realMoments: Array.isArray(snapshot.realMoments) ? snapshot.realMoments : [],
      blockedPetIds: normalizeIdList(snapshot.blockedPetIds),
      userFeedLocation: snapshot.userFeedLocation ?? null,
      locationGranted: Boolean(snapshot.locationGranted),
      heartedPetIds: normalizeIdList(snapshot.heartedPetIds),
      momentPage: Number.isFinite(snapshot.momentPage) ? snapshot.momentPage : 0,
      hasMoreMoments: Boolean(snapshot.hasMoreMoments),
    };
    await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.log('[FeedCache] write failed:', error?.message ?? error);
  }
}

export async function clearCachedFeedSnapshot() {
  try {
    await AsyncStorage.removeItem(FEED_CACHE_KEY);
  } catch (error) {
    console.log('[FeedCache] clear failed:', error?.message ?? error);
  }
}
