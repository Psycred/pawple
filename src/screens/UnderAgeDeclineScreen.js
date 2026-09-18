import React, { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';

/**
 * Terminal decline for under-18 users. Not an onboarding step.
 * OK signs out via AuthContext so session termination matches Settings logout.
 */
export default function UnderAgeDeclineScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleOk = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await signOut();
    } catch (error) {
      console.error('[UnderAgeDecline] signOut failed', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 32) + theme.spacing.sm,
            paddingBottom: Math.max(insets.bottom, 32),
          },
        ]}
      >
        <Text style={styles.body}>
          Pawple is for people 18 and older, for now. A version with parental consent is on our
          road.
        </Text>
        <Pressable
          onPress={handleOk}
          disabled={busy}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !busy && styles.pressed,
            busy && styles.primaryButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="OK"
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.text.inverse.value} />
          ) : (
            <Text style={styles.primaryButtonText}>OK</Text>
          )}
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.feed.shellPaddingHorizontal,
  },
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.md,
    lineHeight: Math.round(theme.fontSizes.md * 1.45),
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
  },
  primaryButton: {
    backgroundColor: theme.colors.brand.sage.value,
    borderRadius: theme.borderRadius.full,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  pressed: {
    opacity: 0.9,
  },
});
