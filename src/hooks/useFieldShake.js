import { useCallback, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Gentle horizontal shake — iOS-style field error feedback.
 */
export function useFieldShake() {
  const titleShake = useRef(new Animated.Value(0)).current;
  const dateShake = useRef(new Animated.Value(0)).current;
  const timeShake = useRef(new Animated.Value(0)).current;
  const petsShake = useRef(new Animated.Value(0)).current;
  const directionsShake = useRef(new Animated.Value(0)).current;

  const anims = useRef({
    title: titleShake,
    date: dateShake,
    time: timeShake,
    pets: petsShake,
    directions: directionsShake,
  }).current;

  const shakeField = useCallback(
    (field) => {
      const anim = anims[field];
      if (!anim) {
        return;
      }
      anim.setValue(0);
      Animated.sequence([
        Animated.timing(anim, { toValue: 8, duration: 45, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(anim, { toValue: -8, duration: 45, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 5, duration: 45, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(anim, { toValue: -5, duration: 45, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 45, easing: Easing.linear, useNativeDriver: true }),
      ]).start();
    },
    [anims],
  );

  return { anims, shakeField };
}
