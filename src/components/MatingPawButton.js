import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

/**
 * Mating interest Paw — sage family when expressed; soft single pulse (not feed heart).
 * Place below evaluation context only — never hero-adjacent.
 */
export default function MatingPawButton({
  expressed = false,
  matched = false,
  busy = false,
  compact = false,
  onPress,
  labelIdle = 'Paw',
  labelExpressed = 'Interest expressed',
  labelMatched = 'Matched',
}) {
  const surfaces = useRuntimeThemeColors();
  const scale = useRef(new Animated.Value(1)).current;
  const idleChipStyle = useMemo(
    () => ({
      backgroundColor: surfaces.isDark
        ? surfaces.meetupChipBackground
        : theme.colors.brand.sageLight.light,
      borderColor: theme.colors.brand.sageMuted.value,
    }),
    [surfaces.isDark, surfaces.meetupChipBackground],
  );

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

  const active = expressed || matched;
  const label = matched ? labelMatched : expressed ? labelExpressed : labelIdle;

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      style={({ pressed }) => [
        compact ? styles.buttonCompact : styles.button,
        !active && idleChipStyle,
        active && styles.buttonExpressed,
        (pressed || busy) && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active, busy }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.inner, compact && styles.innerCompact, { transform: [{ scale }] }]}>
        <Ionicons
          name={active ? 'paw' : 'paw-outline'}
          size={compact ? 18 : 22}
          color={
            active
              ? theme.colors.text.inverse.value
              : theme.colors.brand.sageDark.value
          }
        />
        {!compact ? (
          <Text
            style={[styles.label, active && styles.labelExpressed]}
            allowFontScaling
          >
            {label}
          </Text>
        ) : null}
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
  buttonCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
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
  innerCompact: {
    gap: 0,
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
