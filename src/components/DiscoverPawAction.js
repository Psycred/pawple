import React, { useCallback, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../config/theme';

/**
 * Discover-only Paw — sits outside the memory card (feed heart position).
 * Default: light Pawple green outline. Expressed: solid sage (viewer-only state).
 */
export default function DiscoverPawAction({
  expressed = false,
  busy = false,
  stateKnown = true,
  onPress,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const disabled = busy || !stateKnown;

  const handlePress = useCallback(() => {
    if (disabled) {
      return;
    }
    if (!expressed) {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.12,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 110,
          useNativeDriver: true,
        }),
      ]).start();
    }
    onPress?.();
  }, [disabled, expressed, onPress, scale]);

  const label = !stateKnown
    ? 'Loading interest state'
    : expressed
      ? 'Interest expressed'
      : 'Express interest';

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        !stateKnown
          ? styles.buttonUnknown
          : expressed
            ? styles.buttonExpressed
            : styles.buttonDefault,
        (pressed || disabled) && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: expressed && stateKnown, busy: disabled }}
      accessibilityLabel={label}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={expressed && stateKnown ? 'paw' : 'paw-outline'}
          size={theme.feed.heartSize}
          color={
            !stateKnown
              ? theme.colors.text.muted.value
              : expressed
                ? theme.colors.text.inverse.value
                : theme.colors.brand.sageDark.value
          }
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonDefault: {
    backgroundColor: theme.colors.brand.sageLight.light,
    borderColor: theme.colors.brand.sageMuted.value,
    opacity: 0.92,
  },
  buttonExpressed: {
    backgroundColor: theme.colors.brand.sage.value,
    borderColor: theme.colors.brand.sage.value,
  },
  buttonUnknown: {
    backgroundColor: theme.colors.background.card,
    borderColor: theme.colors.border.light,
    opacity: 0.72,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
