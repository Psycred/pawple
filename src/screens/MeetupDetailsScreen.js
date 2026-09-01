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
import ScreenWrapper from '../components/ScreenWrapper';
import { theme } from '../config/theme';
import { isDemoContentEnabled } from '../config/environment';
import { supabase } from '../config/supabase';
import { useActivePet } from '../contexts/ActivePetContext';
import {
  applyDemoMeetupRsvp,
  cancelDemoMeetup,
} from '../data/demoMeetupRsvp';
import { buildMeetupShareMessage } from '../lib/shareUtils';
import {
  cancelMeetup,
  extractMeetupHostPetIds,
  extractMeetupParticipantPets,
  extractViewerJoinedPetIds,
  fetchMeetupById,
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
import { formatCityBadge } from '../utils/cityUtils';

const SCREEN_BG = '#FFFCF8';
const PRIMARY_TEXT = '#3A312E';
const SECONDARY_TEXT = '#6B625C';
const MUTED_TEXT = '#888888';
const DIVIDER = '#F1E8DF';
const SAGE = '#9EB8A0';
const SAGE_CHIP_BG = '#EEF5EE';
const CANCEL_BANNER_BG = '#FDECEC';
const CANCEL_BANNER_TEXT = '#B84A4A';
const DISABLED_BG = '#E5E5E5';
const DISABLED_TEXT = '#888888';
const CANCEL_EVENT = '#FF3B30';

const AVATAR_SIZE = 36;

function HeaderIconButton({ name, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={name} size={22} color={PRIMARY_TEXT} />
    </Pressable>
  );
}

function DetailSection({ label, children }) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailLabel} allowFontScaling>
        {label}
      </Text>
      {children}
    </View>
  );
}

function PetAvatar({ pet, style }) {
  if (pet?.photo_url) {
    return (
      <Image
        source={{ uri: pet.photo_url }}
        style={[styles.avatar, style]}
        resizeMode="cover"
      />
    );
  }

  const initial = pet?.name?.charAt(0)?.toUpperCase() ?? '?';
  return (
    <View style={[styles.avatar, styles.avatarFallback, style]}>
      <Text style={styles.avatarInitial} allowFontScaling>
        {initial}
      </Text>
    </View>
  );
}

/**
 * Central hub for a single meetup — details, RSVP, and participant preview.
 */
