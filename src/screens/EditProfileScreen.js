import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';

export default function EditProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          navigation.goBack();
          return;
        }
        setEmail(user.email ?? '');
        const { data, error } = await supabase.from('profiles').select('name, city').eq('id', user.id).maybeSingle();
        if (error) throw error;
        setName(data?.name ?? '');
        setCity(data?.city ?? '');
      } catch (error) {
        console.log('[EditProfile] load error', error);
        Alert.alert('Profile', 'Could not load profile right now.');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [navigation]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Profile', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Profile', 'Please sign in again.');
        return;
      }
      const { error } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          name: name.trim(),
          city: city.trim() || null,
          email: user.email ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
      if (error) throw error;
      navigation.goBack();
    } catch (error) {
      console.log('[EditProfile] save error', error);
      Alert.alert('Profile', 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={theme.colors.primary.light} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={theme.colors.text.muted.light}
        />

        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="Your city"
          placeholderTextColor={theme.colors.text.muted.light}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={email}
          editable={false}
          placeholderTextColor={theme.colors.text.muted.light}
        />

        <Pressable style={({ pressed }) => [styles.saveButton, pressed && styles.buttonPressed]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={theme.components.button.primaryText} /> : <Text style={styles.saveText}>Save</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.screen,
  },
  content: {
    padding: theme.spacing.lg,
  },
  label: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: theme.components.input.minHeight,
    borderRadius: theme.components.input.borderRadius,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.background.card,
    paddingHorizontal: theme.spacing.md,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  inputDisabled: {
    opacity: 0.65,
  },
  saveButton: {
    marginTop: theme.spacing.xl,
    minHeight: theme.components.button.minHeight,
    borderRadius: theme.components.button.borderRadius,
    backgroundColor: theme.colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.components.button.primaryText,
    fontWeight: theme.fontWeights.semibold,
  },
  buttonPressed: {
    opacity: 0.86,
  },
});
