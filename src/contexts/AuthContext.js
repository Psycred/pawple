import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { refreshProfileLocationOnAppOpen } from '../lib/profileLocation';
import { refreshViewerFeedLocationOnAppOpen } from '../lib/viewerFeedLocation';
import { refreshLatestTimezoneOnAppActive } from '../lib/profileTimezone';
import AccountLifecycleModal from '../components/AccountLifecycleModal';
import { supabase } from '../config/supabase';
import { createSessionFromUrl, isAuthCallbackUrl, signInWithOAuthProvider } from '../lib/oauth';
import { getPendingInvite, storePendingInvite } from '../lib/onboardingInvite';
import { syncAgeAttestationToProfile } from '../lib/ageAttestationSync';
import { hasPassedAgeGate } from '../lib/ageGate';
import { deleteAccount } from '../lib/deleteAccount';
import { isInvalidProfileSessionError, invalidateStaleSession, resolveSessionUser, signOutUser } from '../lib/authSession';
import { resetToUnauthenticatedEntry } from '../navigation/resetToUnauthenticatedEntry';

const AuthContext = createContext();

async function checkUserProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

  if (isInvalidProfileSessionError(error) || (!error && data == null)) {
    return { sessionInvalid: true };
  }

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
  const [hasAgeAttestation, setHasAgeAttestation] = useState(false);
  const [profile, setProfile] = useState(null);
  const [pendingInviteCode, setPendingInviteCode] = useState(null);
  const [lifecycleModal, setLifecycleModal] = useState(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState('');
  const signingOutRef = useRef(false);

  const resetAuthState = useCallback(() => {
    setUser(null);
    setHasProfile(false);
    setHasCompletedOnboarding(false);
    setHasAgeAttestation(false);
    setProfile(null);
    setPendingInviteCode(null);
    resetToUnauthenticatedEntry();
  }, []);

  /** Clear the logout guard before any path that establishes a new session. */
  const beginSignIn = useCallback(() => {
    signingOutRef.current = false;
    supabase.auth.startAutoRefresh();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && isAuthCallbackUrl(initialUrl)) {
          signingOutRef.current = false;
          await createSessionFromUrl(initialUrl);
        }
      } catch (error) {
        console.log('[AuthContext] Auth callback bootstrap error:', error);
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.log('[AuthContext] Session bootstrap error:', error);
      }

      const sessionUser = data?.session?.user ?? null;
      const validatedUser = await resolveSessionUser(sessionUser);

      if (!cancelled) {
        setUser(validatedUser);
        setAuthLoading(false);
      }
    };

    bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }
      if (signingOutRef.current) {
        // Block INITIAL_SESSION / TOKEN_REFRESHED resurrection during logout or delete.
        if (!session?.user) {
          setUser(null);
        }
        return;
      }
      setUser(session?.user ?? null);
    });

    const linkingSubscription = Linking.addEventListener('url', async ({ url }) => {
      if (!isAuthCallbackUrl(url)) {
        return;
      }
      try {
        signingOutRef.current = false;
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
    beginSignIn();
    return signInWithOAuthProvider(provider);
  }, [beginSignIn]);

  useEffect(() => {
    let cancelled = false;

    const routeUserByProfile = async () => {
      if (!user?.id) {
        setHasProfile(false);
        setHasCompletedOnboarding(false);
        setHasAgeAttestation(false);
        setProfile(null);
        setPendingInviteCode(null);
        return;
      }
      setProfileLoading(true);
      try {
        await syncAgeAttestationToProfile(user.id);
        const profileResult = await checkUserProfile(user.id);

        if (profileResult.sessionInvalid) {
          await invalidateStaleSession(user.id);
          if (!cancelled) {
            resetAuthState();
          }
          return;
        }

        const {
          hasProfile: nextHasProfile,
          hasCompletedOnboarding: nextHasCompletedOnboarding,
          profile: nextProfile,
          pendingInviteCode: nextPendingInviteCode,
        } = profileResult;

        const localAgePassed = await hasPassedAgeGate();
        const nextHasAgeAttestation = Boolean(nextProfile?.age_attested_adult) || localAgePassed;

        if (!cancelled) {
          setHasProfile(nextHasProfile);
          setHasCompletedOnboarding(nextHasCompletedOnboarding);
          setHasAgeAttestation(nextHasAgeAttestation);
          setProfile(nextProfile);
          setPendingInviteCode(nextPendingInviteCode);
        }
      } catch (error) {
        console.log('[AuthContext] Profile check error:', error);
        if (!cancelled) {
          setHasProfile(false);
          setHasCompletedOnboarding(false);
          setHasAgeAttestation(false);
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
  }, [resetAuthState, user]);

  // Phase 1: one silent coarse refresh per foreground when location already granted.
  useEffect(() => {
    if (!user?.id || !hasCompletedOnboarding) {
      return undefined;
    }

    refreshProfileLocationOnAppOpen(user.id);
    refreshViewerFeedLocationOnAppOpen();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshProfileLocationOnAppOpen(user.id);
        refreshViewerFeedLocationOnAppOpen();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [hasCompletedOnboarding, user?.id]);

  // Phase 1A: latest device IANA timezone — no location permission required.
  useEffect(() => {
    if (!user?.id || !hasCompletedOnboarding) {
      return undefined;
    }

    refreshLatestTimezoneOnAppActive(user.id);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshLatestTimezoneOnAppActive(user.id);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [hasCompletedOnboarding, user?.id]);

  // Phase 5: keep Expo push tokens and notification_enabled in sync with OS permission.
  useEffect(() => {
    if (!user?.id || !hasCompletedOnboarding) {
      return undefined;
    }

    let cancelled = false;

    const syncPushRegistration = async () => {
      try {
        const { syncDevicePushRegistration } = await import('../lib/pushNotifications');
        if (!cancelled) {
          await syncDevicePushRegistration();
        }
      } catch (error) {
        console.log('[AuthContext] push registration skipped:', error?.message ?? error);
      }
    };

    syncPushRegistration();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncPushRegistration();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [hasCompletedOnboarding, user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      return null;
    }
    setProfileLoading(true);
    try {
      await syncAgeAttestationToProfile(user.id);
      const result = await checkUserProfile(user.id);
      if (result.sessionInvalid) {
        await invalidateStaleSession(user.id);
        resetAuthState();
        return null;
      }
      const localAgePassed = await hasPassedAgeGate();
      setHasProfile(result.hasProfile);
      setHasCompletedOnboarding(result.hasCompletedOnboarding);
      setHasAgeAttestation(Boolean(result.profile?.age_attested_adult) || localAgePassed);
      setProfile(result.profile);
      setPendingInviteCode(result.pendingInviteCode);
      return result;
    } catch (error) {
      console.log('[AuthContext] refreshProfile error:', error);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [resetAuthState, user?.id]);

  /** Persist deep-link invite and refresh in-memory pending code without a full profile spin. */
  const rememberPendingInvite = useCallback(
    async (code) => {
      const normalized = String(code ?? '')
        .trim()
        .replace(/^@/, '')
        .toUpperCase();
      if (!normalized) {
        return null;
      }
      await storePendingInvite(user?.id ?? null, normalized);
      if (!hasCompletedOnboarding) {
        setPendingInviteCode(normalized);
      }
      return normalized;
    },
    [hasCompletedOnboarding, user?.id],
  );

  const signOut = useCallback(async () => {
    const currentUserId = user?.id ?? null;
    signingOutRef.current = true;
    setLifecycleError('');
    try {
      await signOutUser(currentUserId);
    } catch (error) {
      console.error('[AuthContext] signOut error', error);
    }
    resetAuthState();
  }, [resetAuthState, user?.id]);

  const closeLifecycleModal = useCallback(() => {
    if (lifecycleBusy) {
      return;
    }
    setLifecycleModal(null);
    setLifecycleError('');
  }, [lifecycleBusy]);

  const openLogoutConfirm = useCallback(() => {
    setLifecycleError('');
    setLifecycleModal('logout_confirm');
  }, []);

  const confirmLogout = useCallback(async () => {
    if (lifecycleBusy || !user?.id) {
      return;
    }
    setLifecycleBusy(true);
    setLifecycleError('');
    try {
      await signOut();
      setLifecycleModal(null);
    } catch (error) {
      console.error('[AuthContext] confirmLogout error', error);
      setLifecycleError('Could not log out right now. Please try again.');
    } finally {
      setLifecycleBusy(false);
    }
  }, [lifecycleBusy, signOut, user?.id]);

  const openDeleteConfirm = useCallback(() => {
    if (lifecycleBusy) {
      return;
    }
    setLifecycleError('');
    setLifecycleModal('delete_confirm');
  }, [lifecycleBusy]);

  const confirmDeleteAccount = useCallback(async () => {
    if (lifecycleBusy || !user?.id) {
      return;
    }
    const currentUserId = user.id;
    setLifecycleBusy(true);
    setLifecycleError('');
    signingOutRef.current = true;
    try {
      await deleteAccount({ signOutAfter: false });
      await signOutUser(currentUserId);
      resetAuthState();
      setLifecycleModal('delete_success');
    } catch (error) {
      console.error('[AuthContext] delete account error', error);
      signingOutRef.current = false;
      const rpcMessage = error?.message ?? error?.details ?? '';
      setLifecycleError(
        rpcMessage && rpcMessage !== 'Account deletion did not complete'
          ? `Could not delete your account: ${rpcMessage}`
          : 'Could not delete your account right now. Please try again.',
      );
      setLifecycleModal('delete_confirm');
    } finally {
      setLifecycleBusy(false);
    }
  }, [lifecycleBusy, resetAuthState, user?.id]);

  const closeDeleteGoodbye = useCallback(() => {
    setLifecycleModal(null);
    setLifecycleError('');
    resetToUnauthenticatedEntry();
  }, []);

  const value = useMemo(
    () => ({
      user,
      authLoading,
      profileLoading,
      hasProfile,
      hasCompletedOnboarding,
      hasAgeAttestation,
      profile,
      pendingInviteCode,
      checkUserProfile,
      refreshProfile,
      rememberPendingInvite,
      signInWithOAuth,
      beginSignIn,
      signOut,
      openLogoutConfirm,
      openDeleteConfirm,
      lifecycleBusy,
    }),
    [
      authLoading,
      beginSignIn,
      hasCompletedOnboarding,
      hasAgeAttestation,
      hasProfile,
      lifecycleBusy,
      openDeleteConfirm,
      openLogoutConfirm,
      pendingInviteCode,
      profile,
      profileLoading,
      refreshProfile,
      rememberPendingInvite,
      signInWithOAuth,
      signOut,
      user,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AccountLifecycleModal
        visible={lifecycleModal === 'logout_confirm'}
        variant="logout_confirm"
        busy={lifecycleBusy}
        errorText={lifecycleError}
        onClose={closeLifecycleModal}
        onConfirm={confirmLogout}
      />
      <AccountLifecycleModal
        visible={lifecycleModal === 'delete_confirm'}
        variant="delete_confirm"
        busy={lifecycleBusy}
        errorText={lifecycleError}
        onClose={closeLifecycleModal}
        onConfirm={confirmDeleteAccount}
      />
      <AccountLifecycleModal
        visible={lifecycleModal === 'delete_success'}
        variant="delete_success"
        onClose={closeDeleteGoodbye}
        onConfirm={closeDeleteGoodbye}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
