import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../config/theme';

const NOT_FOR_ME_LABEL = 'Not for me';

/**
 * Quiet dismiss affordance beside the Paw action.
 */
export default function MatingNotForMeAction({ onPress, busy = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || !onPress}
      style={({ pressed }) => [styles.press, (pressed || busy) && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ busy }}
      accessibilityLabel={NOT_FOR_ME_LABEL}
    >
      <Text style={styles.label} allowFontScaling>
        {NOT_FOR_ME_LABEL}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.feedback.error.value,
  },
});
