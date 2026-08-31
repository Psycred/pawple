import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../config/supabase';
import { createSessionFromUrl, isAuthCallbackUrl, signInWithOAuthProvider } from '../lib/oauth';
import { getPendingInvite } from '../lib/onboardingInvite';
import { syncAgeAttestationToProfile } from '../lib/ageAttestationSync';

const AuthContext = createContext();

async function checkUserProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error?.code === 'PGRST116') {
    const pendingInviteCode = await getPendingInvite(userId);
    return { hasProfile: false, hasCompletedOnboarding: false, profile: null, pendingInviteCode };
  }
  if (error) {
    throw error;
  }

  const hasCompletedOnboarding = Boolean(data?.onboarding_completed_at);
  const pendingInviteCode = hasCompletedOnboarding ? null : await getPendingInvite(userId);

  return {
    hasProfile: true,
    hasCompletedOnboarding,
    profile: data,
    pendingInviteCode,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [profile, setProfile] = useState(null);
  const [pendingInviteCode, setPendingInviteCode] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && isAuthCallbackUrl(initialUrl)) {
          await createSessionFromUrl(initialUrl);
        }
      } catch (error) {
        console.log('[AuthContext] Auth callback bootstrap error:', error);
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.log('[AuthContext] Session bootstrap error:', error);
      }
      if (!cancelled) {
        setUser(data?.session?.user ?? null);
        setAuthLoading(false);
      }
    };

    bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const linkingSubscription = Linking.addEventListener('url', async ({ url }) => {
      if (!isAuthCallbackUrl(url)) {
        return;
      }
      try {
        await createSessionFromUrl(url);
      } catch (error) {
        console.log('[AuthContext] Auth callback error:', error);
      }
    });

    return () => {
      cancelled = true;
      authListener?.subscription?.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  const signInWithOAuth = useCallback(async (provider) => {
    return signInWithOAuthProvider(provider);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const routeUserByProfile = async () => {
      if (!user?.id) {
        setHasProfile(false);
        setHasCompletedOnboarding(false);
        setProfile(null);
        setPendingInviteCode(null);
        return;
      }
      setProfileLoading(true);
      try {
        await syncAgeAttestationToProfile(user.id);
        const {
          hasProfile: nextHasProfile,
          hasCompletedOnboarding: nextHasCompletedOnboarding,
          profile: nextProfile,
          pendingInviteCode: nextPendingInviteCode,
        } = await checkUserProfile(user.id);
        if (!cancelled) {
          setHasProfile(nextHasProfile);
          setHasCompletedOnboarding(nextHasCompletedOnboarding);
          setProfile(nextProfile);
          setPendingInviteCode(nextPendingInviteCode);
        }
      } catch (error) {
        console.log('[AuthContext] Profile check error:', error);
        if (!cancelled) {
          setHasProfile(false);
          setHasCompletedOnboarding(false);
          setProfile(null);
          setPendingInviteCode(null);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    routeUserByProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      return null;
    }
    setProfileLoading(true);
    try {
      await syncAgeAttestationToProfile(user.id);
      const result = await checkUserProfile(user.id);
      setHasProfile(result.hasProfile);
      setHasCompletedOnboarding(result.hasCompletedOnboarding);
      setProfile(result.profile);
      setPendingInviteCode(result.pendingInviteCode);
      return result;
    } catch (error) {
      console.log('[AuthContext] refreshProfile error:', error);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [user?.id]);

  const value = useMemo(
    () => ({
      user,
      authLoading,
      profileLoading,
      hasProfile,
      hasCompletedOnboarding,
      profile,
      pendingInviteCode,
      checkUserProfile,
      refreshProfile,
      signInWithOAuth,
    }),
    [
      authLoading,
      hasCompletedOnboarding,
      hasProfile,
      pendingInviteCode,
      profile,
      profileLoading,
      refreshProfile,
      signInWithOAuth,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
