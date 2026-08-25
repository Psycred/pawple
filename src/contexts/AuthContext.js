import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext();

async function checkUserProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error?.code === 'PGRST116') {
    return { hasProfile: false, hasCompletedOnboarding: false, profile: null };
  }
  if (error) {
    throw error;
  }

  const { count, error: petsError } = await supabase
    .from('pets')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);

  if (petsError) {
    throw petsError;
  }

  const hasCompletedOnboarding = (count ?? 0) > 0;
  return {
    hasProfile: true,
    hasCompletedOnboarding,
    profile: data,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
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

    return () => {
      cancelled = true;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const routeUserByProfile = async () => {
      if (!user?.id) {
        setHasProfile(false);
        setHasCompletedOnboarding(false);
        setProfile(null);
        return;
      }
      setProfileLoading(true);
      try {
        const {
          hasProfile: nextHasProfile,
          hasCompletedOnboarding: nextHasCompletedOnboarding,
          profile: nextProfile,
        } = await checkUserProfile(user.id);
        if (!cancelled) {
          setHasProfile(nextHasProfile);
          setHasCompletedOnboarding(nextHasCompletedOnboarding);
          setProfile(nextProfile);
        }
      } catch (error) {
        console.log('[AuthContext] Profile check error:', error);
        if (!cancelled) {
          setHasProfile(false);
          setHasCompletedOnboarding(false);
          setProfile(null);
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

  const value = useMemo(
    () => ({
      user,
      authLoading,
      profileLoading,
      hasProfile,
      hasCompletedOnboarding,
      profile,
      checkUserProfile,
    }),
    [authLoading, hasCompletedOnboarding, hasProfile, profile, profileLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
