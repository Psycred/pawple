import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { theme } from '../config/theme';
import { supabase } from '../config/supabase';
import { pickFromGallery } from '../lib/photoPicker';
import { uploadToSupabase } from '../lib/supabase';
import { useActivePet } from '../contexts/ActivePetContext';
import { useAuth } from '../contexts/AuthContext';
import { processImageForPawple } from '../services/imageProcessor';
import { getValidLocation } from '../lib/locationManager';
import { buildPetAttribution, createMoment, formatMomentDate, linkMomentToPets } from '../services/moments';

const f = theme.createMomentFoundation;
const windowWidth = Dimensions.get('window').width;
const emptyCardWidth = windowWidth - 40;

/** Compositional rhythm (8pt grid) */
const TITLE_MARGIN_TOP = 20;
const TITLE_MARGIN_BOTTOM = 28;
const CARD_TO_CAMERA = 24;
const CAMERA_TO_GALLERY = 14;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const calmLayout = () => {
  LayoutAnimation.configureNext({
    duration: 200,
    update: { type: LayoutAnimation.Types.easeOutEase },
    create: {
      type: LayoutAnimation.Types.easeOutEase,
      property: LayoutAnimation.Properties.opacity,
    },
    delete: {
      type: LayoutAnimation.Types.easeOutEase,
      property: LayoutAnimation.Properties.opacity,
    },
  });
};

/**
 * Expo SDK 52 (expo-image-picker ~16): MediaType is 'images' | 'videos' | 'livePhotos'.
 */
const MOMENT_PICKER_OPTIONS = {
  allowsEditing: true,
  aspect: [4, 5],
  quality: 0.85,
  mediaTypes: ['images'],
};

const formatDate = (date) =>
  date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Earliest selectable memory year (any past year; only the future is capped at today). */
const EARLIEST_MOMENT_YEAR = 1900;

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

/** Start of today (local) — latest selectable memory date. */
const startOfToday = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

/** Memory date cannot be after today (user may pick today or any past date). */
const clampDateToTodayOrPast = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const max = startOfToday();
  return d.getTime() > max.getTime() ? max : d;
};

/**
 * Frame a Moment — keepsake shell + native crop + editorial annotation.
 */
