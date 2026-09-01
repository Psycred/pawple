import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import { supabase } from '../config/supabase';
import { useActivePet } from '../contexts/ActivePetContext';
import {
  acknowledgeMeetupRsvpDisclaimer,
  hasMeetupRsvpDisclaimerAck,
  MEETUP_RSVP_DISCLAIMER,
} from '../lib/meetupRsvpDisclaimer';
import {
  extractMeetupHostPetIds,
  extractViewerJoinedPetIds,
  isDemoMeetupId,
  joinMeetupWithPets,
  leaveMeetupWithPets,
} from '../services/meetups';
import { petTypeEmoji } from '../utils/petTypeEmoji';
import PetContextSelector from './PetContextSelector';

const SHEET_BG = theme.colors.background.card;
const SAGE = theme.colors.brand.sage.value;
const SAGE_LIGHT = theme.colors.brand.sageLight.light;

/**
 * Bottom sheet — multi-pet RSVP (join or leave).
 * Reuses PetContextSelector avatars from the pet switcher flow.
 *
 * @param {'join' | 'leave'} mode
 */
export default function MeetupPetJoinSheet({
  visible,
  mode = 'join',
  meetup,
  onSuccess,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const { activePetId } = useActivePet();

  const [pets, setPets] = useState([]);
  const [loadingPets, setLoadingPets] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const meetupId = meetup?.id;
  const isJoin = mode === 'join';
  const isDevelopmentDemo = __DEV__ && isDemoMeetupId(meetupId);

  const hostPetIds = useMemo(
    () => new Set(extractMeetupHostPetIds(meetup ?? {})),
    [meetup],
  );

  const ownedPetIds = useMemo(() => pets.map((pet) => String(pet.id)), [pets]);

  const viewerJoinedIds = useMemo(
    () => extractViewerJoinedPetIds(meetup ?? {}, ownedPetIds),
    [meetup, ownedPetIds],
  );

  const loadPets = useCallback(async () => {
    setLoadingPets(true);
    setErrorText('');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setPets([]);
        return;
      }

      const { data, error } = await supabase
        .from('pets')
        .select('id, name, photo_url, pet_type, breed')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      setPets(data ?? []);
    } catch (err) {
      console.error('[Supabase]', err);
      setErrorText('Could not load your pets.');
      setPets([]);
    } finally {
      setLoadingPets(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      setShowDisclaimer(false);
      return;
    }
    loadPets();
  }, [visible, loadPets]);

  useEffect(() => {
    if (!visible || !isJoin) {
      return;
    }
    let cancelled = false;
    hasMeetupRsvpDisclaimerAck()
      .then((acked) => {
        if (!cancelled) {
          setShowDisclaimer(!acked);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShowDisclaimer(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visible, isJoin]);

  useEffect(() => {
    if (!visible || pets.length === 0) {
      return;
    }

    if (isJoin) {
      const preselected = new Set(viewerJoinedIds);
      if (
        (!isDevelopmentDemo || preselected.size === 0) &&
        activePetId &&
        ownedPetIds.includes(String(activePetId))
      ) {
        preselected.add(String(activePetId));
      }
      setSelectedIds([...preselected]);
      return;
    }

    const leavable = viewerJoinedIds.filter((id) => !hostPetIds.has(String(id)));
    setSelectedIds(leavable);
  }, [
    visible,
    pets,
    isJoin,
    isDevelopmentDemo,
    viewerJoinedIds,
    activePetId,
    ownedPetIds,
    hostPetIds,
  ]);

  const togglePet = (petId) => {
    const id = String(petId);
    const isHostLocked = hostPetIds.has(id);

    if (isHostLocked) {
      return;
    }

    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((existingId) => existingId !== id);
      }
      return [...prev, id];
    });
  };

  const isManagingDemoSelection =
    isJoin && isDevelopmentDemo && viewerJoinedIds.length > 0;

  const handleConfirm = async () => {
    if (!meetupId || (selectedIds.length === 0 && !isManagingDemoSelection)) {
      return;
    }

    if (isJoin && showDisclaimer) {
      return;
    }

    setBusy(true);
    setErrorText('');

    try {
      if (isJoin) {
        const result = await joinMeetupWithPets(meetupId, selectedIds, {
          meetup,
          viewerPets: pets,
        });
        onSuccess?.({
          mode: 'join',
          petIds: selectedIds,
          meetup: result.meetup,
        });
      } else {
        const result = await leaveMeetupWithPets(meetupId, selectedIds, {
          meetup,
          viewerPets: pets,
        });
        onSuccess?.({
          mode: 'leave',
          petIds: selectedIds,
          meetup: result.meetup,
        });
      }
      onClose?.();
    } catch (err) {
      console.error('[MeetupPetJoinSheet]', err);
      setErrorText(err?.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleAcknowledgeDisclaimer = async () => {
    await acknowledgeMeetupRsvpDisclaimer();
    setShowDisclaimer(false);
  };

  const title = isJoin ? 'Who is joining?' : 'Which pets are leaving?';
  const helper = isJoin
    ? 'Select all pets you want to bring to this meetup.'
    : 'Choose which pets to remove from this meetup.';
  const confirmLabel = isJoin ? 'Confirm' : 'Remove';

  const canConfirm =
    (selectedIds.length > 0 || isManagingDemoSelection) && !busy && !loadingPets;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {showDisclaimer ? (
          <>
            <View style={styles.handle} />
            <Text style={styles.title} allowFontScaling>
              Before you RSVP
            </Text>
            <Text style={styles.disclaimerBody} allowFontScaling>
              {MEETUP_RSVP_DISCLAIMER}
            </Text>
            <Pressable
              onPress={handleAcknowledgeDisclaimer}
              style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Continue to RSVP"
            >
              <Text style={styles.confirmButtonText} allowFontScaling>
                Continue
              </Text>
            </Pressable>
          </>
        ) : (
          <>
        <View style={styles.handle} />

        <Text style={styles.title} allowFontScaling>
          {title}
        </Text>
        <Text style={styles.helper} allowFontScaling>
          {helper}
        </Text>

        {loadingPets ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={SAGE} />
          </View>
        ) : pets.length === 0 ? (
          <Text style={styles.emptyText} allowFontScaling>
            Add a pet to your profile first.
          </Text>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {pets.map((pet) => {
              const petId = String(pet.id);
              const isSelected = selectedIds.includes(petId);
              const isHostLocked = hostPetIds.has(petId);
              const emoji = petTypeEmoji(pet.pet_type);

              return (
                <View key={petId} style={styles.row}>
                  <PetContextSelector
                    photoUrl={pet.photo_url}
                    size={40}
                    style={styles.rowAvatar}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.petName} numberOfLines={1} allowFontScaling>
                      {pet.name} {emoji}
                    </Text>
                    {isHostLocked ? (
                      <Text style={styles.hostHint} allowFontScaling>
                        Host
                      </Text>
                    ) : null}
                  </View>
                  <Switch
                    value={isSelected || isHostLocked}
                    onValueChange={() => togglePet(petId)}
                    disabled={isHostLocked || busy}
                    trackColor={{
                      false: theme.colors.border.light,
                      true: SAGE_LIGHT,
                    }}
                    thumbColor={theme.colors.background.card}
                    accessibilityLabel={`${pet.name} ${isSelected ? 'selected' : 'not selected'}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: Boolean(isSelected || isHostLocked),
                      disabled: Boolean(isHostLocked),
                    }}
                  />
                </View>
              );
            })}
          </ScrollView>
        )}

        {errorText ? (
          <Text style={styles.errorText} allowFontScaling>
            {errorText}
          </Text>
        ) : null}

        <Pressable
          onPress={handleConfirm}
          disabled={!canConfirm}
          style={({ pressed }) => [
            styles.confirmButton,
            !canConfirm && styles.confirmButtonDisabled,
            pressed && canConfirm && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          accessibilityState={{ disabled: !canConfirm }}
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.text.inverse.value} />
          ) : (
            <Text style={styles.confirmButtonText} allowFontScaling>
              {confirmLabel}
            </Text>
          )}
        </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.components.bottomSheet.backdrop,
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: theme.components.bottomSheet.handleWidth,
    height: theme.components.bottomSheet.handleHeight,
    borderRadius: theme.components.bottomSheet.handleRadius,
    backgroundColor: theme.colors.border.light,
    marginBottom: 20,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.lg,
    lineHeight: Math.round(theme.fontSizes.lg * theme.lineHeights.tight),
    color: theme.colors.text.primary.light,
    marginBottom: 8,
  },
  helper: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: Math.round(theme.fontSizes.sm * theme.lineHeights.normal),
    color: theme.colors.text.secondary.light,
    marginBottom: 16,
  },
  disclaimerBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: Math.round(theme.fontSizes.md * theme.lineHeights.normal),
    color: theme.colors.text.secondary.light,
    marginBottom: 24,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.muted.light,
    paddingVertical: 24,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.light,
  },
  rowAvatar: {
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  petName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  hostHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    marginTop: 2,
  },
  errorText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.feedback.error.value,
    marginTop: 8,
  },
  confirmButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SAGE,
  },
  confirmButtonDisabled: {
    opacity: 0.45,
  },
  confirmButtonText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
