import React from 'react';
import { AntDesign, Feather } from '@expo/vector-icons';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';

// OAuth (Google / Apple) — disabled in favor of anonymous guest sign-in.
// import * as AuthSession from 'expo-auth-session';
// import * as WebBrowser from 'expo-web-browser';
// WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const displayFontFamily = 'NunitoSans-SemiBold';
  const displayFontSize = theme.fontSizes.xxl + theme.spacing.xs + theme.spacing.xs / 2;
  const displayFontWeight = theme.fontWeights.semibold;
  const bodyFontFamily = 'Inter-Regular';
  const bodyFontSize = theme.fontSizes.sm;
  const buttonFontFamily = theme.fonts?.button?.family ?? theme.fonts.body;
  const devHintFontFamily = 'Inter-Regular';

  const handleMockOAuth = (provider) => {
    console.log('[Auth] OAuth button pressed:', provider);
    navigation.navigate('InviteCodeScreen', { provider });
  };

  /**
   * Dev-only: jump straight to Onboarding so you can test layout and copy without a Supabase session.
   * Saving the form still needs a real user (getUser); use anonymous sign-in when you test that path.
   */
  const handleDevModeLogin = () => {
    navigation.replace('OnboardingUser', { inviteCode: '' });
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
          style={({ pressed }) => [styles.oauthButton, pressed && styles.oauthButtonActive, pressed && styles.buttonPressed]}
          onPress={() => handleMockOAuth('apple')}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          hitSlop={theme.spacing.xs}
        >
          <View style={styles.oauthButtonInner}>
            <AntDesign
              name="apple1"
              size={theme.fontSizes.xl}
              color={theme.colors.text.primary.light}
            />
            <Text
              style={[
                styles.oauthButtonText,
                { fontFamily: buttonFontFamily },
              ]}
            >
              Continue with Apple
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.oauthButton, pressed && styles.oauthButtonActive, pressed && styles.buttonPressed]}
          onPress={() => handleMockOAuth('google')}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          hitSlop={theme.spacing.xs}
        >
          <View style={styles.oauthButtonInner}>
            <AntDesign
              name="google"
              size={theme.fontSizes.xl}
              color={theme.colors.text.primary.light}
            />
            <Text
              style={[
                styles.oauthButtonText,
                { fontFamily: buttonFontFamily },
              ]}
            >
              Continue with Google
            </Text>
          </View>
        </Pressable>

        {__DEV__ ? (
          <View style={styles.devModeWrap}>
            <Text style={[styles.devModeText, { fontFamily: devHintFontFamily }]}>Dev Mode: Mock OAuth enabled</Text>
            <Pressable style={({ pressed }) => [styles.devSkipButton, pressed && styles.buttonPressed]} onPress={handleDevModeLogin}>
              <Text style={[styles.devSkipText, { fontFamily: devHintFontFamily }]}>Skip to Onboarding</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
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
  oauthButtonTextActive: {
    color: theme.colors.background.screen,
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
});
