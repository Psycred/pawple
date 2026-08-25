import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';
import { openAppSettings } from '../lib/permissions';
import { requestNotificationPermission } from '../lib/notifications';

/**
 * Calm, contextual nudge used before asking for notification permissions.
 */
export default function NotificationNudge({ onEnabled, onDismiss, onEnablePress }) {
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    if (onEnablePress) {
      setLoading(true);
      try {
        await onEnablePress();
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    const granted = await requestNotificationPermission();
    setLoading(false);
    if (granted) {
      onEnabled?.();
      return;
    }
    onDismiss?.();
    openAppSettings();
  };

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.title}>Stay in the loop</Text>
      <Text style={styles.body}>Get likes, meetup invites, and gentle journal reminders.</Text>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Text style={styles.secondaryText}>Not now</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          onPress={handleEnable}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Enable notifications"
        >
          <Text style={styles.primaryText}>{loading ? 'Checking…' : 'Enable'}</Text>
        </Pressable>
      </View>
      <Text
        style={styles.reassurance}
        accessibilityRole="text"
        accessibilityLabel="You can always change notification settings later"
      >
        You can always change this later in Settings.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card.light,
    borderColor: theme.colors.border.light,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.xs,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    marginBottom: theme.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  secondary: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
  primary: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semibold,
    color: theme.components.button.primaryText,
  },
  pressed: {
    opacity: 0.85,
  },
  reassurance: {
    marginTop: theme.spacing.sm,
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
});
