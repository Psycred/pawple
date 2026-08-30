import React, { useState } from 'react';
import { AntDesign, Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';

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

export default function AuthScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { signInWithOAuth } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState(null);
  const [authError, setAuthError] = useState(null);

  const displayFontFamily = 'NunitoSans-SemiBold';
  const displayFontSize = theme.fontSizes.xxl + theme.spacing.xs + theme.spacing.xs / 2;
  const displayFontWeight = theme.fontWeights.semibold;
  const bodyFontFamily = 'Inter-Regular';
  const bodyFontSize = theme.fontSizes.sm;
  const buttonFontFamily = theme.fonts?.button?.family ?? theme.fonts.body;
  const devHintFontFamily = 'Inter-Regular';
  const isBusy = Boolean(loadingProvider);

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
      // AuthContext + AppNavigator route authenticated users to InviteCodeScreen.
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
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: Math.max(insets.top, theme.spacing.xxl), paddingBottom: theme.spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandWrap}>
          <View style={styles.logoWrap}>
            <Feather name="heart" size={theme.spacing.xxl} color={theme.colors.background.screen} />
          </View>
          <Text
            style={[
              styles.title,
              { fontFamily: displayFontFamily, fontSize: displayFontSize, fontWeight: displayFontWeight },
            ]}
          >
            pawple
          </Text>
          <Text style={[styles.subtitle, { fontFamily: bodyFontFamily, fontSize: bodyFontSize }]}>One heart is enough.</Text>
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
          hitSlop={theme.spacing.xs}
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
          hitSlop={theme.spacing.xs}
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
            <Text style={[styles.devModeText, { fontFamily: devHintFontFamily }]}>Dev Mode: anonymous sign-in available</Text>
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
          <Pressable style={styles.modalBackdropPress} onPress={() => setAuthError(null)} accessibilityLabel="Dismiss error message" />
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
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.xxxl,
  },
  brandWrap: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  logoWrap: {
    width: theme.spacing.xxxl + theme.spacing.lg + theme.spacing.sm,
    height: theme.spacing.xxxl + theme.spacing.lg + theme.spacing.sm,
    borderRadius: theme.spacing.xxl + theme.spacing.xs,
    marginBottom: theme.spacing.md + theme.spacing.sm,
    alignSelf: 'center',
    backgroundColor: theme.colors.brand.sage.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.text.primary.light,
    letterSpacing: 0.1,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.placeholder.value,
    opacity: 0.86,
    fontWeight: theme.fontWeights.regular,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
  },
  oauthButton: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.lg + theme.spacing.xs / 2,
    paddingHorizontal: theme.spacing.xl,
    minHeight: theme.components.button.minHeight + theme.spacing.xs,
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
    letterSpacing: 0.3,
    marginLeft: theme.spacing.md,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  devModeWrap: {
    marginTop: theme.spacing.xxl,
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
