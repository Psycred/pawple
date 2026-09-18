import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { CommonActions, StackActions } from '@react-navigation/native';
import { theme } from '../config/theme';
import { supabase } from '../config/supabase';
import RequiredBadge from '../components/RequiredBadge';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../contexts/AuthContext';
import { useActivePet } from '../contexts/ActivePetContext';
import { formatDayMonthYear, formatLocalTime } from '../utils/formatMomentDate';
import { validateOptionalGoogleMapsLink } from '../utils/mapLinkValidation';
import { createMeetup, extractMeetupHostPetIds, updateMeetup } from '../services/meetups';
import { petTypeEmoji } from '../utils/petTypeEmoji';
import { useFieldShake } from '../hooks/useFieldShake';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { captureLocationOnUserConsent } from '../lib/locationManager';
import { resolveCityFromCoords } from '../lib/cityFromLocation';
import { cacheViewerFeedLocation } from '../lib/viewerFeedLocation';
import { normalizeCityForSave } from '../utils/cityUtils';

const OPEN_TO_OPTIONS = [
  { label: 'Open to all', value: 'Open to All' },
  { label: 'Dogs', value: 'Dogs Meetup' },
  { label: 'Cats', value: 'Cats Meetup' },
];

const DURATION_HOURS = [1, 2, 3];

function FieldLabel({ children, required = false, style, labelColor }) {
  return (
    <View style={[styles.labelRow, style]}>
      <Text style={[styles.label, { color: labelColor }]} allowFontScaling>
        {children}
      </Text>
      {required ? <RequiredBadge /> : null}
    </View>
  );
}

function buildMeetupValidation({
  title,
  venueName,
  meetupCity,
  participationLimit,
  meetupDate,
  startTime,
  endTime,
  selectedHostPets,
  mapLinkResult,
}) {
  const fieldErrors = {};
  const shakeFields = [];
  const messages = [];

  if (!title.trim()) {
    const message = 'Please add a meetup name';
    fieldErrors.title = message;
    shakeFields.push('title');
    messages.push(message);
  }

  if (!normalizeCityForSave(meetupCity)) {
    const message = 'Please add the meetup city';
    fieldErrors.city = message;
    shakeFields.push('city');
    messages.push(message);
  }

  const trimmedVenue = venueName.trim();
  if (!trimmedVenue) {
    const message = 'Please add a venue';
    fieldErrors.venue = message;
    shakeFields.push('venue');
    messages.push(message);
  } else if (
    meetupCity &&
    trimmedVenue.toLowerCase() === String(meetupCity).trim().toLowerCase()
  ) {
    const message = 'Add a real venue — not just your city';
    fieldErrors.venue = message;
    shakeFields.push('venue');
    messages.push(message);
  }

  const trimmedLimit = String(participationLimit ?? '').trim();
  const parsedLimit = Number(trimmedLimit);
  if (!trimmedLimit) {
    const message = 'Please add a participation limit';
    fieldErrors.participation = message;
    shakeFields.push('participation');
    messages.push(message);
  } else if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    const message = 'Use a positive whole number';
    fieldErrors.participation = message;
    shakeFields.push('participation');
    messages.push(message);
  }

  if (!meetupDate || Number.isNaN(meetupDate?.getTime?.())) {
    const message = 'Please select a date';
    fieldErrors.date = message;
    shakeFields.push('date');
    messages.push(message);
  }

  if (!startTime || !endTime || endTime <= startTime) {
    const message = 'Please set start and end times';
    fieldErrors.time = message;
    shakeFields.push('time');
    messages.push(message);
  }

  if (!selectedHostPets.length) {
    const message = 'Please select at least one host pet';
    fieldErrors.pets = message;
    shakeFields.push('pets');
    messages.push(message);
  }

  if (!mapLinkResult.isEmpty && !mapLinkResult.isValid) {
    const message = mapLinkResult.message || 'Please use a Google or Apple Maps link';
    fieldErrors.directions = message;
    shakeFields.push('directions');
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    shakeFields,
    firstMessage: messages[0] ?? null,
  };
}

function addHours(date, h) {
  const d = new Date(date.getTime());
  d.setHours(d.getHours() + h);
  return d;
}