export default function MeetupDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { activePetId } = useActivePet();

  // MeetupDetailsScreen lives on the root stack — parent navigate matches other meetup flows.
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
  const [hasJoined, setHasJoined] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [safetyMenuOpen, setSafetyMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockPetTarget, setBlockPetTarget] = useState(null);

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
        const { data: pets } = await supabase
          .from('pets')
          .select('id, name, photo_url, breed, pet_type')
          .eq('owner_id', user.id);
        viewerPets = pets ?? [];
        nextOwnedPetIds = viewerPets.map((p) => String(p.id));
        setOwnedPetIds(nextOwnedPetIds);
      } else {
        setOwnedPetIds([]);
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
    () => (meetup ? extractMeetupParticipantPets(meetup) : []),
    [meetup],
  );

  const hostPetIds = useMemo(() => extractMeetupHostPetIds(meetup ?? {}), [meetup]);

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

  const participantCount = useMemo(() => {
    return Number(meetup?.participant_count ?? 0) || 0;
  }, [meetup?.participant_count]);

  const limit = useMemo(() => {
    const n = Number(meetup?.participation_limit);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [meetup?.participation_limit]);

  const isFull =
    limit != null && participantCount >= limit && !hasJoined && !isActivePetHost;

  const openToLabel = useMemo(() => {
    const openTo = meetup?.open_to;
    if (openTo === 'Please Specify' || openTo === 'Breed Specific') {
      return meetup?.custom_breed_spec?.trim() || openTo;
    }
    return openTo || 'Open to All';
  }, [meetup]);

  const hostNamesLine = useMemo(() => {
    const names = extractHostPetNames(meetup?.meetup_hosts ?? []);
    return formatHostPetNames(names);
  }, [meetup]);

  const blockableHostPets = useMemo(() => {
    const owned = new Set(ownedPetIds.map(String));
    return (meetup?.meetup_hosts ?? [])
      .map((row) => {
        const pet = row?.pets ?? null;
        const id = String(row?.pet_id ?? pet?.id ?? '');
        if (!id || owned.has(id)) {
          return null;
        }
        return {
          id,
          name: pet?.name || 'Pet',
        };
      })
      .filter(Boolean);
  }, [meetup?.meetup_hosts, ownedPetIds]);

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
    return `${formatLocalTime(start)} – ${formatLocalTime(end)}`;
  }, [meetup?.date, meetup?.end_time, meetup?.start_time]);

  const locationText =
    meetup?.location_name?.trim() ||
    meetup?.location?.trim() ||
    (meetup?.google_maps_link ? 'See map link below' : 'Location to be shared');

  const descriptionText = meetup?.description?.trim() || '';

  const cityLabel = useMemo(() => formatCityBadge(meetup?.city), [meetup?.city]);

  const previewPets = participantPets.slice(0, 3);

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
    if (!meetup) {
      return;
    }

    const shareMessage = buildMeetupShareMessage(meetup.title, shareDateLabel);

    try {
      await Share.share({ message: shareMessage });
    } catch (err) {
      console.warn('[MeetupDetails] share failed', err);
      Alert.alert('Share', 'Could not open the share sheet right now.');
    }
  }, [meetup, shareDateLabel]);

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
    Alert.alert(
      'Cancel meetup?',
      "It will be removed from everyone's plans.",
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, cancel',
          style: 'destructive',
          onPress: async () => {
            if (!meetup?.id) {
              Alert.alert('Meetup', 'Could not cancel this meetup.');
              return;
            }
            if (isDemoMeetupId(meetup.id)) {
              setMeetup(cancelDemoMeetup(meetup));
              return;
            }
            setRsvpBusy(true);
            try {
              await cancelMeetup(meetup.id);
              const row = await fetchMeetupById(meetup.id);
              setMeetup(row ?? { ...meetup, status: 'cancelled' });
            } catch (err) {
              console.error('[MeetupDetails] cancel event failed', err);
              Alert.alert('Meetup', err?.message || 'Could not cancel this event.');
            } finally {
              setRsvpBusy(false);
            }
          },
        },
      ],
    );
  };

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
      <HeaderIconButton name="share-2" label="Share meetup" onPress={handleShare} />
      {isCreatorOrHost ? (
        <HeaderIconButton name="edit-2" label="Edit meetup" onPress={handleEdit} />
      ) : null}
      {canReportMeetup || blockableHostPets.length > 0 ? (
        <HeaderIconButton
          name="more-horizontal"
          label="More"
          onPress={() => setSafetyMenuOpen(true)}
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
        backgroundColor={SCREEN_BG}
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
        backgroundColor={SCREEN_BG}
        padded
      >
        <View style={styles.notFoundWrap}>
          <Text style={styles.notFoundTitle} allowFontScaling>
            Meetup not found
          </Text>
          <Text style={styles.notFoundBody} allowFontScaling>
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
      backgroundColor={SCREEN_BG}
      contentStyle={styles.screenContent}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 120 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isCancelled ? (
          <View style={styles.cancelBanner}>
            <Text style={styles.cancelBannerText} allowFontScaling>
              This event was cancelled by the host.
            </Text>
          </View>
        ) : null}

        <Text style={styles.title} allowFontScaling>
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
            <View style={styles.openToChip}>
              <Text style={styles.openToChipText} numberOfLines={1} allowFontScaling>
                {openToLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {hostNamesLine ? (
          <Text style={styles.hostedBy} allowFontScaling>
            {`Hosted by ${hostNamesLine}`}
          </Text>
        ) : null}

        <View style={styles.participantsSection}>
          {participantCount === 0 ? (
            <Text style={styles.emptyParticipants} allowFontScaling>
              Be the first to join!
            </Text>
          ) : (
            <Text style={styles.participantsCount} allowFontScaling>
              {`🐾 ${participantCount}${limit != null ? ` / ${limit}` : ''} pets joining`}
            </Text>
          )}

          {previewPets.length > 0 ? (
            <View style={styles.avatarRow}>
              {previewPets.map((pet, index) => (
                <PetAvatar
                  key={String(pet.id)}
                  pet={pet}
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

        <View style={styles.divider} />

        <DetailSection label="WHEN">
          <Text style={styles.detailPrimary} allowFontScaling>
            {whenDay}
          </Text>
          {whenTime ? (
            <Text style={styles.detailSecondary} allowFontScaling>
              {whenTime}
            </Text>
          ) : null}
        </DetailSection>

        <DetailSection label="WHERE">
          <Text style={styles.detailPrimary} allowFontScaling>
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

        <DetailSection label="ABOUT">
          {descriptionText ? (
            <Text style={styles.detailSecondary} allowFontScaling>
              {descriptionText}
            </Text>
          ) : (
            <Text style={styles.detailEmpty} allowFontScaling>
              No description provided
            </Text>
          )}
        </DetailSection>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={handleCtaPress}
          disabled={ctaState.disabled || rsvpBusy}
          style={({ pressed }) => [
            styles.ctaButton,
            ctaState.variant === 'primary' && styles.ctaPrimary,
            ctaState.variant === 'joined' && styles.ctaPrimary,
            ctaState.variant === 'disabled' && styles.ctaDisabled,
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
              ctaState.variant === 'disabled' && styles.ctaTextDisabled,
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
        count={participantCount}
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
        onBlocked={() => setBlockPetTarget(null)}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: CANCEL_BANNER_BG,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  cancelBannerText: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: CANCEL_BANNER_TEXT,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 24,
    lineHeight: 30,
    color: PRIMARY_TEXT,
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
    backgroundColor: SAGE_CHIP_BG,
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
    color: PRIMARY_TEXT,
    marginBottom: 20,
  },
  participantsSection: {
    marginBottom: 24,
  },
  participantsCount: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: SECONDARY_TEXT,
    marginBottom: 12,
  },
  emptyParticipants: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED_TEXT,
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
    borderColor: SCREEN_BG,
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarFallback: {
    backgroundColor: SAGE_CHIP_BG,
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
    backgroundColor: DIVIDER,
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
    color: MUTED_TEXT,
    marginBottom: 8,
  },
  detailPrimary: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    lineHeight: 24,
    color: PRIMARY_TEXT,
  },
  detailSecondary: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: SECONDARY_TEXT,
    marginTop: 4,
  },
  detailEmpty: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: MUTED_TEXT,
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
    backgroundColor: SCREEN_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
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
  ctaDisabled: {
    backgroundColor: DISABLED_BG,
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
  ctaTextDisabled: {
    color: DISABLED_TEXT,
    fontFamily: theme.fonts.medium,
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
    color: PRIMARY_TEXT,
    marginBottom: 8,
    textAlign: 'center',
  },
  notFoundBody: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: SECONDARY_TEXT,
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
