import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import {
  getMaximumEligibleBirthDate,
  isEligibleBirthDate,
  MINIMUM_ACCOUNT_AGE,
  recordAgeGatePass,
} from '../lib/ageGate';

function formatBirthDate(date) {
  try {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Store-compliant Phase 1 age gate (Founder: 18+ India launch).
 * Quiet confirmation before Auth / app use. Under-age users stay here.
 */
export default function AgeGateScreen({ onPassed }) {
  const insets = useSafeAreaInsets();
  const maxEligibleBirthDate = useMemo(() => getMaximumEligibleBirthDate(), []);
  const defaultBirthDate = useMemo(() => {
    // Calm default: exactly the eligibility edge (18 years ago today).
    return new Date(maxEligibleBirthDate.getTime());
  }, [maxEligibleBirthDate]);

  const [birthDate, setBirthDate] = useState(defaultBirthDate);
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [denied, setDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (submitting) {
      return;
    }

    if (!isEligibleBirthDate(birthDate)) {
      setDenied(true);
      return;
    }

    setSubmitting(true);
    try {
      await recordAgeGatePass(birthDate);
      setDenied(false);
      // Parent remounts navigator with Auth / signed-in route once eligible.
      if (typeof onPassed === 'function') {
        onPassed();
      }
    } catch (error) {
      console.error('[AgeGate] persist failed', error);
      setDenied(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 32) + theme.spacing.md,
            paddingBottom: Math.max(insets.bottom, 32),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>pawple</Text>
        <Text style={styles.title}>Before you continue</Text>
        <Text style={styles.body}>
          Pawple is for adults. Phase 1 is 18+ only — for accounts, Terms, and Meetups.
        </Text>

        <Text style={styles.label}>Birthday</Text>
        <Pressable
          onPress={() => setShowPicker(true)}
          style={({ pressed }) => [styles.dateReveal, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Choose your birthday"
        >
          <Text style={styles.dateRevealText}>{formatBirthDate(birthDate)}</Text>
        </Pressable>

        {showPicker ? (
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={birthDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              // Allow selecting any past date; eligibility is checked on continue.
              onChange={(event, nextDate) => {
                if (Platform.OS === 'android') {
                  setShowPicker(false);
                  if (event?.type === 'dismissed') {
                    return;
                  }
                }
                if (nextDate) {
                  setBirthDate(nextDate);
                  setDenied(false);
                }
              }}
            />
            {Platform.OS === 'ios' ? (
              <Pressable
                onPress={() => setShowPicker(false)}
                style={({ pressed }) => [styles.pickerDone, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Done choosing birthday"
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {denied ? (
          <Text style={styles.denied} accessibilityLiveRegion="polite">
            Pawple is for people {MINIMUM_ACCOUNT_AGE} and older. You can’t continue with this birthday.
          </Text>
        ) : null}

        <Pressable
          onPress={handleContinue}
          disabled={submitting}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !submitting && styles.pressed,
            submitting && styles.primaryButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Confirm I am ${MINIMUM_ACCOUNT_AGE} or older`}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? 'Saving…' : `I am ${MINIMUM_ACCOUNT_AGE} or older`}
          </Text>
        </Pressable>

        <Text style={styles.footnote}>
          By continuing you confirm your age. Meetup attendance also requires an 18+ account holder.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
  brand: {
    fontFamily: 'Inter-Medium',
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.muted.light,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: theme.fontSizes.creationTitle ?? theme.fontSizes.xxl,
    color: theme.colors.text.primary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.md,
    lineHeight: Math.round(theme.fontSizes.md * 1.45),
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
  },
  label: {
    fontFamily: 'Inter-Medium',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    marginBottom: theme.spacing.sm,
  },
  dateReveal: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  dateRevealText: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  pickerWrap: {
    marginBottom: theme.spacing.md,
  },
  pickerDone: {
    alignSelf: 'flex-end',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  pickerDoneText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: theme.fontSizes.md,
    color: theme.colors.brand.sageDark.value,
  },
  denied: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    lineHeight: Math.round(theme.fontSizes.sm * 1.4),
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  primaryButton: {
    backgroundColor: theme.colors.brand.sage.value,
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  footnote: {
    marginTop: theme.spacing.xl,
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.xs,
    lineHeight: Math.round(theme.fontSizes.xs * 1.4),
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
});
