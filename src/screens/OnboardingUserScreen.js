import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import RequiredBadge from '../components/RequiredBadge';
import { useAuth } from '../contexts/AuthContext';
import { isEligibleBirthDate, recordAgeGatePass } from '../lib/ageGate';
import { syncAgeAttestationAfterLocalPass } from '../lib/ageAttestationSync';
import {
  captureApproximateLocationOnAboutYouContinue,
  saveLatestProfileLocation,
} from '../lib/profileLocation';
import { cacheViewerFeedLocation } from '../lib/viewerFeedLocation';
import { normalizeCityForSave, normalizeCityKey } from '../utils/cityUtils';

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

export default function OnboardingUserScreen({ navigation, route }) {
  const surfaces = useRuntimeThemeColors();
  const insets = useSafeAreaInsets();
  const { pendingInviteCode, profile, refreshProfile } = useAuth();
  const routeInviteCode = route?.params?.inviteCode ?? pendingInviteCode ?? '';
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [birthDate, setBirthDate] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefillLoaded, setPrefillLoaded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const nameRef = useRef(null);
  const cityRef = useRef(null);
  /** Set before UnderAgeDecline so a slow session check cannot alert during sign-out. */
  const underAgeExitRef = useRef(false);

  const onboardingTheme = useMemo(
    () => ({
      safe: { backgroundColor: surfaces.backgroundScreen },
      title: { color: surfaces.textPrimary },
      label: { color: surfaces.textSecondary },
      input: {
        backgroundColor: surfaces.inputBackground,
        borderColor: surfaces.inputBorder,
        color: surfaces.textPrimary,
      },
      dateReveal: { backgroundColor: surfaces.backgroundCard },
      dateRevealText: { color: surfaces.textPrimary },
      datePlaceholder: { color: surfaces.placeholder },
    }),
    [
      surfaces.backgroundCard,
      surfaces.backgroundScreen,
      surfaces.inputBackground,
      surfaces.inputBorder,
      surfaces.placeholder,
      surfaces.textPrimary,
      surfaces.textSecondary,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const checkSession = async () => {
        if (underAgeExitRef.current) {
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (cancelled || underAgeExitRef.current) {
          return;
        }

        if (!data?.session) {
          Alert.alert('Session Required', 'Please complete authentication to continue.', [
            {
              text: 'OK',
              onPress: () => navigation.replace('Welcome'),
            },
          ]);
          return;
        }

        if (!routeInviteCode && !__DEV__) {
          navigation.replace('InviteCodeScreen');
        }
      };

      checkSession();

      return () => {
        cancelled = true;
      };
    }, [navigation, routeInviteCode]),
  );

  useEffect(() => {
    if (prefillLoaded || !profile) {
      return;
    }
    if (profile.name) {
      setFullName(profile.name);
    }
    if (profile.city) {
      setCity(profile.city);
    }
    setPrefillLoaded(true);
  }, [prefillLoaded, profile]);

  const saveUserProfile = async (name, cityValue) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('No user found');
    }

    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        name: name.trim(),
        city: cityValue,
        email: user.email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (error) {
      console.error('[Supabase]', error);
      throw error;
    }

    return user.id;
  };

  const handleCityBlur = () => {
    const normalized = normalizeCityForSave(city);
    if (normalized && normalized !== city) {
      setCity(normalized);
    }
  };

  const handleContinue = async () => {
    const trimmedName = fullName.trim();
    const normalizedCity = normalizeCityForSave(city);
    const nextErrors = {};

    if (!trimmedName) {
      nextErrors.name = 'Please enter your name.';
    }
    if (!normalizeCityKey(normalizedCity)) {
      nextErrors.city = 'Please enter your city.';
    }
    setFieldErrors(nextErrors);

    if (nextErrors.name) {
      nameRef.current?.focus();
      return;
    }
    if (nextErrors.city) {
      cityRef.current?.focus();
      return;
    }
    if (!birthDate) {
      setShowPicker(true);
      return;
    }

    if (!isEligibleBirthDate(birthDate)) {
      underAgeExitRef.current = true;
      navigation.navigate('UnderAgeDecline');
      return;
    }

    const navParams = {
      fullName: trimmedName,
      city: normalizedCity,
      inviteCode: routeInviteCode ?? '',
    };

    setSaving(true);
    try {
      await recordAgeGatePass(birthDate);
      await syncAgeAttestationAfterLocalPass();
      const userId = await saveUserProfile(trimmedName, normalizedCity);

      // Wave 5 §2: one native location ask on Continue; non-blocking if declined.
      const approxCoords = await captureApproximateLocationOnAboutYouContinue();
      if (approxCoords && userId) {
        await saveLatestProfileLocation(userId, approxCoords);
      }
      await cacheViewerFeedLocation(approxCoords, normalizedCity);

      await refreshProfile?.();
      navigation.navigate('OnboardingPets', navParams);
    } catch (error) {
      console.log('[OnboardingUser] Profile save error:', error);
      Alert.alert('Error', 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, onboardingTheme.safe]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 32) + theme.spacing.sm,
              paddingBottom: Math.max(insets.bottom, 32),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, onboardingTheme.title]}>About you</Text>

          <View style={styles.labelRow}>
            <Text style={[styles.label, onboardingTheme.label]}>Name</Text>
            <RequiredBadge />
          </View>
          <TextInput
            ref={nameRef}
            style={[styles.input, onboardingTheme.input, fieldErrors.name && styles.inputError]}
            placeholder="John Doe"
            placeholderTextColor={surfaces.placeholder}
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
              if (fieldErrors.name) {
                setFieldErrors((prev) => ({ ...prev, name: null }));
              }
            }}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {fieldErrors.name ? (
            <Text style={styles.inlineError} accessibilityLiveRegion="polite" allowFontScaling>
              {fieldErrors.name}
            </Text>
          ) : null}

          <View style={[styles.labelRow, styles.fieldGap]}>
            <Text style={[styles.label, onboardingTheme.label]}>City</Text>
            <RequiredBadge />
          </View>
          <TextInput
            ref={cityRef}
            style={[styles.input, onboardingTheme.input, fieldErrors.city && styles.inputError]}
            placeholder="Mumbai"
            placeholderTextColor={surfaces.placeholder}
            value={city}
            onChangeText={(value) => {
              setCity(value);
              if (fieldErrors.city) {
                setFieldErrors((prev) => ({ ...prev, city: null }));
              }
            }}
            onBlur={handleCityBlur}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {fieldErrors.city ? (
            <Text style={styles.inlineError} accessibilityLiveRegion="polite" allowFontScaling>
              {fieldErrors.city}
            </Text>
          ) : null}

          <View style={styles.ageCluster}>
            <View style={[styles.labelRow, styles.fieldGap]}>
              <Text style={[styles.label, onboardingTheme.label]}>Birthday</Text>
              <RequiredBadge />
            </View>
            <Pressable
              onPress={() => setShowPicker(true)}
              style={({ pressed }) => [
                styles.dateReveal,
                onboardingTheme.dateReveal,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Choose your birthday"
            >
              <Text
                style={[
                  styles.dateRevealText,
                  onboardingTheme.dateRevealText,
                  !birthDate && styles.datePlaceholder,
                  !birthDate && onboardingTheme.datePlaceholder,
                ]}
              >
                {birthDate ? formatBirthDate(birthDate) : 'Choose your birthday'}
              </Text>
            </Pressable>

            {showPicker ? (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={birthDate ?? new Date(2000, 0, 1)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={(event, nextDate) => {
                    if (Platform.OS === 'android') {
                      setShowPicker(false);
                      if (event?.type === 'dismissed') {
                        return;
                      }
                    }
                    if (nextDate) {
                      setBirthDate(nextDate);
                    }
                  }}
                />
                {Platform.OS === 'ios' ? (
                  <Pressable
                    onPress={() => setShowPicker(false)}
                    style={({ pressed }) => [styles.pickerDone, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Done"
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              saving && styles.buttonDisabled,
              pressed && !saving && styles.pressed,
            ]}
            onPress={handleContinue}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.text.inverse.value} />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.feed.shellPaddingHorizontal,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: theme.fontSizes.creationTitle ?? theme.fontSizes.xxl,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.xl,
  },
  label: {
    fontFamily: 'Inter-Medium',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  fieldGap: {
    marginTop: theme.spacing.xl,
  },
  input: {
    minHeight: 56,
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  inputError: {
    borderWidth: 1,
    borderColor: theme.colors.feedback.error.value,
  },
  inlineError: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.feedback.error.value,
  },
  cityHint: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.muted.light,
    marginTop: theme.spacing.xs,
  },
  ageCluster: {
    marginTop: theme.spacing.xl,
  },
  dateReveal: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    justifyContent: 'center',
  },
  dateRevealText: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  datePlaceholder: {
    color: theme.colors.placeholder.value,
  },
  pickerWrap: {
    marginTop: theme.spacing.sm,
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
  button: {
    backgroundColor: theme.colors.brand.sage.value,
    borderRadius: theme.borderRadius.full,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xxl,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  pressed: {
    opacity: 0.9,
  },
});
