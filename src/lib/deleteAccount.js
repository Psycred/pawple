import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { clearPendingInvite } from './onboardingInvite';
import {
  STORAGE_ACTIVE_PET_ID,
  STORAGE_ATTENDED_EVENT_IDS,
  STORAGE_LIKED_POST_IDS,
} from '../utils/pawpleStorage';

/**
 * Server-controlled account deletion (Product Contract §10).
 * C5 wires Settings UI; this helper is the canonical client invocation path.
 */
export async function deleteAccount() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }

  const { data, error } = await supabase.rpc('delete_user_account');
  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  if (!data?.ok) {
    throw new Error('Account deletion did not complete');
  }

  // Session is invalid after auth row removal; clear local state regardless.
  try {
    await supabase.auth.signOut();
  } catch (_signOutError) {
    // Expected when the auth user no longer exists.
  }

  await AsyncStorage.multiRemove([
    STORAGE_ACTIVE_PET_ID,
    STORAGE_LIKED_POST_IDS,
    STORAGE_ATTENDED_EVENT_IDS,
  ]);

  await clearPendingInvite(user.id);

  return data;
}
