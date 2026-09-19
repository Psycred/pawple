import { Feather } from '@expo/vector-icons';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import { abandonCameraCapture, captureFromCamera } from '../lib/cameraCapture';
import { nextCameraTraceId, logCameraTrace } from '../lib/cameraCaptureDiagnostics';
import { logPhotoFlow } from '../lib/photoFlowDiagnostics';
import { pickFromGallery } from '../lib/photoPicker';
import MatingSetupModal from '../components/MatingSetupModal';
import PhotoPickerModal from '../components/PhotoPickerModal';
import PawpleConfirmModal from '../components/PawpleConfirmModal';
import { isValidMatingGender } from '../lib/matingEligibility';
import PetCompanionCommunitySection from '../components/PetCompanionCommunitySection';
import RequiredBadge from '../components/RequiredBadge';
import { areMatingSurfacesVisible } from '../config/phase1aSurfaces';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { supabase } from '../config/supabase';
import { useActivePet } from '../contexts/ActivePetContext';
import {
  fetchPetProfile,
  updatePetCompanionDiscovery,
  updatePetGender,
  updatePetMatingBreedPreference,
} from '../services/pets';
import { resolveActivePetAfterDelete } from '../lib/activePetIntegrity';
import { resolvePetPhotoUrl } from '../lib/petPhotoUpload';
import { approvePickedPhotoUri } from '../lib/photoValidationGate';
import { usePhotoValidationGate } from '../contexts/PhotoValidationContext';
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
  const surfaces = useRuntimeThemeColors();
  const petId = route?.params?.petId ?? null;
  const { activePetId, setPet, refreshUserPets } = useActivePet();
  const { ready: photoValidationReady, validatePhoto } = usePhotoValidationGate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false);

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
  const [persistedGender, setPersistedGender] = useState('');
  const [matingBreedPreference, setMatingBreedPreference] = useState('');
  const [setupVisible, setSetupVisible] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [hostedCount, setHostedCount] = useState(0);
  const [participatedCount, setParticipatedCount] = useState(0);
  const [selectedTraits, setSelectedTraits] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});

  const formTheme = useMemo(
    () => ({
      screen: { backgroundColor: surfaces.backgroundScreen },
      loadingWrap: { backgroundColor: surfaces.backgroundScreen },
      photoWrap: { borderColor: surfaces.border },
      photoFallback: {
        backgroundColor: surfaces.isDark
          ? surfaces.meetupChipBackground
          : theme.colors.brand.sageLight.light,
      },
      label: { color: surfaces.textMuted },
      input: {
        backgroundColor: surfaces.inputBackground,
        borderColor: surfaces.inputBorder,
        color: surfaces.textPrimary,
      },
      chip: {
        backgroundColor: surfaces.backgroundCard,
        borderColor: surfaces.border,
      },
      chipOn: {
        backgroundColor: surfaces.isDark
          ? surfaces.meetupChipBackground
          : theme.colors.brand.sageLight.light,
        borderColor: theme.colors.brand.sage.value,
      },
      chipText: { color: surfaces.textPrimary },
      helperText: { color: surfaces.textSecondary },
      traitChip: { backgroundColor: surfaces.profileTraitChipBackground },
      traitChipText: { color: surfaces.profileHeroNameColor },
      counterText: { color: surfaces.isDark ? surfaces.textMuted : '#999' },
      deleteButton: { backgroundColor: surfaces.backgroundCard },
    }),
    [
      surfaces.backgroundCard,
      surfaces.backgroundScreen,
      surfaces.border,
      surfaces.inputBackground,
      surfaces.inputBorder,
      surfaces.isDark,
      surfaces.meetupChipBackground,
      surfaces.profileHeroNameColor,
      surfaces.profileTraitChipBackground,
      surfaces.textMuted,
      surfaces.textPrimary,
      surfaces.textSecondary,
    ],
  );

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
        setPersistedGender(data.gender ?? '');
        setAge(data.age != null ? String(data.age) : '');
        setVaccinationStatus(normalizeVaccinationFromDb(data.vaccinated));
        setBio(data.bio ?? '');
        setPhotoUri(data.photo_url ?? null);
        setLookingForCompanion(Boolean(data.is_looking_for_companion));
        setMatingBreedPreference(data.mating_breed_preference ?? '');
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
    if (nextValue) {
      setSetupError('');
      setSetupVisible(true);
      return;
    }

    setCompanionSaving(true);
    try {
      await updatePetCompanionDiscovery(petId, false);
      setLookingForCompanion(false);
    } catch (error) {
      console.error('[EditPet] companion toggle failed', error);
      Alert.alert('Pet', 'Could not update discovery setting. Try again.');
    } finally {
      setCompanionSaving(false);
    }
  };

  const handleSetupConfirm = async ({ gender: nextGender, breedPreference }) => {
    if (!petId || companionSaving) {
      return;
    }
    setCompanionSaving(true);
    setSetupError('');
    try {
      if (nextGender) {
        const updated = await updatePetGender(petId, nextGender);
        const savedGender = updated?.gender ?? nextGender;
        setGender(savedGender);
        setPersistedGender(savedGender);
        setFieldErrors((prev) => ({ ...prev, gender: null }));
      } else if (isValidMatingGender(gender) && gender.trim() !== persistedGender.trim()) {
        const updated = await updatePetGender(petId, gender.trim());
        setPersistedGender(updated?.gender ?? gender.trim());
      }
      const prefRow = await updatePetMatingBreedPreference(petId, breedPreference);
      setMatingBreedPreference(prefRow?.mating_breed_preference ?? breedPreference);
      await updatePetCompanionDiscovery(petId, true);
      setLookingForCompanion(true);
      setSetupVisible(false);
    } catch (error) {
      console.error('[EditPet] mating setup failed', error);
      setSetupError('Could not save Mating setup. Try again.');
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

  const openPhotoOptions = () => {
    setPhotoSourceOpen(true);
  };

  const handlePhotoSourceSelected = async (source) => {
    logPhotoFlow('screen_handler_start', { screen: 'EditPet' });
    await pickPhoto(source);
  };

  useEffect(() => {
    return () => {
      abandonCameraCapture('unmount', { screen: 'EditPet' });
    };
  }, []);

  const pickPhoto = async (source) => {
    const traceId = nextCameraTraceId('EditPet');
    logCameraTrace(traceId, 'pick_photo_start', { source });

    try {
      if (source !== 'camera') {
        const result = await pickFromGallery({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        const uri = result?.assets?.[0]?.uri;
        if (uri) {
          const allowed = await approvePickedPhotoUri(uri, {
            ready: photoValidationReady,
            validatePhoto,
          });
          if (!allowed) {
            return false;
          }
          setPhotoUri(uri);
          return true;
        }
        return false;
      }

      const capture = await captureFromCamera(
        {
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        },
        { traceId, screen: 'EditPet' },
      );
      logCameraTrace(traceId, 'pick_photo_capture_result', { status: capture.status });

      if (capture.status === 'busy' || capture.status === 'canceled' || capture.status === 'abandoned') {
        return false;
      }
      if (capture.status !== 'captured') {
        return false;
      }
      const cameraUri = capture.result?.assets?.[0]?.uri;
      if (cameraUri) {
        const allowed = await approvePickedPhotoUri(cameraUri, {
          ready: photoValidationReady,
          validatePhoto,
        });
        if (!allowed) {
          return false;
        }
        setPhotoUri(cameraUri);
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
    const nextErrors = {};
    if (!name.trim()) {
      nextErrors.name = 'Please enter a pet name.';
    }
    if (!petType) {
      nextErrors.petType = 'Please choose a pet type.';
    }
    if (petType === 'other' && !petTypeCustom.trim()) {
      nextErrors.petTypeCustom = 'Tell us what kind of pet this is.';
    }
    if (lookingForCompanion && !isValidMatingGender(gender)) {
      nextErrors.gender = 'Choose gender to keep Open to Mating enabled.';
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
        Alert.alert('Pet', 'Please sign in again.');
        return;
      }

      const photo_url = await resolvePetPhotoUrl(photoUri, user.id);

      const payload = {
        name: name.trim(),
        pet_type: petType,
        pet_type_custom: petType === 'other' ? petTypeCustom.trim() || null : null,
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

  const navigateToMainOnboardingPets = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, city')
      .eq('id', user.id)
      .single();
    navigation.navigate('OnboardingPets', {
      fullName: profile?.name ?? '',
      city: profile?.city ?? '',
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_pet', { p_pet_id: petId });
      if (error) {
        throw error;
      }

      const remaining = await refreshUserPets();

      if (!remaining?.length) {
        await setPet(null);
        await navigateToMainOnboardingPets();
        return;
      }

      if (String(activePetId) === String(petId)) {
        const nextPetId = resolveActivePetAfterDelete(activePetId, petId, remaining);
        if (nextPetId != null) {
          await setPet(nextPetId);
          const nextPet = remaining.find((pet) => String(pet.id) === String(nextPetId));
          navigation.setParams({
            petId: nextPetId,
            petName: nextPet?.name ?? '',
          });
          return;
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
    setDeleteConfirmOpen(true);
  };

  const bioLabel = name.trim() ? `About ${name.trim()}` : 'About';

  if (loading) {
    return (
      <View style={[styles.loadingWrap, formTheme.loadingWrap]}>
        <ActivityIndicator color={theme.colors.primary.light} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, formTheme.screen]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.photoSection}>
          <View style={[styles.photoWrap, formTheme.photoWrap]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
            ) : (
              <View style={[styles.photoFallback, formTheme.photoFallback]}>
                <Feather name="camera" size={28} color={theme.colors.brand.sage.value} />
              </View>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [styles.photoButton, pressed && styles.buttonPressed]}
            onPress={openPhotoOptions}
            accessibilityRole="button"
            accessibilityLabel="Upload or change pet photo"
          >
            <Text style={styles.photoButtonText}>Upload / Change Photo</Text>
          </Pressable>
        </View>

        <View style={styles.labelRow}>
          <Text style={[styles.label, formTheme.label]}>Name</Text>
          <RequiredBadge />
        </View>
        <TextInput
          style={[styles.input, formTheme.input, fieldErrors.name && styles.inputError]}
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (fieldErrors.name) {
              setFieldErrors((prev) => ({ ...prev, name: null }));
            }
          }}
          placeholder="Tyson"
          placeholderTextColor={surfaces.placeholder}
        />
        {fieldErrors.name ? (
          <Text style={styles.inlineError} accessibilityLiveRegion="polite">
            {fieldErrors.name}
          </Text>
        ) : null}

        <View style={styles.labelRow}>
          <Text style={[styles.label, formTheme.label]}>Pet Type</Text>
          <RequiredBadge />
        </View>
        <View style={[styles.chipRow, fieldErrors.petType && styles.choiceError]}>
          {PET_TYPE_OPTIONS.map((option) => {
            const selected = petType === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  setPetType(option.key);
                  setFieldErrors((prev) => ({
                    ...prev,
                    petType: null,
                    petTypeCustom: option.key === 'other' ? prev.petTypeCustom : null,
                  }));
                }}
                style={({ pressed }) => [
                  styles.chip,
                  formTheme.chip,
                  selected && styles.chipOn,
                  selected && formTheme.chipOn,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, formTheme.chipText, selected && styles.chipTextOn]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {fieldErrors.petType ? (
          <Text style={styles.inlineError} accessibilityLiveRegion="polite">
            {fieldErrors.petType}
          </Text>
        ) : null}

        {petType === 'other' ? (
          <>
            <View style={styles.labelRow}>
              <Text style={[styles.label, formTheme.label]}>Type</Text>
              <RequiredBadge />
            </View>
            <TextInput
              style={[styles.input, formTheme.input, fieldErrors.petTypeCustom && styles.inputError]}
              value={petTypeCustom}
              onChangeText={(value) => {
                setPetTypeCustom(value);
                if (fieldErrors.petTypeCustom) {
                  setFieldErrors((prev) => ({ ...prev, petTypeCustom: null }));
                }
              }}
              placeholder="e.g., Rabbit, Bird"
              placeholderTextColor={surfaces.placeholder}
            />
            {fieldErrors.petTypeCustom ? (
              <Text style={styles.inlineError} accessibilityLiveRegion="polite">
                {fieldErrors.petTypeCustom}
              </Text>
            ) : null}
          </>
        ) : null}

        <View style={styles.labelRow}>
          <Text style={[styles.label, formTheme.label]}>Breed</Text>
        </View>
        <TextInput
          style={[styles.input, formTheme.input]}
          value={breed}
          onChangeText={setBreed}
          placeholder="Beagle"
          placeholderTextColor={surfaces.placeholder}
        />

        <View style={styles.labelRow}>
          <Text style={[styles.label, formTheme.label]}>Gender</Text>
          {lookingForCompanion ? <RequiredBadge /> : null}
        </View>
        <View style={[styles.chipRow, fieldErrors.gender && styles.choiceError]}>
          {GENDER_OPTIONS.map((option) => {
            const selected = gender === option;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  setGender(option);
                  if (fieldErrors.gender) {
                    setFieldErrors((prev) => ({ ...prev, gender: null }));
                  }
                }}
                style={({ pressed }) => [
                  styles.chip,
                  formTheme.chip,
                  selected && styles.chipOn,
                  selected && formTheme.chipOn,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, formTheme.chipText, selected && styles.chipTextOn]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {fieldErrors.gender ? (
          <Text style={styles.inlineError} accessibilityLiveRegion="polite">
            {fieldErrors.gender}
          </Text>
        ) : null}

        <View style={styles.labelRow}>
          <Text style={[styles.label, formTheme.label]}>Age</Text>
        </View>
        <TextInput
          style={[styles.input, formTheme.input]}
          value={age}
          onChangeText={(t) => setAge(sanitizeAgeInput(t))}
          placeholder="e.g., 3"
          placeholderTextColor={surfaces.placeholder}
          keyboardType="decimal-pad"
        />

        <View style={styles.labelRow}>
          <Text style={[styles.label, formTheme.label]}>Vaccination Status</Text>
        </View>
        <View style={styles.chipRow}>
          {VACCINATION_OPTIONS.map((option) => {
            const selected = vaccinationStatus === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setVaccinationStatus(option.key)}
                style={({ pressed }) => [
                  styles.chip,
                  formTheme.chip,
                  selected && styles.chipOn,
                  selected && formTheme.chipOn,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, formTheme.chipText, selected && styles.chipTextOn]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.labelRow}>
          <Text style={[styles.label, formTheme.label]}>{bioLabel}</Text>
        </View>
        <TextInput
          style={[styles.input, formTheme.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="Loves fetch and belly rubs"
          placeholderTextColor={surfaces.placeholder}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, formTheme.label]}>Personality & Traits</Text>
          </View>
          <Text style={[styles.helperText, formTheme.helperText]}>Select up to {MAX_TRAITS} traits</Text>

          <View style={styles.traitChipsContainer}>
            {TRAIT_SUGGESTIONS.map((trait) => {
              const isSelected = selectedTraits.includes(trait);
              const isDisabled = !isSelected && selectedTraits.length >= MAX_TRAITS;

              return (
                <TouchableOpacity
                  key={trait}
                  style={[
                    styles.traitChip,
                    formTheme.traitChip,
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
                      formTheme.traitChipText,
                      isSelected && styles.traitChipTextSelected,
                    ]}
                  >
                    {trait}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.counterText, formTheme.counterText]}>
            {selectedTraits.length} of {MAX_TRAITS} selected
          </Text>
        </View>

        <PetCompanionCommunitySection
          showToggle={areMatingSurfacesVisible()}
          lookingForCompanion={lookingForCompanion}
          onToggle={handleCompanionToggle}
          toggleDisabled={companionSaving || saving || deleting}
          hostedCount={hostedCount}
          participatedCount={participatedCount}
        />

        <MatingSetupModal
          visible={setupVisible}
          petName={name}
          existingGender={isValidMatingGender(persistedGender) ? persistedGender : gender}
          existingBreedPreference={matingBreedPreference}
          saving={companionSaving}
          errorText={setupError}
          onConfirm={handleSetupConfirm}
          onClose={() => {
            if (!companionSaving) {
              setSetupVisible(false);
              setSetupError('');
            }
          }}
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
          style={({ pressed }) => [
            styles.deleteButton,
            formTheme.deleteButton,
            pressed && styles.buttonPressed,
          ]}
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
        visible={photoSourceOpen}
        onClose={() => setPhotoSourceOpen(false)}
        onSelectSource={handlePhotoSourceSelected}
      />

      <PawpleConfirmModal
        visible={deleteConfirmOpen}
        busy={deleting}
        onClose={() => {
          if (!deleting) {
            setDeleteConfirmOpen(false);
          }
        }}
        onConfirm={async () => {
          setDeleteConfirmOpen(false);
          await handleDelete();
        }}
        title="Delete pet?"
        body="This will remove this pet's profile."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        icon="trash-2"
        iconTone="caution"
        confirmTone="sage"
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    fontFamily: theme.fonts.medium,
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
    paddingVertical: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.sm,
  },
  inputError: {
    borderColor: theme.colors.feedback.error.value,
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
  choiceError: {
    borderWidth: 1,
    borderColor: theme.colors.feedback.error.value,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xs,
  },
  inlineError: {
    marginTop: -theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.feedback.error.value,
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
