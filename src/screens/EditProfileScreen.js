import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import RequiredBadge from '../components/RequiredBadge';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

export default function EditProfileScreen({ navigation }) {
  const surfaces = useRuntimeThemeColors();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const profileTheme = useMemo(
    () => ({
      screen: { backgroundColor: surfaces.backgroundScreen },
      loadingWrap: { backgroundColor: surfaces.backgroundScreen },
      label: { color: surfaces.textMuted },
      input: {
        backgroundColor: surfaces.backgroundCard,
        borderColor: surfaces.border,
        color: surfaces.textPrimary,
      },
    }),
    [
      surfaces.backgroundCard,
      surfaces.backgroundScreen,
      surfaces.border,
      surfaces.textMuted,
      surfaces.textPrimary,
    ],
  );

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
    const nextErrors = {};
    if (!name.trim()) {
      nextErrors.name = 'Please enter your name.';
    }
    if (!city.trim()) {
      nextErrors.city = 'Please enter your city.';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
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
          city: city.trim(),
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
      <View style={[styles.loadingWrap, profileTheme.loadingWrap]}>
        <ActivityIndicator color={theme.colors.primary.light} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, profileTheme.screen]}>
      <View style={styles.content}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, profileTheme.label]}>Name</Text>
          <RequiredBadge />
        </View>
        <TextInput
          style={[styles.input, profileTheme.input, fieldErrors.name && styles.inputError]}
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (fieldErrors.name) {
              setFieldErrors((prev) => ({ ...prev, name: null }));
            }
          }}
          placeholder="Your name"
          placeholderTextColor={surfaces.placeholder}
        />
        {fieldErrors.name ? (
          <Text style={styles.inlineError} accessibilityLiveRegion="polite">
            {fieldErrors.name}
          </Text>
        ) : null}

        <View style={styles.labelRow}>
          <Text style={[styles.label, profileTheme.label]}>City</Text>
          <RequiredBadge />
        </View>
        <TextInput
          style={[styles.input, profileTheme.input, fieldErrors.city && styles.inputError]}
          value={city}
          onChangeText={(value) => {
            setCity(value);
            if (fieldErrors.city) {
              setFieldErrors((prev) => ({ ...prev, city: null }));
            }
          }}
          placeholder="Your city"
          placeholderTextColor={surfaces.placeholder}
        />
        {fieldErrors.city ? (
          <Text style={styles.inlineError} accessibilityLiveRegion="polite">
            {fieldErrors.city}
          </Text>
        ) : null}

        <View style={styles.labelRow}>
          <Text style={[styles.label, profileTheme.label]}>Email</Text>
        </View>
        <TextInput
          style={[styles.input, profileTheme.input, styles.inputDisabled]}
          value={email}
          editable={false}
          placeholderTextColor={surfaces.placeholder}
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
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textTransform: 'uppercase',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
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
  inputError: {
    borderColor: theme.colors.feedback.error.value,
  },
  inlineError: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.feedback.error.value,
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
