import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

/**
 * Quietly identifies user-entered fields that cannot be skipped.
 * Validation remains separate so the normal state never looks alarming.
 */
export default function RequiredBadge() {
  const surfaces = useRuntimeThemeColors();
  const badgeTheme = useMemo(
    () => ({
      badge: {
        backgroundColor: surfaces.isDark
          ? surfaces.meetupChipBackground
          : theme.colors.brand.sageLight.light,
      },
    }),
    [surfaces.isDark, surfaces.meetupChipBackground],
  );

  return (
    <View style={[styles.badge, badgeTheme.badge]} accessible accessibilityLabel="Required">
      <Text style={styles.text} allowFontScaling>
        Required
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.brand.sageLight.light,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  text: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.brand.sageDark.light,
  },
});
