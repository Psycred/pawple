import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { useActivePet } from '../contexts/ActivePetContext';
import {
  extractMeetupHostPetIds,
  hasViewerJoinedMeetup,
  isDemoMeetupId,
  isMeetupPast,
} from '../services/meetups';
import { formatLocalTime } from '../utils/formatMomentDate';
import { formatCityBadge } from '../utils/cityUtils';
import { formatMeetupCardHostedByLine } from '../utils/meetupHostDisplay';
import MeetupPetJoinSheet from './MeetupPetJoinSheet';

const LABEL_SAGE = '#8EA88F';
const TITLE_SAGE = '#6E8E73';
const BUTTON_SAGE = '#9EB8A0';
const TITLE_JOINED = '#9EB8A0';

/**
 * Gold-standard meetup card — one layout everywhere (feed, carousel, profile).
 * Parent controls width via the `style` prop; default is full width.
 */
export default function MeetupCard({
  meetup: meetupProp,
  actionVariant = 'rsvp',
  onManage,
  onPress,
  style,
  viewerPets = [],
  viewerId = null,
}) {
  const navigation = useNavigation();
  const { activePetId } = useActivePet();
  const surfaces = useRuntimeThemeColors();
  const meetupTheme = useMemo(
    () => ({
      card: {
        backgroundColor: surfaces.meetupCardBackground,
        borderColor: surfaces.meetupCardBorder,
      },
      bodyText: { color: surfaces.meetupBodyText },
      metaText: { color: surfaces.meetupMetaText },
      chipBackground: { backgroundColor: surfaces.meetupChipBackground },
      divider: { backgroundColor: surfaces.meetupCardBorder },
      joinedButton: {
        backgroundColor: surfaces.meetupJoinedButtonBackground,
        borderColor: BUTTON_SAGE,
      },
      screenButton: {
        backgroundColor: surfaces.backgroundScreen,
        borderColor: surfaces.meetupCardBorder,
      },
    }),
    [surfaces],
  );
  const [meetup, setMeetup] = useState(meetupProp);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);

  useEffect(() => {
    setMeetup(meetupProp);
  }, [meetupProp]);

  const ownedPetIds = useMemo(() => {
    if (!viewerId || !Array.isArray(viewerPets)) {
      return [];
    }
    return viewerPets.map((pet) => pet?.id).filter(Boolean).map(String);
  }, [viewerId, viewerPets]);

  const isHostPet = useMemo(() => {
    if (!activePetId) {
      return false;
    }
    const ids = extractMeetupHostPetIds(meetup);
    return ids.some((id) => String(id) === String(activePetId));
  }, [activePetId, meetup]);

  const joined =
    actionVariant === 'going' ||
    actionVariant === 'hosting' ||
    isHostPet ||
    Boolean(meetup?.viewer_joined ?? meetup?.has_joined ?? meetup?.joined) ||
    hasViewerJoinedMeetup(meetup, ownedPetIds);

  const meetupDate = useMemo(() => {
    if (!meetup?.date) {
      return null;
    }
    const parsed = new Date(`${String(meetup.date).split('T')[0]}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [meetup?.date]);

  const dateHeading = useMemo(() => formatMeetupCardDate(meetupDate), [meetupDate]);

  const timeLine = useMemo(() => {
    const start = timePartsToLabel(meetup?.start_time);
    const end = timePartsToLabel(meetup?.end_time);
    if (!start && !end) {
      return '';
    }
    if (start && end) {
      return `${start} – ${end}`;
    }
    return start || end;
  }, [meetup?.end_time, meetup?.start_time]);

  const chipLabel = useMemo(() => {
    const openTo = meetup?.open_to;
    if (openTo === 'Please Specify' || openTo === 'Breed Specific') {
      return meetup?.custom_breed_spec?.trim() || openTo;
    }
    if (openTo) {
      return openTo;
    }
    return '';
  }, [meetup?.open_to, meetup?.custom_breed_spec]);

  const venueLabel = useMemo(() => {
    const name = meetup?.location_name ?? meetup?.locationName;
    const trimmed = String(name ?? '').trim();
    return trimmed || null;
  }, [meetup?.location_name, meetup?.locationName]);

  const cityLabel = useMemo(() => formatCityBadge(meetup?.city), [meetup?.city]);

  const hostedByLine = useMemo(() => formatMeetupCardHostedByLine(meetup), [meetup]);

  // Visual-only split — keeps formatMeetupCardHostedByLine() as the single source of copy.
  const hostedByNames = useMemo(() => {
    if (!hostedByLine) {
      return '';
    }
    return hostedByLine.replace(/^Hosted by\s+/, '');
  }, [hostedByLine]);

  const distanceLabel = useMemo(() => {
    const km = Number(meetup?.distanceKm ?? meetup?.distance_km);
    if (!Number.isFinite(km) || km < 0) {
      return null;
    }
    return `${Math.round(km)} km away`;
  }, [meetup?.distanceKm, meetup?.distance_km]);

  const mapsLink = useMemo(() => {
    const link = meetup?.google_maps_link?.trim();
    return link || null;
  }, [meetup?.google_maps_link]);

  const limit = useMemo(() => {
    const raw = meetup?.participation_limit;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [meetup?.participation_limit]);

  const openMapsLink = () => {
    if (!mapsLink) {
      return;
    }
    Linking.openURL(mapsLink).catch(() => {
      Alert.alert('Directions', 'Could not open that link.');
    });
  };

  const goingCount = useMemo(() => Number(meetup?.participant_count ?? 0) || 0, [meetup?.participant_count]);

  const participantsText =
    limit != null ? `${goingCount} / ${limit} pets joining` : `${goingCount} pets joining`;

  const isFull = limit != null && goingCount >= limit && !joined && !isHostPet;
  const isPast = isMeetupPast(meetup);
  const hasSchedule = Boolean(dateHeading || timeLine);
  const hasLocation = Boolean(venueLabel || cityLabel);
  const showLocationActions = Boolean(distanceLabel || mapsLink);

  const openMeetupDetails = () => {
    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      parent.navigate('MeetupDetailsScreen', { meetupId: meetup?.id, meetup });
      return;
    }
    navigation.navigate('MeetupDetailsScreen', { meetupId: meetup?.id, meetup });
  };

  const handleCardPress = () => {
    if (onPress) {
      onPress(meetup);
      return;
    }
    openMeetupDetails();
  };

  const handleJoinSheetSuccess = ({ meetup: refreshedMeetup }) => {
    if (refreshedMeetup) {
      setMeetup(refreshedMeetup);
    }
  };

  const handleRsvp = () => {
    if (actionVariant !== 'rsvp') {
      return;
    }
    if (joined) {
      if (__DEV__ && isDemoMeetupId(meetup?.id)) {
        setJoinSheetOpen(true);
      } else {
        setLeaveSheetOpen(true);
      }
      return;
    }
    if (isFull) {
      return;
    }
    if (ownedPetIds.length === 0) {
      Alert.alert('Meetup', 'Add a pet to your profile first.');
      return;
    }
    if (!meetup?.id) {
      return;
    }
    setJoinSheetOpen(true);
  };

  const handleGoingAction = () => {
    setLeaveSheetOpen(true);
  };

  const renderPrimaryButton = () => {
    if (actionVariant === 'none') {
      return null;
    }

    if (isHostPet && actionVariant !== 'hosting') {
      return (
        <View
          style={[styles.primaryButton, styles.primaryButtonHost, meetupTheme.screenButton]}
          accessibilityRole="text"
        >
          <Text style={[styles.primaryButtonText, styles.primaryButtonTextHost]} allowFontScaling>
            Host
          </Text>
        </View>
      );
    }

    if (actionVariant === 'hosting') {
      return (
        <Pressable
          onPress={() => onManage?.(meetup)}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Manage ${meetup?.title || 'meetup'}`}
        >
          <Text style={styles.primaryButtonText} allowFontScaling>
            Manage
          </Text>
        </Pressable>
      );
    }

    if (actionVariant === 'going') {
      return (
        <Pressable
          onPress={handleGoingAction}
          style={({ pressed }) => [
            styles.primaryButton,
            styles.primaryButtonJoined,
            meetupTheme.joinedButton,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cancel your participation in this meetup"
        >
          <Text style={[styles.primaryButtonText, styles.primaryButtonTextJoined]} allowFontScaling>
            Cancel
          </Text>
        </Pressable>
      );
    }

    if (isPast) {
      return (
        <View
          style={[styles.primaryButton, styles.primaryButtonFull, meetupTheme.screenButton]}
          accessibilityRole="text"
          accessibilityLabel="This meetup has ended"
        >
          <Text
            style={[styles.primaryButtonText, styles.primaryButtonTextFull, meetupTheme.metaText]}
            allowFontScaling
          >
            Completed
          </Text>
        </View>
      );
    }

    const buttonLabel = joined ? "You're Going" : isFull ? 'Event Full' : 'Count Us In';

    return (
      <Pressable
        onPress={handleRsvp}
        disabled={isFull}
        style={({ pressed }) => [
          styles.primaryButton,
          joined && !isFull && styles.primaryButtonJoined,
          joined && !isFull && meetupTheme.joinedButton,
          isFull && styles.primaryButtonFull,
          isFull && meetupTheme.screenButton,
          pressed && !isFull && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: isFull, selected: joined }}
        accessibilityLabel={
          joined
            ? "You're going to this meetup, tap to cancel"
            : isFull
              ? 'This meetup is full'
              : 'Count us in for this meetup'
        }
      >
        <Text
          style={[
            styles.primaryButtonText,
            joined && !isFull && styles.primaryButtonTextJoined,
            isFull && styles.primaryButtonTextFull,
          ]}
          allowFontScaling
        >
          {buttonLabel}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.card, meetupTheme.card, style]} accessibilityRole="summary">
      {meetup?.isPinned ? (
        <Text style={styles.topLabel} allowFontScaling>
          YOUR MEETUP
        </Text>
      ) : null}

      <Pressable
        onPress={handleCardPress}
        style={({ pressed }) => [styles.cardBodyPress, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${meetup?.title || 'meetup'}`}
      >
        <Text
          style={[styles.title, joined && styles.titleJoined]}
          numberOfLines={2}
          allowFontScaling
        >
          {meetup?.title}
        </Text>

        {hasLocation ? (
          <View style={styles.locationBlock}>
            {venueLabel ? (
              <Text style={[styles.venueText, meetupTheme.metaText]} numberOfLines={2} allowFontScaling>
                {venueLabel}
              </Text>
            ) : null}
            {cityLabel ? (
              <Text
                style={[styles.cityText, !venueLabel && styles.cityTextStandalone]}
                numberOfLines={1}
                allowFontScaling
              >
                {cityLabel}
              </Text>
            ) : null}
          </View>
        ) : null}

        {hostedByLine ? (
          <View style={styles.hostedByRow}>
            <Feather name="user" size={13} color={LABEL_SAGE} style={styles.hostedByIcon} />
            <Text style={styles.hostedByText} numberOfLines={2} allowFontScaling>
              <Text style={[styles.hostedByPrefix, meetupTheme.metaText]}>Hosted by </Text>
              <Text style={[styles.hostedByNames, meetupTheme.bodyText]}>{hostedByNames}</Text>
            </Text>
          </View>
        ) : null}

        {hasSchedule || showLocationActions ? (
          <View style={styles.scheduleRow}>
            {hasSchedule ? (
              <View style={styles.scheduleCopy}>
                <Feather name="calendar" size={14} color={LABEL_SAGE} style={styles.metaIcon} />
                <View style={styles.metaCopy}>
                  {dateHeading ? (
                    <Text style={[styles.dateHeading, meetupTheme.bodyText]} allowFontScaling>
                      {dateHeading}
                    </Text>
                  ) : null}
                  {timeLine ? (
                    <Text style={[styles.timeLine, meetupTheme.metaText]} allowFontScaling>
                      {timeLine}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={styles.scheduleCopyPlaceholder} />
            )}

            {showLocationActions ? (
              <View style={[styles.locationActionsPanel, meetupTheme.chipBackground]}>
                {distanceLabel ? (
                  <View style={styles.distanceRow} accessibilityLabel={distanceLabel}>
                    <Feather name="navigation" size={11} color={TITLE_SAGE} />
                    <Text style={styles.distanceText} numberOfLines={1} allowFontScaling>
                      {distanceLabel}
                    </Text>
                  </View>
                ) : null}
                {mapsLink ? (
                  <Pressable
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      openMapsLink();
                    }}
                    style={({ pressed }) => [styles.directionsPressable, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Open directions"
                  >
                    <View style={styles.directionsRow}>
                      <Feather name="navigation" size={11} color={TITLE_SAGE} />
                      <Text style={styles.directionsLink} allowFontScaling>
                        Directions
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.participantsSection}>
          <Feather name="users" size={14} color={LABEL_SAGE} style={styles.metaIcon} />
          <Text style={[styles.participantsText, meetupTheme.metaText]} numberOfLines={1} allowFontScaling>
            {participantsText}
          </Text>

          {chipLabel ? (
            <>
              <View style={[styles.sectionDivider, meetupTheme.divider]} />
              <View style={styles.openToGroup}>
                <Ionicons name="paw-outline" size={13} color={TITLE_SAGE} style={styles.openToPaw} />
                <Text style={styles.openToText} numberOfLines={1} allowFontScaling>
                  {chipLabel}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </Pressable>

      {actionVariant !== 'none' ? <View style={[styles.ctaDivider, meetupTheme.divider]} /> : null}
      {renderPrimaryButton()}

      <MeetupPetJoinSheet
        visible={joinSheetOpen}
        mode="join"
        meetup={meetup}
        onClose={() => setJoinSheetOpen(false)}
        onSuccess={handleJoinSheetSuccess}
      />
      <MeetupPetJoinSheet
        visible={leaveSheetOpen}
        mode="leave"
        meetup={meetup}
        onClose={() => setLeaveSheetOpen(false)}
        onSuccess={handleJoinSheetSuccess}
      />
    </View>
  );
}

function formatMeetupCardDate(date) {
  if (!date) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}

function timePartsToLabel(t) {
  if (t == null) {
    return '';
  }
  const s = String(t);
  const [hRaw, mRaw] = s.split(':');
  const h = parseInt(hRaw, 10);
  const m = parseInt(mRaw ?? '0', 10);
  if (Number.isNaN(h)) {
    return '';
  }
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return formatLocalTime(d);
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: theme.spacing.xl,
  },
  topLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: LABEL_SAGE,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardBodyPress: {
    alignSelf: 'stretch',
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 22,
    lineHeight: 26,
    color: TITLE_SAGE,
    marginBottom: 6,
  },
  titleJoined: {
    color: TITLE_JOINED,
  },
  locationBlock: {
    marginBottom: 6,
    gap: 1,
  },
  venueText: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 18,
  },
  cityText: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 18,
    color: LABEL_SAGE,
  },
  cityTextStandalone: {
    marginTop: 0,
  },
  distanceText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 15,
    color: TITLE_SAGE,
  },
  hostedByRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  hostedByIcon: {
    marginTop: 2,
  },
  hostedByText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
  },
  hostedByPrefix: {
    fontFamily: theme.fonts.body,
  },
  hostedByNames: {
    fontFamily: theme.fonts.semibold,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  scheduleCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  scheduleCopyPlaceholder: {
    flex: 1,
    minWidth: 0,
  },
  metaIcon: {
    marginTop: 2,
  },
  metaCopy: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  dateHeading: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    lineHeight: 19,
  },
  timeLine: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 17,
  },
  locationActionsPanel: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    minWidth: 84,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  directionsPressable: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  directionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  directionsLink: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 15,
    color: TITLE_SAGE,
  },
  participantsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantsText: {
    flexShrink: 1,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 18,
  },
  sectionDivider: {
    width: 1,
    height: 13,
    marginHorizontal: 2,
  },
  openToGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  openToPaw: {
    marginTop: 1,
  },
  openToText: {
    flexShrink: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    lineHeight: 18,
    color: TITLE_SAGE,
  },
  ctaDivider: {
    height: 1,
    marginTop: 10,
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: theme.borderRadius.full,
    backgroundColor: BUTTON_SAGE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  primaryButtonJoined: {
    borderWidth: 1,
  },
  primaryButtonFull: {
    borderWidth: 1,
  },
  primaryButtonHost: {
    borderWidth: 1,
  },
  primaryButtonText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.text.inverse.value,
  },
  primaryButtonTextJoined: {
    color: TITLE_SAGE,
  },
  primaryButtonTextFull: {
    fontFamily: theme.fonts.medium,
  },
  primaryButtonTextHost: {
    fontFamily: theme.fonts.medium,
    color: TITLE_SAGE,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
