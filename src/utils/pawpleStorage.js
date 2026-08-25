import AsyncStorage from '@react-native-async-storage/async-storage';

/** Active pet id for feed + shared header (Profile, Journal, Events, Settings). */
export const STORAGE_ACTIVE_PET_ID = 'active_pet_id';
export const STORAGE_LIKED_POST_IDS = '@pawple/liked_post_ids';
export const STORAGE_ATTENDED_EVENT_IDS = '@pawple/attended_event_ids';

export async function getActivePetId() {
  return AsyncStorage.getItem(STORAGE_ACTIVE_PET_ID);
}

export async function setActivePetId(petId) {
  await AsyncStorage.setItem(STORAGE_ACTIVE_PET_ID, petId);
}

export async function getLikedPostIds() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LIKED_POST_IDS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setLikedPostIds(ids) {
  await AsyncStorage.setItem(STORAGE_LIKED_POST_IDS, JSON.stringify(ids));
}

export async function toggleLikedPost(postId) {
  const ids = await getLikedPostIds();
  const set = new Set(ids);
  if (set.has(postId)) {
    set.delete(postId);
  } else {
    set.add(postId);
  }
  const next = [...set];
  await setLikedPostIds(next);
  return next;
}

export async function isPostLiked(postId) {
  const ids = await getLikedPostIds();
  return ids.includes(postId);
}

export async function getAttendedEventIds() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_ATTENDED_EVENT_IDS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addAttendedEventId(eventSourceId) {
  const ids = await getAttendedEventIds();
  if (ids.includes(eventSourceId)) {
    return ids;
  }
  const next = [...ids, eventSourceId];
  await AsyncStorage.setItem(STORAGE_ATTENDED_EVENT_IDS, JSON.stringify(next));
  return next;
}
