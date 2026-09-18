import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import PawPhotoFrame from '../components/PawPhotoFrame';
import PhotoPickerModal from '../components/PhotoPickerModal';
import LegalConsentRow from '../components/LegalConsentRow';
import RequiredBadge from '../components/RequiredBadge';
import {
  abandonCameraCapture,
  captureFromCamera,
} from '../lib/cameraCapture';
import { nextCameraTraceId, logCameraTrace } from '../lib/cameraCaptureDiagnostics';
import { logPhotoFlow } from '../lib/photoFlowDiagnostics';
import { pickFromGallery } from '../lib/photoPicker';
import { promptNotificationPermissionIfNeeded } from '../lib/notifications';
import { useActivePet } from '../contexts/ActivePetContext';
import { useAuth } from '../contexts/AuthContext';
import { formatPetIdentityLine } from '../utils/petDisplay';
import { completeOnboarding, getPendingInvite, validateInviteCode } from '../lib/onboardingInvite';
import { getPetFieldErrors, isPetValid } from '../lib/petOnboardingValidation';
import { resolvePetPhotoUrl } from '../lib/petPhotoUpload';
import { approvePickedPhotoUri } from '../lib/photoValidationGate';
import { usePhotoValidationGate } from '../contexts/PhotoValidationContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GENDER_OPTIONS = ['Male', 'Female'];

/** Inputs and placeholders always use Inter — never Caveat. */
const INPUT_FONT_FAMILY = 'Inter-Regular';

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

/** Conversational line above chips; updates as `pet.name` changes. */
const getPetTypePromptLine = (pet, petIndex) => {
  const n = pet.name.trim();
  if (n) {
    return `Is ${n} a... 🐾`;
  }
  return petIndex === 0 ? 'Is your new friend a... 🐾' : 'Is this new friend a... 🐾';
};

/** Collapsed card: Name • Type • Breed (Apple-style identity line). */
const formatPetSummary = (pet) => `🐾 ${formatPetIdentityLine(pet)}`;

