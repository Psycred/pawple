import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { clearSignedUrlCache } from './storageMedia';
import { clearPerUserLocalState } from './userLocalState';

/** Postgres / PostgREST errors that mean the cached session should be dropped (F4 boot guard). */
export function isInvalidProfileSessionError(error) {
  if (!error) {
    return false;
  }
  const code = String(error.code ?? '');
  return code === '42501' || code === '42703';
}

async function clearPersistedAuthTokens() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter((key) => key.includes('auth-token') || key.startsWith('sb-'));
    if (authKeys.length) {
      await AsyncStorage.multiRemove(authKeys);
    }
  } catch (error) {
    console.error('[authSession] Failed to clear persisted auth tokens', error);
  }
}

export async function ensureSessionCleared() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    await clearPersistedAuthTokens();
    return;
  }
  if (data?.session) {
    await supabase.auth.signOut({ scope: 'global' });
    await supabase.auth.signOut({ scope: 'local' });
    await clearPersistedAuthTokens();
  }
}

export async function invalidateStaleSession(userId) {
  try {
    await clearPerUserLocalState(userId);
  } catch (error) {
    console.log('[authSession] Local state cleanup error:', error);
  }
  try {
    await supabase.auth.signOut({ scope: 'global' });
    await supabase.auth.signOut({ scope: 'local' });
    await clearPersistedAuthTokens();
  } catch (error) {
    console.log('[authSession] signOut after stale session:', error);
  }
}

/**
 * Terminate the Supabase session and clear per-user local state.
 * Global sign-out runs first so the server refresh token is revoked before
 * local storage is purged (autoRefreshToken must not resurrect a session).
 * Never throws — AuthContext always clears in-memory state after this runs.
 */
export async function signOutUser(userId) {
  clearSignedUrlCache();
  try {
    const { unregisterCachedDevicePushToken } = await import('../services/pushTokens');
    await unregisterCachedDevicePushToken();
  } catch (error) {
    console.log('[authSession] push token cleanup skipped:', error?.message ?? error);
  }

  if (userId) {
    try {
      await clearPerUserLocalState(userId);
    } catch (error) {
      console.error('[authSession] clearPerUserLocalState failed', error);
    }
  }

  // Stop refresh races while tokens are being revoked and purged from AsyncStorage.
  supabase.auth.stopAutoRefresh();

  const { error: globalError } = await supabase.auth.signOut({ scope: 'global' });
  if (globalError) {
    console.error('[authSession] global signOut failed', globalError);
  }

  const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
  if (localError) {
    console.error('[authSession] local signOut failed', localError);
  }

  await clearPersistedAuthTokens();

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    await clearPersistedAuthTokens();
    await supabase.auth.signOut({ scope: 'local' });
  }

  await ensureSessionCleared();
}

export async function resolveSessionUser(sessionUser) {
  if (!sessionUser?.id) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    console.log('[authSession] Stale session at bootstrap:', error?.message ?? 'no user');
    await invalidateStaleSession(sessionUser.id);
    return null;
  }

  return data.user;
}