function toTimeString(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultStart() {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  return d;
}

function defaultEnd(start) {
  return addHours(start, 2);
}

function parseTimeString(timeStr, baseDate) {
  const datePart = toISODate(baseDate);
  const timePart = String(timeStr ?? '10:00:00').slice(0, 8);
  const parsed = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(parsed.getTime()) ? defaultStart() : parsed;
}

function deriveDurationMode(start, end) {
  const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  for (const hours of DURATION_HOURS) {
    if (Math.abs(diffHours - hours) < 0.05) {
      return hours;
    }
  }
  return 'custom';
}

/**
 * Lightweight meetup planner — no images, no social noise.
 */
export default function CreateMeetupScreen({ navigation, route }) {
  const isEditing = route?.params?.isEditing === true;
  const editMeetupId = route?.params?.meetupId ?? route?.params?.meetup?.id ?? null;
  const seedMeetup = route?.params?.meetup ?? null;
  const { user } = useAuth();
  const { activePetId } = useActivePet();

  const [pets, setPets] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetupCity, setMeetupCity] = useState('');
  const [venueName, setVenueName] = useState('');
  const [selectedOpenTo, setSelectedOpenTo] = useState('Open to All');
  const [participationLimit, setParticipationLimit] = useState('');
  const [directionsUrl, setDirectionsUrl] = useState('');
  const [meetupDate, setMeetupDate] = useState(() => {
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    return t;
  });
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(() => defaultEnd(defaultStart()));
  /** 1 | 2 | 3 hours preset, or `'custom'` when end time edited manually */
  const [durationMode, setDurationMode] = useState(2);
  const [selectedHostPets, setSelectedHostPets] = useState(() =>
    activePetId ? [String(activePetId)] : [],
  );

  const [showDate, setShowDate] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [saving, setSaving] = useState(false);
  const cityEditedRef = useRef(false);

  const { anims: shakeAnims, shakeField } = useFieldShake();
  const surfaces = useRuntimeThemeColors();
  const chipSelectedBg = surfaces.isDark
    ? surfaces.meetupChipBackground
    : theme.colors.brand.sageLight.light;
  const inputSurfaceStyle = {
    color: surfaces.textPrimary,
    backgroundColor: surfaces.backgroundCard,
  };

  const mapLinkResult = useMemo(
    () => validateOptionalGoogleMapsLink(directionsUrl),
    [directionsUrl],
  );

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const shouldShowError = (field) =>
    Boolean(fieldErrors[field] && (submitAttempted || touched[field]));

  const showValidationToast = (message) => {
    Toast.show({
      type: 'error',
      text1: message,
      visibilityTime: 2600,
      position: 'top',
      topOffset: Platform.OS === 'ios' ? 56 : 40,
    });
  };

  const loadPets = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    try {
      const { data, error } = await supabase
        .from('pets')
        .select('id, name, photo_url, pet_type')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });
      if (error) {
        throw error;
      }
      setPets(data ?? []);
      if (isEditing && seedMeetup) {
        const hostIds = extractMeetupHostPetIds(seedMeetup);
        const ownedIds = new Set((data ?? []).map((p) => String(p.id)));
        const validHosts = hostIds.filter((id) => ownedIds.has(String(id)));
        if (validHosts.length) {
          setSelectedHostPets(validHosts);
        }
        return;
      }
      if (activePetId && (data ?? []).some((p) => String(p.id) === String(activePetId))) {
        setSelectedHostPets([String(activePetId)]);
      } else if ((data ?? []).length > 0) {
        setSelectedHostPets([String(data[0].id)]);
      }
    } catch (err) {
      console.error('[Supabase]', err);
      setNetworkError(true);
    }
  }, [user?.id, activePetId, isEditing, seedMeetup]);

  useEffect(() => {
    if (!isEditing || !seedMeetup) {
      return;
    }

    const dateStr = String(seedMeetup.date ?? '').split('T')[0];
    const parsedDate = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date();
    const parsedStart = parseTimeString(seedMeetup.start_time, parsedDate);
    const parsedEnd = parseTimeString(seedMeetup.end_time, parsedDate);

    setTitle(seedMeetup.title ?? '');
    setDescription(seedMeetup.description ?? '');
    setMeetupCity(seedMeetup.city ?? '');
    setVenueName(seedMeetup.location_name ?? '');
    setSelectedOpenTo(seedMeetup.open_to ?? 'Open to All');
    setParticipationLimit(
      seedMeetup.participation_limit != null ? String(seedMeetup.participation_limit) : '',
    );
    setDirectionsUrl(seedMeetup.google_maps_link ?? '');
    setMeetupDate(parsedDate);
    setStartTime(parsedStart);
    setEndTime(parsedEnd);
    setDurationMode(deriveDurationMode(parsedStart, parsedEnd));

    const hostIds = extractMeetupHostPetIds(seedMeetup);
    if (hostIds.length) {
      setSelectedHostPets(hostIds);
    }
  }, [isEditing, seedMeetup]);

  useEffect(() => {
    loadPets();
  }, [loadPets]);

  useEffect(() => {
    if (isEditing) {
      return undefined;
    }

    let cancelled = false;
    const prefillCurrentCity = async () => {
      const location = await captureLocationOnUserConsent();
      if (cancelled || !location.granted || !location.coords) {
        return;
      }

      const detectedCity = await resolveCityFromCoords(
        location.coords.latitude,
        location.coords.longitude,
      );
      if (normalizeCityForSave(detectedCity)) {
        await cacheViewerFeedLocation(location.coords, detectedCity);
      }
      if (
        cancelled ||
        cityEditedRef.current ||
        !normalizeCityForSave(detectedCity)
      ) {
        return;
      }
      setMeetupCity(detectedCity);
    };

    prefillCurrentCity();
    return () => {
      cancelled = true;
    };
  }, [isEditing]);

  const applyDuration = (hours) => {
    setDurationMode(hours);
    setEndTime(addHours(startTime, hours));
  };

  const onStartChange = (_e, d) => {
    if (Platform.OS === 'android') {
      setShowStart(false);
    }
    if (!d) {
      return;
    }
    setStartTime(d);
    markTouched('time');
    if (typeof durationMode === 'number') {
      setEndTime(addHours(d, durationMode));
    }
  };

  const onEndChange = (_e, d) => {
    if (Platform.OS === 'android') {
      setShowEnd(false);
    }
    if (!d) {
      return;
    }
    setEndTime(d);
    setDurationMode('custom');
    markTouched('time');
  };

  const runValidation = useCallback(() => {
    const result = buildMeetupValidation({
      title,
      venueName,
      meetupCity,
      participationLimit,
      meetupDate,
      startTime,
      endTime,
      selectedHostPets,
      mapLinkResult,
    });
    setFieldErrors(result.fieldErrors);
    return result;
  }, [
    title,
    venueName,
    meetupCity,
    participationLimit,
    meetupDate,
    startTime,
    endTime,
    selectedHostPets,
    mapLinkResult,
  ]);

  const goFeed = () => {
    Toast.show({
      type: 'success',
      text1: 'Meetup planned',
      visibilityTime: 2000,
      position: 'bottom',
    });
    // Spec "navigation.replace('FeedScreen')": land on home feed with refresh (tabs stay under MainTabs).
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: {
              routes: [
                { name: 'FeedScreen', params: { refreshFeed: Date.now() } },
                { name: 'CreateHub' },
                { name: 'PetsScreen' },
              ],
              index: 0,
            },
          },
        ],
      }),
    );
  };

  const goBackAfterEdit = () => {
    Toast.show({
      type: 'success',
      text1: 'Meetup updated successfully.',
      visibilityTime: 2000,
      position: 'bottom',
    });
    navigation.goBack();
  };

  const submit = async () => {
    setSubmitAttempted(true);
    setNetworkError(false);

    const validation = runValidation();
    if (!validation.valid) {
      validation.shakeFields.forEach((field) => shakeField(field));
      if (validation.firstMessage) {
        showValidationToast(validation.firstMessage);
      }
      return;
    }

    if (!user?.id) {
      return;
    }
    setSaving(true);
    try {
      const parsedLimit = participationLimit.trim() ? parseInt(participationLimit, 10) : null;
      const meetupInput = {
        title: title.trim(),
        description: description.trim() || null,
        city: normalizeCityForSave(meetupCity),
        locationName: venueName.trim(),
        date: toISODate(meetupDate),
        startTime: toTimeString(startTime),
        endTime: toTimeString(endTime),
        hostPetIds: selectedHostPets,
        openTo: selectedOpenTo,
        googleMapsLink: directionsUrl.trim() || null,
        participationLimit: Number.isFinite(parsedLimit) ? parsedLimit : null,
      };

      if (isEditing && editMeetupId) {
        await updateMeetup(editMeetupId, meetupInput);
        goBackAfterEdit();
        return;
      }

      await createMeetup(meetupInput);
      goFeed();
    } catch (err) {
      const errMessage = err?.message ?? '';
      if (
        errMessage.includes('Google Maps') ||
        errMessage.includes('maps.app.goo.gl') ||
        errMessage.includes('Apple Maps')
      ) {
        setFieldErrors((prev) => ({ ...prev, directions: errMessage }));
        shakeField('directions');
        return;
      }
      console.error('[Supabase]', err);
      if (errMessage.includes('Participation')) {
        Toast.show({
          type: 'error',
          text1: errMessage,
          visibilityTime: 2500,
          position: 'bottom',
        });
      } else {
        setNetworkError(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleHostPetToggle = (petId, isChecked) => {
    const id = String(petId);
    setSelectedHostPets((prev) => {
      if (isChecked) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((existingId) => existingId !== id);
    });
  };

  const handleCancel = () => {
    if (isEditing) {
      navigation.goBack();
      return;
    }
    navigation.dispatch(StackActions.replace('MainTabs'));
  };

  return (
    <ScreenWrapper onClose={handleCancel}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: surfaces.textPrimary }]} allowFontScaling>
          {isEditing ? 'Edit Meetup' : 'Plan a meetup'}
        </Text>

        <FieldLabel required style={styles.labelBlock} labelColor={surfaces.textPrimary}>
          Meetup name
        </FieldLabel>
        <Animated.View style={{ transform: [{ translateX: shakeAnims.title }] }}>
          <TextInput
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (fieldErrors.title) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.title;
                  return next;
                });
              }
            }}
            onBlur={() => markTouched('title')}
            placeholder="Sunday morning playdate"
            placeholderTextColor={surfaces.placeholder}
            style={[
              styles.input,
              inputSurfaceStyle,
              shouldShowError('title') && styles.inputError,
              shouldShowError('title') && { backgroundColor: surfaces.backgroundCard },
            ]}
            maxLength={50}
            accessibilityLabel="Meetup name"
          />
        </Animated.View>
        {shouldShowError('title') ? (
          <Text style={styles.inlineError} allowFontScaling>
            {fieldErrors.title}
          </Text>
        ) : null}

        <Text
          style={[styles.label, styles.standaloneLabel, styles.labelSpaced, { color: surfaces.textPrimary }]}
          allowFontScaling
        >
          About
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="A relaxed morning for friendly paws"
          placeholderTextColor={surfaces.placeholder}
          style={[styles.input, styles.aboutInput, inputSurfaceStyle]}
          multiline
          maxLength={280}
          textAlignVertical="top"
          accessibilityLabel="About"
        />

        <Text
          style={[styles.label, styles.standaloneLabel, styles.labelSpaced, { color: surfaces.textPrimary }]}
          allowFontScaling
        >
          Who can join?
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.openToRow}
        >
          {OPEN_TO_OPTIONS.map((option) => {
            const on = selectedOpenTo === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setSelectedOpenTo(option.value)}
                style={({ pressed }) => [
                  styles.openToChip,
                  {
                    backgroundColor: surfaces.backgroundCard,
                    borderColor: surfaces.border,
                  },
                  on && {
                    backgroundColor: chipSelectedBg,
                    borderColor: theme.colors.brand.sage.value,
                  },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={option.label}
              >
                <Text
                  style={[
                    styles.openToChipText,
                    { color: surfaces.textPrimary },
                    on && styles.openToChipTextOn,
                  ]}
                  allowFontScaling
                >
                  {on ? `${option.label} ✓` : option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <FieldLabel required style={[styles.labelBlock, styles.labelSpaced]} labelColor={surfaces.textPrimary}>
          City
        </FieldLabel>
        <Animated.View style={{ transform: [{ translateX: shakeAnims.city }] }}>
          <TextInput
            value={meetupCity}
            onChangeText={(text) => {
              cityEditedRef.current = true;
              setMeetupCity(text);
              if (fieldErrors.city) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.city;
                  return next;
                });
              }
            }}
            onBlur={() => markTouched('city')}
            placeholder="Jaipur"
            placeholderTextColor={surfaces.placeholder}
            style={[
              styles.input,
              inputSurfaceStyle,
              shouldShowError('city') && styles.inputError,
              shouldShowError('city') && { backgroundColor: surfaces.backgroundCard },
            ]}
            accessibilityLabel="City"
          />
        </Animated.View>
        {shouldShowError('city') ? (
          <Text style={styles.inlineError} allowFontScaling>
            {fieldErrors.city}
          </Text>
        ) : null}

        <FieldLabel required style={[styles.labelBlock, styles.labelSpaced]} labelColor={surfaces.textPrimary}>
          Where?
        </FieldLabel>
        <Animated.View style={{ transform: [{ translateX: shakeAnims.venue }] }}>
          <TextInput
            value={venueName}
            onChangeText={(text) => {
              setVenueName(text);
              if (fieldErrors.venue) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.venue;
                  return next;
                });
              }
            }}
            onBlur={() => markTouched('venue')}
            placeholder="Cubbon Park"
            placeholderTextColor={surfaces.placeholder}
            style={[
              styles.input,
              inputSurfaceStyle,
              shouldShowError('venue') && styles.inputError,
              shouldShowError('venue') && { backgroundColor: surfaces.backgroundCard },
            ]}
            accessibilityLabel="Venue"
          />
        </Animated.View>
        {shouldShowError('venue') ? (
          <Text style={styles.inlineError} allowFontScaling>
            {fieldErrors.venue}
          </Text>
        ) : null}

        <FieldLabel required style={[styles.labelBlock, styles.labelSpaced]} labelColor={surfaces.textPrimary}>
          Maximum participants
        </FieldLabel>
        <Animated.View style={{ transform: [{ translateX: shakeAnims.participation }] }}>
          <TextInput
            value={participationLimit}
            onChangeText={(text) => {
              setParticipationLimit(text.replace(/[^0-9]/g, ''));
              if (fieldErrors.participation) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.participation;
                  return next;
                });
              }
            }}
            onBlur={() => markTouched('participation')}
            placeholder="20"
            placeholderTextColor={surfaces.placeholder}
            keyboardType="number-pad"
            style={[
              styles.input,
              styles.participationInput,
              inputSurfaceStyle,
              shouldShowError('participation') && styles.inputError,
              shouldShowError('participation') && { backgroundColor: surfaces.backgroundCard },
            ]}
            accessibilityLabel="Maximum participants"
          />
        </Animated.View>
        {shouldShowError('participation') ? (
          <Text style={styles.inlineError} allowFontScaling>
            {fieldErrors.participation}
          </Text>
        ) : null}

        <Text
          style={[styles.label, styles.standaloneLabel, styles.labelSpaced, { color: surfaces.textPrimary }]}
          allowFontScaling
        >
          Directions — optional
        </Text>
        <Animated.View style={{ transform: [{ translateX: shakeAnims.directions }] }}>
          <TextInput
            value={directionsUrl}
            onChangeText={(text) => {
              setDirectionsUrl(text);
              if (fieldErrors.directions) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.directions;
                  return next;
                });
              }
            }}
            onBlur={() => markTouched('directions')}
            placeholder="Paste a Google or Apple Maps link (optional)"
            placeholderTextColor={surfaces.placeholder}
            style={[
              styles.input,
              styles.directionsInput,
              inputSurfaceStyle,
              shouldShowError('directions') && styles.inputError,
              shouldShowError('directions') && { backgroundColor: surfaces.backgroundCard },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Directions link"
          />
        </Animated.View>
        <Text style={[styles.helperMuted, { color: surfaces.textMuted }]} allowFontScaling>
          Paste a Google or Apple Maps link
        </Text>
        {shouldShowError('directions') ? (
          <Text style={styles.inlineError} allowFontScaling>
            {fieldErrors.directions}
          </Text>
        ) : null}
        <FieldLabel style={[styles.labelBlock, styles.labelSpaced]} labelColor={surfaces.textPrimary}>
          Date
        </FieldLabel>
        <Animated.View style={{ transform: [{ translateX: shakeAnims.date }] }}>
          <Pressable
            onPress={() => {
              setShowDate(true);
              markTouched('date');
            }}
            style={({ pressed }) => [
              styles.dateReveal,
              inputSurfaceStyle,
              shouldShowError('date') && styles.inputError,
              shouldShowError('date') && { backgroundColor: surfaces.backgroundCard },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Choose meetup date"
          >
            <Text style={[styles.dateRevealText, { color: surfaces.textPrimary }]} allowFontScaling>
              {formatDayMonthYear(meetupDate)}
            </Text>
          </Pressable>
        </Animated.View>
        {shouldShowError('date') ? (
          <Text style={styles.inlineError} allowFontScaling>
            {fieldErrors.date}
          </Text>
        ) : null}
        {showDate ? (
          <View>
            <DateTimePicker
              value={meetupDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(ev, d) => {
                if (Platform.OS === 'android') {
                  setShowDate(false);
                }
                if (d) {
                  setMeetupDate(d);
                  markTouched('date');
                }
              }}
            />
            {Platform.OS === 'ios' ? (
              <Pressable onPress={() => setShowDate(false)} style={styles.pickerDone} accessibilityLabel="Done choosing date">
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <FieldLabel style={[styles.labelBlock, styles.labelSpaced]} labelColor={surfaces.textPrimary}>
          Time
        </FieldLabel>
        <Animated.View style={{ transform: [{ translateX: shakeAnims.time }] }}>
          <View style={styles.timeRow}>
            <View style={styles.timeCol}>
              <Text style={[styles.timeColLabel, { color: surfaces.textPrimary }]} allowFontScaling>
                Starts
              </Text>
              <Pressable
                onPress={() => {
                  setShowStart(true);
                  markTouched('time');
                }}
                style={({ pressed }) => [
                  styles.dateReveal,
                  inputSurfaceStyle,
                  shouldShowError('time') && styles.inputError,
                  shouldShowError('time') && { backgroundColor: surfaces.backgroundCard },
                  pressed && styles.pressed,
                ]}
                accessibilityLabel="Choose start time"
              >
                <Text style={[styles.dateRevealText, { color: surfaces.textPrimary }]} allowFontScaling>
                  {formatLocalTime(startTime)}
                </Text>
              </Pressable>
            </View>
            <View style={styles.timeCol}>
              <Text style={[styles.timeColLabel, { color: surfaces.textPrimary }]} allowFontScaling>
                Ends
              </Text>
              <Pressable
                onPress={() => {
                  setShowEnd(true);
                  markTouched('time');
                }}
                style={({ pressed }) => [
                  styles.dateReveal,
                  inputSurfaceStyle,
                  shouldShowError('time') && styles.inputError,
                  shouldShowError('time') && { backgroundColor: surfaces.backgroundCard },
                  pressed && styles.pressed,
                ]}
                accessibilityLabel="Choose end time"
              >
                <Text style={[styles.dateRevealText, { color: surfaces.textPrimary }]} allowFontScaling>
                  {formatLocalTime(endTime)}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
        <View style={styles.durRow}>
          {DURATION_HOURS.map((h) => {
            const active = durationMode === h;
            return (
              <Pressable
                key={h}
                onPress={() => applyDuration(h)}
                style={({ pressed }) => [
                  styles.durChip,
                  { backgroundColor: surfaces.backgroundCard },
                  active && { backgroundColor: chipSelectedBg },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Duration ${h} hours`}
              >
                <Text
                  style={[
                    styles.durChipText,
                    { color: surfaces.textPrimary },
                    active && styles.durChipTextOn,
                  ]}
                  allowFontScaling
                >
                  {h}h
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setDurationMode('custom')}
            style={({ pressed }) => [
              styles.durChip,
              { backgroundColor: surfaces.backgroundCard },
              durationMode === 'custom' && { backgroundColor: chipSelectedBg },
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Custom duration"
          >
            <Text
              style={[
                styles.durChipText,
                { color: surfaces.textPrimary },
                durationMode === 'custom' && styles.durChipTextOn,
              ]}
              allowFontScaling
            >
              Custom
            </Text>
          </Pressable>
        </View>
        {showStart ? (
          <View>
            <DateTimePicker
              value={startTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onStartChange}
            />
            {Platform.OS === 'ios' ? (
              <Pressable onPress={() => setShowStart(false)} style={styles.pickerDone} accessibilityLabel="Done choosing start time">
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {showEnd ? (
          <View>
            <DateTimePicker
              value={endTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onEndChange}
            />
            {Platform.OS === 'ios' ? (
              <Pressable onPress={() => setShowEnd(false)} style={styles.pickerDone} accessibilityLabel="Done choosing end time">
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {shouldShowError('time') ? (
          <Text style={styles.inlineError} allowFontScaling>
            {fieldErrors.time}
          </Text>
        ) : null}

        <FieldLabel style={[styles.labelBlock, styles.labelSpaced]} labelColor={surfaces.textPrimary}>
          Who is hosting?
        </FieldLabel>
        <Animated.View
          style={[
            styles.hostList,
            { backgroundColor: surfaces.backgroundCard, transform: [{ translateX: shakeAnims.pets }] },
            shouldShowError('pets') && styles.inputError,
            shouldShowError('pets') && { backgroundColor: surfaces.backgroundCard },
          ]}
        >
          {pets.map((p) => {
            const petId = String(p.id);
            const isSelected = selectedHostPets.includes(petId);
            const emoji = petTypeEmoji(p.pet_type);
            return (
              <View key={petId} style={styles.hostRow}>
                <Text
                  style={[
                    styles.hostName,
                    { color: surfaces.textPrimary },
                    isSelected && styles.hostNameOn,
                  ]}
                  allowFontScaling
                >
                  {p.name} {emoji}
                </Text>
                <Switch
                  value={isSelected}
                  onValueChange={(isChecked) => {
                    handleHostPetToggle(petId, isChecked);
                    markTouched('pets');
                    if (fieldErrors.pets) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.pets;
                        return next;
                      });
                    }
                  }}
                  trackColor={{
                    false: surfaces.border,
                    true: theme.colors.brand.sage.value,
                  }}
                  thumbColor={surfaces.backgroundCard}
                  accessibilityLabel={`${p.name} hosting`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: Boolean(isSelected) }}
                />
              </View>
            );
          })}
        </Animated.View>
        {pets.length === 0 ? (
          <Text style={[styles.helperText, { color: surfaces.textMuted }]} allowFontScaling>
            Add a pet to your profile first.
          </Text>
        ) : null}
        {shouldShowError('pets') ? (
          <Text style={styles.inlineError} allowFontScaling>
            {fieldErrors.pets}
          </Text>
        ) : null}

        {networkError ? (
          <View style={styles.netBox}>
            <Text style={styles.error} allowFontScaling>
              We couldn&apos;t reach Pawple. Check your connection.
            </Text>
            <Pressable onPress={submit} style={styles.retry} accessibilityRole="button" accessibilityLabel="Try again">
              <Text style={styles.retryText} allowFontScaling>
                Try again
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => [styles.cta, (pressed || saving) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={isEditing ? 'Save changes' : 'Plan meetup'}
          accessibilityState={{ disabled: saving }}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.text.inverse.value} />
          ) : (
            <Text style={styles.ctaText} allowFontScaling>
              {isEditing ? 'Save Changes' : 'Plan meetup'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  topBar: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  cancelIcon: {
    minWidth: theme.components.meetup.ctaMinHeight,
    minHeight: theme.components.meetup.ctaMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingTop: theme.feed.shellPaddingTop,
    paddingHorizontal: theme.feed.shellPaddingHorizontal,
    paddingBottom: theme.feed.shellPaddingBottom,
    flexGrow: 1,
  },
  screenTitle: {
    ...theme.fonts.scale.creationTitle,
    marginBottom: theme.spacing.sm,
  },
  screenSub: {
    ...theme.fonts.scale.input,
    fontSize: 15,
    lineHeight: Math.round(15 * theme.lineHeights.normal),
    color: theme.colors.text.secondary.light,
    width: '80%',
    marginBottom: theme.spacing.xl,
  },
  label: {
    ...theme.fonts.scale.label,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  standaloneLabel: {
    marginBottom: theme.spacing.xs,
  },
  labelBlock: {
    marginBottom: theme.spacing.sm,
  },
  labelSpaced: {
    marginTop: theme.spacing.sm,
  },
  input: {
    ...theme.fonts.scale.input,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.components.meetupForm.fieldPaddingY,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: theme.colors.feedback.error.value,
  },
  aboutInput: {
    minHeight: 96,
  },
  inlineError: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: Math.round(theme.fontSizes.sm * theme.lineHeights.normal),
    color: theme.colors.feedback.error.value,
    marginBottom: theme.spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  openToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  openToChip: {
    borderRadius: theme.borderRadius.full,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
  },
  openToChipText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
  },
  openToChipTextOn: {
    color: theme.colors.brand.sageDark.light,
    fontFamily: theme.fonts.medium,
  },
  openToSpecifyInput: {
    marginTop: 0,
    marginBottom: theme.spacing.sm,
  },
  participationInput: {
    marginBottom: theme.spacing.xs,
  },
  directionsInput: {
    marginBottom: theme.spacing.xs,
  },
  helperMuted: {
    ...theme.fonts.scale.helper,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  mapWarning: {
    ...theme.fonts.scale.helper,
    color: theme.colors.text.secondary.light,
    marginBottom: theme.spacing.sm,
  },
  dateReveal: {
    ...theme.fonts.scale.input,
    marginBottom: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateRevealText: {
    ...theme.fonts.scale.input,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  timeCol: {
    flex: 1,
  },
  timeColLabel: {
    ...theme.fonts.scale.label,
    marginBottom: theme.spacing.sm,
  },
  durRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  durChip: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.full,
  },
  durChipText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
  },
  durChipTextOn: {
    color: theme.colors.brand.sageDark.light,
    fontFamily: theme.fonts.medium,
  },
  hostList: {
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 48,
  },
  hostName: {
    flex: 1,
    paddingRight: theme.spacing.md,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
  },
  hostNameOn: {
    fontFamily: theme.fonts.medium,
    color: theme.colors.brand.sageDark.light,
  },
  helperText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    marginBottom: theme.spacing.md,
  },
  petChip: {
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background.card,
    marginRight: theme.spacing.sm,
  },
  petChipOn: {
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  petChipText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.primary.light,
  },
  petChipTextOn: {
    color: theme.colors.brand.sageDark.light,
    fontFamily: theme.fonts.medium,
  },
  error: {
    ...theme.fonts.scale.helper,
    color: theme.colors.feedback.error.value,
    marginBottom: theme.spacing.sm,
  },
  netBox: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  retry: {
    marginTop: theme.spacing.sm,
    minHeight: theme.components.meetup.ctaMinHeight,
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.brand.sage.value,
  },
  cta: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xxl,
    minHeight: theme.components.meetup.ctaMinHeight,
    borderRadius: theme.borderRadius.meetupCta,
    width: '100%',
    backgroundColor: theme.colors.brand.sage.value,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    backgroundColor: theme.colors.background.light,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  ctaText: {
    ...theme.fonts.scale.cta,
    color: theme.colors.text.inverse.value,
  },
  ctaTextDisabled: {
    color: theme.colors.text.muted.light,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  pickerDone: {
    alignSelf: 'flex-end',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  pickerDoneText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.brand.sage.value,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.components.bottomSheet.backdrop,
  },
  sheet: {
    backgroundColor: theme.colors.background.screen,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  sheetTitle: {
    ...theme.fonts.scale.cardTitle,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.lg,
  },
  sheetRow: {
    paddingVertical: theme.spacing.md,
    minHeight: theme.components.meetup.ctaMinHeight,
    justifyContent: 'center',
  },
  sheetRowText: {
    ...theme.fonts.scale.input,
    color: theme.colors.text.primary.light,
  },
  sheetCta: {
    marginTop: theme.spacing.lg,
    minHeight: theme.components.meetup.ctaMinHeight,
    borderRadius: theme.borderRadius.meetupCta,
    backgroundColor: theme.colors.brand.sage.value,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCtaText: {
    ...theme.fonts.scale.cta,
    color: theme.colors.text.inverse.value,
  },
});
