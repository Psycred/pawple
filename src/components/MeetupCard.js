import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../config/theme';
import { useActivePet } from '../contexts/ActivePetContext';
import {
  extractMeetupHostPetIds,
  hasViewerJoinedMeetup,
  isDemoMeetupId,
} from '../services/meetups';
import { formatLocalTime, formatShortWeekday } from '../utils/formatMomentDate';
import { formatDistanceLabel } from '../utils/distanceUtils';
import MeetupPetJoinSheet from './MeetupPetJoinSheet';

const CARD_BG = '#FFFCF8';
const CARD_BORDER = '#F1E8DF';
const LABEL_SAGE = '#8EA88F';
const TITLE_SAGE = '#6E8E73';
const BODY_TEXT = '#4A403B';
const META_TEXT = '#6B625C';
const VISIBILITY_BG = '#EEF5EE';
const BUTTON_SAGE = '#9EB8A0';
const BUTTON_JOINED_BG = '#EEF5EE';
const TITLE_JOINED = '#9EB8A0';

const HOST_AVATAR_SIZE = 28;
const HOST_AVATAR_OVERLAP = -8;
const MAX_VISIBLE_HOSTS = 3;

/**
 * Gold-standard meetup card — one layout everywhere (feed, carousel, profile).
 * Parent controls width via the `style` prop; default is full width.
 *
 * @param {'rsvp' | 'going' | 'hosting'} [actionVariant='rsvp']
 * @param {(meetup: object) => void} [onManage]
 * @param {(meetup: object) => void} [onPress] — tap card body (excludes primary CTA)
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [style]
 * @param {Array<{ id: string }>} [viewerPets] — already-loaded pets owned by the viewer
 * @param {string|null} [viewerId] — signed-in viewer id
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

  const dateLine = useMemo(() => {
    if (!meetup?.date) {
      return '';
    }
    const d = new Date(`${String(meetup.date).split('T')[0]}T12:00:00`);
    const day = formatShortWeekday(d);
    const start = timePartsToLabel(meetup.start_time);
    const end = timePartsToLabel(meetup.end_time);
    return `${day} · ${start} – ${end}`;
  }, [meetup?.date, meetup?.end_time, meetup?.start_time]);

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

  // Honest omit when GPS/venue distance is missing — never invent a km figure.
  const distanceLabel = useMemo(() => {
    const fromRow = Number(meetup?.distanceKm ?? meetup?.distance_km);
    return formatDistanceLabel(Number.isFinite(fromRow) ? fromRow : null);
  }, [meetup?.distanceKm, meetup?.distance_km]);

  const limit = useMemo(() => {
    const raw = meetup?.participation_limit;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [meetup?.participation_limit]);

  const hostPets = useMemo(() => buildHostPets(meetup), [meetup]);

  const goingCount = useMemo(() => {
    return Number(meetup?.participant_count ?? 0) || 0;
  }, [meetup?.participant_count]);

  const participantsText =
    limit != null ? `${goingCount} / ${limit} pets joining` : `${goingCount} pets joining`;
  const isFull = limit != null && goingCount >= limit && !joined && !isHostPet;

  const hostPetsWithPhotos = hostPets.filter((host) => host.photo_url);
  const visibleHosts = hostPetsWithPhotos.slice(0, MAX_VISIBLE_HOSTS);
  const overflowHostCount =
    hostPetsWithPhotos.length > MAX_VISIBLE_HOSTS
      ? hostPetsWithPhotos.length - MAX_VISIBLE_HOSTS
      : 0;
  const hostNamesLine = useMemo(() => formatHostNamesLine(hostPets), [hostPets]);

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
    if (isHostPet && actionVariant !== 'hosting') {
      return (
        <View style={[styles.primaryButton, styles.primaryButtonHost]} accessibilityRole="text">
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
          disabled={false}
          style={({ pressed }) => [
            styles.primaryButton,
            styles.primaryButtonJoined,
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

    const buttonLabel = joined ? "You're Going" : isFull ? 'Event Full' : 'Count Us In';

    return (
      <Pressable
        onPress={handleRsvp}
        disabled={isFull}
        style={({ pressed }) => [
          styles.primaryButton,
          joined && !isFull && styles.primaryButtonJoined,
          isFull && styles.primaryButtonFull,
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
    <View style={[styles.card, style]} accessibilityRole="summary">
      <Pressable
        onPress={handleCardPress}
        style={({ pressed }) => [styles.cardBodyPress, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${meetup?.title || 'meetup'}`}
      >
        {meetup?.isPinned ? (
          <Text style={styles.topLabel} allowFontScaling>
            YOUR MEETUP
          </Text>
        ) : null}

        <Text
          style={[styles.title, joined && styles.titleJoined]}
          numberOfLines={2}
          allowFontScaling
        >
          {meetup?.title}
        </Text>

        {dateLine ? (
          <Text style={styles.dateTime} allowFontScaling>
            {dateLine}
          </Text>
        ) : null}

        {distanceLabel || chipLabel ? (
          <View style={styles.locationRow}>
            {distanceLabel ? (
              <Text style={styles.distanceText} numberOfLines={1} allowFontScaling>
                {distanceLabel}
              </Text>
            ) : (
              <View style={styles.distanceText} />
            )}
            {chipLabel ? (
              <View style={styles.visibilityChip}>
                <Text style={styles.visibilityChipText} numberOfLines={1} allowFontScaling>
                  {chipLabel}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {hostPets.length > 0 ? (
          <View style={styles.hostsSection}>
            <View style={styles.hostsRow}>
              {visibleHosts.length > 0 ? (
                <View style={styles.avatarStack}>
                  {visibleHosts.map((host, index) => (
                    <HostAvatar key={host.id} host={host} index={index} />
                  ))}
                  {overflowHostCount > 0 ? (
                    <View style={[styles.hostAvatar, styles.hostOverflowBadge, styles.hostAvatarOverlap]}>
                      <Text style={styles.hostOverflowText} allowFontScaling>
                        +{overflowHostCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {hostNamesLine ? (
                <Text style={styles.hostNames} numberOfLines={2} allowFontScaling>
                  {hostNamesLine}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <Text style={styles.participantsText} allowFontScaling>
          {`🐾 ${participantsText}`}
        </Text>
      </Pressable>

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

function HostAvatar({ host, index }) {
  const overlapStyle = index > 0 ? styles.hostAvatarOverlap : null;

  if (!host.photo_url) {
    return null;
  }

  return (
    <Image
      source={{ uri: host.photo_url }}
      style={[styles.hostAvatar, overlapStyle]}
      resizeMode="cover"
    />
  );
}

function buildHostPets(meetup) {
  const hostRows = meetup?.meetup_hosts ?? [];
  return hostRows
    .map((row, index) => ({
      id: String(row?.pet_id ?? index),
      name: String(row?.pets?.name ?? '').trim(),
      photo_url: row?.pets?.photo_url ?? null,
    }))
    .filter((host) => host.name);
}

function formatHostNamesLine(hostPets) {
  if (!hostPets.length) {
    return '';
  }
  if (hostPets.length <= MAX_VISIBLE_HOSTS) {
    return hostPets.map((host) => host.name).join(' • ');
  }
  const visibleNames = hostPets.slice(0, MAX_VISIBLE_HOSTS).map((host) => host.name);
  const overflow = hostPets.length - MAX_VISIBLE_HOSTS;
  return `${visibleNames.join(' • ')} • +${overflow}`;
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
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
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
  titlePress: {
    alignSelf: 'stretch',
  },
  cardBodyPress: {
    alignSelf: 'stretch',
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 22,
    lineHeight: 28,
    color: TITLE_SAGE,
    marginBottom: 10,
  },
  titleJoined: {
    color: TITLE_JOINED,
  },
  dateTime: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    color: BODY_TEXT,
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  distanceText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: LABEL_SAGE,
  },
  visibilityChip: {
    flexShrink: 0,
    backgroundColor: VISIBILITY_BG,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  visibilityChipText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: TITLE_SAGE,
  },
  hostsSection: {
    marginBottom: 16,
  },
  hostsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostAvatar: {
    width: HOST_AVATAR_SIZE,
    height: HOST_AVATAR_SIZE,
    borderRadius: HOST_AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: CARD_BG,
  },
  hostAvatarOverlap: {
    marginLeft: HOST_AVATAR_OVERLAP,
  },
  hostAvatarFallback: {
    backgroundColor: VISIBILITY_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarInitial: {
    fontFamily: theme.fonts.medium,
    fontSize: 11,
    color: TITLE_SAGE,
  },
  hostOverflowBadge: {
    backgroundColor: VISIBILITY_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostOverflowText: {
    fontFamily: theme.fonts.medium,
    fontSize: 10,
    color: TITLE_SAGE,
  },
  hostNames: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    lineHeight: 20,
    color: BODY_TEXT,
  },
  participantsText: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: META_TEXT,
    marginBottom: 22,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: BUTTON_SAGE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  primaryButtonJoined: {
    backgroundColor: BUTTON_JOINED_BG,
    borderWidth: 1,
    borderColor: BUTTON_SAGE,
  },
  primaryButtonFull: {
    backgroundColor: theme.colors.background.screen,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  primaryButtonHost: {
    backgroundColor: theme.colors.background.screen,
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
    color: META_TEXT,
  },
  primaryButtonTextHost: {
    fontFamily: theme.fonts.medium,
    color: TITLE_SAGE,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
