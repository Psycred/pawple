import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';

/**
 * Calm note about notification status. Beta does not request OS permission
 * because push delivery is deferred (Product Contract §9).
 */
export default function NotificationNudge({ onDismiss }) {
  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.title}>No alerts yet</Text>
      <Text style={styles.body}>
        Push notifications aren't part of beta. Pawple will ask only when gentle reminders are ready.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Continue"
      >
        <Text style={styles.primaryText}>Continue</Text>
      </Pressable>
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
});
