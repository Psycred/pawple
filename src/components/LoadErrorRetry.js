import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';

/**
 * Calm retry state for list screens — distinct from genuine empty results.
 */
export default function LoadErrorRetry({ onRetry, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.message} allowFontScaling>
        Couldn&apos;t load. Check your connection.
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={styles.retryText} allowFontScaling>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxxl,
  },
  message: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: Math.round(theme.fontSizes.md * theme.lineHeights.normal),
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  retry: {
    minHeight: theme.components.button.minHeight,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  retryText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.brand.sage.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
