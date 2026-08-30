import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../config/theme';

/**
 * Post-pet onboarding: calm completion step before entering the app.
 * Push permission is deferred per Product Contract §9 — no misleading prompt.
 */
export default function OnboardingFinalScreen({ navigation }) {
  const { refreshProfile } = useAuth();

  const continueToApp = async () => {
    await refreshProfile?.();
    navigation.replace('MainTabs', { screen: 'FeedScreen' });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>You're in</Text>
        <Text style={styles.body}>
          Your pet's Pawple home is ready. Moments, meetups, and journals are waiting.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={continueToApp}
          accessibilityRole="button"
          accessibilityLabel="Continue to Pawple"
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxxl,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    backgroundColor: theme.colors.primary.light,
    borderRadius: theme.components.button.borderRadius,
    minHeight: theme.components.button.minHeight,
    paddingVertical: theme.components.button.paddingVertical,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.components.button.primaryText,
  },
  pressed: {
    opacity: 0.88,
  },
});
