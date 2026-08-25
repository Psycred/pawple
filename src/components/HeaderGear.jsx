import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { theme } from '../config/theme';

/**
 * Icon-only account trigger. Keep this subtle so the pet selector stays dominant.
 */
export default function HeaderGear({ visible, onPress }) {
  if (!visible) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      accessibilityRole="button"
      accessibilityLabel="Open account settings"
      accessibilityHint="Opens account and settings menu"
    >
      <Ionicons
        name="settings-outline"
        size={theme.fontSizes.xxl}
        color={theme.colors.text.muted.light}
        style={styles.icon}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: theme.spacing.xxxl,
    minHeight: theme.spacing.xxxl,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  icon: {
    opacity: 0.6,
  },
});
