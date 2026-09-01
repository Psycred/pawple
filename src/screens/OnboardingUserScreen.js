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
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { normalizeCityForSave, normalizeCityKey } from '../utils/cityUtils';

export default function OnboardingUserScreen({ navigation, route }) {
  const { pendingInviteCode } = useAuth();
  const routeInviteCode = route?.params?.inviteCode ?? pendingInviteCode ?? '';
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        Alert.alert('Session Required', 'Please complete authentication to continue.', [
          {
            text: 'OK',
            onPress: () => navigation.replace('Auth'),
          },
        ]);
        return;
      }

      if (!routeInviteCode && !__DEV__) {
        navigation.replace('InviteCodeScreen');
      }
    };
    checkSession();
  }, [navigation, routeInviteCode]);

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

  const handleNextPress = async () => {
    const trimmedName = fullName.trim();
    const normalizedCity = normalizeCityForSave(city);

    if (!trimmedName || !normalizeCityKey(normalizedCity)) {
      Alert.alert('Missing Info', 'Please enter your full name and city.');
      return;
    }

    const navParams = {
      fullName: trimmedName,
      city: normalizedCity,
      inviteCode: routeInviteCode ?? '',
    };

    setSaving(true);
    try {
      await saveUserProfile(trimmedName, normalizedCity);
      navigation.navigate('OnboardingPets', navParams);
    } catch (error) {
      console.log('[OnboardingUser] Profile save error:', error);
      Alert.alert('Error', 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
          onBlur={handleCityBlur}
          autoCapitalize="words"
          autoCorrect={false}
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
});
