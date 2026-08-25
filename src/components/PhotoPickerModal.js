import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../config/theme';

/**
 * Apple-style photo source picker: fade backdrop + centered card (fade, scale, slight lift).
 * Exit animation runs before `onClose` so the parent can clear state without flashing.
 */
export default function PhotoPickerModal({
  visible,
  petDisplayName,
  onClose,
  onTakePhoto,
  onChooseFromLibrary,
}) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.94)).current;
  /** Starts slightly below center so spring reads like a confident upward settle (Apple-style sheet cue). */
  const cardTranslateY = useRef(new Animated.Value(72)).current;

  const runEnter = () => {
    backdropOpacity.setValue(0);
    cardOpacity.setValue(0);
    cardScale.setValue(0.94);
    cardTranslateY.setValue(72);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        tension: 68,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 68,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const runExit = (then) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.96,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 56,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && then) {
        then();
      }
    });
  };

  useEffect(() => {
    if (visible) {
      runEnter();
    }
  }, [visible]);

  const dismiss = () => {
    runExit(onClose);
  };

  const handleSkip = () => {
    dismiss();
  };

  const handleBackdropPress = () => {
    dismiss();
  };

  const handleTakePhoto = async () => {
    try {
      const picked = await onTakePhoto();
      if (picked) {
        runExit(onClose);
      }
    } catch (e) {
      console.log('[PhotoPickerModal] Take photo:', e);
    }
  };

  const handleChooseLibrary = async () => {
    try {
      const picked = await onChooseFromLibrary();
      if (picked) {
        runExit(onClose);
      }
    } catch (e) {
      console.log('[PhotoPickerModal] Library:', e);
    }
  };

  const headerPet = petDisplayName?.trim() || 'your pet';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleSkip}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdropTouch}
          onPress={handleBackdropPress}
          accessibilityRole="button"
          accessibilityLabel="Dismiss photo options"
        >
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, styles.backdropFill, { opacity: backdropOpacity }]}
          />
        </Pressable>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
            },
          ]}
        >
          <Text style={styles.title}>{`🐾 Capture ${headerPet}'s Best Side`}</Text>
          <Text style={styles.subtitle}>A photo helps other pet parents recognize your friend</Text>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
              onPress={handleTakePhoto}
              accessibilityRole="button"
              accessibilityLabel="Take photo with camera"
            >
              <Text style={styles.primaryEmoji} accessibilityElementsHidden>
                📸
              </Text>
              <Text style={styles.primaryBtnText}>Take Photo</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
              onPress={handleChooseLibrary}
              accessibilityRole="button"
              accessibilityLabel="Choose photo from library"
            >
              <Text style={styles.primaryEmoji} accessibilityElementsHidden>
                🖼️
              </Text>
              <Text style={styles.primaryBtnText}>Choose from Library</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Skip adding photo for now"
          >
            <Text style={styles.skipText}>Skip for Now</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFill: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  card: {
    zIndex: 2,
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.primary.light,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.components.button.minHeight + 36,
  },
  primaryBtnPressed: {
    opacity: 0.92,
  },
  primaryEmoji: {
    fontSize: 48,
    lineHeight: 52,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  primaryBtnText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  skipBtn: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  skipBtnPressed: {
    opacity: 0.75,
  },
  skipText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.muted.light,
  },
});