export default function OnboardingPetsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { setPet } = useActivePet();
  const { profile, refreshProfile, pendingInviteCode } = useAuth();
  const { ready: photoValidationReady, validatePhoto } = usePhotoValidationGate();
  const mode = route?.params?.mode;
  const petId = route?.params?.petId ?? null;
  const isManageAddMode = mode === 'add';
  const isEditMode = mode === 'edit';
  const isManageCrudMode = isManageAddMode || isEditMode;
  const fullName = route?.params?.fullName ?? profile?.name ?? '';
  const city = route?.params?.city ?? profile?.city ?? '';
  const inviteCode = (route?.params?.inviteCode ?? pendingInviteCode ?? '').trim().toUpperCase();
  const [petForms, setPetForms] = useState([createEmptyPet()]);
  /** Only one pet form is expanded at a time; summaries appear above. */
  const [expandedPetIndex, setExpandedPetIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [invalidPetIndexes, setInvalidPetIndexes] = useState([]);
  const [petFieldErrors, setPetFieldErrors] = useState({});
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [photoModalPetIndex, setPhotoModalPetIndex] = useState(null);
  const [photoValidatingPetIndex, setPhotoValidatingPetIndex] = useState(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [existingPetIds, setExistingPetIds] = useState([]);
  const [secondaryPetFocusToken, setSecondaryPetFocusToken] = useState(0);
  const nameInputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const screenMountedRef = useRef(true);

  const showInviteInvalidFeedback = () => {
    const message = 'This invite may have expired or already been used.';
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Invite not valid', message);
  };

  const onboardingPetOptions = useMemo(
    () => ({ requireBreed: !isManageCrudMode }),
    [isManageCrudMode],
  );
  const completedCount = useMemo(
    () => petForms.filter((pet) => isPetValid(pet, onboardingPetOptions)).length,
    [petForms, onboardingPetOptions],
  );
  const collapsedIndices = useMemo(
    () => petForms.map((_, i) => i).filter((i) => i !== expandedPetIndex),
    [petForms, expandedPetIndex],
  );

  const surfaces = useRuntimeThemeColors();

  const onboardingTheme = useMemo(
    () => ({
      container: { backgroundColor: surfaces.backgroundScreen },
      title: { color: surfaces.textPrimary },
      subtitle: { color: surfaces.textSecondary },
      card: {
        backgroundColor: surfaces.backgroundCard,
        borderColor: surfaces.border,
      },
      photoNameDivider: { backgroundColor: surfaces.border },
      petFormIndex: { color: surfaces.textMuted },
      petTypePrompt: { color: surfaces.textPrimary },
      optionalFieldsBorder: { borderTopColor: surfaces.border },
      labelOptional: { color: surfaces.textMuted },
      label: { color: surfaces.textSecondary },
      requiredFieldLabel: { color: surfaces.textSecondary },
      input: {
        backgroundColor: surfaces.inputBackground,
        borderColor: surfaces.inputBorder,
        color: surfaces.textPrimary,
      },
      inputOptional: {
        backgroundColor: surfaces.backgroundCard,
        borderColor: surfaces.border,
      },
      petTypeChipIdle: {
        backgroundColor: surfaces.backgroundCard,
        borderColor: surfaces.border,
      },
      petTypeChipText: { color: surfaces.textPrimary },
      summaryCard: {
        backgroundColor: surfaces.backgroundCard,
        borderColor: surfaces.border,
      },
      summaryMainText: { color: surfaces.textPrimary },
      editLabel: { color: surfaces.textSecondary },
      optionChip: {
        backgroundColor: surfaces.backgroundScreen,
        borderColor: surfaces.border,
      },
      optionChipOptional: {
        backgroundColor: surfaces.backgroundCard,
        borderColor: surfaces.border,
      },
      optionChipText: { color: surfaces.textSecondary },
      vaccineButtonText: { color: surfaces.textSecondary },
      vaccineUnselected: {
        backgroundColor: surfaces.backgroundScreen,
        borderColor: surfaces.border,
      },
      secondaryBottomActionsBorder: { borderTopColor: surfaces.border },
      secondaryBottomBtn: {
        backgroundColor: surfaces.backgroundScreen,
        borderColor: surfaces.border,
      },
      secondaryBottomBtnTextCancel: { color: surfaces.textSecondary },
      secondaryButton: {
        backgroundColor: surfaces.backgroundCard,
        borderColor: surfaces.border,
      },
      secondaryButtonText: { color: surfaces.textPrimary },
      addPetSubtitle: { color: surfaces.textSecondary },
      primaryActionSpinner: surfaces.isDark
        ? theme.colors.text.inverse.value
        : theme.colors.background.light,
      placeholder: surfaces.placeholder,
      cancelIcon: surfaces.textMuted,
    }),
    [
      surfaces.backgroundCard,
      surfaces.backgroundScreen,
      surfaces.border,
      surfaces.inputBackground,
      surfaces.inputBorder,
      surfaces.isDark,
      surfaces.placeholder,
      surfaces.textMuted,
      surfaces.textPrimary,
      surfaces.textSecondary,
    ],
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

  /** Resume interrupted onboarding: reuse pets already saved without duplicating rows. */
  useEffect(() => {
    const loadExistingOnboardingPets = async () => {
      if (isManageCrudMode) {
        return;
      }
      setPrefillLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) {
          return;
        }
        const { data: existingPets, error } = await supabase
          .from('pets')
          .select('id, name, age, breed, gender, vaccinated, photo_url, pet_type, pet_type_custom')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true });
        if (error) {
          throw error;
        }
        if (!existingPets?.length) {
          return;
        }
        setExistingPetIds(existingPets.map((pet) => pet.id));
        setPetForms(
          existingPets.map((data) => ({
            name: data.name ?? '',
            age: data.age != null ? String(data.age) : '',
            breed: data.breed ?? '',
            gender: data.gender ?? '',
            vaccinated: data.vaccinated ?? '',
            photoUri: data.photo_url ?? null,
            pet_type: data.pet_type ?? '',
            pet_type_custom: data.pet_type_custom ?? '',
          })),
        );
        setExpandedPetIndex(0);
      } catch (error) {
        console.log('[OnboardingPets] Resume prefill error:', error);
      } finally {
        setPrefillLoading(false);
      }
    };
    loadExistingOnboardingPets();
  }, [isManageCrudMode]);

  const updatePetField = (index, field, value) => {
    setPetForms((prev) => prev.map((pet, i) => (i === index ? { ...pet, [field]: value } : pet)));
    setPetFieldErrors((prev) => {
      const currentErrors = prev[index];
      if (!currentErrors?.[field]) {
        return prev;
      }
      const nextForPet = { ...currentErrors };
      delete nextForPet[field];
      const next = { ...prev };
      if (Object.keys(nextForPet).length) {
        next[index] = nextForPet;
      } else {
        delete next[index];
      }
      return next;
    });
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
    setPetFieldErrors((prev) => {
      const currentErrors = prev[index];
      if (!currentErrors) {
        return prev;
      }
      const nextForPet = { ...currentErrors };
      delete nextForPet.pet_type;
      if (typeKey !== 'other') {
        delete nextForPet.pet_type_custom;
      }
      const next = { ...prev };
      if (Object.keys(nextForPet).length) {
        next[index] = nextForPet;
      } else {
        delete next[index];
      }
      return next;
    });
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
    setPetFieldErrors((prev) => {
      const next = {};
      Object.entries(prev).forEach(([rawIndex, errors]) => {
        const itemIndex = Number(rawIndex);
        if (itemIndex !== idx) {
          next[itemIndex > idx ? itemIndex - 1 : itemIndex] = errors;
        }
      });
      return next;
    });
  };

  /** Collapse secondary form back to main list (pet row stays in draft). */
  const handleSaveSecondaryPetDraft = () => {
    if (isManageCrudMode || expandedPetIndex <= 0) {
      return;
    }
    const errors = getPetFieldErrors(petForms[expandedPetIndex], { requireBreed: true });
    if (Object.keys(errors).length > 0) {
      setPetFieldErrors((prev) => ({ ...prev, [expandedPetIndex]: errors }));
      setInvalidPetIndexes((prev) =>
        prev.includes(expandedPetIndex) ? prev : [...prev, expandedPetIndex],
      );
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
  };

  useEffect(() => {
    return () => {
      screenMountedRef.current = false;
    };
  }, []);

  // Abandon in-flight camera only when leaving the screen — not on parent remounts.
  useFocusEffect(
    useCallback(() => {
      return () => {
        abandonCameraCapture('screen_blur', { screen: 'OnboardingPets' });
      };
    }, []),
  );

  // Returning from OS camera/gallery must not leave a stale RN modal intercepting touches.
  useFocusEffect(
    useCallback(() => {
      setPhotoModalVisible(false);
      setPhotoModalPetIndex(null);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setPhotoModalVisible(false);
        setPhotoModalPetIndex(null);
      }
    });
    return () => subscription.remove();
  }, []);

  const commitPickedPetPhoto = useCallback(
    async (index, uri) => {
      if (!uri) {
        return false;
      }
      // Validate after native crop confirmation — commit only when the gate accepts.
      setPhotoValidatingPetIndex(index);
      try {
        const allowed = await approvePickedPhotoUri(uri, {
          ready: photoValidationReady,
          validatePhoto,
        });
        if (!allowed) {
          return false;
        }
        updatePetField(index, 'photoUri', uri);
        return true;
      } finally {
        setPhotoValidatingPetIndex(null);
      }
    },
    [photoValidationReady, validatePhoto],
  );

  /** After native modal dismiss: pet index travels with source — not React state cleared by onClose. */
  const handlePhotoSourceSelected = async (source, petIndex) => {
    logPhotoFlow('screen_handler_start', { screen: 'OnboardingPets', petIndex });
    setPhotoModalVisible(false);
    try {
      await pickPetPhoto(petIndex, source);
    } finally {
      setPhotoModalPetIndex(null);
    }
  };

  /** @returns {Promise<boolean>} true when a new image URI was saved */
  const pickPetPhoto = async (index, source) => {
    if (index == null) {
      return false;
    }

    const traceId = nextCameraTraceId('OnboardingPets');
    logCameraTrace(traceId, 'pick_pet_photo_start', { source, petIndex: index });

    try {
      if (source !== 'camera') {
        const result = await pickFromGallery({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        const uri = result?.assets?.[0]?.uri;
        if (uri) {
          return commitPickedPetPhoto(index, uri);
        }
        return false;
      }

      const capture = await captureFromCamera(
        {
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        },
        { traceId, screen: 'OnboardingPets' },
      );
      logCameraTrace(traceId, 'pick_pet_photo_capture_result', { status: capture.status });

      if (capture.status === 'busy' || capture.status === 'canceled' || capture.status === 'abandoned') {
        return false;
      }
      if (capture.status !== 'captured') {
        return false;
      }
      const cameraUri = capture.result?.assets?.[0]?.uri;
      if (cameraUri) {
        return commitPickedPetPhoto(index, cameraUri);
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
        const activePetErrors = getPetFieldErrors(activePet);
        if (Object.keys(activePetErrors).length > 0) {
          setPetFieldErrors({ 0: activePetErrors });
          setInvalidPetIndexes([0]);
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
        const photo_url = await resolvePetPhotoUrl(activePet.photoUri, user.id);
        const payload = {
          owner_id: user.id,
          name: activePet.name.trim(),
          age: parseAgeForStorage(activePet.age),
          breed: activePet.breed.trim() || null,
          gender: activePet.gender?.trim() || null,
          vaccinated:
            activePet.vaccinated === 'Yes' || activePet.vaccinated === 'No' ? activePet.vaccinated : null,
          photo_url,
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

      if (!petForms.some((pet) => isPetValid(pet, onboardingPetOptions))) {
        const firstCandidateIndex = petForms.findIndex((pet) => !isPetEmpty(pet));
        const targetIndex = firstCandidateIndex >= 0 ? firstCandidateIndex : 0;
        setPetFieldErrors({
          [targetIndex]: getPetFieldErrors(petForms[targetIndex], onboardingPetOptions),
        });
        setInvalidPetIndexes([targetIndex]);
        setExpandedPetIndex(targetIndex);
        Alert.alert(
          'Almost there',
          'Add at least one friend with their name, breed, and a tap on Dog, Cat, Fish, or Other. If you pick Other, tell us what they are.',
        );
        return;
      }

      const invalidIndexes = petForms
        .map((pet, index) => ({ pet, index }))
        .filter(({ pet }) => !isPetEmpty(pet) && !isPetValid(pet, onboardingPetOptions))
        .map(({ index }) => index);

      if (invalidIndexes.length > 0) {
        const nextFieldErrors = {};
        invalidIndexes.forEach((index) => {
          nextFieldErrors[index] = getPetFieldErrors(petForms[index], onboardingPetOptions);
        });
        setPetFieldErrors(nextFieldErrors);
        setInvalidPetIndexes(invalidIndexes);
        const petLabels = invalidIndexes.map((index) => `Pet ${index + 1}`).join(', ');
        Alert.alert(
          'Just a little more',
          `${petLabels} still need a name, breed, and one of the paths below (Dog, Cat, Fish, or Other). If you chose Other, add a quick note so we know who they are.`,
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

      const resolvedInviteCode = inviteCode || (await getPendingInvite(user.id));
      if (!resolvedInviteCode && !__DEV__) {
        Alert.alert('Invite needed', 'Enter a valid invite code to continue.');
        navigation.replace('InviteCodeScreen');
        return;
      }

      let redeemInviteId = null;
      if (resolvedInviteCode) {
        const inviteCheck = await validateInviteCode(resolvedInviteCode, user.id);
        if (!inviteCheck.ok) {
          if (inviteCheck.reason === 'own_invite') {
            Alert.alert('Invite code', 'You cannot redeem your own invite code.');
          } else {
            showInviteInvalidFeedback();
          }
          return;
        }
        redeemInviteId = inviteCheck.inviteId;
      }

      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('profiles')
        .select('id, onboarding_completed_at')
        .eq('id', user.id)
        .maybeSingle();

      if (existingProfileError) {
        throw existingProfileError;
      }

      if (existingProfile?.onboarding_completed_at) {
        await refreshProfile?.();
        navigation.replace('MainTabs', { screen: 'FeedScreen' });
        return;
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

      let firstPetId = existingPetIds[0] ?? null;

      if (!existingPetIds.length) {
        const petsToSave = petForms.filter((pet) => isPetValid(pet, onboardingPetOptions));
        const petsPayload = await Promise.all(
          petsToSave.map(async (pet) => {
            const photo_url = await resolvePetPhotoUrl(pet.photoUri, user.id);
            return {
              owner_id: user.id,
              name: pet.name.trim(),
              age: parseAgeForStorage(pet.age),
              breed: pet.breed.trim() || null,
              gender: pet.gender?.trim() || null,
              vaccinated: pet.vaccinated === 'Yes' || pet.vaccinated === 'No' ? pet.vaccinated : null,
              photo_url,
              pet_type: pet.pet_type,
              pet_type_custom:
                pet.pet_type === 'other' ? (pet.pet_type_custom?.trim() ? pet.pet_type_custom.trim() : null) : null,
            };
          }),
        );

        console.log('[OnboardingPets] Saving pets:', petsPayload);

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
        firstPetId = insertedPets?.[0]?.id ?? null;
      } else {
        console.log('[OnboardingPets] Reusing existing pets for interrupted onboarding:', existingPetIds);
        const petsToSync = petForms.filter((pet, index) => existingPetIds[index]);
        await Promise.all(
          petsToSync.map(async (pet, index) => {
            const petRowId = existingPetIds[index];
            if (!petRowId) {
              return;
            }
            const photo_url = await resolvePetPhotoUrl(pet.photoUri, user.id);
            const { error: syncError } = await supabase
              .from('pets')
              .update({
                name: pet.name.trim(),
                age: parseAgeForStorage(pet.age),
                breed: pet.breed.trim() || null,
                gender: pet.gender?.trim() || null,
                vaccinated:
                  pet.vaccinated === 'Yes' || pet.vaccinated === 'No' ? pet.vaccinated : null,
                photo_url,
                pet_type: pet.pet_type,
                pet_type_custom:
                  pet.pet_type === 'other'
                    ? pet.pet_type_custom?.trim()
                      ? pet.pet_type_custom.trim()
                      : null
                    : null,
              })
              .eq('id', petRowId)
              .eq('owner_id', user.id);
            if (syncError) {
              throw syncError;
            }
          }),
        );
      }

      if (!firstPetId) {
        throw new Error('At least one pet is required to complete onboarding.');
      }

      await setPet(String(firstPetId));

      await completeOnboarding({
        userId: user.id,
        inviteId: redeemInviteId,
        inviteCode: resolvedInviteCode,
      });
      await refreshProfile?.();

      // OS notification prompt after successful pet submit — never block save on result.
      await promptNotificationPermissionIfNeeded();

      navigation.replace('MainTabs', { screen: 'FeedScreen' });
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
      <Text
        style={[
          optional ? styles.labelOptional : styles.label,
          optional ? onboardingTheme.labelOptional : onboardingTheme.label,
        ]}
      >
        {label}
      </Text>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const active = value === option;
          return (
            <Pressable
              key={option}
              style={({ pressed }) => [
                styles.optionChip,
                optional
                  ? [styles.optionChipOptional, onboardingTheme.optionChipOptional]
                  : onboardingTheme.optionChip,
                active && styles.optionChipActive,
                pressed && styles.chipPressed,
              ]}
              onPress={() => onSelect(option)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  onboardingTheme.optionChipText,
                  active && styles.optionChipTextActive,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const isSecondaryPetExpanded = !isManageCrudMode && expandedPetIndex > 0;
  const showOnboardingHeader = !isSecondaryPetExpanded;
  const scrollBottomInset = Math.max(insets.bottom, theme.spacing.xxxl);

  const renderPetPhotoSection = (index, pet) => (
    <View style={styles.photoSectionLead}>
      <View style={styles.photoFrameRow}>
        <PawPhotoFrame
          uri={pet.photoUri}
          onPress={() => openPetPhotoOptions(index)}
          disabled={loading || photoValidatingPetIndex === index}
          validating={photoValidatingPetIndex === index}
        />
      </View>
      <View style={[styles.photoNameDivider, onboardingTheme.photoNameDivider]} />
    </View>
  );

  const renderPrimaryAction = () => (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={saveOnboarding}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Complete setup and go to home"
    >
      {loading ? (
        <ActivityIndicator color={onboardingTheme.primaryActionSpinner} />
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
  );

  return (
    <SafeAreaView style={[styles.container, onboardingTheme.container]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        {prefillLoading ? (
          <View style={styles.prefillLoadingWrap}>
            <ActivityIndicator color={theme.colors.primary.light} />
          </View>
        ) : null}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: theme.feed.shellPaddingTop,
              paddingBottom: scrollBottomInset,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          scrollEnabled
          removeClippedSubviews={false}
        >
        <View style={styles.scrollInner} collapsable={false}>
        {showOnboardingHeader ? (
          <>
            <Text style={[styles.title, onboardingTheme.title]}>
              {isEditMode ? 'Edit Pet' : isManageAddMode ? 'Add Pet' : 'Add Your Pets'}
            </Text>
            <Text style={[styles.subtitle, onboardingTheme.subtitle]}>
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
                onboardingTheme.summaryCard,
                showInvalid && styles.summaryCardInvalid,
                pressed && styles.summaryPressed,
              ]}
              onPress={() => expandPet(index)}
              accessibilityRole="button"
              accessibilityLabel={`Edit pet ${petNumber}`}
            >
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryMainText, onboardingTheme.summaryMainText]} numberOfLines={2}>
                  {summaryLine}
                </Text>
                <View style={styles.editBadge}>
                  <Text style={styles.editIcon} accessibilityLabel="Edit">
                    ✏️
                  </Text>
                  <Text style={[styles.editLabel, onboardingTheme.editLabel]}>Edit</Text>
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
          const petErrors = petFieldErrors[index] ?? {};
          return (
            <View
              key={`pet-expanded-${index}`}
              style={[
                styles.card,
                onboardingTheme.card,
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
                    <Feather name="x" size={theme.fontSizes.xxl} color={onboardingTheme.cancelIcon} />
                  </Pressable>
                  {petForms.length > 1 ? (
                    <Text style={[styles.petFormIndex, onboardingTheme.petFormIndex]}>{`Pet ${petNumber}`}</Text>
                  ) : null}

                  {renderPetPhotoSection(index, pet)}

                  <View style={styles.petDetailsSection}>
                  <View style={styles.requiredLabelRow}>
                    <Text style={[styles.requiredFieldLabel, onboardingTheme.requiredFieldLabel]}>Pet name</Text>
                    <RequiredBadge />
                  </View>
                  <TextInput
                    ref={nameInputRef}
                    style={[styles.input, onboardingTheme.input, styles.inputPetName, petErrors.name && styles.inputError]}
                    placeholder="Their name"
                    placeholderTextColor={onboardingTheme.placeholder}
                    value={pet.name}
                    onChangeText={(value) => updatePetField(index, 'name', value)}
                    editable={!loading}
                    returnKeyType="next"
                    accessibilityLabel="Pet name"
                  />
                  {petErrors.name ? (
                    <Text style={styles.inlineError} accessibilityLiveRegion="polite">
                      {petErrors.name}
                    </Text>
                  ) : null}

                  <View style={styles.petTypePromptWrap}>
                    <Text style={[styles.petTypePrompt, onboardingTheme.petTypePrompt]} numberOfLines={2}>
                      {getPetTypePromptLine(pet, index)}
                    </Text>
                    <RequiredBadge />
                  </View>

                  <View
                    style={[styles.petTypeChipRow, petErrors.pet_type && styles.selectionError]}
                    accessibilityRole="radiogroup"
                  >
                    {PET_TYPE_CHIPS.map(({ key, label }) => {
                      const selected = pet.pet_type === key;
                      return (
                        <Pressable
                          key={key}
                          style={({ pressed }) => [
                            styles.petTypeChip,
                            selected
                              ? styles.petTypeChipSelected
                              : [styles.petTypeChipIdle, onboardingTheme.petTypeChipIdle],
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => selectPetType(index, key)}
                          disabled={loading}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={label}
                        >
                          <Text
                            style={[
                              styles.petTypeChipText,
                              onboardingTheme.petTypeChipText,
                              selected && styles.petTypeChipTextSelected,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {petErrors.pet_type ? (
                    <Text style={styles.inlineError} accessibilityLiveRegion="polite">
                      {petErrors.pet_type}
                    </Text>
                  ) : null}

                  {pet.pet_type === 'other' ? (
                    <>
                      <View style={styles.requiredLabelRow}>
                        <Text style={[styles.requiredFieldLabel, onboardingTheme.requiredFieldLabel]}>Type</Text>
                        <RequiredBadge />
                      </View>
                      <TextInput
                        style={[
                          styles.input,
                          onboardingTheme.input,
                          styles.inputOptional,
                          onboardingTheme.inputOptional,
                          styles.petOtherInput,
                          petErrors.pet_type_custom && styles.inputError,
                        ]}
                        placeholder="Tell us what they are..."
                        placeholderTextColor={onboardingTheme.placeholder}
                        value={pet.pet_type_custom}
                        onChangeText={(value) => updatePetField(index, 'pet_type_custom', value)}
                        editable={!loading}
                        accessibilityLabel="Describe your pet"
                      />
                      {petErrors.pet_type_custom ? (
                        <Text style={styles.inlineError} accessibilityLiveRegion="polite">
                          {petErrors.pet_type_custom}
                        </Text>
                      ) : null}
                    </>
                  ) : null}

                  <View style={[styles.optionalFields, onboardingTheme.optionalFieldsBorder]}>
                    <View style={styles.requiredLabelRow}>
                      <Text style={[styles.requiredFieldLabel, onboardingTheme.requiredFieldLabel]}>Breed</Text>
                      <RequiredBadge />
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        onboardingTheme.input,
                        styles.inputOptional,
                        onboardingTheme.inputOptional,
                        petErrors.breed && styles.inputError,
                      ]}
                      placeholder="Golden Retriever"
                      placeholderTextColor={onboardingTheme.placeholder}
                      value={pet.breed}
                      onChangeText={(value) => updatePetField(index, 'breed', value)}
                      editable={!loading}
                      returnKeyType="next"
                      accessibilityLabel="Breed"
                    />
                    {petErrors.breed ? (
                      <Text style={styles.inlineError} accessibilityLiveRegion="polite">
                        {petErrors.breed}
                      </Text>
                    ) : null}

                    <Text style={[styles.labelOptional, onboardingTheme.labelOptional]}>Age</Text>
                    <TextInput
                      style={[
                        styles.input,
                        onboardingTheme.input,
                        styles.inputOptional,
                        onboardingTheme.inputOptional,
                      ]}
                      placeholder="Years (e.g., 2.5)"
                      placeholderTextColor={onboardingTheme.placeholder}
                      value={pet.age}
                      onChangeText={(value) => updatePetField(index, 'age', sanitizeAgeInput(value))}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                      editable={!loading}
                    />

                    {renderOptionRow('Gender', pet.gender, GENDER_OPTIONS, (value) => updatePetField(index, 'gender', value), true)}

                    <View>
                      <Text style={[styles.labelOptional, onboardingTheme.labelOptional]}>Vaccinated?</Text>
                      <View style={styles.vaccineButtonRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.vaccineButton,
                            styles.vaccineButtonHalf,
                            isYesSelected
                              ? {
                                  backgroundColor: theme.colors.primary.light,
                                  borderColor: theme.colors.primary.light,
                                }
                              : onboardingTheme.vaccineUnselected,
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => updatePetField(index, 'vaccinated', 'Yes')}
                          disabled={loading}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isYesSelected }}
                          accessibilityLabel="Vaccinated: Yes"
                        >
                          <Text
                            style={[
                              styles.vaccineButtonText,
                              onboardingTheme.vaccineButtonText,
                              isYesSelected && styles.vaccineButtonTextOnSolid,
                            ]}
                          >
                            Yes
                          </Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.vaccineButton,
                            styles.vaccineButtonHalf,
                            isNoSelected
                              ? {
                                  backgroundColor: theme.colors.error.light,
                                  borderColor: theme.colors.error.light,
                                }
                              : onboardingTheme.vaccineUnselected,
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => updatePetField(index, 'vaccinated', 'No')}
                          disabled={loading}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isNoSelected }}
                          accessibilityLabel="Vaccinated: No"
                        >
                          <Text
                            style={[
                              styles.vaccineButtonText,
                              onboardingTheme.vaccineButtonText,
                              isNoSelected && styles.vaccineButtonTextOnSolid,
                            ]}
                          >
                            No
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  </View>

                  <View style={[styles.secondaryBottomActions, onboardingTheme.secondaryBottomActionsBorder]}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryBottomBtn,
                        onboardingTheme.secondaryBottomBtn,
                        pressed && styles.chipPressed,
                      ]}
                      onPress={handleCancelSecondaryPet}
                      disabled={loading}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel and remove this pet"
                    >
                      <Text style={[styles.secondaryBottomBtnTextCancel, onboardingTheme.secondaryBottomBtnTextCancel]}>
                        Cancel
                      </Text>
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
                    <Text style={[styles.petFormIndex, onboardingTheme.petFormIndex]}>{`Pet ${petNumber}`}</Text>
                  ) : null}

                  {renderPetPhotoSection(index, pet)}

                  <View style={styles.petDetailsSection}>
                  <View style={styles.requiredLabelRow}>
                    <Text style={[styles.requiredFieldLabel, onboardingTheme.requiredFieldLabel]}>Pet name</Text>
                    <RequiredBadge />
                  </View>
                  <TextInput
                    ref={nameInputRef}
                    style={[styles.input, onboardingTheme.input, styles.inputPetName, petErrors.name && styles.inputError]}
                    placeholder="Their name"
                    placeholderTextColor={onboardingTheme.placeholder}
                    value={pet.name}
                    onChangeText={(value) => updatePetField(index, 'name', value)}
                    editable={!loading}
                    accessibilityLabel="Pet name"
                  />
                  {petErrors.name ? (
                    <Text style={styles.inlineError} accessibilityLiveRegion="polite">
                      {petErrors.name}
                    </Text>
                  ) : null}

                  <View style={styles.petTypePromptWrap}>
                    <Text style={[styles.petTypePrompt, onboardingTheme.petTypePrompt]} numberOfLines={2}>
                      {getPetTypePromptLine(pet, index)}
                    </Text>
                    <RequiredBadge />
                  </View>

                  <View
                    style={[styles.petTypeChipRow, petErrors.pet_type && styles.selectionError]}
                    accessibilityRole="radiogroup"
                  >
                    {PET_TYPE_CHIPS.map(({ key, label }) => {
                      const selected = pet.pet_type === key;
                      return (
                        <Pressable
                          key={key}
                          style={({ pressed }) => [
                            styles.petTypeChip,
                            selected
                              ? styles.petTypeChipSelected
                              : [styles.petTypeChipIdle, onboardingTheme.petTypeChipIdle],
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => selectPetType(index, key)}
                          disabled={loading}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={label}
                        >
                          <Text
                            style={[
                              styles.petTypeChipText,
                              onboardingTheme.petTypeChipText,
                              selected && styles.petTypeChipTextSelected,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {petErrors.pet_type ? (
                    <Text style={styles.inlineError} accessibilityLiveRegion="polite">
                      {petErrors.pet_type}
                    </Text>
                  ) : null}

                  {pet.pet_type === 'other' ? (
                    <>
                      <View style={styles.requiredLabelRow}>
                        <Text style={[styles.requiredFieldLabel, onboardingTheme.requiredFieldLabel]}>Type</Text>
                        <RequiredBadge />
                      </View>
                      <TextInput
                        style={[
                          styles.input,
                          onboardingTheme.input,
                          styles.inputOptional,
                          onboardingTheme.inputOptional,
                          styles.petOtherInput,
                          petErrors.pet_type_custom && styles.inputError,
                        ]}
                        placeholder="Tell us what they are..."
                        placeholderTextColor={onboardingTheme.placeholder}
                        value={pet.pet_type_custom}
                        onChangeText={(value) => updatePetField(index, 'pet_type_custom', value)}
                        editable={!loading}
                        accessibilityLabel="Describe your pet"
                      />
                      {petErrors.pet_type_custom ? (
                        <Text style={styles.inlineError} accessibilityLiveRegion="polite">
                          {petErrors.pet_type_custom}
                        </Text>
                      ) : null}
                    </>
                  ) : null}

                  <View style={[styles.optionalFields, onboardingTheme.optionalFieldsBorder]}>
                    {!isManageCrudMode ? (
                      <>
                        <View style={styles.requiredLabelRow}>
                          <Text style={[styles.requiredFieldLabel, onboardingTheme.requiredFieldLabel]}>Breed</Text>
                          <RequiredBadge />
                        </View>
                        <TextInput
                          style={[
                            styles.input,
                            onboardingTheme.input,
                            styles.inputOptional,
                            onboardingTheme.inputOptional,
                            petErrors.breed && styles.inputError,
                          ]}
                          placeholder="Golden Retriever"
                          placeholderTextColor={onboardingTheme.placeholder}
                          value={pet.breed}
                          onChangeText={(value) => updatePetField(index, 'breed', value)}
                          editable={!loading}
                          accessibilityLabel="Breed"
                        />
                        {petErrors.breed ? (
                          <Text style={styles.inlineError} accessibilityLiveRegion="polite">
                            {petErrors.breed}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Text style={[styles.labelOptional, onboardingTheme.labelOptional]}>Breed</Text>
                        <TextInput
                          style={[
                            styles.input,
                            onboardingTheme.input,
                            styles.inputOptional,
                            onboardingTheme.inputOptional,
                          ]}
                          placeholder="Golden Retriever"
                          placeholderTextColor={onboardingTheme.placeholder}
                          value={pet.breed}
                          onChangeText={(value) => updatePetField(index, 'breed', value)}
                          editable={!loading}
                        />
                      </>
                    )}

                    <Text style={[styles.labelOptional, onboardingTheme.labelOptional]}>Age</Text>
                    <TextInput
                      style={[
                        styles.input,
                        onboardingTheme.input,
                        styles.inputOptional,
                        onboardingTheme.inputOptional,
                      ]}
                      placeholder="Years (e.g., 2.5)"
                      placeholderTextColor={onboardingTheme.placeholder}
                      value={pet.age}
                      onChangeText={(value) => updatePetField(index, 'age', sanitizeAgeInput(value))}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                      editable={!loading}
                    />

                    {renderOptionRow('Gender', pet.gender, GENDER_OPTIONS, (value) => updatePetField(index, 'gender', value), true)}

                    <View>
                      <Text style={[styles.labelOptional, onboardingTheme.labelOptional]}>Vaccinated?</Text>
                      <View style={styles.vaccineButtonRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.vaccineButton,
                            styles.vaccineButtonHalf,
                            isYesSelected
                              ? {
                                  backgroundColor: theme.colors.primary.light,
                                  borderColor: theme.colors.primary.light,
                                }
                              : onboardingTheme.vaccineUnselected,
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => updatePetField(index, 'vaccinated', 'Yes')}
                          disabled={loading}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isYesSelected }}
                          accessibilityLabel="Vaccinated: Yes"
                        >
                          <Text
                            style={[
                              styles.vaccineButtonText,
                              onboardingTheme.vaccineButtonText,
                              isYesSelected && styles.vaccineButtonTextOnSolid,
                            ]}
                          >
                            Yes
                          </Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.vaccineButton,
                            styles.vaccineButtonHalf,
                            isNoSelected
                              ? {
                                  backgroundColor: theme.colors.error.light,
                                  borderColor: theme.colors.error.light,
                                }
                              : onboardingTheme.vaccineUnselected,
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => updatePetField(index, 'vaccinated', 'No')}
                          disabled={loading}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isNoSelected }}
                          accessibilityLabel="Vaccinated: No"
                        >
                          <Text
                            style={[
                              styles.vaccineButtonText,
                              onboardingTheme.vaccineButtonText,
                              isNoSelected && styles.vaccineButtonTextOnSolid,
                            ]}
                          >
                            No
                          </Text>
                        </Pressable>
                      </View>
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
            <Text style={[styles.addPetSubtitle, onboardingTheme.addPetSubtitle]}>Got another furry friend?</Text>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                onboardingTheme.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleAddAnotherPet}
              disabled={loading}
            >
              <Text style={[styles.secondaryButtonText, onboardingTheme.secondaryButtonText]}>
                + Add Another Pet
              </Text>
            </Pressable>
          </>
        ) : null}

        {!isManageCrudMode ? <LegalConsentRow /> : null}

        {renderPrimaryAction()}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PhotoPickerModal
        visible={photoModalVisible}
        photoModalPetIndex={photoModalPetIndex}
        onClose={() => {
          setPhotoModalVisible(false);
          setPhotoModalPetIndex(null);
        }}
        onSelectSource={handlePhotoSourceSelected}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.light,
  },
  flex: {
    flex: 1,
  },
  prefillLoadingWrap: {
    paddingTop: theme.spacing.lg,
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.feed.shellPaddingHorizontal,
  },
  scrollInner: {
    width: '100%',
  },
  photoSectionLead: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: theme.spacing.lg,
  },
  photoNameDivider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: theme.colors.border.light,
  },
  petDetailsSection: {
    gap: theme.spacing.sm,
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
    marginBottom: theme.spacing.md,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  petTypePrompt: {
    flexShrink: 1,
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
  selectionError: {
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
    marginBottom: theme.spacing.md,
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
  requiredLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  requiredFieldLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
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
  inputError: {
    borderColor: theme.colors.feedback.error.value,
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
    marginTop: theme.spacing.md,
  },
  secondaryButton: {
    borderRadius: theme.components.button.borderRadius,
    minHeight: theme.components.button.minHeight,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
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
