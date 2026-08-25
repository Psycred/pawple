import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { theme } from '../config/theme';

/** Soft ease — no snappy “button” bounce */
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.45, 0, 0.55, 1);

/** Each cycle softens slightly, like a calming pulse */
const HEARTBEAT_CYCLES = [
  { lub: 1.11, dub: 1.06 },
  { lub: 1.09, dub: 1.05 },
  { lub: 1.08, dub: 1.04 },
];

/**
 * One lub–dub pair: swell → dip → softer swell → brief rest.
 */
function lubDubSteps(scale, lubPeak, dubPeak, restMs) {
  return [
    Animated.timing(scale, {
      toValue: lubPeak,
      duration: 280,
      easing: EASE_OUT,
      useNativeDriver: true,
    }),
    Animated.timing(scale, {
      toValue: 0.99,
      duration: 220,
      easing: EASE_IN_OUT,
      useNativeDriver: true,
    }),
    Animated.timing(scale, {
      toValue: dubPeak,
      duration: 260,
      easing: EASE_OUT,
      useNativeDriver: true,
    }),
    Animated.timing(scale, {
      toValue: 1,
      duration: restMs,
      easing: EASE_OUT,
      useNativeDriver: true,
    }),
  ];
}

/**
 * Two (or three) gentle lub–dub cycles — emotional, not gamified.
 */
function runGentleHeartbeat(scale) {
  scale.stopAnimation();
  scale.setValue(1);

  const cycleCount = Math.min(
    theme.feed.heartbeatLubDubCycles ?? 2,
    HEARTBEAT_CYCLES.length,
  );
  const steps = [];

  for (let i = 0; i < cycleCount; i += 1) {
    const { lub, dub } = HEARTBEAT_CYCLES[i];
    const isLast = i === cycleCount - 1;
    const restMs = isLast ? 640 : 280;
    steps.push(...lubDubSteps(scale, lub, dub, restMs));
  }

  Animated.sequence(steps).start();
}

/**
 * Heart + share row — lives outside the post card (calm, left-aligned, no counts).
 */
export default function ActionBar({ isLiked, onLike, onShare }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handleLike = () => {
    if (!isLiked) {
      runGentleHeartbeat(scale);
    }
    onLike?.();
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleLike}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={isLiked ? 'Unlike memory' : 'Like memory'}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={theme.feed.heartSize}
            color={isLiked ? theme.feed.likeColor : theme.feed.actionIconColor}
          />
        </Animated.View>
      </Pressable>

      <Pressable
        onPress={onShare}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Share memory"
      >
        <Feather name="share" size={theme.feed.shareSize} color={theme.feed.actionIconColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: theme.feed.actionRowMarginTop,
    paddingHorizontal: theme.feed.frameGap,
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
