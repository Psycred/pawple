import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MeetupDetailsSkeleton from '../components/MeetupDetailsSkeleton';
import MeetupPetJoinSheet from '../components/MeetupPetJoinSheet';
import ParticipantModal from '../components/ParticipantModal';
import ContentSafetyMenu from '../components/ContentSafetyMenu';
import ReportSheet from '../components/ReportSheet';
import BlockConfirmSheet from '../components/BlockConfirmSheet';
import CancelMeetupConfirmModal from '../components/CancelMeetupConfirmModal';
import ScreenWrapper from '../components/ScreenWrapper';
import { theme } from '../config/theme';
import { isDemoContentEnabled } from '../config/environment';
import { supabase } from '../config/supabase';
import { useActivePet } from '../contexts/ActivePetContext';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import {
  applyDemoMeetupRsvp,
  cancelDemoMeetup,
} from '../data/demoMeetupRsvp';
import { shareMeetupWithPreview } from '../utils/shareFeedPost';
import MeetupCard from '../components/MeetupCard';
import { fetchBlockedPetIds, isBlockedByPetIds } from '../services/blocks';
import {
  cancelMeetup,
  extractMeetupHostPetIds,
  extractVisibleMeetupHostPetIds,
  extractVisibleMeetupParticipantPets,
  extractViewerJoinedPetIds,
  fetchMeetupById,
  getMeetupParticipantDisplayCount,
  hasViewerJoinedMeetup,
  isDemoMeetupId,
  isMeetupPast,
  normalizeMeetupRow,
} from '../services/meetups';
import {
  formatDayMonthYear,
  formatLocalTime,
  formatSmartMeetupDay,
  parseTimeOnDate,
} from '../utils/formatMomentDate';
import { extractHostPetNames, formatHostPetNames } from '../utils/meetupHostDisplay';
import { buildMeetupShareCaption } from '../utils/meetupShareCopy';
import { formatCityBadge } from '../utils/cityUtils';

const SAGE = '#9EB8A0';
const MEETUP_LABEL_ACCENT = '#8EA88F';
const CANCEL_EVENT = '#FF3B30';

const AVATAR_SIZE = 36;

function HeaderIconButton({ name, label, onPress, color }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={name} size={22} color={color} />
    </Pressable>
  );
}

function DetailSection({ label, children, labelColor }) {
  return (
    <View style={styles.detailSection}>
      <Text style={[styles.detailLabel, { color: labelColor }]} allowFontScaling>
        {label}
      </Text>
      {children}
    </View>
  );
}

function PetAvatar({ pet, style, surfaces }) {
  const avatarStyle = [styles.avatar, { borderColor: surfaces.meetupCardBackground }, style];

  if (pet?.photo_url) {
    return (
      <Image
        source={{ uri: pet.photo_url }}
        style={avatarStyle}
        resizeMode="cover"
      />
    );
  }

  const initial = pet?.name?.charAt(0)?.toUpperCase() ?? '?';
  return (
    <View
      style={[
        avatarStyle,
        styles.avatarFallback,
        { backgroundColor: surfaces.meetupChipBackground },
      ]}
    >
      <Text style={styles.avatarInitial} allowFontScaling>
        {initial}
      </Text>
    </View>
  );
}

/**
 * Central hub for a single meetup â€” details, RSVP, and participant preview.
 */
