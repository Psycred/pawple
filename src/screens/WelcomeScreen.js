import React, { useCallback, useState } from 'react';
import { AntDesign } from '@expo/vector-icons';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

/** Dev-only session bootstrap for local testing without OAuth providers. */
async function ensureDevSession() {
  if (!__DEV__) {
    return { ok: false, error: 'Dev sign-in is unavailable in production builds.' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    return { ok: true };
  }

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('[Auth] Anonymous auth failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Design Wave 5 (§1): pet-first cold open — welcome and sign-in on one calm screen.
 */
export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { signInWithOAuth, beginSignIn } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState(null);
  const [authError, setAuthError] = useState(null);

  const buttonFontFamily = theme.fonts?.button?.family ?? theme.fonts.body;
  const devHintFontFamily = 'Inter-Regular';
  const isBusy = Boolean(loadingProvider);
  const surfaces = useRuntimeThemeColors();

  // PAW-180 V1.1: logged-out entry must not back-navigate into authenticated stack history.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => true;
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, []),
  );

  const handleOAuth = async (provider) => {
    if (isBusy) {
      return;
    }

    setAuthError(null);
    setLoadingProvider(provider);

    try {
      const result = await signInWithOAuth(provider);
      if (result?.cancelled) {
        return;
      }
      // AuthContext routes authenticated users to InviteCodeScreen.
    } catch (error) {
      console.error('[Auth] OAuth failed:', error);
      setAuthError(error?.message ?? 'Sign-in failed. Please try again.');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleDevModeLogin = async () => {
    if (isBusy) {
      return;
    }

    setAuthError(null);
    setLoadingProvider('dev');

    try {
      beginSignIn();
      const result = await ensureDevSession();
      if (!result.ok) {
        setAuthError(result.error ?? 'Dev sign-in failed. Please try again.');
        return;
      }
      navigation.navigate('InviteCodeScreen');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: surfaces.backgroundScreen }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 32) + theme.spacing.sm,
            paddingBottom: Math.max(insets.bottom, 32),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandWrap}>
          <Image
            source={require('../../assets/brand/dist/lockup-stacked-1024w.png')}
            style={styles.logoLockup}
            resizeMode="contain"
            accessibilityLabel="Pawple"
          />
          <Text style={styles.headline} allowFontScaling>
            One heart is enough.
          </Text>
          <Text style={styles.supporting} allowFontScaling>
            For the pet you love.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.oauthButton,
            pressed && !isBusy && styles.oauthButtonActive,
            pressed && !isBusy && styles.buttonPressed,
            isBusy && styles.oauthButtonDisabled,
          ]}
          onPress={() => handleOAuth('apple')}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
        >
          <View style={styles.oauthButtonInner}>
            {loadingProvider === 'apple' ? (
              <ActivityIndicator color={theme.colors.text.primary.light} />
            ) : (
              <AntDesign name="apple1" size={theme.fontSizes.xl} color={theme.colors.text.primary.light} />
            )}
            <Text style={[styles.oauthButtonText, { fontFamily: buttonFontFamily }]}>Continue with Apple</Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.oauthButton,
            pressed && !isBusy && styles.oauthButtonActive,
            pressed && !isBusy && styles.buttonPressed,
            isBusy && styles.oauthButtonDisabled,
          ]}
          onPress={() => handleOAuth('google')}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <View style={styles.oauthButtonInner}>
            {loadingProvider === 'google' ? (
              <ActivityIndicator color={theme.colors.text.primary.light} />
            ) : (
              <AntDesign name="google" size={theme.fontSizes.xl} color={theme.colors.text.primary.light} />
            )}
            <Text style={[styles.oauthButtonText, { fontFamily: buttonFontFamily }]}>Continue with Google</Text>
          </View>
        </Pressable>

        {__DEV__ ? (
          <View style={styles.devModeWrap}>
            <Text style={[styles.devModeText, { fontFamily: devHintFontFamily }]}>
              Dev Mode: anonymous sign-in available
            </Text>
            <Pressable
              style={({ pressed }) => [styles.devSkipButton, pressed && styles.buttonPressed, isBusy && styles.oauthButtonDisabled]}
              onPress={handleDevModeLogin}
              disabled={isBusy}
            >
              <Text style={[styles.devSkipText, { fontFamily: devHintFontFamily }]}>
                {loadingProvider === 'dev' ? 'Signing in…' : 'Continue with dev session'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(authError)} transparent animationType="fade" onRequestClose={() => setAuthError(null)}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdropPress}
            onPress={() => setAuthError(null)}
            accessibilityLabel="Dismiss error message"
          />
          <View style={styles.modalCard} accessibilityViewIsModal accessible>
            <Text style={styles.modalTitle}>Sign-in failed</Text>
            <Text style={styles.modalBody}>{authError}</Text>
            <Pressable
              onPress={() => setAuthError(null)}
              style={({ pressed }) => [styles.modalButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.modalButtonText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.feed.shellPaddingHorizontal,
  },
  brandWrap: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logoLockup: {
    width: '62.5%',
    aspectRatio: 72 / 103,
    marginBottom: theme.spacing.lg,
  },
  headline: {
    fontFamily: 'Inter-SemiBold',
    fontSize: theme.fontSizes.creationTitle ?? theme.fontSizes.xxl,
    color: theme.colors.text.primary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  supporting: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.md,
    lineHeight: Math.round(theme.fontSizes.md * 1.45),
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
  },
  oauthButton: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.full,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    marginBottom: theme.spacing.md,
  },
  oauthButtonActive: {
    backgroundColor: theme.colors.brand.sage.light,
    borderColor: theme.colors.brand.sage.light,
  },
  oauthButtonDisabled: {
    opacity: 0.6,
  },
  oauthButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  oauthButtonText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    fontWeight: theme.fontWeights.semibold,
    marginLeft: theme.spacing.md,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  devModeWrap: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
  },
  devModeText: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
  devSkipButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  devSkipText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(47, 47, 47, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalBackdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '85%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: theme.spacing.xs },
    shadowOpacity: 0.08,
    shadowRadius: theme.spacing.sm,
    elevation: 3,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: Platform.select({ ios: 'Inter-SemiBold', android: 'Inter-SemiBold', default: 'System' }),
    fontWeight: theme.fontWeights.semibold,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: Platform.select({ ios: 'Inter-Regular', android: 'Inter-Regular', default: 'System' }),
    fontWeight: theme.fontWeights.regular,
    fontSize: theme.fontSizes.md - 1,
    color: theme.colors.text.secondary.light,
    lineHeight: theme.fontSizes.xl + 2,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  modalButton: {
    backgroundColor: theme.colors.brand.sage.light,
    borderRadius: theme.borderRadius.xl + 2,
    paddingVertical: theme.components.button.paddingVertical,
    paddingHorizontal: theme.spacing.xxl,
    minHeight: theme.components.button.minHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    color: theme.colors.text.inverse.value,
    fontFamily: theme.fonts?.button?.family ?? theme.fonts.body,
    fontWeight: theme.fontWeights.semibold,
    fontSize: theme.fontSizes.md - 1,
  },
});
