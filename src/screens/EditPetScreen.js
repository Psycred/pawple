import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import PhotoPickerModal from '../components/PhotoPickerModal';
import PetCompanionCommunitySection from '../components/PetCompanionCommunitySection';
import { EXPOSE_MATING_SURFACES } from '../config/phase1aSurfaces';
import { theme } from '../config/theme';
import { supabase } from '../config/supabase';
import { useActivePet } from '../contexts/ActivePetContext';
import { fetchPetProfile, updatePetCompanionDiscovery } from '../services/pets';
import {
  openAppSettings,
  requestCameraPermissionJIT,
} from '../lib/permissions';
import { pickFromGallery } from '../lib/photoPicker';
import { resolveActivePetAfterDelete } from '../lib/activePetIntegrity';
import { resolvePetPhotoUrl } from '../lib/petPhotoUpload';
import { TRAIT_SUGGESTIONS, MAX_TRAITS } from '../constants/petTraits';

const PET_TYPE_OPTIONS = [
  { key: 'dog', label: 'Dog' },
  { key: 'cat', label: 'Cat' },
  { key: 'other', label: 'Other' },
];

const GENDER_OPTIONS = ['Male', 'Female'];

const VACCINATION_OPTIONS = [
  { key: 'up_to_date', label: 'Up to date' },
  { key: 'not_up_to_date', label: 'Not up to date' },
];

