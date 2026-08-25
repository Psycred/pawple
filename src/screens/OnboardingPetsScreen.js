import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  UIManager,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import PawPhotoFrame from '../components/PawPhotoFrame';
import PhotoPickerModal from '../components/PhotoPickerModal';
import LegalConsentRow from '../components/LegalConsentRow';
import {
  openAppSettings,
  requestCameraPermissionJIT,
} from '../lib/permissions';
import { pickFromGallery } from '../lib/photoPicker';
import { useActivePet } from '../contexts/ActivePetContext';
import { useAuth } from '../contexts/AuthContext';
import { formatPetIdentityLine } from '../utils/petDisplay';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

/** Inputs and placeholders always use Inter — never Caveat. */
const INPUT_FONT_FAMILY = 'Inter-Regular';
const INPUT_PLACEHOLDER_COLOR = theme.colors.placeholder.value;

const PET_TYPE_CHIPS = [
  { key: 'dog', label: '🐕 Dog' },
  { key: 'cat', label: '🐈 Cat' },
  { key: 'fish', label: '🐠 Fish' },
  { key: 'other', label: '🦎 Other' },
];

const createEmptyPet = () => ({
  name: '',
  age: '',
  breed: '',
  gender: '',
  vaccinated: '',
  photoUri: null,
  pet_type: '',
  pet_type_custom: '',
});

const isPetEmpty = (pet) =>
  !pet.pet_type &&
  !pet.pet_type_custom?.trim() &&
  !pet.name.trim() &&
  !pet.age.trim() &&
  !pet.breed.trim() &&
  !pet.gender &&
  !pet.vaccinated &&
  !pet.photoUri;

