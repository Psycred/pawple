import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import {
  APPROXIMATE_LOCATION_OPTIONS,
  fetchApproximateCoords,
  saveLatestProfileLocation,
} from '../lib/profileLocation';

export default function OnboardingUserScreen({ navigation, route }) {
  const routeInviteCode = route?.params?.inviteCode ?? '';
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  /** profile = name/city form; location = custom pre-prompt (onboarding only). */
  const [phase, setPhase] = useState('profile');
  const [pendingNav, setPendingNav] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        Alert.alert('Session Required', 'Please complete authentication to continue.', [
          {
            text: 'OK',
            onPress: () => {
              if (navigation.getState()?.routeNames?.includes('AuthScreen')) {
                navigation.replace('AuthScreen');
              } else {
                navigation.replace('Auth');
              }
            },
          },
        ]);
      }
    };
    checkSession();
  }, [navigation]);

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
        city: cityValue.trim(),
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

  const goToPets = (navParams) => {
    navigation.navigate('OnboardingPets', navParams);
  };

  const proceedAfterProfileSave = async (userId, navParams) => {
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status === 'undetermined') {
      setPendingNav(navParams);
      setPhase('location');
      return;
    }

    if (status === 'granted') {
      const coords = await fetchApproximateCoords();
      if (coords) {
        await saveLatestProfileLocation(userId, coords);
      }
    }

    goToPets(navParams);
  };

  const handleNextPress = async () => {
    const trimmedName = fullName.trim();
    const trimmedCity = city.trim();

    if (!trimmedName || !trimmedCity) {
      Alert.alert('Missing Info', 'Please enter your full name and city.');
      return;
    }

    const navParams = {
      fullName: trimmedName,
      city: trimmedCity,
      inviteCode: routeInviteCode ?? '',
    };

    setSaving(true);
    try {
      const userId = await saveUserProfile(trimmedName, trimmedCity);
      await proceedAfterProfileSave(userId, navParams);
    } catch (error) {
      console.log('[OnboardingUser] Profile save error:', error);
      Alert.alert('Error', 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const finishLocationStep = () => {
    if (pendingNav) {
      goToPets(pendingNav);
    }
  };

  const handleAllowLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        const position = await Location.getCurrentPositionAsync(APPROXIMATE_LOCATION_OPTIONS);
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user?.id) {
            await saveLatestProfileLocation(user.id, { latitude, longitude });
          }
          console.log('[Location] Approximate location obtained');
        }
      } else {
        console.log('[Location] Permission:', status);
      }
    } catch (error) {
      console.log('[Location] Error:', error);
    } finally {
      setLocationLoading(false);
      finishLocationStep();
    }
  };

  const handleSkipLocation = () => {
    if (locationLoading) {
      return;
    }
    finishLocationStep();
  };

  if (phase === 'location') {
    return (
      <SafeAreaView style={styles.locationSafe}>
        <View style={styles.locationContainer}>
          <View style={styles.iconWrap}>
            <Feather
              name="map-pin"
              size={theme.fontSizes.xxxl - theme.spacing.xs}
              color={theme.colors.background.screen}
            />
          </View>
          <Text style={styles.locationTitle}>Help Pawple feel local</Text>
          <Text style={styles.locationBody}>
            Discover nearby meetups, playmates and pet-friendly events.
          </Text>
          <Text style={styles.locationNote}>
            We use your approximate location (city-level) to personalize your experience. We never track your exact
            location or store location history.
          </Text>

          <Pressable
            onPress={handleAllowLocation}
            disabled={locationLoading}
            style={({ pressed }) => [
              styles.allowButton,
              pressed && styles.buttonPressed,
              locationLoading && styles.buttonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Allow location"
          >
            <Text style={styles.allowButtonText}>
              {locationLoading ? 'One calm moment...' : 'Allow location'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSkipLocation}
            disabled={locationLoading}
            style={({ pressed }) => [styles.skipButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Skip for now"
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Let&apos;s Get Started! 🐾</Text>
      <Text style={styles.subtitle}>Tell us about yourself first.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Your Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="John Doe"
          placeholderTextColor={theme.colors.text.muted.light}
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={styles.label}>City *</Text>
        <TextInput
          style={styles.input}
          placeholder="Mumbai"
          placeholderTextColor={theme.colors.text.muted.light}
          value={city}
          onChangeText={setCity}
        />

        <Pressable
          style={({ pressed }) => [styles.button, saving && styles.buttonDisabled, pressed && styles.buttonPressed]}
          onPress={handleNextPress}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Go to pet details step"
        >
          {saving ? (
            <ActivityIndicator color={theme.components.button.primaryText} />
          ) : (
            <Text style={styles.buttonText}>Next: Add Your Pets</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.light,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxxl,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.text.primary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
  },
  card: {
    backgroundColor: theme.colors.card.light,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  label: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    marginTop: theme.spacing.xs,
  },
  input: {
    minHeight: theme.components.input.minHeight,
    backgroundColor: theme.components.input.background,
    borderColor: theme.components.input.border,
    borderWidth: 1,
    borderRadius: theme.components.input.borderRadius,
    padding: theme.spacing.md,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  button: {
    backgroundColor: theme.colors.primary.light,
    borderRadius: theme.components.button.borderRadius,
    minHeight: theme.components.button.minHeight,
    paddingVertical: theme.components.button.paddingVertical,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.components.button.primaryText,
    fontWeight: theme.fontWeights.semibold,
  },
  locationSafe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  locationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.xxxl,
  },
  iconWrap: {
    width: theme.spacing.xxxl + theme.spacing.md + theme.spacing.xs,
    height: theme.spacing.xxxl + theme.spacing.md + theme.spacing.xs,
    borderRadius: theme.spacing.xxxl - theme.spacing.md,
    backgroundColor: theme.colors.brand.sage.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  locationTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.text.primary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  locationBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  locationNote: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.xxl,
  },
  allowButton: {
    minHeight: theme.components.button.minHeight,
    borderRadius: theme.components.button.borderRadius,
    backgroundColor: theme.colors.brand.sage.light,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.components.button.paddingVertical,
    paddingHorizontal: theme.components.button.paddingHorizontal,
    width: '100%',
  },
  allowButtonText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
    fontWeight: theme.fontWeights.semibold,
  },
  skipButton: {
    marginTop: theme.spacing.md,
    alignSelf: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  skipText: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textDecorationLine: 'underline',
  },
});
