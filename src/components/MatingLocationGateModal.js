import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../config/theme';
import * as Location from 'expo-location';
import { openAppSettings } from '../lib/permissions';
import { requestForegroundLocationGranted } from '../lib/locationPermission';

/**
 * Feature gate before Open to Mating — not an OS permission primer.
 * Explains why location is required; Continue surfaces the native OS sheet.
 */
export default function MatingLocationGateModal({
  visible,
  busy = false,
  onClose,
  onGranted,
}) {
  const handleContinue = async () => {
    const granted = await requestForegroundLocationGranted();
    if (granted) {
      onGranted?.();
      return;
    }
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current?.status === 'denied' && current?.canAskAgain === false) {
        await openAppSettings();
      }
    } catch {
      // Quiet exit — toggle stays off.
    }
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdropPress}
          onPress={busy ? undefined : onClose}
          accessibilityLabel="Close"
        />
        <View style={styles.card} accessibilityViewIsModal accessible>
          <Text style={styles.body} allowFontScaling>
            Approximate location helps find suitable matches nearby.
          </Text>

          <Pressable
            onPress={handleContinue}
            disabled={busy}
            style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.text.inverse.value} />
            ) : (
              <Text style={styles.primaryBtnText} allowFontScaling>Continue</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onClose}
            disabled={busy}
            style={({ pressed }) => [styles.secondaryBtn, pressed && !busy && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={styles.secondaryBtnText} allowFontScaling>Not now</Text>
          </Pressable>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 24,
    color: theme.colors.text.primary.value,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  primaryBtn: {
    minHeight: 48,
    minWidth: 160,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.brand.sage.value,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  primaryBtnText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  secondaryBtn: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  secondaryBtnText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
