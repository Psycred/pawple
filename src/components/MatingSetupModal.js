import React, { useEffect, useState } from 'react';
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
import {
  MATING_BREED_PREFERENCE_OPTIONS,
  MATING_BREED_PREFERENCES,
  MATING_GENDER_OPTIONS,
  isValidMatingGender,
  normalizeMatingGender,
} from '../lib/matingEligibility';

/**
 * Compact Open-to-Mating setup — gender (when missing) + breed preference.
 * Selections stay local until Continue so cancel never partially enables Mating.
 */
export default function MatingSetupModal({
  visible,
  petName,
  existingGender = '',
  existingBreedPreference = '',
  saving = false,
  errorText = '',
  onConfirm,
  onClose,
}) {
  const displayName = String(petName ?? '').trim() || 'your pet';
  const genderKnown = isValidMatingGender(existingGender);
  const [gender, setGender] = useState('');
  const [breedPreference, setBreedPreference] = useState(
    MATING_BREED_PREFERENCES.SAME_BREED,
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    setGender(genderKnown ? normalizeMatingGender(existingGender) : '');
    setBreedPreference(
      existingBreedPreference === MATING_BREED_PREFERENCES.ALL_BREEDS
        ? MATING_BREED_PREFERENCES.ALL_BREEDS
        : MATING_BREED_PREFERENCES.SAME_BREED,
    );
  }, [visible, existingGender, existingBreedPreference, genderKnown]);

  const handleContinue = () => {
    if (!genderKnown && !isValidMatingGender(gender)) {
      return;
    }
    onConfirm?.({
      gender: genderKnown ? undefined : normalizeMatingGender(gender),
      breedPreference,
    });
  };

  const canContinue =
    !saving &&
    (genderKnown || isValidMatingGender(gender)) &&
    (breedPreference === MATING_BREED_PREFERENCES.SAME_BREED ||
      breedPreference === MATING_BREED_PREFERENCES.ALL_BREEDS);

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
          accessibilityLabel="Cancel Mating setup"
        />
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} allowFontScaling>
            {genderKnown ? 'Who would you like to meet?' : 'Get your pet ready to meet'}
          </Text>

          {!genderKnown ? (
            <>
              <View style={styles.labelRow}>
                <Text style={styles.label} allowFontScaling>
                  Gender
                </Text>
                <RequiredBadge />
              </View>
              <View style={styles.options} accessibilityRole="radiogroup">
                {MATING_GENDER_OPTIONS.map((option) => {
                  const selected = gender === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setGender(option)}
                      disabled={saving}
                      style={({ pressed }) => [
                        styles.option,
                        selected && styles.optionSelected,
                        pressed && !saving && styles.pressed,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={option}
                    >
                      <Text
                        style={[styles.optionText, selected && styles.optionTextSelected]}
                        allowFontScaling
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.label, styles.preferenceHeading]} allowFontScaling>
                Who would you like to meet?
              </Text>
            </>
          ) : null}
          <View style={styles.options} accessibilityRole="radiogroup">
            {MATING_BREED_PREFERENCE_OPTIONS.map((option) => {
              const selected = breedPreference === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setBreedPreference(option.value)}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && !saving && styles.pressed,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                >
                  <Text
                    style={[styles.optionText, selected && styles.optionTextSelected]}
                    allowFontScaling
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {saving ? (
            <ActivityIndicator
              color={theme.colors.brand.sage.value}
              style={styles.progress}
              accessibilityLabel="Saving Mating setup"
            />
          ) : null}
          {errorText ? (
            <Text style={styles.error} accessibilityLiveRegion="polite" allowFontScaling>
              {errorText}
            </Text>
          ) : null}

          <Pressable
            onPress={handleContinue}
            disabled={!canContinue}
            style={({ pressed }) => [
              styles.continueBtn,
              !canContinue && styles.continueDisabled,
              pressed && canContinue && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.continueText} allowFontScaling>
              Continue
            </Text>
          </Pressable>

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
    marginBottom: theme.spacing.lg,
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
  preferenceHeading: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  options: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
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
    paddingHorizontal: theme.spacing.sm,
  },
  optionSelected: {
    borderColor: theme.colors.brand.sage.value,
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  optionText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    textAlign: 'center',
  },
  optionTextSelected: {
    color: theme.colors.brand.sageDark.value,
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
  continueBtn: {
    minHeight: theme.components.button.minHeight,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.brand.sage.value,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
  },
  continueDisabled: {
    opacity: 0.5,
  },
  continueText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  cancel: {
    minHeight: theme.components.button.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
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