export default function CreateMomentScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { activePetId, loading: activePetLoading } = useActivePet();
  const [imageUri, setImageUri] = useState(null);
  const [isFraming, setIsFraming] = useState(false);
  const [isImageSelected, setIsImageSelected] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => startOfToday());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showLocationEdit, setShowLocationEdit] = useState(false);
  const [showChangeSheet, setShowChangeSheet] = useState(false);
  const [selectedPets, setSelectedPets] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const sectionOpacity = useRef(new Animated.Value(0)).current;
  const sectionTranslateY = useRef(new Animated.Value(16)).current;
  const locationInputRef = useRef(null);

  const day = selectedDate.getDate();
  const month = selectedDate.getMonth();
  const year = selectedDate.getFullYear();

  const today = startOfToday();
  const maxYear = today.getFullYear();
  const maxMonth = today.getMonth();
  const maxDay = today.getDate();

  const availableYears = useMemo(
    () => Array.from({ length: maxYear - EARLIEST_MOMENT_YEAR + 1 }, (_, i) => EARLIEST_MOMENT_YEAR + i),
    [maxYear],
  );

  const availableMonthIndices = useMemo(() => {
    const limit = year === maxYear ? maxMonth + 1 : 12;
    return Array.from({ length: limit }, (_, i) => i);
  }, [year, maxYear, maxMonth]);

  const availableDays = useMemo(() => {
    const daysInMo = daysInMonth(year, month);
    const limit = year === maxYear && month === maxMonth ? Math.min(maxDay, daysInMo) : daysInMo;
    return Array.from({ length: limit }, (_, i) => i + 1);
  }, [year, month, maxYear, maxMonth, maxDay]);

  // Phase 1: the active pet is the default (and only) selected pet. Schema supports up to 2.
  useEffect(() => {
    let cancelled = false;
    const loadActivePet = async () => {
      if (!activePetId) {
        if (!cancelled) setSelectedPets([]);
        return;
      }
      const { data } = await supabase
        .from('pets')
        .select('id, name')
        .eq('id', activePetId)
        .single();
      if (!cancelled && data) {
        setSelectedPets([{ id: String(data.id), name: data.name }]);
      }
    };
    loadActivePet();
    return () => {
      cancelled = true;
    };
  }, [activePetId]);

  const petNames = selectedPets.map((p) => p.name).filter(Boolean);
  const attributionLabel = petNames.length ? buildPetAttribution(petNames) : null;
  const hasActivePet = Boolean(activePetId);

  const onDismiss = () => {
    navigation.goBack();
  };

  const handlePickImage = async (source) => {
    try {
      if (source !== 'camera') {
        const result = await pickFromGallery(MOMENT_PICKER_OPTIONS);
        const asset = result?.assets?.[0];
        if (asset?.uri) {
          setImageUri(asset.uri);
          setIsFraming(true);
          setIsImageSelected(true);
        }
        return;
      }

      const current = await ImagePicker.getCameraPermissionsAsync();

      const openPicker = async () => {
        const result = await ImagePicker.launchCameraAsync(MOMENT_PICKER_OPTIONS);

        if (result.canceled) {
          return;
        }

        const asset = result.assets?.[0];
        if (asset?.uri) {
          setImageUri(asset.uri);
          setIsFraming(true);
          setIsImageSelected(true);
        }
      };

      if (current.granted) {
        await openPicker();
        return;
      }

      const status = current.status;

      if (status === 'undetermined') {
        const requested = await ImagePicker.requestCameraPermissionsAsync();
        if (requested.granted) {
          await openPicker();
          return;
        }
        Alert.alert('Camera', 'Permission needed to access camera.');
        return;
      }

      if (status === 'denied') {
        Alert.alert('Camera', 'Please enable camera access in Settings to use this feature.');
      }
    } catch (e) {
      console.log('[CreateMoment] pick image', e);
      Alert.alert('Photo', 'Something went wrong. Please try again.');
    }
  };

  const handleLooksGood = () => {
    if (isRevealed) {
      return;
    }

    // Must have a successfully selected/cropped image before annotating.
    if (!imageUri || !isImageSelected) {
      Toast.show({ type: 'error', text1: 'Add a photo first', position: 'bottom', visibilityTime: 1500 });
      return;
    }

    setIsRevealed(true);

    Animated.parallel([
      Animated.timing(cardTranslateY, {
        toValue: -14,
        duration: 260,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(sectionOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(sectionTranslateY, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
    ]).start();
  };

  const showToast = (text1, type = 'error') =>
    Toast.show({ type, text1, position: 'bottom', visibilityTime: 1500 });

  // [FLOW] Step 1-8 implementation
  const handleSaveMoment = async () => {
    // [FLOW] Step 2 — prevent double-taps completely.
    if (isSaving) {
      return;
    }

    const trimmedCaption = caption.trim();
    const trimmedLocation = location?.trim() || null;
    const selectedPetIds = selectedPets.map((p) => p.id).filter(Boolean).slice(0, 2);

    // [VALIDATION] Quiet guards — small bottom toast, no alerts/modals/UI blocking.
    if (!imageUri) {
      return showToast('Add a photo first');
    }
    if (!trimmedCaption) {
      return showToast('Add a moment');
    }
    if (selectedPetIds.length === 0) {
      return showToast('Select a pet');
    }
    if (!user?.id) {
      return showToast("Couldn't save moment. Try again.");
    }

    const memoryDate = clampDateToTodayOrPast(selectedDate);
    const pickedMs = new Date(selectedDate).setHours(0, 0, 0, 0);
    const maxMs = startOfToday().getTime();
    if (pickedMs > maxMs) {
      return showToast('Choose today or an earlier date');
    }

    // [FLOW] Step 2 — saving state.
    setIsSaving(true);
    console.log('[Moment] Save started');

    try {
      console.log('[Moment] User loaded', { userId: user.id });
      // Store calendar date as YYYY-MM-DD (local), not UTC from toISOString() (avoids day shift).
      const momentDate = `${memoryDate.getFullYear()}-${String(memoryDate.getMonth() + 1).padStart(2, '0')}-${String(memoryDate.getDate()).padStart(2, '0')}`;

      // [FLOW] Step 3 — [PROCESSING] silent resize + compress + encode (no spinner).
      const processed = await processImageForPawple(imageUri);

      // [FLOW] Step 4 — upload once, get public URL.
      console.log('[Moment] Upload starting', {
        extension: processed.extension,
        contentType: processed.contentType,
        base64Length: processed.base64?.length,
      });
      const publicUrl = await uploadToSupabase(processed, user.id);
      console.log('[Moment] Upload success', { publicUrl });

      // [FLOW] Step 5 — create the single moment record (pet_ids stored as attribution fallback).
      const locationResult = await getValidLocation({
        reason: 'to attach your moment to a place',
        requestIfNeeded: true,
        preferCache: true,
      });
      const userLocation = locationResult.coords;
      console.log('[Moment] Moment insert starting', {
        locationStatus: locationResult.status,
        hasCoords: userLocation?.latitude != null && userLocation?.longitude != null,
      });
      const moment = await createMoment({
        userId: user.id,
        imageUrl: publicUrl,
        caption: trimmedCaption,
        momentDate,
        location: trimmedLocation,
        petIds: selectedPetIds,
        petNames: selectedPets.map((p) => p.name).filter(Boolean),
        location_lat: userLocation?.latitude,
        location_lng: userLocation?.longitude,
      });
      console.log('[Moment] Moment insert success', { momentId: moment.id });

      // [FLOW] Step 6 — link selected pets (one upload, multiple journals).
      // Non-fatal: a missing moment_pets table must not lose a saved memory — pet_ids on the
      // moment already drives feed attribution; the join powers pet-profile journals.
      console.log('[Moment] Pet link starting', { momentId: moment.id, petIds: selectedPetIds });
      try {
        await linkMomentToPets(moment.id, selectedPetIds);
        console.log('[Moment] Pet link success');
      } catch (linkErr) {
        console.error('[Moment] Pet link failed (non-fatal)', linkErr?.message, linkErr?.code);
      }

      // [FLOW] Step 7 — optimistic feed row (MomentCard shape), newest first.
      const optimisticMoment = {
        id: moment.id,
        photo_url: publicUrl,
        caption: trimmedCaption,
        location: trimmedLocation || '',
        moment_date: momentDate,
        memory_date: formatMomentDate(momentDate),
        created_at: moment.created_at ?? new Date().toISOString(),
        pet_names: selectedPets.map((p) => p.name).join(', '),
        user_id: user.id,
        pet_ids: selectedPetIds.map(String),
      };

      // [FLOW] Step 8 — subtle success + auto-return to Feed with the new card at top.
      navigation.navigate('MainTabs', {
        screen: 'FeedScreen',
        params: { refreshFeed: Date.now(), newMoment: optimisticMoment },
      });
      console.log('[Moment] Save complete');
      showToast('Moment saved', 'success');
    } catch (error) {
      console.error('[Moment] Save failed', error);
      console.error('[Moment] error.message:', error?.message);
      console.error('[Moment] error.code:', error?.code);
      console.error('[Moment] full error:', JSON.stringify(error, Object.getOwnPropertyNames(error ?? {})));
      showToast("Couldn't save moment. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const openLocationEdit = () => {
    calmLayout();
    setShowLocationEdit(true);
    requestAnimationFrame(() => locationInputRef.current?.focus());
  };

  const closeLocationEdit = () => {
    calmLayout();
    setShowLocationEdit(false);
  };

  /** Open wheels once; stay visible while user changes day/month/year until save or leave. */
  const openDatePicker = () => {
    if (!showDatePicker) {
      calmLayout();
      setShowDatePicker(true);
    }
  };

  const updateDate = (nextDate) => {
    setSelectedDate(clampDateToTodayOrPast(nextDate));
  };

  const frameOpacity = isImageSelected ? 0.5 : 0.4;
  const cardScale = isImageSelected ? 1 : 0.94;
  const cardMarginBottom = !isFraming ? CARD_TO_CAMERA : isRevealed ? 0 : CARD_TO_CAMERA;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            style={({ pressed }) => [styles.dismissWrap, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <View style={styles.dismissInner}>
              <Feather name="x" size={22} color="#3A312E" />
            </View>
          </Pressable>

          <Text style={styles.title} allowFontScaling>
            Frame a Moment
          </Text>

          {!activePetLoading && !hasActivePet ? (
            <Text style={styles.noPetLine} allowFontScaling>
              Add a pet to frame a moment.
            </Text>
          ) : null}

          <View style={styles.main}>
            <Animated.View
              style={[
                styles.cardAnimatedWrap,
                { transform: [{ translateY: cardTranslateY }] },
              ]}
            >
              <View
                style={[
                  styles.emptyCard,
                  {
                    width: emptyCardWidth,
                    transform: [{ scale: cardScale }],
                    marginBottom: cardMarginBottom,
                  },
                ]}
              >
                <View style={styles.paperWarmth} pointerEvents="none" />

                {isFraming && imageUri ? (
                  <View style={styles.photoLayer} pointerEvents="box-none">
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.photo}
                      resizeMode="cover"
                      pointerEvents="none"
                      accessibilityIgnoresInvertColors
                    />
                    <Pressable
                      onPress={() => setShowChangeSheet(true)}
                      style={({ pressed }) => [
                        styles.changePhoto,
                        pressed && styles.changePhotoPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Change photo"
                      hitSlop={8}
                    >
                      <Text style={styles.changePhotoText} allowFontScaling>
                        Change
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <View style={[styles.frameInkWrap, { opacity: frameOpacity }]} pointerEvents="none">
                  <View style={styles.frameInkPrimary} />
                  <View style={styles.frameInkPressure} />
                </View>
              </View>
            </Animated.View>

            {!isFraming ? (
              <>
                <Pressable
                  onPress={() => handlePickImage('camera')}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Camera"
                >
                  <Text style={styles.primaryLabel} allowFontScaling>
                    Camera
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handlePickImage('gallery')}
                  style={({ pressed }) => [styles.secondaryWrap, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Gallery"
                >
                  <Text style={styles.secondaryLabel} allowFontScaling>
                    Gallery
                  </Text>
                </Pressable>
              </>
            ) : null}

            {isFraming && imageUri && isImageSelected && !isRevealed ? (
              <Pressable
                onPress={handleLooksGood}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Looks good"
              >
                <Text style={styles.primaryLabel} allowFontScaling>
                  Looks good
                </Text>
              </Pressable>
            ) : null}

            {isRevealed ? (
              <Animated.View
                style={[
                  styles.editorialSection,
                  { width: emptyCardWidth },
                  {
                    opacity: sectionOpacity,
                    transform: [{ translateY: sectionTranslateY }],
                  },
                ]}
              >
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Morning walk 🐾"
                  placeholderTextColor="#B7B0A5"
                  style={styles.captionInput}
                  multiline
                  textAlignVertical="top"
                  accessibilityLabel="Caption"
                />

                {attributionLabel ? (
                  <Text style={styles.petAttribution} allowFontScaling>
                    {attributionLabel}
                  </Text>
                ) : null}

                <View style={styles.metadataContainer}>
                  <TouchableOpacity
                    onPress={openDatePicker}
                    activeOpacity={0.5}
                    style={styles.metadataTouchable}
                    accessibilityRole="button"
                    accessibilityLabel="Date"
                  >
                    <Text style={styles.metadataDate} allowFontScaling>
                      {formatDate(selectedDate)}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker ? (
                    <View style={styles.dateWheelRow}>
                      <Picker
                        selectedValue={Math.min(day, availableDays[availableDays.length - 1] ?? day)}
                        onValueChange={(val) => {
                          const maxD = daysInMonth(year, month);
                          updateDate(new Date(year, month, Math.min(val, maxD)));
                        }}
                        style={styles.dateWheelPicker}
                        itemStyle={styles.dateWheelItem}
                      >
                        {availableDays.map((d) => (
                          <Picker.Item key={d} label={String(d)} value={d} />
                        ))}
                      </Picker>
                      <Picker
                        selectedValue={Math.min(month, availableMonthIndices[availableMonthIndices.length - 1] ?? month)}
                        onValueChange={(val) => {
                          const maxD = daysInMonth(year, val);
                          updateDate(new Date(year, val, Math.min(day, maxD)));
                        }}
                        style={styles.dateWheelPicker}
                        itemStyle={styles.dateWheelItem}
                      >
                        {availableMonthIndices.map((i) => (
                          <Picker.Item key={MONTHS[i]} label={MONTHS[i]} value={i} />
                        ))}
                      </Picker>
                      <Picker
                        selectedValue={year}
                        onValueChange={(val) => {
                          const maxD = daysInMonth(val, month);
                          updateDate(new Date(val, month, Math.min(day, maxD)));
                        }}
                        style={styles.dateWheelPicker}
                        itemStyle={styles.dateWheelItem}
                      >
                        {availableYears.map((y) => (
                          <Picker.Item key={y} label={String(y)} value={y} />
                        ))}
                      </Picker>
                    </View>
                  ) : null}

                  {!showLocationEdit ? (
                    <TouchableOpacity
                      onPress={openLocationEdit}
                      activeOpacity={0.5}
                      style={styles.metadataTouchable}
                      accessibilityRole="button"
                      accessibilityLabel="Location"
                    >
                      <Text
                        style={[
                          styles.metadataLocation,
                          !location.trim() && styles.metadataLocationPlaceholder,
                        ]}
                        allowFontScaling
                      >
                        {location.trim() || 'Add location'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TextInput
                      ref={locationInputRef}
                      value={location}
                      onChangeText={setLocation}
                      onBlur={closeLocationEdit}
                      placeholder="Add location"
                      placeholderTextColor="#B7B0A5"
                      style={styles.locationInlineInput}
                      accessibilityLabel="Location"
                    />
                  )}
                </View>

                <Pressable
                  onPress={handleSaveMoment}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.saveButton,
                    isSaving && styles.saveButtonSaving,
                    pressed && !isSaving && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSaving }}
                  accessibilityLabel="Save moment"
                >
                  <Text style={styles.primaryLabel} allowFontScaling>
                    {isSaving ? 'Saving…' : 'Save moment'}
                  </Text>
                </Pressable>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Pawple "Change" choice sheet — preserves the existing photo until a new one is confirmed. */}
      <Modal
        visible={showChangeSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChangeSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setShowChangeSheet(false)}
        >
          <View style={styles.sheetCard}>
            <TouchableOpacity
              onPress={() => {
                setShowChangeSheet(false);
                handlePickImage('camera');
              }}
            >
              <Text style={styles.sheetOption} allowFontScaling>
                Take another photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowChangeSheet(false);
                handlePickImage('gallery');
              }}
            >
              <Text style={styles.sheetOption} allowFontScaling>
                Choose from gallery
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowChangeSheet(false)} style={styles.sheetCancelWrap}>
              <Text style={styles.sheetCancel} allowFontScaling>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: f.screenBackground,
  },
  scrollContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: f.paddingHorizontal,
    paddingBottom: f.paddingBottom,
  },
  dismissWrap: {
    width: f.spacerWidth,
    alignItems: 'flex-start',
  },
  dismissInner: {
    padding: f.dismissHitPadding,
  },
  title: {
    marginTop: TITLE_MARGIN_TOP,
    marginBottom: TITLE_MARGIN_BOTTOM,
    fontFamily: 'Inter-Medium',
    fontSize: 17,
    color: '#3A312E',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  noPetLine: {
    marginBottom: 20,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#9A9A9A',
    textAlign: 'center',
  },
  main: {
    flexGrow: 1,
    alignItems: 'center',
  },
  cardAnimatedWrap: {
    alignSelf: 'center',
  },
  emptyCard: {
    aspectRatio: 4 / 5,
    backgroundColor: '#FBFAF7',
    borderRadius: 14,
    alignSelf: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  paperWarmth: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E8DCC4',
    opacity: 0.06,
    borderRadius: 14,
  },
  photoLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  changePhoto: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    zIndex: 3,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  changePhotoPressed: {
    opacity: theme.opacity.pressedUi,
  },
  changePhotoText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: '#B7B0A5',
    opacity: 0.7,
  },
  frameInkWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  frameInkPrimary: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 1.2,
    borderColor: 'rgba(138, 107, 91, 0.38)',
    borderRadius: 14,
    borderTopLeftRadius: 14.2,
    borderTopRightRadius: 13.8,
    borderBottomLeftRadius: 14.1,
    borderBottomRightRadius: 13.9,
  },
  frameInkPressure: {
    position: 'absolute',
    left: 0.5,
    right: 0.5,
    top: 0.5,
    bottom: 0.5,
    borderWidth: 1,
    borderColor: 'rgba(138, 107, 91, 0.22)',
    borderRadius: 14.5,
    borderTopLeftRadius: 13.7,
    borderTopRightRadius: 14.3,
    borderBottomLeftRadius: 14.2,
    borderBottomRightRadius: 13.6,
  },
  primaryButton: {
    alignSelf: 'center',
    width: '86%',
    height: 44,
    borderRadius: 22,
    backgroundColor: '#A3B3A0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    marginTop: 24,
  },
  saveButtonSaving: {
    opacity: 0.7,
  },
  primaryLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#FFF',
  },
  secondaryWrap: {
    marginTop: CAMERA_TO_GALLERY,
    alignSelf: 'center',
  },
  secondaryLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#9A9A9A',
  },
  editorialSection: {
    alignSelf: 'center',
  },
  captionInput: {
    fontFamily: 'Kalam',
    fontSize: 18,
    color: '#2F2F2F',
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginTop: 8,
    width: '100%',
  },
  petAttribution: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: '#4A4A4A',
    marginTop: 6,
  },
  metadataContainer: {
    marginTop: 6,
    width: '100%',
  },
  metadataTouchable: {
    alignSelf: 'flex-start',
  },
  metadataDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#9A9A9A',
    letterSpacing: -0.1,
  },
  metadataLocation: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#9A9A9A',
    letterSpacing: -0.1,
    marginTop: 2,
  },
  metadataLocationPlaceholder: {
    color: '#B7B0A5',
  },
  dateWheelRow: {
    flexDirection: 'row',
    height: 90,
    marginTop: 6,
    backgroundColor: '#FBFAF7',
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  dateWheelPicker: {
    flex: 1,
  },
  dateWheelItem: {
    fontSize: 16,
    color: '#2F2F2F',
  },
  locationInlineInput: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#2F2F2F',
    backgroundColor: 'transparent',
    borderWidth: 0,
    height: 36,
    marginTop: 4,
    paddingVertical: 0,
    paddingHorizontal: 0,
    width: '100%',
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sheetCard: {
    marginTop: 'auto',
    backgroundColor: '#FBFAF7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  sheetOption: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#2F2F2F',
    paddingVertical: 14,
    textAlign: 'center',
  },
  sheetCancelWrap: {
    marginTop: 8,
  },
  sheetCancel: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: '#9A9A9A',
    paddingVertical: 14,
    textAlign: 'center',
  },
});
