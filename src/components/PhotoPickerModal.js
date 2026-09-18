import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { beginPhotoFlowAttempt, logPhotoFlow } from '../lib/photoFlowDiagnostics';

/**
 * Shared Pawple photo source chooser — Camera, Gallery, Cancel.
 * iOS: RN Modal → exit animation → onClose → native onDismiss → onSelectSource.
 * Android: in-tree overlay → exit animation → onClose → unmount → onSelectSource.
 */

function PhotoPickerChooserPanel({
  backdropOpacity,
  cardOpacity,
  cardScale,
  cardTranslateY,
  surfaces,
  onSelectSource,
  onDismiss,
}) {
  return (
    <View style={styles.root}>
      <Pressable
        style={styles.backdropTouch}
        onPress={onDismiss}
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
            backgroundColor: surfaces.backgroundElevated,
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
          },
        ]}
      >
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => onSelectSource('camera')}
            accessibilityRole="button"
            accessibilityLabel="Camera"
          >
            <Text style={styles.primaryBtnText} allowFontScaling>
              Camera
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: surfaces.backgroundScreen },
              pressed && styles.pressed,
            ]}
            onPress={() => onSelectSource('gallery')}
            accessibilityRole="button"
            accessibilityLabel="Gallery"
          >
            <Text style={[styles.secondaryBtnText, { color: surfaces.textPrimary }]} allowFontScaling>
              Gallery
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={[styles.cancelText, { color: surfaces.textMuted }]} allowFontScaling>
            Cancel
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function usePhotoPickerAnimations(visible) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.94)).current;
  const cardTranslateY = useRef(new Animated.Value(72)).current;
  const actionInFlight = useRef(false);

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
      actionInFlight.current = false;
      runEnter();
    }
  }, [visible]);

  return {
    backdropOpacity,
    cardOpacity,
    cardScale,
    cardTranslateY,
    actionInFlight,
    runExit,
  };
}

/** Android exit animation — always runs the close callback even if interrupted. */
function usePhotoPickerAnimationsAndroid(visible) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.94)).current;
  const cardTranslateY = useRef(new Animated.Value(72)).current;
  const actionInFlight = useRef(false);

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
    ]).start(() => {
      if (then) {
        then();
      }
    });
  };

  useEffect(() => {
    if (visible) {
      actionInFlight.current = false;
      runEnter();
    }
  }, [visible]);

  return {
    backdropOpacity,
    cardOpacity,
    cardScale,
    cardTranslateY,
    actionInFlight,
    runExit,
  };
}