const sanitizeAgeInput = (value) => {
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) {
    return cleaned;
  }
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`;
};

const parseAgeForStorage = (ageStr) => {
  const t = String(ageStr ?? '').trim();
  if (!t) {
    return null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
};

function normalizeVaccinationFromDb(raw) {
  if (raw === true || raw === 'Yes' || raw === 'yes' || raw === 'true') {
    return 'up_to_date';
  }
  if (raw === false || raw === 'No' || raw === 'no' || raw === 'false') {
    return 'not_up_to_date';
  }
  return '';
}

function vaccinationForDb(status) {
  if (status === 'up_to_date') {
    return 'Yes';
  }
  if (status === 'not_up_to_date') {
    return 'No';
  }
  return null;
}

function normalizeTraits(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((trait) => typeof trait === 'string' && trait.trim()).map((trait) => trait.trim());
}

/**
 * Dedicated pet profile editor — separate from the human "My Profile" screen.
 */
export default function EditPetScreen({ navigation, route }) {
  const petId = route?.params?.petId ?? null;
  const { activePetId, setPet } = useActivePet();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  const [name, setName] = useState('');
  const [petType, setPetType] = useState('');
  const [petTypeCustom, setPetTypeCustom] = useState('');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [vaccinationStatus, setVaccinationStatus] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [lookingForCompanion, setLookingForCompanion] = useState(false);
  const [companionSaving, setCompanionSaving] = useState(false);
  const [hostedCount, setHostedCount] = useState(0);
  const [participatedCount, setParticipatedCount] = useState(0);
  const [selectedTraits, setSelectedTraits] = useState([]);

  useLayoutEffect(() => {
    const title = name.trim() ? `Edit ${name.trim()}` : 'Edit Pet';
    navigation.setOptions({ title });
  }, [navigation, name]);

  useEffect(() => {
    const loadPet = async () => {
      if (!petId) {
        Alert.alert('Pet', 'Could not find this pet.');
        navigation.goBack();
        return;
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          navigation.goBack();
          return;
        }

        const profileData = await fetchPetProfile(petId, user.id);
        const data = profileData?.pet;
        if (!data) {
          throw new Error('Pet not found');
        }

        setName(data.name ?? '');
        setPetType(data.pet_type ?? '');
        setPetTypeCustom(data.pet_type_custom ?? '');
        setBreed(data.breed ?? '');
        setGender(data.gender ?? '');
        setAge(data.age != null ? String(data.age) : '');
        setVaccinationStatus(normalizeVaccinationFromDb(data.vaccinated));
        setBio(data.bio ?? '');
        setPhotoUri(data.photo_url ?? null);
        setLookingForCompanion(Boolean(data.is_looking_for_companion));
        setHostedCount(profileData.hosted_count ?? 0);
        setParticipatedCount(profileData.participated_count ?? 0);
        setSelectedTraits(normalizeTraits(data.traits));
      } catch (error) {
        console.error('[Supabase]', error);
        Alert.alert('Pet', 'Could not load this pet profile.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    loadPet();
  }, [navigation, petId]);

  const handleCompanionToggle = async (nextValue) => {
    if (!petId || companionSaving) {
      return;
    }
    const previous = lookingForCompanion;
    setLookingForCompanion(nextValue);
    setCompanionSaving(true);
    try {
      await updatePetCompanionDiscovery(petId, nextValue);
    } catch (error) {
      console.error('[EditPet] companion toggle failed', error);
      setLookingForCompanion(previous);
      Alert.alert('Pet', 'Could not update discovery setting. Try again.');
    } finally {
      setCompanionSaving(false);
    }
  };

  const handleTraitToggle = (trait) => {
    setSelectedTraits((prev) => {
      if (prev.includes(trait)) {
        return prev.filter((t) => t !== trait);
      }
      if (prev.length >= MAX_TRAITS) {
        return prev;
      }
      return [...prev, trait];
    });
  };

  const pickPhoto = async (source) => {
    try {
      if (source === 'library') {
        const result = await pickFromGallery({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (result?.assets?.[0]?.uri) {
          setPhotoUri(result.assets[0].uri);
          return true;
        }
        return false;
      }

      const granted = await requestCameraPermissionJIT();
      if (!granted) {
        Alert.alert('Camera', 'Permission was not granted.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: openAppSettings },
        ]);
        return false;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[EditPet] photo error', error);
      Alert.alert('Photo', 'Something went wrong. Try again.');
      return false;
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Pet', 'Please enter a name.');
      return;
    }
    if (!petType) {
      Alert.alert('Pet', 'Please choose Dog, Cat, or Other.');
      return;
    }
    if (petType === 'other' && !petTypeCustom.trim() && !breed.trim()) {
      Alert.alert('Pet', 'Tell us what kind of pet this is.');
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Pet', 'Please sign in again.');
        return;
      }

      const photo_url = await resolvePetPhotoUrl(photoUri, user.id);

      const payload = {
        name: name.trim(),
        pet_type: petType,
        pet_type_custom: petType === 'other' ? petTypeCustom.trim() || breed.trim() || null : null,
        breed: breed.trim() || null,
        gender: gender || null,
        age: parseAgeForStorage(age),
        vaccinated: vaccinationForDb(vaccinationStatus),
        bio: bio.trim() || null,
        photo_url,
        traits: normalizeTraits(selectedTraits),
      };

      const { error } = await supabase
        .from('pets')
        .update(payload)
        .eq('id', petId)
        .eq('owner_id', user.id);

      if (error) {
        if (/traits/i.test(error.message ?? '')) {
          throw new Error(
            'Traits could not be saved. Apply the pets.traits migration in Supabase, then try again.',
          );
        }
        throw error;
      }
      navigation.goBack();
    } catch (error) {
      console.error('[Supabase]', error);
      Alert.alert('Pet', error?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from('pets').delete().eq('id', petId);
      if (error) {
        throw error;
      }
      if (String(activePetId) === String(petId)) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: remaining } = await supabase
            .from('pets')
            .select('id, created_at')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: true });
          const nextPetId = resolveActivePetAfterDelete(activePetId, petId, remaining ?? []);
          if (nextPetId !== undefined) {
            await setPet(nextPetId);
          }
        } else {
          await setPet(null);
        }
      }
      navigation.goBack();
    } catch (error) {
      console.error('[Supabase]', error);
      Alert.alert('Pet', 'Could not delete this pet. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete pet?', "This will remove this pet's profile.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDelete },
    ]);
  };

  const bioLabel = name.trim() ? `About ${name.trim()}` : 'About';

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={theme.colors.primary.light} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.photoSection}>
          <View style={styles.photoWrap}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
            ) : (
              <View style={styles.photoFallback}>
                <Feather name="camera" size={28} color={theme.colors.brand.sage.value} />
              </View>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [styles.photoButton, pressed && styles.buttonPressed]}
            onPress={() => setPhotoModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Upload or change pet photo"
          >
            <Text style={styles.photoButtonText}>Upload / Change Photo</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Tyson"
          placeholderTextColor={theme.colors.text.muted.light}
        />

        <Text style={styles.label}>Pet Type</Text>
        <View style={styles.chipRow}>
          {PET_TYPE_OPTIONS.map((option) => {
            const selected = petType === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setPetType(option.key)}
                style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.buttonPressed]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {petType === 'other' ? (
          <>
            <Text style={styles.label}>Type</Text>
            <TextInput
              style={styles.input}
              value={petTypeCustom}
              onChangeText={setPetTypeCustom}
              placeholder="e.g., Rabbit, Bird"
              placeholderTextColor={theme.colors.text.muted.light}
            />
          </>
        ) : null}

        <Text style={styles.label}>Breed</Text>
        <TextInput
          style={styles.input}
          value={breed}
          onChangeText={setBreed}
          placeholder="Beagle"
          placeholderTextColor={theme.colors.text.muted.light}
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.chipRow}>
          {GENDER_OPTIONS.map((option) => {
            const selected = gender === option;
            return (
              <Pressable
                key={option}
                onPress={() => setGender(option)}
                style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.buttonPressed]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={(t) => setAge(sanitizeAgeInput(t))}
          placeholder="e.g., 3"
          placeholderTextColor={theme.colors.text.muted.light}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Vaccination Status</Text>
        <View style={styles.chipRow}>
          {VACCINATION_OPTIONS.map((option) => {
            const selected = vaccinationStatus === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setVaccinationStatus(option.key)}
                style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.buttonPressed]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{bioLabel}</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="Loves fetch and belly rubs"
          placeholderTextColor={theme.colors.text.muted.light}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.section}>
          <Text style={styles.label}>Personality & Traits</Text>
          <Text style={styles.helperText}>Select up to {MAX_TRAITS} traits</Text>

          <View style={styles.traitChipsContainer}>
            {TRAIT_SUGGESTIONS.map((trait) => {
              const isSelected = selectedTraits.includes(trait);
              const isDisabled = !isSelected && selectedTraits.length >= MAX_TRAITS;

              return (
                <TouchableOpacity
                  key={trait}
                  style={[
                    styles.traitChip,
                    isSelected && styles.traitChipSelected,
                    isDisabled && styles.traitChipDisabled,
                  ]}
                  onPress={() => handleTraitToggle(trait)}
                  disabled={isDisabled}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected, disabled: isDisabled }}
                  accessibilityLabel={trait}
                >
                  <Text
                    style={[
                      styles.traitChipText,
                      isSelected && styles.traitChipTextSelected,
                    ]}
                  >
                    {trait}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.counterText}>
            {selectedTraits.length} of {MAX_TRAITS} selected
          </Text>
        </View>

        <PetCompanionCommunitySection
          showToggle={EXPOSE_MATING_SURFACES}
          lookingForCompanion={lookingForCompanion}
          onToggle={handleCompanionToggle}
          toggleDisabled={companionSaving || saving || deleting}
          hostedCount={hostedCount}
          participatedCount={participatedCount}
        />

        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && styles.buttonPressed]}
          onPress={handleSave}
          disabled={saving || deleting}
          accessibilityRole="button"
          accessibilityLabel="Save pet profile"
        >
          {saving ? (
            <ActivityIndicator color={theme.components.button.primaryText} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.deleteButton, pressed && styles.buttonPressed]}
          onPress={confirmDelete}
          disabled={saving || deleting}
          accessibilityRole="button"
          accessibilityLabel="Delete pet"
        >
          {deleting ? (
            <ActivityIndicator color={theme.colors.danger.value} />
          ) : (
            <Text style={styles.deleteText}>Delete Pet</Text>
          )}
        </Pressable>
      </ScrollView>

      <PhotoPickerModal
        visible={photoModalVisible}
        petDisplayName={name}
        onClose={() => setPhotoModalVisible(false)}
        onChooseFromLibrary={() => pickPhoto('library')}
        onTakePhoto={() => pickPhoto('camera')}
      />
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
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  photoWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.border.light,
    marginBottom: theme.spacing.sm,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  photoButton: {
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
  },
  photoButtonText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.brand.sage.value,
  },
  label: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.fonts.medium,
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
    paddingVertical: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.sm,
  },
  bioInput: {
    minHeight: 112,
    paddingTop: theme.spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  chip: {
    borderRadius: theme.borderRadius.full,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background.card,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  chipOn: {
    backgroundColor: theme.colors.brand.sageLight.light,
    borderColor: theme.colors.brand.sage.value,
  },
  chipText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.primary.light,
  },
  chipTextOn: {
    fontFamily: theme.fonts.medium,
    color: theme.colors.brand.sageDark.light,
  },
  section: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  helperText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    marginBottom: theme.spacing.md,
  },
  traitChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  traitChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  traitChipSelected: {
    backgroundColor: '#9EB8A0',
    borderColor: '#9EB8A0',
  },
  traitChipDisabled: {
    opacity: 0.4,
  },
  traitChipText: {
    fontSize: 13,
    color: '#3A312E',
    fontWeight: '500',
  },
  traitChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  counterText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  saveButton: {
    marginTop: theme.spacing.xl,
    minHeight: theme.components.button.minHeight,
    borderRadius: theme.components.button.borderRadius,
    backgroundColor: theme.colors.brand.sage.value,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  deleteButton: {
    marginTop: theme.spacing.md,
    minHeight: theme.components.button.minHeight,
    borderRadius: theme.components.button.borderRadius,
    borderWidth: 1,
    borderColor: theme.colors.danger.value,
    backgroundColor: theme.colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.danger.value,
  },
  buttonPressed: {
    opacity: 0.86,
  },
});
