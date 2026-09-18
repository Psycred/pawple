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
import RequiredBadge from './RequiredBadge';

export const MATING_GENDER_OPTIONS = ['Male', 'Female'];

/**
 * Gender stays optional until a pet is being opened to mating.
 * Selecting an option delegates persistence to the owning screen.
 */
export default function GenderRequiredModal({
  visible,
  petName,
  saving = false,
  errorText = '',
  onSelect,
  onClose,
}) {
  const displayName = String(petName ?? '').trim() || 'your pet';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!saving) {
          onClose?.();
        }
      }}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => {
            if (!saving) {
              onClose?.();
            }
          }}
          accessibilityLabel="Cancel gender selection"
        />
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} allowFontScaling>
            Add gender first
          </Text>
          <Text style={styles.body} allowFontScaling>
            {`Choose gender before ${displayName} is Open to Mating.`}
          </Text>

          <View style={styles.labelRow}>
            <Text style={styles.label} allowFontScaling>
              Gender
            </Text>
            <RequiredBadge />
          </View>

          <View style={styles.options} accessibilityRole="radiogroup">
            {MATING_GENDER_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => onSelect?.(option)}
                disabled={saving}
                style={({ pressed }) => [
                  styles.option,
                  pressed && !saving && styles.pressed,
                ]}
                accessibilityRole="radio"
                accessibilityLabel={option}
              >
                <Text style={styles.optionText} allowFontScaling>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          {saving ? (
            <ActivityIndicator
              color={theme.colors.brand.sage.value}
              style={styles.progress}
              accessibilityLabel="Saving gender"
            />
          ) : null}
          {errorText ? (
            <Text style={styles.error} accessibilityLiveRegion="polite" allowFontScaling>
              {errorText}
            </Text>
          ) : null}

          <Pressable
            onPress={onClose}
            disabled={saving}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText} allowFontScaling>
              Cancel
            </Text>
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
    paddingHorizontal: theme.spacing.xxl,
    backgroundColor: theme.components.bottomSheet.backdrop,
  },
  card: {
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.background.card,
    padding: theme.spacing.xl,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.sm,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: Math.round(theme.fontSizes.md * theme.lineHeights.normal),
    color: theme.colors.text.secondary.light,
    marginBottom: theme.spacing.xl,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.primary.light,
  },
  options: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  option: {
    flex: 1,
    minHeight: theme.components.button.minHeight,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.background.screen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  progress: {
    marginTop: theme.spacing.lg,
  },
  error: {
    marginTop: theme.spacing.md,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.feedback.error.value,
  },
  cancel: {
    minHeight: theme.components.button.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  cancelText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.muted.light,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
