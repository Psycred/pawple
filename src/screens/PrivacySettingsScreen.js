import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';

/**
 * Phase 1 placeholder for privacy controls.
 */
export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.group}>
        <View style={[styles.row, styles.disabledRow]}>
          <Text style={styles.rowLabel}>Hide my profile from search</Text>
          <Switch
            value={false}
            disabled
            trackColor={{ false: theme.colors.border.light, true: theme.colors.primary.light }}
            thumbColor={theme.colors.background.light}
            ios_backgroundColor={theme.colors.border.light}
            accessibilityRole="switch"
            accessibilityLabel="Hide my profile from search"
          />
        </View>
        <View style={styles.divider} />
        <View style={[styles.row, styles.disabledRow]}>
          <Text style={styles.rowLabel}>Allow DMs from verified pet parents</Text>
          <Switch
            value={false}
            disabled
            trackColor={{ false: theme.colors.border.light, true: theme.colors.primary.light }}
            thumbColor={theme.colors.background.light}
            ios_backgroundColor={theme.colors.border.light}
            accessibilityRole="switch"
            accessibilityLabel="Allow DMs from verified pet parents"
          />
        </View>
        <View style={styles.divider} />
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          accessibilityRole="button"
          accessibilityLabel="Download my data"
        >
          <Text style={styles.rowLabel}>Download my data</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.muted.light} />
        </Pressable>
      </View>

      <Text style={styles.footerText}>Privacy controls coming in Phase 2.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background.light,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  group: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.card.light,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    overflow: 'hidden',
  },
  row: {
    minHeight: 44,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowLabel: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border.light,
  },
  disabledRow: {
    opacity: 0.5,
  },
  footerText: {
    marginTop: theme.spacing.xl,
    ...theme.fonts.legalDisclosure,
    textAlign: 'center',
  },
});