export default function MeetupDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { activePetId } = useActivePet();
  const surfaces = useRuntimeThemeColors();

  // MeetupDetailsScreen lives on the root stack â€” parent navigate matches other meetup flows.
  const stackNavigation = useMemo(
    () => navigation.getParent?.() ?? navigation,
    [navigation],
  );

  const meetupId = route?.params?.meetupId ?? route?.params?.meetup?.id;
  const seedMeetup = route?.params?.meetup ?? null;

  const [meetup, setMeetup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [ownedPetIds, setOwnedPetIds] = useState([]);
  const [viewerPets, setViewerPets] = useState([]);
  const [hasJoined, setHasJoined] = useState(false);
  const shareCardRef = React.useRef(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [safetyMenuOpen, setSafetyMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockPetTarget, setBlockPetTarget] = useState(null);
  const [blockedPetIds, setBlockedPetIds] = useState(() => new Set());

  const loadMeetup = useCallback(async () => {
    setLoading(true);
    setError(false);
    let viewerPets = [];

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      let nextOwnedPetIds = [];

      if (user?.id) {
        const [petsRes, blockedIds] = await Promise.all([
          supabase
            .from('pets')
            .select('id, name, photo_url, breed, pet_type')
            .eq('owner_id', user.id),
          fetchBlockedPetIds().catch((err) => {
            console.error('[Supabase]', err);
            return [];
          }),
        ]);
        viewerPets = petsRes.data ?? [];
        nextOwnedPetIds = viewerPets.map((p) => String(p.id));
        setViewerPets(viewerPets);
        setOwnedPetIds(nextOwnedPetIds);
        setBlockedPetIds(new Set((blockedIds ?? []).map(String)));
      } else {
        setOwnedPetIds([]);
        setBlockedPetIds(new Set());
      }

      let row = null;

      const isBlockedDemoMeetup =
        !isDemoContentEnabled &&
        (isDemoMeetupId(meetupId) || isDemoMeetupId(seedMeetup?.id));

      if (isBlockedDemoMeetup) {
        setMeetup(null);
        setError(true);
        return;
      }

      if (meetupId && !isDemoMeetupId(meetupId)) {
        row = await fetchMeetupById(meetupId);
      }

      if (!row && seedMeetup) {
        row = normalizeMeetupRow(seedMeetup);
      }

      if (__DEV__ && row && isDemoMeetupId(row.id)) {
        row = applyDemoMeetupRsvp(row, viewerPets);
      }

      if (!row) {
        setMeetup(null);
        setError(true);
        return;
      }

      setMeetup(row);

      const joinedPetIds = extractViewerJoinedPetIds(row, nextOwnedPetIds);
      setHasJoined(
        joinedPetIds.length > 0 ||
          Boolean(row?.viewer_joined) ||
          hasViewerJoinedMeetup(row, nextOwnedPetIds),
      );
    } catch (err) {
      console.error('[MeetupDetails]', err);
      const canUseSeedFallback =
        seedMeetup && (isDemoContentEnabled || !isDemoMeetupId(seedMeetup?.id));

      if (canUseSeedFallback) {
        const normalized = normalizeMeetupRow(seedMeetup);
        const row =
          __DEV__ && isDemoMeetupId(normalized.id)
            ? applyDemoMeetupRsvp(normalized, viewerPets)
            : normalized;
        setMeetup(row);
        setError(false);
      } else {
        setMeetup(null);
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [meetupId, seedMeetup]);

  useEffect(() => {
    loadMeetup();
  }, [loadMeetup]);

  const participantPets = useMemo(
    () => (meetup ? extractVisibleMeetupParticipantPets(meetup, blockedPetIds) : []),
    [blockedPetIds, meetup],
  );

  const hostPetIds = useMemo(
    () => extractVisibleMeetupHostPetIds(meetup ?? {}, blockedPetIds),
    [blockedPetIds, meetup],
  );

  const isCreator = Boolean(
    currentUserId && meetup?.user_id && String(meetup.user_id) === String(currentUserId),
  );

  const isHostOwner = useMemo(
    () => hostPetIds.some((id) => ownedPetIds.includes(String(id))),
    [hostPetIds, ownedPetIds],
  );

  const isCreatorOrHost = isCreator || isHostOwner;

  const isActivePetHost = Boolean(
    activePetId && hostPetIds.some((id) => String(id) === String(activePetId)),
  );

  const status = meetup?.status ?? 'upcoming';
  const isCancelled = status === 'cancelled';
  const isPast = isMeetupPast(meetup) || status === 'completed';

  const visibleParticipantCount = participantPets.length;

  const serverParticipantCount = useMemo(() => {
    return Number(meetup?.participant_count ?? 0) || 0;
  }, [meetup?.participant_count]);

  const displayParticipantCount = useMemo(
    () => getMeetupParticipantDisplayCount(meetup, visibleParticipantCount),
    [meetup, visibleParticipantCount],
  );

  const limit = useMemo(() => {
    const n = Number(meetup?.participation_limit);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [meetup?.participation_limit]);

  const isFull =
    limit != null &&
    serverParticipantCount >= limit &&
    !hasJoined &&
    !isActivePetHost;

  const openToLabel = useMemo(() => {
    const openTo = meetup?.open_to;
    if (openTo === 'Please Specify' || openTo === 'Breed Specific') {
      return meetup?.custom_breed_spec?.trim() || openTo;
    }
    return openTo || 'Open to All';
  }, [meetup]);

  const hostNamesLine = useMemo(() => {
    const visibleHostIds = new Set(hostPetIds.map(String));
    const visibleHosts = (meetup?.meetup_hosts ?? []).filter((row) => {
      const id = String(row?.pet_id ?? row?.pets?.id ?? '');
      return id && visibleHostIds.has(id);
    });
    const names = extractHostPetNames(visibleHosts);
    return formatHostPetNames(names);
  }, [hostPetIds, meetup?.meetup_hosts]);

  const blockableHostPets = useMemo(() => {
    const owned = new Set(ownedPetIds.map(String));
    return (meetup?.meetup_hosts ?? [])
      .map((row) => {
        const pet = row?.pets ?? null;
        const id = String(row?.pet_id ?? pet?.id ?? '');
        if (!id || owned.has(id) || blockedPetIds.has(id)) {
          return null;
        }
        return {
          id,
          name: pet?.name || 'Pet',
        };
      })
      .filter(Boolean);
  }, [blockedPetIds, meetup?.meetup_hosts, ownedPetIds]);

  const canReportMeetup = Boolean(
    meetup?.id &&
      meetup?.user_id &&
      currentUserId &&
      String(meetup.user_id) !== String(currentUserId),
  );

  const whenDay = useMemo(
    () => formatSmartMeetupDay(meetup?.date),
    [meetup?.date],
  );

  const whenTime = useMemo(() => {
    const start = parseTimeOnDate(meetup?.date, meetup?.start_time);
    const end = parseTimeOnDate(meetup?.date, meetup?.end_time);
    if (!start || !end) {
      return '';
    }
    return `${formatLocalTime(start)} â€“ ${formatLocalTime(end)}`;
  }, [meetup?.date, meetup?.end_time, meetup?.start_time]);

  const locationText =
    meetup?.location_name?.trim() ||
    meetup?.location?.trim() ||
    (meetup?.google_maps_link ? 'See map link below' : 'Location to be shared');

  const descriptionText = meetup?.description?.trim() || '';

  const cityLabel = useMemo(() => formatCityBadge(meetup?.city), [meetup?.city]);

  const previewPets = participantPets.slice(0, 3);

  const handlePetBlocked = useCallback(
    (pet) => {
      const petId = String(pet?.id ?? '');
      if (!petId) {
        return;
      }
      setBlockedPetIds((prev) => {
        const next = new Set(prev);
        next.add(petId);
        return next;
      });
      setBlockPetTarget(null);
      setParticipantsOpen(false);
      const hostIds = extractMeetupHostPetIds(meetup ?? {});
      if (isBlockedByPetIds(hostIds, [...blockedPetIds, petId])) {
        navigation.goBack();
      }
    },
    [blockedPetIds, meetup, navigation],
  );

  useEffect(() => {
    if (loading || !meetup) {
      return;
    }
    const hostIds = extractMeetupHostPetIds(meetup);
    if (hostIds.length > 0 && isBlockedByPetIds(hostIds, blockedPetIds)) {
      navigation.goBack();
    }
  }, [blockedPetIds, loading, meetup, navigation]);

  const ctaState = useMemo(() => {
    if (isCancelled) {
      return { label: 'Cancelled', disabled: true, variant: 'disabled' };
    }
    if (isPast) {
      return { label: 'Event Ended', disabled: true, variant: 'disabled' };
    }
    if (isCreatorOrHost) {
      return { label: 'Cancel Event', disabled: false, variant: 'cancelEvent' };
    }
    if (isFull) {
      return { label: 'Event Full', disabled: true, variant: 'disabled' };
    }
    if (hasJoined) {
      return { label: "You're Going", disabled: false, variant: 'joined' };
    }
    return { label: 'Count Us In', disabled: false, variant: 'primary' };
  }, [hasJoined, isCancelled, isCreatorOrHost, isFull, isPast]);

  const shareDateLabel = useMemo(() => {
    const smart = formatSmartMeetupDay(meetup?.date);
    if (smart) {
      return smart;
    }
    if (meetup?.date) {
      const d = new Date(`${String(meetup.date).split('T')[0]}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        return formatDayMonthYear(d);
      }
    }
    return 'soon';
  }, [meetup?.date]);

  const handleShare = useCallback(async () => {
    if (!meetup?.id || !shareCardRef.current) {
      return;
    }

    const shareMessage = buildMeetupShareCaption({
      meetup,
      ownedPetIds,
      activePetId,
      viewerPets,
      shareDateLabel,
    });

    try {
      await shareMeetupWithPreview({
        caption: shareMessage,
        meetupId: meetup.id,
        captureRefTarget: shareCardRef,
        userId: currentUserId,
      });
    } catch (err) {
      console.warn('[MeetupDetails] share failed', err);
      Alert.alert('Share', 'Could not open the share sheet right now.');
    }
  }, [
    activePetId,
    currentUserId,
    meetup,
    ownedPetIds,
    shareDateLabel,
    viewerPets,
  ]);

  const handleEdit = useCallback(() => {
    const id = meetup?.id;
    if (!id) {
      return;
    }

    // CreateMeetupScreen exists; EditMeetupScreen does not. Edit pre-fill is not implemented yet.
    const canNavigateToEdit = !isDemoMeetupId(id);

    if (canNavigateToEdit) {
      stackNavigation.navigate('CreateMeetupScreen', {
        meetupId: id,
        isEditing: true,
        meetup,
      });
      return;
    }

    console.log('Navigate to Edit Screen for meetup:', id);
    Alert.alert('Edit functionality is coming soon.');
  }, [meetup, stackNavigation]);

  const handleOpenMaps = () => {
    const url = meetup?.google_maps_link;
    if (!url) {
      return;
    }
    Linking.openURL(url).catch((err) => {
      console.warn('[MeetupDetails] maps open failed', err);
    });
  };

  const handleJoinSheetSuccess = ({ meetup: refreshedMeetup }) => {
    if (!refreshedMeetup) {
      return;
    }

    setMeetup(refreshedMeetup);
    const nextJoined = extractViewerJoinedPetIds(refreshedMeetup, ownedPetIds);
    setHasJoined(nextJoined.length > 0);
  };

  const handleLeave = () => {
    setLeaveSheetOpen(true);
  };

  const handleCancelEvent = () => {
    setCancelConfirmOpen(true);
  };

  const confirmCancelEvent = useCallback(async () => {
    if (!meetup?.id) {
      Alert.alert('Meetup', 'Could not cancel this meetup.');
      setCancelConfirmOpen(false);
      return;
    }
    if (isDemoMeetupId(meetup.id)) {
      setMeetup(cancelDemoMeetup(meetup));
      setCancelConfirmOpen(false);
      return;
    }
    setRsvpBusy(true);
    try {
      await cancelMeetup(meetup.id);
      const row = await fetchMeetupById(meetup.id);
      setMeetup(row ?? { ...meetup, status: 'cancelled' });
      setCancelConfirmOpen(false);
    } catch (err) {
      console.error('[MeetupDetails] cancel event failed', err);
      Alert.alert('Meetup', err?.message || 'Could not cancel this event.');
    } finally {
      setRsvpBusy(false);
    }
  }, [meetup]);

  const handleCtaPress = () => {
    if (ctaState.disabled || rsvpBusy) {
      return;
    }
    if (ctaState.variant === 'cancelEvent') {
      handleCancelEvent();
      return;
    }
    if (ctaState.variant === 'joined') {
      if (__DEV__ && isDemoMeetupId(meetup?.id)) {
        setJoinSheetOpen(true);
      } else {
        handleLeave();
      }
      return;
    }
    if (ownedPetIds.length === 0) {
      Alert.alert('Meetup', 'Add a pet to your profile first.');
      return;
    }
    setJoinSheetOpen(true);
  };

  const headerRight = (
    <View style={styles.headerActions}>
      <HeaderIconButton
        name="share-2"
        label="Share meetup"
        onPress={handleShare}
        color={surfaces.profileHeroNameColor}
      />
      {isCreatorOrHost ? (
        <HeaderIconButton
          name="edit-2"
          label="Edit meetup"
          onPress={handleEdit}
          color={surfaces.profileHeroNameColor}
        />
      ) : null}
      {canReportMeetup || blockableHostPets.length > 0 ? (
        <HeaderIconButton
          name="more-horizontal"
          label="More"
          onPress={() => setSafetyMenuOpen(true)}
          color={surfaces.profileHeroNameColor}
        />
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <ScreenWrapper
        showBackButton
        onClose={() => stackNavigation.goBack()}
        headerRight={headerRight}
        backgroundColor={surfaces.meetupCardBackground}
        padded
      >
        <MeetupDetailsSkeleton />
      </ScreenWrapper>
    );
  }

  if (error || !meetup) {
    return (
      <ScreenWrapper
        showBackButton
        onClose={() => stackNavigation.goBack()}
        backgroundColor={surfaces.meetupCardBackground}
        padded
      >
        <View style={styles.notFoundWrap}>
          <Text style={[styles.notFoundTitle, { color: surfaces.profileHeroNameColor }]} allowFontScaling>
            Meetup not found
          </Text>
          <Text style={[styles.notFoundBody, { color: surfaces.meetupMetaText }]} allowFontScaling>
            This meetup may have been removed or is unavailable.
          </Text>
          <Pressable
            onPress={() => stackNavigation.goBack()}
            style={({ pressed }) => [styles.notFoundButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.notFoundButtonText} allowFontScaling>
              Go Back
            </Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper
      showBackButton
      onClose={() => stackNavigation.goBack()}
      headerRight={headerRight}
      backgroundColor={surfaces.meetupCardBackground}
      contentStyle={styles.screenContent}
    >
      <View
        pointerEvents="none"
        style={styles.shareCaptureHost}
      >
        <View ref={shareCardRef} collapsable={false}>
          <MeetupCard
            meetup={meetup}
            viewerPets={viewerPets}
            viewerId={currentUserId}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 120 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isCancelled ? (
          <View
            style={[
              styles.cancelBanner,
              {
                backgroundColor: surfaces.backgroundCard,
                borderColor: surfaces.meetupCardBorder,
              },
            ]}
          >
            <Text style={styles.cancelBannerLabel} allowFontScaling>
              Cancelled
            </Text>
            <Text style={[styles.cancelBannerText, { color: surfaces.meetupMetaText }]} allowFontScaling>
              {isCreatorOrHost
                ? 'You cancelled this meetup.'
                : 'This meetup was cancelled.'}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.title, { color: surfaces.profileHeroNameColor }]} allowFontScaling>
          {meetup.title}
        </Text>

        <View style={styles.metaRow}>
          {cityLabel ? (
            <Text style={styles.cityText} allowFontScaling>
              {cityLabel}
            </Text>
          ) : (
            <View style={styles.cityText} />
          )}
          {openToLabel ? (
            <View style={[styles.openToChip, { backgroundColor: surfaces.meetupChipBackground }]}>
              <Text style={styles.openToChipText} numberOfLines={1} allowFontScaling>
                {openToLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {hostNamesLine ? (
          <Text style={[styles.hostedBy, { color: surfaces.profileHeroNameColor }]} allowFontScaling>
            {`Hosted by ${hostNamesLine}`}
          </Text>
        ) : null}

        <View style={styles.participantsSection}>
          {displayParticipantCount === 0 ? (
            <Text style={[styles.emptyParticipants, { color: surfaces.profileHeroBioColor }]} allowFontScaling>
              Be the first to join!
            </Text>
          ) : (
            <Text style={[styles.participantsCount, { color: surfaces.meetupMetaText }]} allowFontScaling>
              {`${displayParticipantCount}${limit != null ? ` / ${limit}` : ''} pets joining`}
            </Text>
          )}

          {previewPets.length > 0 ? (
            <View style={styles.avatarRow}>
              {previewPets.map((pet, index) => (
                <PetAvatar
                  key={String(pet.id)}
                  pet={pet}
                  surfaces={surfaces}
                  style={index > 0 ? styles.avatarOverlap : null}
                />
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={() => setParticipantsOpen(true)}
            style={({ pressed }) => [styles.seeAllButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="See all participants"
          >
            <Text style={styles.seeAllText} allowFontScaling>
              See all
            </Text>
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: surfaces.meetupCardBorder }]} />

        <DetailSection label="WHEN" labelColor={surfaces.profileHeroBioColor}>
          <Text style={[styles.detailPrimary, { color: surfaces.profileHeroNameColor }]} allowFontScaling>
            {whenDay}
          </Text>
          {whenTime ? (
            <Text style={[styles.detailSecondary, { color: surfaces.meetupMetaText }]} allowFontScaling>
              {whenTime}
            </Text>
          ) : null}
        </DetailSection>

        <DetailSection label="WHERE" labelColor={surfaces.profileHeroBioColor}>
          <Text style={[styles.detailPrimary, { color: surfaces.profileHeroNameColor }]} allowFontScaling>
            {locationText}
          </Text>
          {meetup.google_maps_link ? (
            <Pressable onPress={handleOpenMaps} accessibilityRole="link">
              <Text style={styles.mapsLink} allowFontScaling>
                Open in Maps
              </Text>
            </Pressable>
          ) : null}
        </DetailSection>

        <DetailSection label="ABOUT" labelColor={surfaces.profileHeroBioColor}>
          {descriptionText ? (
            <Text style={[styles.detailSecondary, { color: surfaces.meetupMetaText }]} allowFontScaling>
              {descriptionText}
            </Text>
          ) : (
            <Text style={[styles.detailEmpty, { color: surfaces.profileHeroBioColor }]} allowFontScaling>
              No description provided
            </Text>
          )}
        </DetailSection>
      </ScrollView>

      <View
        style={[
          styles.ctaBar,
          {
            backgroundColor: surfaces.meetupCardBackground,
            borderTopColor: surfaces.meetupCardBorder,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          onPress={handleCtaPress}
          disabled={ctaState.disabled || rsvpBusy}
          style={({ pressed }) => [
            styles.ctaButton,
            ctaState.variant === 'primary' && styles.ctaPrimary,
            ctaState.variant === 'joined' && styles.ctaPrimary,
            ctaState.variant === 'disabled' && {
              backgroundColor: surfaces.meetupDisabledButtonBackground,
            },
            ctaState.variant === 'cancelEvent' && styles.ctaCancelEvent,
            pressed && !ctaState.disabled && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: ctaState.disabled }}
        >
          <Text
            style={[
              styles.ctaText,
              (ctaState.variant === 'primary' || ctaState.variant === 'joined') && styles.ctaTextPrimary,
              ctaState.variant === 'disabled' && {
                color: surfaces.profileHeroBioColor,
                fontFamily: theme.fonts.medium,
              },
              ctaState.variant === 'cancelEvent' && styles.ctaTextCancelEvent,
            ]}
            allowFontScaling
          >
            {ctaState.label}
          </Text>
        </Pressable>
      </View>

      <ParticipantModal
        visible={participantsOpen}
        count={displayParticipantCount}
        participants={participantPets}
        ownedPetIds={ownedPetIds}
        onBlockPet={(pet) => {
          setParticipantsOpen(false);
          setBlockPetTarget({
            id: pet.id,
            name: pet.name || 'Pet',
          });
        }}
        onClose={() => setParticipantsOpen(false)}
      />

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

      <ContentSafetyMenu
        visible={safetyMenuOpen}
        title="Meetup"
        showReport={canReportMeetup}
        showBlock={blockableHostPets.length > 0}
        blockLabel={
          blockableHostPets.length === 1
            ? `Block ${blockableHostPets[0].name}`
            : 'Block host'
        }
        onReport={() => {
          setSafetyMenuOpen(false);
          setReportOpen(true);
        }}
        onBlock={() => {
          setSafetyMenuOpen(false);
          setBlockPetTarget(blockableHostPets[0] ?? null);
        }}
        onClose={() => setSafetyMenuOpen(false)}
      />

      <ReportSheet
        visible={reportOpen}
        targetType="meetup"
        targetId={meetup?.id}
        reportedUserId={meetup?.user_id}
        blockablePets={blockableHostPets}
        onClose={() => setReportOpen(false)}
      />

      <BlockConfirmSheet
        visible={Boolean(blockPetTarget)}
        pet={blockPetTarget}
        onClose={() => setBlockPetTarget(null)}
        onBlocked={handlePetBlocked}
      />

      <CancelMeetupConfirmModal
        visible={cancelConfirmOpen}
        busy={rsvpBusy}
        onClose={() => {
          if (!rsvpBusy) {
            setCancelConfirmOpen(false);
          }
        }}
        onConfirm={confirmCancelEvent}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  shareCaptureHost: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: '100%',
  },
  screenContent: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBanner: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 24,
  },
  cancelBannerLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: MEETUP_LABEL_ACCENT,
    marginBottom: 6,
  },
  cancelBannerText: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 24,
    lineHeight: 30,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  cityText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: SAGE,
  },
  openToChip: {
    flexShrink: 0,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  openToChipText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: SAGE,
  },
  hostedBy: {
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  participantsSection: {
    marginBottom: 24,
  },
  participantsCount: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  emptyParticipants: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    color: SAGE,
  },
  seeAllButton: {
    alignSelf: 'flex-start',
  },
  seeAllText: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: SAGE,
  },
  divider: {
    height: 1,
    marginBottom: 24,
  },
  detailSection: {
    marginBottom: 28,
  },
  detailLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  detailPrimary: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    lineHeight: 24,
  },
  detailSecondary: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 4,
  },
  detailEmpty: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  mapsLink: {
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    color: SAGE,
    marginTop: 8,
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaButton: {
    minHeight: 52,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ctaPrimary: {
    backgroundColor: SAGE,
  },
  ctaCancelEvent: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: CANCEL_EVENT,
  },
  ctaText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  ctaTextPrimary: {
    color: '#FFFFFF',
  },
  ctaTextCancelEvent: {
    color: CANCEL_EVENT,
  },
  notFoundWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  notFoundTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: 20,
    lineHeight: 26,
    marginBottom: 8,
    textAlign: 'center',
  },
  notFoundBody: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  notFoundButton: {
    minHeight: 48,
    paddingHorizontal: 28,
    borderRadius: theme.borderRadius.full,
    backgroundColor: SAGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundButtonText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
