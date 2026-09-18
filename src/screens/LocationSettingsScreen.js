import React, { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

/**
 * Phase 1 placeholder for location controls.
 */
export default function LocationSettingsScreen() {
  const surfaces = useRuntimeThemeColors();
  const insets = useSafeAreaInsets();

  const locationTheme = useMemo(
    () => ({
      screen: { backgroundColor: surfaces.backgroundScreen },
      group: {
        backgroundColor: surfaces.backgroundCard,
        borderColor: surfaces.border,
      },
      rowLabel: { color: surfaces.textPrimary },
      divider: { backgroundColor: surfaces.border },
      footerText: { color: surfaces.textMuted },
      switchTrack: {
        false: surfaces.border,
        true: theme.colors.primary.light,
      },
      switchThumb: surfaces.backgroundScreen,
      switchIosBackground: surfaces.border,
    }),
    [
      surfaces.backgroundCard,
      surfaces.backgroundScreen,
      surfaces.border,
      surfaces.textMuted,
      surfaces.textPrimary,
    ],
  );

  return (
    <View style={[styles.screen, locationTheme.screen, { paddingTop: insets.top }]}>
      <View style={[styles.group, locationTheme.group]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, locationTheme.rowLabel]}>City: Mumbai</Text>
        </View>
        <View style={[styles.divider, locationTheme.divider]} />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, locationTheme.rowLabel]}>Meetup Radius: 25 km</Text>
        </View>
        <View style={[styles.divider, locationTheme.divider]} />
        <View style={[styles.row, styles.disabledRow]}>
          <Text style={[styles.rowLabel, locationTheme.rowLabel]}>Use precise location</Text>
          <Switch
            value={false}
            disabled
            trackColor={locationTheme.switchTrack}
            thumbColor={locationTheme.switchThumb}
            ios_backgroundColor={locationTheme.switchIosBackground}
            accessibilityRole="switch"
            accessibilityLabel="Use precise location"
          />
        </View>
      </View>

      <Text style={[styles.footerText, locationTheme.footerText]}>
        Full location controls coming in Phase 2.
      </Text>
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
  },
  rowLabel: {
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
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
});
