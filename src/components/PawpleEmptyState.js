import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

/**
 * Calm empty result — distinct from LoadErrorRetry (genuine load failures).
 * Matches the heading/body hierarchy used on discovery and notifications surfaces.
 */
export default function PawpleEmptyState({ title, body, style, children }) {
  const surfaces = useRuntimeThemeColors();

  return (
    <View style={[styles.wrap, style]}>
      <Text style={[styles.title, { color: surfaces.textPrimary }]} allowFontScaling>
        {title}
      </Text>
      {body ? (
        <Text style={[styles.body, { color: surfaces.textSecondary }]} allowFontScaling>
          {body}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.lg,
    lineHeight: Math.round(theme.fontSizes.lg * theme.lineHeights.normal),
    color: theme.colors.text.primary.light,
    textAlign: 'center',
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
  },
});
