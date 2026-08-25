import React, { useState } from 'react';
import { 
  ActivityIndicator, 
  Pressable, 
  StyleSheet, 
  Text, 
  TextInput, 
  View,
  Alert 
} from 'react-native';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';

export default function OnboardingScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCompleteProfile = async () => {
    try {
      if (!fullName || !petName) {
        Alert.alert('Missing Info', 'Please enter your name and your pet\'s name');
        return;
      }

      setLoading(true);

      // Always use the server-side session user id when writing to RLS-protected tables.
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'No user found. Please sign in again.');
        return;
      }

      // Anonymous users have no profile row yet — insert (not upsert) so RLS and triggers match first-time setup.
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        name: fullName,
        city: city || null,
        email: user.email || null,
        updated_at: new Date().toISOString(),
      });

      if (profileError) throw profileError;

      // Create pet profile
      const { error: petError } = await supabase
        .from('pets')
        .insert({
          owner_id: user.id,
          name: petName,
          breed: petBreed || null,
        });

      if (petError) throw petError;

      // Navigate to home
      navigation.replace('MainTabs', { screen: 'FeedScreen' });
    } catch (error) {
      console.error('Onboarding error:', error);
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Let's Get Started! 🐾</Text>
      <Text style={styles.subtitle}>Tell us about you and your furry friend</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Your Name</Text>
        <TextInput
          style={styles.input}
          placeholder="John Doe"
          placeholderTextColor={theme.colors.text.muted.light}
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={styles.label}>City (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Mumbai"
          placeholderTextColor={theme.colors.text.muted.light}
          value={city}
          onChangeText={setCity}
        />

        <Text style={styles.label}>Your Pet's Name *</Text>
        <TextInput
          style={[styles.input, styles.inputPetName]}
          placeholder="Pet name"
          placeholderTextColor={theme.colors.text.muted.light}
          value={petName}
          onChangeText={setPetName}
        />

        <Text style={styles.label}>Pet's Breed (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Golden Retriever"
          placeholderTextColor={theme.colors.text.muted.light}
          value={petBreed}
          onChangeText={setPetBreed}
        />

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleCompleteProfile}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Complete setup and go to home"
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.background.light} />
          ) : (
            <Text style={styles.buttonText}>Complete Setup 🎉</Text>
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
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  label: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    marginTop: theme.spacing.sm,
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
  inputPetName: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.xl,
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
  buttonText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.components.button.primaryText,
    fontWeight: theme.fontWeights.semibold,
  },
});