const sanitizeAgeInput = (value) => {
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`;
};

/** Empty or invalid numeric → null; otherwise float (NaN coerced via spec). */
const parseAgeForStorage = (ageStr) => {
  const t = String(ageStr ?? '').trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : parseFloat(t.replace(/[^0-9.]/g, '')) || 0;
};

/** Ready to save: name + one chip (and custom text if Other). Everything else optional. */
const isPetValid = (pet) => {
  const typeOk =
    pet.pet_type === 'dog' ||
    pet.pet_type === 'cat' ||
    pet.pet_type === 'fish' ||
    (pet.pet_type === 'other' && !!pet.pet_type_custom?.trim());
  return typeOk && !!pet.name.trim();
};

/** Conversational line above chips; updates as `pet.name` changes. */
const getPetTypePromptLine = (pet, petIndex) => {
  const n = pet.name.trim();
  if (n) {
    return `Is ${n} a... 🐾`;
  }
  return petIndex === 0 ? 'Is your new friend a... 🐾' : 'Is this new friend a... 🐾';
};

/**
 * Keep the selected pet photo visible in-app even before remote storage is configured.
 * Accepts remote URLs and local picker URIs (file/content).
 */
const photoUrlForInsert = (photoUri) => {
  if (photoUri == null || typeof photoUri !== 'string') return null;
  const trimmed = photoUri.trim();
  if (!trimmed) return null;
  const isRemote = trimmed.startsWith('https://') || trimmed.startsWith('http://');
  const isLocal = trimmed.startsWith('file://') || trimmed.startsWith('content://');
  return isRemote || isLocal ? trimmed : null;
};

/** Collapsed card: Name • Type • Breed (Apple-style identity line). */
const formatPetSummary = (pet) => `🐾 ${formatPetIdentityLine(pet)}`;

export default function OnboardingPetsScreen({ navigation, route }) {
  const { setPet } = useActivePet();
  const { profile } = useAuth();
  const mode = route?.params?.mode;
  const petId = route?.params?.petId ?? null;
  const isManageAddMode = mode === 'add';
  const isEditMode = mode === 'edit';
  const isManageCrudMode = isManageAddMode || isEditMode;
  const fullName = route?.params?.fullName ?? profile?.name ?? '';
  const city = route?.params?.city ?? profile?.city ?? '';
  const inviteCode = (route?.params?.inviteCode ?? '').trim().toUpperCase();
  const [petForms, setPetForms] = useState([createEmptyPet()]);
  /** Only one pet form is expanded at a time; summaries appear above. */
  const [expandedPetIndex, setExpandedPetIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [invalidPetIndexes, setInvalidPetIndexes] = useState([]);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [photoModalPetIndex, setPhotoModalPetIndex] = useState(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [secondaryPetFocusToken, setSecondaryPetFocusToken] = useState(0);
  const nameInputRef = useRef(null);
  const scrollViewRef = useRef(null);

  const showInviteInvalidFeedback = () => {
    const message = 'Code invalid or already used.';
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Invite code', message);
  };

  const completedCount = useMemo(() => petForms.filter((pet) => isPetValid(pet)).length, [petForms]);
  const hasAtLeastOneValidPet = completedCount > 0;
  const hasPartiallyInvalidPet = useMemo(
    () => petForms.some((pet) => !isPetEmpty(pet) && !isPetValid(pet)),
    [petForms],
  );
  const canSubmitFinalOnboarding = Boolean(fullName?.trim() && city?.trim() && hasAtLeastOneValidPet && !hasPartiallyInvalidPet);

  const collapsedIndices = useMemo(
    () => petForms.map((_, i) => i).filter((i) => i !== expandedPetIndex),
    [petForms, expandedPetIndex],
  );

  useEffect(() => {
    const loadPetForEdit = async () => {
      if (!isEditMode || !petId) {
        return;
      }
      setPrefillLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Pets', 'Please sign in again.');
          navigation.goBack();
          return;
        }
        const { data, error } = await supabase
          .from('pets')
          .select('*')
          .eq('id', petId)
          .eq('owner_id', user.id)
          .single();
        if (error || !data) {
          throw error || new Error('Pet not found');
        }
        setPetForms([
          {
            name: data.name ?? '',
            age: data.age != null ? String(data.age) : '',
            breed: data.breed ?? '',
            gender: data.gender ?? '',
            vaccinated: data.vaccinated ?? '',
            photoUri: data.photo_url ?? null,
            pet_type: data.pet_type ?? '',
            pet_type_custom: data.pet_type_custom ?? '',
          },
        ]);
        setExpandedPetIndex(0);
      } catch (error) {
        console.log('[OnboardingPets] Edit prefill error:', error);
        Alert.alert('Pets', 'Could not load this pet profile.');
        navigation.goBack();
      } finally {
        setPrefillLoading(false);
      }
    };
    loadPetForEdit();
  }, [isEditMode, navigation, petId]);

  const updatePetField = (index, field, value) => {
    setPetForms((prev) => prev.map((pet, i) => (i === index ? { ...pet, [field]: value } : pet)));
    setInvalidPetIndexes((prev) => prev.filter((item) => item !== index));
  };

  const selectPetType = (index, typeKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPetForms((prev) =>
      prev.map((pet, i) => {
        if (i !== index) return pet;
        const next = { ...pet, pet_type: typeKey };
        if (typeKey !== 'other') {
          next.pet_type_custom = '';
        }
        return next;
      }),
    );
    setInvalidPetIndexes((prev) => prev.filter((item) => item !== index));
  };

  const expandPet = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPetIndex(index);
  };

  const handleAddAnotherPet = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPetForms((prev) => {
      const next = [...prev, createEmptyPet()];
      setExpandedPetIndex(next.length - 1);
      return next;
    });
    setSecondaryPetFocusToken((n) => n + 1);
  };

  const handleCancelSecondaryPet = () => {
    if (isManageCrudMode || petForms.length <= 1) {
      return;
    }
    const idx = expandedPetIndex;
    if (idx <= 0) {
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPetForms((prev) => prev.filter((_, i) => i !== idx));
    setExpandedPetIndex(Math.max(0, idx - 1));
    setInvalidPetIndexes((prev) =>
      prev
        .filter((i) => i !== idx)
        .map((i) => (i > idx ? i - 1 : i)),
    );
  };

  /** Collapse secondary form back to main list (pet row stays in draft). */
  const handleSaveSecondaryPetDraft = () => {
    if (isManageCrudMode || expandedPetIndex <= 0) {
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPetIndex(0);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo?.({ y: 0, animated: true });
    }, 50);
  };

  useEffect(() => {
    if (isManageCrudMode || secondaryPetFocusToken === 0) {
      return;
    }
    if (expandedPetIndex <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo?.({ y: 0, animated: true });
      nameInputRef.current?.focus?.();
    }, 100);
    return () => clearTimeout(timer);
  }, [secondaryPetFocusToken, expandedPetIndex, isManageCrudMode]);

  const openPetPhotoOptions = (index) => {
    setPhotoModalPetIndex(index);
    setPhotoModalVisible(true);
  };

  const closePhotoModal = () => {
    setPhotoModalVisible(false);
    setPhotoModalPetIndex(null);
  };

  /** @returns {Promise<boolean>} true when a new image URI was saved */
  const pickPetPhoto = async (index, source) => {
    if (index == null) {
      return false;
    }
    try {
      if (source === 'library') {
        const result = await pickFromGallery({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (result?.assets?.[0]?.uri) {
          updatePetField(index, 'photoUri', result.assets[0].uri);
          return true;
        }
        return false;
      }

      const granted = await requestCameraPermissionJIT();
      if (!granted) {
        Alert.alert('Camera', 'Permission was not granted. You can skip the photo and continue.', [
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
        updatePetField(index, 'photoUri', result.assets[0].uri);
        return true;
      }
      return false;
    } catch (e) {
      console.log('[OnboardingPets] Image picker error:', e);
      Alert.alert('Photo', 'Something went wrong. You can continue without a photo.');
      return false;
    }
  };

  const saveOnboarding = async () => {
    try {
      if (isManageCrudMode) {
        const activePet = petForms[0];
        if (!isPetValid(activePet)) {
          Alert.alert(
            'Almost there',
            'Add a name and choose Dog, Cat, Fish, or Other. If you choose Other, include what they are.',
          );
          return;
        }
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Pets', 'Please sign in again.');
          return;
        }
        const payload = {
          owner_id: user.id,
          name: activePet.name.trim(),
          age: parseAgeForStorage(activePet.age),
          breed: activePet.breed.trim() || null,
          gender: activePet.gender?.trim() || null,
          vaccinated:
            activePet.vaccinated === 'Yes' || activePet.vaccinated === 'No' ? activePet.vaccinated : null,
          photo_url: photoUrlForInsert(activePet.photoUri),
          pet_type: activePet.pet_type,
          pet_type_custom:
            activePet.pet_type === 'other'
              ? activePet.pet_type_custom?.trim()
                ? activePet.pet_type_custom.trim()
                : null
              : null,
        };
        const petsData = payload;
        console.log('[DEBUG] User:', user);
        console.log('[DEBUG] Pets data:', petsData);
        console.log('[OnboardingPets] Saving pets (manage):', payload);
        console.log('[OnboardingPets] Current user:', user?.id);
        if (isEditMode) {
          const { error } = await supabase
            .from('pets')
            .update(payload)
            .eq('id', petId)
            .eq('owner_id', user.id);
          if (error) {
            console.error('[OnboardingPets] Manage update error:', {
              message: error?.message,
              code: error?.code,
              details: error?.details,
              hint: error?.hint,
            });
            throw error;
          }
          Alert.alert('Pets', 'Profile updated');
          if (petId) {
            await setPet(String(petId));
          }
          navigation.goBack();
          return;
        } else {
          const { data: insertedPet, error } = await supabase.from('pets').insert(payload).select('id').single();
          if (error) {
            console.error('[OnboardingPets] Manage insert error:', {
              message: error?.message,
              code: error?.code,
              details: error?.details,
              hint: error?.hint,
            });
            throw error;
          }
          console.log('[OnboardingPets] Manage insert OK:', { insertedPet });
          if (insertedPet?.id) {
            await setPet(String(insertedPet.id));
          }
          navigation.navigate('MainTabs', { screen: 'FeedScreen' });
          return;
        }
      }

      if (!fullName || !city) {
        Alert.alert('Missing Info', 'Please go back and complete your profile details.');
        return;
      }

      if (!petForms.some(isPetValid)) {
        Alert.alert(
          'Almost there',
          'Add at least one friend with their name and a tap on Dog, Cat, Fish, or Other. If you pick Other, tell us what they are.',
        );
        return;
      }

      const invalidIndexes = petForms
        .map((pet, index) => ({ pet, index }))
        .filter(({ pet }) => !isPetEmpty(pet) && !isPetValid(pet))
        .map(({ index }) => index);

      if (invalidIndexes.length > 0) {
        setInvalidPetIndexes(invalidIndexes);
        const petLabels = invalidIndexes.map((index) => `Pet ${index + 1}`).join(', ');
        Alert.alert(
          'Just a little more',
          `${petLabels} still need a name and one of the paths below (Dog, Cat, Fish, or Other). If you chose Other, add a quick note so we know who they are.`,
        );
        return;
      }

      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'No user found. Please sign in again.');
        return;
      }

      console.log('[OnboardingPets] Onboarding save start, user:', user.id, 'inviteCode:', inviteCode || '(none)');

      let redeemInviteId = null;
      if (inviteCode) {
        const { data: inviteRow, error: inviteError } = await supabase
          .from('invites')
          .select('id, user_id, status')
          .eq('code', inviteCode)
          .eq('status', 'unused')
          .maybeSingle();
        if (inviteError) {
          throw inviteError;
        }
        if (!inviteRow?.id) {
          showInviteInvalidFeedback();
          return;
        }
        if (String(inviteRow.user_id) === String(user.id)) {
          Alert.alert('Invite code', 'You cannot redeem your own invite code.');
          return;
        }
        redeemInviteId = inviteRow.id;
      }

      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (existingProfileError) {
        throw existingProfileError;
      }

      const consentAt = new Date().toISOString();

      if (!existingProfile?.id) {
        const { error: profileError } = await supabase.from('profiles').upsert(
          {
            id: user.id,
            name: fullName,
            city: city,
            email: user.email || null,
            accepted_tos_at: consentAt,
            accepted_privacy_at: consentAt,
            updated_at: consentAt,
          },
          { onConflict: 'id' },
        );

        if (profileError) {
          console.error('[OnboardingPets] Profile upsert error:', {
            message: profileError?.message,
            code: profileError?.code,
            details: profileError?.details,
            hint: profileError?.hint,
          });
          throw profileError;
        }
      } else {
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            name: fullName,
            city: city,
            email: user.email || null,
            accepted_tos_at: consentAt,
            accepted_privacy_at: consentAt,
            updated_at: consentAt,
          })
          .eq('id', user.id);
        if (profileUpdateError) {
          console.error('[OnboardingPets] Profile update error:', profileUpdateError);
          throw profileUpdateError;
        }
      }

      const petsToSave = petForms.filter(isPetValid);
      const petsPayload = petsToSave.map((pet) => ({
        owner_id: user.id,
        name: pet.name.trim(),
        age: parseAgeForStorage(pet.age),
        breed: pet.breed.trim() || null,
        gender: pet.gender?.trim() || null,
        vaccinated: pet.vaccinated === 'Yes' || pet.vaccinated === 'No' ? pet.vaccinated : null,
        photo_url: photoUrlForInsert(pet.photoUri),
        pet_type: pet.pet_type,
        pet_type_custom:
          pet.pet_type === 'other' ? (pet.pet_type_custom?.trim() ? pet.pet_type_custom.trim() : null) : null,
      }));

      const petsData = petsPayload;
      console.log('[DEBUG] User:', user);
      console.log('[DEBUG] Pets data:', petsData);
      console.log('[OnboardingPets] Saving pets:', petsPayload);
      console.log('[OnboardingPets] Current user:', user?.id);
      console.log('[OnboardingPets] Pets to save count:', petsPayload.length, 'raw forms:', petForms.length);

      const { data: insertedPets, error: petError } = await supabase.from('pets').insert(petsPayload).select('id');
      if (petError) {
        console.error('[OnboardingPets] Pets insert error:', {
          message: petError?.message,
          code: petError?.code,
          details: petError?.details,
          hint: petError?.hint,
        });
        throw petError;
      }
      console.log('[OnboardingPets] Pets insert OK:', { insertedPets, rowCount: insertedPets?.length ?? 0 });

      const firstCreatedPetId = insertedPets?.[0]?.id;
      if (firstCreatedPetId) {
        await setPet(String(firstCreatedPetId));
      }

      if (redeemInviteId) {
        const redeemedAt = new Date().toISOString();
        const { data: redeemedInvite, error: redeemError } = await supabase
          .from('invites')
          .update({ status: 'used', used_by_user_id: user.id, used_at: redeemedAt })
          .eq('id', redeemInviteId)
          .eq('status', 'unused')
          .select('id')
          .maybeSingle();
        if (redeemError) {
          throw redeemError;
        }
        if (!redeemedInvite?.id) {
          showInviteInvalidFeedback();
          return;
        }
      }

      navigation.replace('OnboardingFinal');
    } catch (error) {
      console.error('[OnboardingPets] Save failed:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        name: error?.name,
        stack: error?.stack,
        raw: error,
      });
      console.error('[DEBUG] Supabase error (actual):', error);
      console.error('[DEBUG] Supabase error keys:', error && typeof error === 'object' ? Object.keys(error) : []);
      console.error('[DEBUG] Supabase error fields:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        statusCode: error?.statusCode,
      });
      try {
        console.error(
          '[DEBUG] Supabase error JSON:',
          JSON.stringify(error, Object.getOwnPropertyNames(Object(error))),
        );
      } catch (stringifyErr) {
        console.error('[DEBUG] Supabase error JSON stringify failed:', stringifyErr);
      }
      const detail =
        error?.message ||
        error?.details ||
        (typeof error === 'string' ? error : null) ||
        'Could not save setup. Please try again.';
      Alert.alert('Error', detail);
    } finally {
      setLoading(false);
    }
  };

  const renderOptionRow = (label, value, options, onSelect, optional = false) => (
    <View>
      <Text style={optional ? styles.labelOptional : styles.label}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const active = value === option;
          return (
            <Pressable
              key={option}
              style={({ pressed }) => [
                styles.optionChip,
                optional && styles.optionChipOptional,
                active && styles.optionChipActive,
                pressed && styles.chipPressed,
              ]}
              onPress={() => onSelect(option)}
            >
              <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const isSecondaryPetExpanded = !isManageCrudMode && expandedPetIndex > 0;
  const showOnboardingHeader = !isSecondaryPetExpanded;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {prefillLoading ? (
        <View style={styles.prefillLoadingWrap}>
          <ActivityIndicator color={theme.colors.primary.light} />
        </View>
      ) : null}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showOnboardingHeader ? (
          <>
            <Text style={styles.title}>
              {isEditMode ? 'Edit Pet' : isManageAddMode ? 'Add Pet' : 'Add Your Pets'}
            </Text>
            <Text style={styles.subtitle}>
              {isManageCrudMode ? 'Keep your pet profile up to date.' : 'You can add one or many pets now.'}
            </Text>
          </>
        ) : null}

        {/* Collapsed pets first — clean summary cards */}
        {!isManageCrudMode &&
          collapsedIndices.map((index) => {
          const pet = petForms[index];
          const petNumber = index + 1;
          const summaryLine = formatPetSummary(pet);
          const showInvalid = invalidPetIndexes.includes(index);

          return (
            <Pressable
              key={`pet-summary-${petNumber}`}
              style={({ pressed }) => [
                styles.summaryCard,
                showInvalid && styles.summaryCardInvalid,
                pressed && styles.summaryPressed,
              ]}
              onPress={() => expandPet(index)}
              accessibilityRole="button"
              accessibilityLabel={`Edit pet ${petNumber}`}
            >
              <View style={styles.summaryRow}>
                <Text style={styles.summaryMainText} numberOfLines={2}>
                  {summaryLine}
                </Text>
                <View style={styles.editBadge}>
                  <Text style={styles.editIcon} accessibilityLabel="Edit">
                    ✏️
                  </Text>
                  <Text style={styles.editLabel}>Edit</Text>
                </View>
              </View>
            </Pressable>
          );
          })}

        {/* Single expanded pet form (mapped so PawPhotoFrame stays per-pet and explicit). */}
        {petForms.map((pet, index) => {
          if (index !== expandedPetIndex) {
            return null;
          }
          const petNumber = index + 1;
          const isYesSelected = pet.vaccinated === 'Yes';
          const isNoSelected = pet.vaccinated === 'No';
          const isSecondaryPetFlow = !isManageCrudMode && index > 0;
          return (
            <View
              key={`pet-expanded-${index}`}
              style={[
                styles.card,
                isSecondaryPetFlow && styles.cardSecondary,
                invalidPetIndexes.includes(index) && styles.cardInvalid,
              ]}
            >
              {isSecondaryPetFlow ? (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryCancelHit, pressed && styles.chipPressed]}
                    onPress={handleCancelSecondaryPet}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel adding pet"
                  >
                    <Feather name="x" size={theme.fontSizes.xxl} color={theme.colors.text.muted.light} />
                  </Pressable>
                  {petForms.length > 1 ? (
                    <Text style={styles.petFormIndex}>{`Pet ${petNumber}`}</Text>
                  ) : null}

                  <TextInput
                    ref={nameInputRef}
                    style={[styles.input, styles.inputPetName]}
                    placeholder="Their name"
                    placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                    value={pet.name}
                    onChangeText={(value) => updatePetField(index, 'name', value)}
                    editable={!loading}
                    returnKeyType="next"
                    accessibilityLabel="Pet name"
                  />

                  <View style={styles.petTypePromptWrap}>
                    <Text style={styles.petTypePrompt} numberOfLines={2}>
                      {getPetTypePromptLine(pet, index)}
                    </Text>
                  </View>

                  <View style={styles.petTypeChipRow} accessibilityRole="radiogroup">
                    {PET_TYPE_CHIPS.map(({ key, label }) => {
                      const selected = pet.pet_type === key;
                      return (
                        <Pressable
                          key={key}
                          style={({ pressed }) => [
                            styles.petTypeChip,
                            selected ? styles.petTypeChipSelected : styles.petTypeChipIdle,
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => selectPetType(index, key)}
                          disabled={loading}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={label}
                        >
                          <Text style={[styles.petTypeChipText, selected && styles.petTypeChipTextSelected]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {pet.pet_type === 'other' ? (
                    <TextInput
                      style={[styles.input, styles.inputOptional, styles.petOtherInput]}
                      placeholder="Tell us what they are..."
                      placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                      value={pet.pet_type_custom}
                      onChangeText={(value) => updatePetField(index, 'pet_type_custom', value)}
                      editable={!loading}
                      accessibilityLabel="Describe your pet"
                    />
                  ) : null}

                  <View style={styles.optionalFields}>
                    <Text style={styles.labelOptional}>Breed</Text>
                    <TextInput
                      style={[styles.input, styles.inputOptional]}
                      placeholder="Golden Retriever"
                      placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                      value={pet.breed}
                      onChangeText={(value) => updatePetField(index, 'breed', value)}
                      editable={!loading}
                      returnKeyType="next"
                    />

                    <Text style={styles.labelOptional}>Age</Text>
                    <TextInput
                      style={[styles.input, styles.inputOptional]}
                      placeholder="Years (e.g., 2.5)"
                      placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                      value={pet.age}
                      onChangeText={(value) => updatePetField(index, 'age', sanitizeAgeInput(value))}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                      editable={!loading}
                    />

                    {renderOptionRow('Gender', pet.gender, GENDER_OPTIONS, (value) => updatePetField(index, 'gender', value), true)}

                    <View>
                      <Text style={styles.labelOptional}>Vaccinated?</Text>
                      <View style={styles.vaccineButtonRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.vaccineButton,
                            styles.vaccineButtonHalf,
                            {
                              backgroundColor: isYesSelected ? theme.colors.primary.light : theme.colors.background.light,
                              borderColor: isYesSelected ? theme.colors.primary.light : theme.colors.border.light,
                            },
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => updatePetField(index, 'vaccinated', 'Yes')}
                          disabled={loading}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isYesSelected }}
                          accessibilityLabel="Vaccinated: Yes"
                        >
                          <Text
                            style={[styles.vaccineButtonText, isYesSelected && styles.vaccineButtonTextOnSolid]}
                          >
                            Yes
                          </Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.vaccineButton,
                            styles.vaccineButtonHalf,
                            {
                              backgroundColor: isNoSelected ? theme.colors.error.light : theme.colors.background.light,
                              borderColor: isNoSelected ? theme.colors.error.light : theme.colors.border.light,
                            },
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => updatePetField(index, 'vaccinated', 'No')}
                          disabled={loading}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isNoSelected }}
                          accessibilityLabel="Vaccinated: No"
                        >
                          <Text
                            style={[styles.vaccineButtonText, isNoSelected && styles.vaccineButtonTextOnSolid]}
                          >
                            No
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.photoSection}>
                      <View style={styles.photoFrameRow}>
                        <PawPhotoFrame
                          uri={pet.photoUri}
                          onPress={() => openPetPhotoOptions(index)}
                          disabled={loading}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.secondaryBottomActions}>
                    <Pressable
                      style={({ pressed }) => [styles.secondaryBottomBtn, pressed && styles.chipPressed]}
                      onPress={handleCancelSecondaryPet}
                      disabled={loading}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel and remove this pet"
                    >
                      <Text style={styles.secondaryBottomBtnTextCancel}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.secondaryBottomBtnPrimary, pressed && styles.chipPressed]}
                      onPress={handleSaveSecondaryPetDraft}
                      disabled={loading}
                      accessibilityRole="button"
                      accessibilityLabel="Save pet and return to list"
                    >
                      <Text style={styles.secondaryBottomBtnTextSave}>Save pet</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {petForms.length > 1 ? (
                    <Text style={styles.petFormIndex}>{`Pet ${petNumber}`}</Text>
                  ) : null}

                  <TextInput
                    ref={nameInputRef}
                    style={[styles.input, styles.inputPetName]}
                    placeholder="Their name"
                    placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                    value={pet.name}
                    onChangeText={(value) => updatePetField(index, 'name', value)}
                    editable={!loading}
                    accessibilityLabel="Pet name"
                  />

                  <View style={styles.petTypePromptWrap}>
                    <Text style={styles.petTypePrompt} numberOfLines={2}>
                      {getPetTypePromptLine(pet, index)}
                    </Text>
                  </View>

                  <View style={styles.petTypeChipRow} accessibilityRole="radiogroup">
                    {PET_TYPE_CHIPS.map(({ key, label }) => {
                      const selected = pet.pet_type === key;
                      return (
                        <Pressable
                          key={key}
                          style={({ pressed }) => [
                            styles.petTypeChip,
                            selected ? styles.petTypeChipSelected : styles.petTypeChipIdle,
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => selectPetType(index, key)}
                          disabled={loading}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={label}
                        >
                          <Text style={[styles.petTypeChipText, selected && styles.petTypeChipTextSelected]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {pet.pet_type === 'other' ? (
                    <TextInput
                      style={[styles.input, styles.inputOptional, styles.petOtherInput]}
                      placeholder="Tell us what they are..."
                      placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                      value={pet.pet_type_custom}
                      onChangeText={(value) => updatePetField(index, 'pet_type_custom', value)}
                      editable={!loading}
                      accessibilityLabel="Describe your pet"
                    />
                  ) : null}

                  <View style={styles.optionalFields}>
                    <Text style={styles.labelOptional}>Breed</Text>
                    <TextInput
                      style={[styles.input, styles.inputOptional]}
                      placeholder="Golden Retriever"
                      placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                      value={pet.breed}
                      onChangeText={(value) => updatePetField(index, 'breed', value)}
                      editable={!loading}
                    />

                    <Text style={styles.labelOptional}>Age</Text>
                    <TextInput
                      style={[styles.input, styles.inputOptional]}
                      placeholder="Years (e.g., 2.5)"
                      placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                      value={pet.age}
                      onChangeText={(value) => updatePetField(index, 'age', sanitizeAgeInput(value))}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                      editable={!loading}
                    />

                    {renderOptionRow('Gender', pet.gender, GENDER_OPTIONS, (value) => updatePetField(index, 'gender', value), true)}

                    <View>
                      <Text style={styles.labelOptional}>Vaccinated?</Text>
                      <View style={styles.vaccineButtonRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.vaccineButton,
                            styles.vaccineButtonHalf,
                            {
                              backgroundColor: isYesSelected ? theme.colors.primary.light : theme.colors.background.light,
                              borderColor: isYesSelected ? theme.colors.primary.light : theme.colors.border.light,
                            },
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => updatePetField(index, 'vaccinated', 'Yes')}
                          disabled={loading}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isYesSelected }}
                          accessibilityLabel="Vaccinated: Yes"
                        >
                          <Text
                            style={[styles.vaccineButtonText, isYesSelected && styles.vaccineButtonTextOnSolid]}
                          >
                            Yes
                          </Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.vaccineButton,
                            styles.vaccineButtonHalf,
                            {
                              backgroundColor: isNoSelected ? theme.colors.error.light : theme.colors.background.light,
                              borderColor: isNoSelected ? theme.colors.error.light : theme.colors.border.light,
                            },
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => updatePetField(index, 'vaccinated', 'No')}
                          disabled={loading}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isNoSelected }}
                          accessibilityLabel="Vaccinated: No"
                        >
                          <Text
                            style={[styles.vaccineButtonText, isNoSelected && styles.vaccineButtonTextOnSolid]}
                          >
                            No
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.photoSection}>
                      <View style={styles.photoFrameRow}>
                        <PawPhotoFrame
                          uri={pet.photoUri}
                          onPress={() => openPetPhotoOptions(index)}
                          disabled={loading}
                        />
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          );
        })}

        {!isManageCrudMode && expandedPetIndex === 0 ? (
          <>
            <Text style={styles.addPetSubtitle}>Got another furry friend?</Text>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={handleAddAnotherPet}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>+ Add Another Pet</Text>
            </Pressable>
          </>
        ) : null}

        {!isManageCrudMode ? <LegalConsentRow /> : null}

        <Pressable
          style={({ pressed }) => [styles.button, (!isManageCrudMode && !canSubmitFinalOnboarding) && styles.buttonDisabled, pressed && styles.buttonPressed]}
          onPress={saveOnboarding}
          disabled={loading || (!isManageCrudMode && !canSubmitFinalOnboarding)}
          accessibilityRole="button"
          accessibilityLabel="Complete setup and go to home"
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.background.light} />
          ) : (
            <Text style={styles.buttonText}>
              {isEditMode
                ? 'Save Changes'
                : isManageAddMode
                  ? 'Add Pet'
                  : `Complete Setup 🎉 (${completedCount} ready)`}
            </Text>
          )}
        </Pressable>
      </ScrollView>

      <PhotoPickerModal
        visible={photoModalVisible}
        petDisplayName={photoModalPetIndex != null ? petForms[photoModalPetIndex]?.name ?? '' : ''}
        onClose={closePhotoModal}
        onTakePhoto={() => pickPetPhoto(photoModalPetIndex, 'camera')}
        onChooseFromLibrary={() => pickPetPhoto(photoModalPetIndex, 'library')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.light,
  },
  prefillLoadingWrap: {
    paddingTop: theme.spacing.lg,
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: theme.feed.shellPaddingHorizontal,
    paddingTop: theme.feed.shellPaddingTop,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.md,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: theme.fontSizes.creationTitle,
    lineHeight: Math.round(theme.fontSizes.creationTitle * theme.lineHeights.tight),
    color: theme.colors.text.primary.light,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: INPUT_FONT_FAMILY,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.card.light,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  cardInvalid: {
    borderColor: theme.colors.error.light,
  },
  cardSecondary: {
    marginTop: 0,
  },
  secondaryCancelHit: {
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.sm,
    minWidth: theme.components.meetup.ctaMinHeight,
    minHeight: theme.components.meetup.ctaMinHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.light,
  },
  secondaryBottomBtn: {
    flex: 1,
    minHeight: theme.components.meetup.ctaMinHeight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.light,
  },
  secondaryBottomBtnPrimary: {
    flex: 1,
    minHeight: theme.components.meetup.ctaMinHeight,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary.light,
  },
  secondaryBottomBtnTextCancel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.secondary.light,
  },
  secondaryBottomBtnTextSave: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.components.button.primaryText,
  },
  nameLead: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    marginBottom: theme.spacing.xs,
  },
  petTypePromptWrap: {
    marginBottom: theme.spacing.sm,
  },
  petTypePrompt: {
    fontFamily: 'Inter-Medium',
    fontSize: theme.fontSizes.md,
    lineHeight: Math.round(theme.fontSizes.md * theme.lineHeights.normal),
    color: theme.colors.text.primary.light,
    textAlign: 'center',
  },
  optionalFields: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.light,
    gap: theme.spacing.xs,
  },
  labelOptional: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    marginTop: theme.spacing.sm,
  },
  inputOptional: {
    backgroundColor: theme.colors.card.light,
    borderColor: theme.colors.border.light,
    opacity: 0.98,
  },
  petFormIndex: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  petTypeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  petTypeChip: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  petTypeChipIdle: {
    backgroundColor: theme.colors.card.light,
    borderColor: theme.colors.border.light,
  },
  petTypeChipSelected: {
    backgroundColor: theme.colors.primary.light,
    borderColor: theme.colors.primary.light,
  },
  petTypeChipText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary.light,
  },
  petTypeChipTextSelected: {
    color: theme.components.button.primaryText,
  },
  petOtherInput: {
    marginBottom: theme.spacing.xs,
  },
  summaryCard: {
    backgroundColor: theme.colors.card.light,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  summaryCardInvalid: {
    borderColor: theme.colors.error.light,
  },
  summaryPressed: {
    opacity: 0.92,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  summaryMainText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  editIcon: {
    fontSize: theme.fontSizes.md,
  },
  editLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
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
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.components.input.paddingVertical,
    paddingHorizontal: theme.components.input.paddingHorizontal,
    fontFamily: INPUT_FONT_FAMILY,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  inputPetName: {
    fontFamily: INPUT_FONT_FAMILY,
    fontSize: theme.fontSizes.lg,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  optionChip: {
    minHeight: theme.components.button.minHeight,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.background.light,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
  },
  optionChipOptional: {
    backgroundColor: theme.colors.card.light,
    borderColor: theme.colors.border.light,
  },
  optionChipActive: {
    backgroundColor: theme.colors.primary.light,
    borderColor: theme.colors.primary.light,
  },
  optionChipText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
  },
  optionChipTextActive: {
    color: theme.components.button.primaryText,
    fontWeight: theme.fontWeights.semibold,
  },
  vaccineButtonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  vaccineButton: {
    minHeight: theme.components.button.minHeight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  vaccineButtonHalf: {
    flex: 1,
  },
  vaccineButtonText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
    fontWeight: theme.fontWeights.semibold,
  },
  vaccineButtonTextOnSolid: {
    color: theme.components.button.primaryText,
  },
  vaccineHelper: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.muted.light,
    marginTop: theme.spacing.xs,
  },
  chipPressed: {
    opacity: 0.88,
  },
  button: {
    backgroundColor: theme.colors.primary.light,
    borderRadius: theme.components.button.borderRadius,
    minHeight: theme.components.button.minHeight,
    paddingVertical: theme.components.button.paddingVertical,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  secondaryButton: {
    borderRadius: theme.components.button.borderRadius,
    minHeight: theme.components.button.minHeight,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.card.light,
    marginTop: theme.spacing.sm,
  },
  addPetSubtitle: {
    fontFamily: INPUT_FONT_FAMILY,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.components.button.primaryText,
    fontWeight: theme.fontWeights.semibold,
  },
  secondaryButtonText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    fontWeight: theme.fontWeights.medium,
  },
  photoSection: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  photoFrameRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
  },
  photoHintOptional: {
    color: theme.colors.text.muted.light,
  },
  photoDisclaimer: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
});
