import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../config/supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({
  scheme: 'pawple',
  path: 'auth/callback',
});

export function getOAuthRedirectUri() {
  return redirectTo;
}

export function isAuthCallbackUrl(url) {
  if (!url) {
    return false;
  }
  return url.startsWith(redirectTo) || url.includes('auth/callback');
}

/**
 * Exchange the OAuth callback URL for a persisted Supabase session.
 * Supports PKCE (`code`) and implicit token callbacks.
 */
export async function createSessionFromUrl(url) {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      console.error('[Supabase]', error);
      throw error;
    }
    return data.session;
  }

  const { access_token, refresh_token } = params;
  if (access_token && refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) {
      console.error('[Supabase]', error);
      throw error;
    }
    return data.session;
  }

  throw new Error('No auth credentials found in callback URL');
}

/**
 * Start Google or Apple OAuth via Supabase Auth + expo-auth-session.
 * Returns `{ cancelled: true }` when the user dismisses the provider sheet.
 */
export async function signInWithOAuthProvider(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  if (!data?.url) {
    throw new Error('OAuth URL missing from Supabase');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { cancelled: true, session: null };
  }

  if (result.type !== 'success' || !result.url) {
    throw new Error('Sign-in was interrupted. Please try again.');
  }

  const session = await createSessionFromUrl(result.url);
  return { cancelled: false, session };
}