/** iOS — unchanged RN Modal + onDismiss handoff. */
function PhotoPickerModalIOS({
  visible,
  photoModalPetIndex = null,
  onClose,
  onSelectSource,
}) {
  const surfaces = useRuntimeThemeColors();
  const pendingSourceRef = useRef(null);
  const {
    backdropOpacity,
    cardOpacity,
    cardScale,
    cardTranslateY,
    actionInFlight,
    runExit,
  } = usePhotoPickerAnimations(visible);

  const handleModalDismiss = () => {
    const pending = pendingSourceRef.current;
    pendingSourceRef.current = null;
    if (pending == null) {
      return;
    }
    const { source, petIndex, attemptId } = pending;
    logPhotoFlow('modal_on_select_source', { source, attemptId, petIndex, platform: 'ios' });
    Promise.resolve(onSelectSource?.(source, petIndex)).catch((e) => {
      console.log('[PhotoPickerModal] source action:', e);
    });
  };

  const dismiss = () => {
    runExit(() => {
      logPhotoFlow('modal_on_close', { reason: 'cancel', platform: 'ios' });
      onClose?.();
      actionInFlight.current = false;
    });
  };

  const selectSource = (source) => {
    if (actionInFlight.current) {
      return;
    }
    actionInFlight.current = true;
    const attemptId = beginPhotoFlowAttempt(source);
    logPhotoFlow('modal_select_source', { source, attemptId, petIndex: photoModalPetIndex, platform: 'ios' });
    pendingSourceRef.current = { source, petIndex: photoModalPetIndex, attemptId };
    runExit(() => {
      logPhotoFlow('modal_on_close', { source, attemptId, petIndex: photoModalPetIndex, platform: 'ios' });
      onClose?.();
      actionInFlight.current = false;
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismiss}
      onDismiss={handleModalDismiss}
      statusBarTranslucent
    >
      <PhotoPickerChooserPanel
        backdropOpacity={backdropOpacity}
        cardOpacity={cardOpacity}
        cardScale={cardScale}
        cardTranslateY={cardTranslateY}
        surfaces={surfaces}
        onSelectSource={selectSource}
        onDismiss={dismiss}
      />
    </Modal>
  );
}

/**
 * Android — in-tree overlay within the same Activity (no RN Modal Dialog).
 * Preserves the selection, closes via onClose, then delivers onSelectSource after unmount.
 */
function PhotoPickerModalAndroid({
  visible,
  photoModalPetIndex = null,
  onClose,
  onSelectSource,
}) {
  const surfaces = useRuntimeThemeColors();
  const pendingDeliveryRef = useRef(null);
  const deliveredRef = useRef(false);
  /** True from source tap until pending selection is delivered or cancel clears it. */
  const handoffInFlightRef = useRef(false);
  const onSelectSourceRef = useRef(onSelectSource);
  onSelectSourceRef.current = onSelectSource;

  const {
    backdropOpacity,
    cardOpacity,
    cardScale,
    cardTranslateY,
    actionInFlight,
    runExit,
  } = usePhotoPickerAnimationsAndroid(visible);

  const deliverPendingSelection = () => {
    const pending = pendingDeliveryRef.current;
    if (!pending || deliveredRef.current) {
      return;
    }

    deliveredRef.current = true;
    pendingDeliveryRef.current = null;
    handoffInFlightRef.current = false;
    const { source, petIndex, attemptId } = pending;
    logPhotoFlow('modal_on_select_source', { source, attemptId, petIndex, platform: 'android' });
    Promise.resolve(onSelectSourceRef.current?.(source, petIndex)).catch((e) => {
      console.log('[PhotoPickerModal] source action:', e);
    });
  };

  useEffect(() => {
    if (visible) {
      if (!handoffInFlightRef.current) {
        deliveredRef.current = false;
        pendingDeliveryRef.current = null;
      }
      return;
    }

    deliverPendingSelection();
  }, [visible]);

  const dismiss = () => {
    handoffInFlightRef.current = false;
    pendingDeliveryRef.current = null;
    runExit(() => {
      logPhotoFlow('modal_on_close', { reason: 'cancel', platform: 'android' });
      onClose?.();
      actionInFlight.current = false;
    });
  };

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => subscription.remove();
  }, [visible]);

  const selectSource = (source) => {
    if (actionInFlight.current) {
      return;
    }
    actionInFlight.current = true;
    handoffInFlightRef.current = true;
    const attemptId = beginPhotoFlowAttempt(source);
    logPhotoFlow('modal_select_source', { source, attemptId, petIndex: photoModalPetIndex, platform: 'android' });
    pendingDeliveryRef.current = { source, petIndex: photoModalPetIndex, attemptId };
    runExit(() => {
      logPhotoFlow('modal_on_close', { source, attemptId, petIndex: photoModalPetIndex, platform: 'android' });
      onClose?.();
      actionInFlight.current = false;
      deliverPendingSelection();
    });
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.androidOverlay} accessibilityViewIsModal>
      <PhotoPickerChooserPanel
        backdropOpacity={backdropOpacity}
        cardOpacity={cardOpacity}
        cardScale={cardScale}
        cardTranslateY={cardTranslateY}
        surfaces={surfaces}
        onSelectSource={selectSource}
        onDismiss={dismiss}
      />
    </View>
  );
}

export default function PhotoPickerModal(props) {
  if (Platform.OS === 'android') {
    return <PhotoPickerModalAndroid {...props} />;
  }
  return <PhotoPickerModalIOS {...props} />;
}

const styles = StyleSheet.create({
  androidOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 24,
  },
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
    backgroundColor: theme.components.bottomSheet.backdrop,
  },
  card: {
    zIndex: 2,
    width: '100%',
    maxWidth: 400,
    borderRadius: 22,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  actions: {
    gap: theme.spacing.sm,
  },
  primaryBtn: {
    width: '100%',
    minHeight: theme.components.button.minHeight,
    borderRadius: 22,
    backgroundColor: theme.colors.brand.sage.value,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  primaryBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  secondaryBtn: {
    width: '100%',
    minHeight: theme.components.button.minHeight,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  secondaryBtnText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
  },
  cancelBtn: {
    marginTop: theme.spacing.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
