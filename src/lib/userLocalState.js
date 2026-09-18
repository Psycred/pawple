import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearCachedFeedSnapshot } from './feedCache';
import { clearPendingInvite } from './onboardingInvite';
import { clearPendingShareDestination } from './pendingShareDestination';
import { clearPermissionReminderState } from './permissionReminderState';
import {
  STORAGE_ACTIVE_PET_ID,
  STORAGE_ATTENDED_EVENT_IDS,
  STORAGE_LIKED_POST_IDS,
} from '../utils/pawpleStorage';

/** Legacy ActivePetContext key (pre–pawpleStorage migration). */
const LEGACY_ACTIVE_PET_ID_KEY = 'activePetId';

/** Legacy liked/active keys from src/config/pawpleStorage.js. */
const LEGACY_LIKED_POSTS_KEY = '@pawple:likedPosts';
const LEGACY_ACTIVE_PET_KEY = '@pawple:activePet';

/** Invite remaining count cache (InviteSheet / AccountSheet). */
const INVITE_REMAINING_CACHE_KEY = 'inviteUnusedCount';

const PER_USER_ASYNC_KEYS = [
  STORAGE_ACTIVE_PET_ID,
  STORAGE_LIKED_POST_IDS,
  STORAGE_ATTENDED_EVENT_IDS,
  LEGACY_ACTIVE_PET_ID_KEY,
  LEGACY_LIKED_POSTS_KEY,
  LEGACY_ACTIVE_PET_KEY,
  INVITE_REMAINING_CACHE_KEY,
];

/**
 * Remove per-user AsyncStorage keys after sign-out or account deletion.
 * Device-level prefs (appearance, age gate, location cache) are intentionally kept.
 */
export async function clearPerUserLocalState(userId) {
  try {
    await AsyncStorage.multiRemove(PER_USER_ASYNC_KEYS);
  } catch (error) {
    console.error('[userLocalState] AsyncStorage multiRemove failed', error);
  }

  if (userId) {
    try {
      await clearPendingInvite(userId);
    } catch (error) {
      console.error('[userLocalState] clearPendingInvite failed', error);
    }
  }

  try {
    await clearPendingShareDestination(userId);
  } catch (error) {
    console.error('[userLocalState] clearPendingShareDestination failed', error);
  }

  if (userId) {
    try {
      await clearPermissionReminderState(userId);
    } catch (error) {
      console.error('[userLocalState] clearPermissionReminderState failed', error);
    }
  }

  try {
    await clearCachedFeedSnapshot();
  } catch (error) {
    console.error('[userLocalState] clearCachedFeedSnapshot failed', error);
  }
}
