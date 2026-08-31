import React, { useCallback, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../config/theme';

/**
 * Mating interest Paw — sage family when expressed; soft single pulse (not feed heart).
 * Place below evaluation context only — never hero-adjacent.
 */
export default function MatingPawButton({
  expressed = false,
  busy = false,
  onPress,
  labelIdle = 'Paw',
  labelExpressed = 'Interest expressed',
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    if (busy) {
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
  }, [busy, expressed, onPress, scale]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        expressed && styles.buttonExpressed,
        (pressed || busy) && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: expressed, busy }}
      accessibilityLabel={expressed ? labelExpressed : labelIdle}
    >
      <Animated.View style={[styles.inner, { transform: [{ scale }] }]}>
        <Ionicons
          name={expressed ? 'paw' : 'paw-outline'}
          size={22}
          color={
            expressed
              ? theme.colors.text.inverse.value
              : theme.colors.brand.sageDark.value
          }
        />
        <Text
          style={[styles.label, expressed && styles.labelExpressed]}
          allowFontScaling
        >
          {expressed ? labelExpressed : labelIdle}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 999,
    paddingHorizontal: 24,
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sageLight.light,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.brand.sageMuted.value,
  },
  buttonExpressed: {
    backgroundColor: theme.colors.brand.sage.value,
    borderColor: theme.colors.brand.sage.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.brand.sageDark.value,
  },
  labelExpressed: {
    color: theme.colors.text.inverse.value,
  },
});
