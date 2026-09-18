import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ContentSafetyMenu from '../components/ContentSafetyMenu';
import DiscoverMomentCard from '../components/DiscoverMomentCard';
import LoadErrorRetry from '../components/LoadErrorRetry';
import MatingSurfaceHeader from '../components/MatingSurfaceHeader';
import PawpleEmptyState from '../components/PawpleEmptyState';
import PetContextSelector from '../components/PetContextSelector';
import ReportSheet from '../components/ReportSheet';
import ScreenWrapper from '../components/ScreenWrapper';
import UnpawConfirmSheet from '../components/UnpawConfirmSheet';
import UnpawReportPrompt from '../components/UnpawReportPrompt';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { useActivePet } from '../contexts/ActivePetContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { useMatingUnpawFlow } from '../hooks/useMatingUnpawFlow';
import {
  MATING_CHAT_ENDED_SUBTITLE,
  MATING_CHAT_ENDED_TITLE,
  MATING_CHAT_TAB_LABEL,
} from '../content/legalDocuments';
import { formatChatListTime } from '../lib/formatChatTime';
import { promptNotificationPermissionIfNeeded } from '../lib/notifications';
import { fetchDiscoverMomentMap, fetchDiscoverProfileMeta } from '../services/discoverMoments';
import {
  dismissIncomingPaw,
  excludeLocallySuppressedReportChatChannels,
  expressPaw,
  fetchDiscoverPawState,
  fetchInboundInterest,
  fetchMyIntroductionChannels,
  flushPendingReportChatDismiss,
  getLocallySuppressedReportChatDismissChannelId,
  petsHaveMutualPaw,
  queryMutualPaw,
} from '../services/mating';

/**
 * Resolve viewer-owned pet vs other pet for a channel row.
 * @param {object} row RPC row
 * @param {Set<string>} ownedPetIds
 */
function resolveChannelPets(row, ownedPetIds) {
  const lowId = String(row.pet_low_id ?? '');
  const highId = String(row.pet_high_id ?? '');
  const lowOwned = ownedPetIds.has(lowId);
  const highOwned = ownedPetIds.has(highId);

  if (lowOwned && !highOwned) {
    return {
      myPetId: lowId,
      myPetName: row.pet_low_name ?? 'Pet',
      otherPetId: highId,
      otherPetName: row.pet_high_name ?? 'Pet',
      otherPhotoUrl: row.pet_high_photo_url ?? null,
    };
  }
  if (highOwned && !lowOwned) {
    return {
      myPetId: highId,
      myPetName: row.pet_high_name ?? 'Pet',
      otherPetId: lowId,
      otherPetName: row.pet_low_name ?? 'Pet',
      otherPhotoUrl: row.pet_low_photo_url ?? null,
    };
  }

  const mineLow = lowOwned;
  return {
    myPetId: mineLow ? lowId : highId,
    myPetName: mineLow ? row.pet_low_name ?? 'Pet' : row.pet_high_name ?? 'Pet',
    otherPetId: mineLow ? highId : lowId,
    otherPetName: mineLow ? row.pet_high_name ?? 'Pet' : row.pet_low_name ?? 'Pet',
    otherPhotoUrl: mineLow ? row.pet_high_photo_url : row.pet_low_photo_url,
  };
}

/**
 * Chat hub — Interested inbound Paws + Connected introduction threads.
 * Connected: pet identity + actual latest message preview. No human names.
 */
export default function MatingChatListScreen({ navigation }) {
  const surfaces = useRuntimeThemeColors();
  const { user } = useAuth();
  const { activePetId } = useActivePet();
  const [channels, setChannels] = useState([]);
  const [ownedPetIds, setOwnedPetIds] = useState(() => new Set());
  const [interestedRows, setInterestedRows] = useState([]);
  const [featuredMoments, setFeaturedMoments] = useState({});
  const [profileMeta, setProfileMeta] = useState({});
  const [pawState, setPawState] = useState({ outbound: new Set(), ready: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [hadChannels, setHadChannels] = useState(false);
  const [pawBusyId, setPawBusyId] = useState(null);
  const [dismissBusyId, setDismissBusyId] = useState(null);
  const [unpawTargetId, setUnpawTargetId] = useState(null);
  const [reportPetName, setReportPetName] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [connectedSafetyOpen, setConnectedSafetyOpen] = useState(false);
  /** Active pet id the current hub content belongs to — guards stale list on pet switch. */
  const hubPetIdRef = useRef(null);
  const errorRef = useRef(false);

  const interestedCardWidth = Dimensions.get('window').width * theme.feed.carouselCardWidthRatio;
  const interestedCardGap = theme.feed.carouselCardGap;

  const hubTheme = useMemo(
    () => ({
      sectionTitle: { color: surfaces.textPrimary },
      connectedEmpty: { color: surfaces.textMuted },
      title: { color: surfaces.textPrimary },
      preview: { color: surfaces.textSecondary },
      time: { color: surfaces.textMuted },
      avatarFallback: {
        backgroundColor: surfaces.isDark
          ? surfaces.meetupChipBackground
          : theme.colors.brand.sageLight.light,
      },
    }),
    [surfaces.isDark, surfaces.meetupChipBackground, surfaces.textMuted, surfaces.textPrimary, surfaces.textSecondary],
  );

  useEffect(() => {
    setHadChannels(false);
  }, [activePetId]);

  const loadInterested = useCallback(async (viewerPetId, { preserveKnownOnFailure = false } = {}) => {
    if (!viewerPetId) {
      setInterestedRows([]);
      setFeaturedMoments({});
      setProfileMeta({});
      setPawState({ outbound: new Set(), ready: true });
      return;
    }

    const inbound = await fetchInboundInterest(viewerPetId);
    const nonMutual = [];

    for (const row of inbound) {
      const fromPetId = row?.from_pet_id;
      if (!fromPetId) {
        continue;
      }
      const mutualCheck = await queryMutualPaw(viewerPetId, fromPetId);
      if (!mutualCheck.ok || mutualCheck.mutual) {
        continue;
      }
      nonMutual.push(row);
    }

    const fromIds = nonMutual.map((row) => row.from_pet_id).filter(Boolean);
    const [momentMap, metaMap] = await Promise.all([
      fetchDiscoverMomentMap(fromIds, viewerPetId),
      fetchDiscoverProfileMeta(fromIds),
    ]);

    setInterestedRows(nonMutual);
    setFeaturedMoments(Object.fromEntries(momentMap));
    setProfileMeta(Object.fromEntries(metaMap));

    if (!fromIds.length) {
      setPawState({ outbound: new Set(), ready: true });
      return;
    }

    const pawResult = await fetchDiscoverPawState(viewerPetId, fromIds);
    if (!pawResult.ok) {
      setPawState((prev) => {
        if (preserveKnownOnFailure && prev.ready) {
          return prev;
        }
        return { outbound: new Set(), ready: false };
      });
      return;
    }

    setPawState({
      outbound: pawResult.outbound,
      ready: true,
    });
  }, []);

  const load = useCallback(async ({ isRefresh = false } = {}) => {
    if (!user?.id || !activePetId) {
      setChannels([]);
      setOwnedPetIds(new Set());
      setInterestedRows([]);
      setFeaturedMoments({});
      setProfileMeta({});
      setPawState({ outbound: new Set(), ready: false });
      hubPetIdRef.current = null;
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const preserveHub = isRefresh || (hubPetIdRef.current === activePetId && !errorRef.current);

    if (isRefresh) {
      setRefreshing(true);
    }

    if (!preserveHub) {
      setLoading(true);
    }
    setError(false);
    errorRef.current = false;
    try {
      await flushPendingReportChatDismiss();
      const suppressedChannelId = await getLocallySuppressedReportChatDismissChannelId();

      const { data: ownedPets, error: petsError } = await supabase
        .from('pets')
        .select('id')
        .eq('owner_id', user.id);

      if (petsError) {
        console.error('[Supabase]', petsError);
        throw petsError;
      }

      const ids = new Set((ownedPets ?? []).map((p) => String(p.id)));
      setOwnedPetIds(ids);

      const [rows] = await Promise.all([
        fetchMyIntroductionChannels(),
        loadInterested(activePetId, { preserveKnownOnFailure: preserveHub }),
      ]);

      const activePetChannels = excludeLocallySuppressedReportChatChannels(
        rows.filter((row) => {
          if (row.list_kind === 'ended_anonymous') {
            return String(row?.pet_low_id ?? '') === String(activePetId);
          }
          return (
            String(row?.pet_low_id ?? '') === String(activePetId) ||
            String(row?.pet_high_id ?? '') === String(activePetId)
          );
        }),
        suppressedChannelId,
      );
      setChannels(activePetChannels);
      hubPetIdRef.current = activePetId;
      if (activePetChannels.length > 0) {
        setHadChannels(true);
      }
    } catch (e) {
      console.error('[MatingChatList]', e);
      if (!preserveHub) {
        setError(true);
        errorRef.current = true;
        setChannels([]);
        setInterestedRows([]);
        setFeaturedMoments({});
        setProfileMeta({});
        setPawState({ outbound: new Set(), ready: false });
        hubPetIdRef.current = null;
      }
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, [activePetId, loadInterested, user?.id]);

  const unpawFlow = useMatingUnpawFlow({
    viewerPetId: activePetId,
    otherPetId: unpawTargetId,
    onUnpawComplete: () => {
      load();
    },
  });

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        load();
      }
    });
    return () => subscription.remove();
  }, [load]);

  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => {
      const aTime = new Date(a.last_message_at ?? a.opened_at ?? 0).getTime();
      const bTime = new Date(b.last_message_at ?? b.opened_at ?? 0).getTime();
      return bTime - aTime;
    });
  }, [channels]);

  const openThread = useCallback(
    (row, resolved) => {
      const channelId = row.channel_id ?? row.id;
      if (!channelId) {
        return;
      }
      navigation.navigate('MatingIntroductionChatScreen', {
        channelId,
        otherPetId: resolved.otherPetId,
        otherPetName: resolved.otherPetName,
        otherPetPhotoUrl: resolved.otherPhotoUrl,
        viewerPetId: resolved.myPetId,
      });
    },
    [navigation],
  );

  const openEndedAnonymousThread = useCallback(
    (row) => {
      const channelId = row.channel_id ?? row.id;
      if (!channelId || !activePetId) {
        return;
      }
      navigation.navigate('MatingIntroductionChatScreen', {
        channelId,
        viewerPetId: activePetId,
      });
    },
    [activePetId, navigation],
  );

  const openConnectedProfile = useCallback(
    (resolved) => {
      if (!resolved.otherPetId || !resolved.myPetId) {
        return;
      }
      navigation.navigate('ViewPetProfileScreen', {
        petId: resolved.otherPetId,
        viewerPetId: resolved.myPetId,
      });
    },
    [navigation],
  );

  const openInterestedProfile = useCallback(
    (item, resolvedPetId) => {
      const petId = resolvedPetId ?? item?.from_pet?.id ?? item?.from_pet_id;
      if (!petId || !activePetId) {
        return;
      }
      navigation.navigate('ViewPetProfileScreen', {
        petId,
        source: 'interest',
        viewerPetId: activePetId,
        pawInterestId: item?.id ?? null,
      });
    },
    [activePetId, navigation],
  );

  const handleNotForMe = useCallback(
    async (item) => {
      const fromPetId = item?.from_pet_id;
      if (!activePetId || !fromPetId || dismissBusyId) {
        return;
      }
      setDismissBusyId(fromPetId);
      try {
        await dismissIncomingPaw(activePetId, fromPetId);
        await load();
      } catch (e) {
        console.error('[MatingChatList] dismiss incoming paw', e);
        Toast.show({
          type: 'error',
          text1: e?.userMessage || e?.message || "Couldn't dismiss this paw.",
        });
      } finally {
        setDismissBusyId(null);
      }
    },
    [activePetId, dismissBusyId, load],
  );

  const handleInterestedPaw = useCallback(
    async (item) => {
      const fromPet = item?.from_pet ?? { id: item?.from_pet_id, name: 'Pet' };
      const fromPetId = fromPet?.id ?? item?.from_pet_id;
      if (!activePetId || !fromPetId || pawBusyId || !pawState.ready) {
        return;
      }
      const key = String(fromPetId);
      if (pawState.outbound.has(key)) {
        setUnpawTargetId(fromPetId);
        setReportPetName(fromPet?.name ?? 'this pet');
        unpawFlow.requestUnpaw();
        return;
      }
      setPawBusyId(fromPetId);
      const hadOutbound = pawState.outbound.has(key);
      setPawState((prev) => {
        const outbound = new Set(prev.outbound);
        outbound.add(key);
        return { ...prev, outbound, ready: true };
      });
      try {
        await expressPaw(activePetId, fromPetId);
        const isMutual = await petsHaveMutualPaw(activePetId, fromPetId);
        if (isMutual) {
          await promptNotificationPermissionIfNeeded();
        }
        void load();
      } catch (e) {
        console.error('[MatingChatList] paw', e);
        setPawState((prev) => {
          if (hadOutbound) {
            return prev;
          }
          const outbound = new Set(prev.outbound);
          outbound.delete(key);
          return { ...prev, outbound };
        });
        Toast.show({
          type: 'error',
          text1: e?.userMessage || e?.message || "Couldn't express interest.",
        });
      } finally {
        setPawBusyId(null);
      }
    },
    [activePetId, load, pawBusyId, pawState.outbound, pawState.ready, unpawFlow],
  );

  const showRemovedQuiet = !loading && !error && hadChannels && sortedChannels.length === 0;
  const hubFullyEmpty =
    !loading && !error && interestedRows.length === 0 && sortedChannels.length === 0;
  const showInterestedSectionEmpty = !hubFullyEmpty && interestedRows.length === 0;
  const connectedEmptyTitle = showRemovedQuiet
    ? 'No introductions right now.'
    : 'No introductions yet.';

  const renderInterestedItem = useCallback(
    ({ item }) => {
      const fromPet = item.from_pet ?? { id: item.from_pet_id, name: 'Pet' };
      const candidateId = String(item.from_pet_id);
      const featuredMoment = featuredMoments[candidateId] ?? null;
      const candidateProfile = profileMeta[candidateId] ?? null;
      const hasMoment = Boolean(featuredMoment);
      const photoUri = hasMoment
        ? featuredMoment?.image_url ?? featuredMoment?.photo_url ?? null
        : fromPet?.photo_url ?? null;
      const caption = hasMoment ? String(featuredMoment.caption ?? '').trim() : '';
      const location = hasMoment ? String(featuredMoment.location ?? '').trim() : '';

      return (
        <View style={[styles.interestedCardSlot, { width: interestedCardWidth }]}>
          <DiscoverMomentCard
            variant={hasMoment ? 'moment' : 'profile'}
            petId={fromPet.id ?? item.from_pet_id}
            petName={fromPet.name}
            photoUri={photoUri}
            caption={caption}
            location={location}
            memoryDate={hasMoment ? featuredMoment : ''}
            momentId={hasMoment ? featuredMoment.id : null}
            momentOwnerId={hasMoment ? featuredMoment.user_id : null}
            pawInterestId={item.id}
            reportedUserId={candidateProfile?.ownerId ?? item.from_owner_id ?? null}
            profilePhotoDate={candidateProfile?.photoDate ?? ''}
            pawExpressed={pawState.outbound.has(candidateId)}
            pawStateKnown={pawState.ready}
            pawBusy={pawBusyId === item.from_pet_id}
            showNotForMe
            notForMeBusy={dismissBusyId === item.from_pet_id}
            onNotForMePress={() => handleNotForMe(item)}
            onOpenProfile={(resolvedPetId) => openInterestedProfile(item, resolvedPetId)}
            onPawPress={() => handleInterestedPaw(item)}
            onPetBlocked={() => load()}
          />
        </View>
      );
    },
    [
      featuredMoments,
      dismissBusyId,
      handleInterestedPaw,
      handleNotForMe,
      interestedCardWidth,
      load,
      openInterestedProfile,
      pawBusyId,
      pawState.outbound,
      pawState.ready,
      profileMeta,
    ],
  );

  const chatHeader = (
    <MatingSurfaceHeader title={MATING_CHAT_TAB_LABEL} variant="chat" />
  );

  const renderHubHeader = () => (
    <View style={styles.hubSections}>
      <View style={styles.interestedSection}>
        <Text style={[styles.sectionTitle, hubTheme.sectionTitle]} allowFontScaling>
          Interested
        </Text>
        {interestedRows.length > 0 ? (
          <FlatList
            horizontal
            data={interestedRows}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderInterestedItem}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            ItemSeparatorComponent={() => <View style={{ width: interestedCardGap }} />}
            contentContainerStyle={styles.interestedCarouselContent}
            style={styles.interestedCarousel}
          />
        ) : showInterestedSectionEmpty ? (
          <PawpleEmptyState
            style={styles.sectionEmpty}
            title="No paws just yet"
            body="When another pet shows interest, they'll appear here."
          />
        ) : null}
      </View>
      <View style={styles.connectedSection}>
        <Text style={[styles.sectionTitle, hubTheme.sectionTitle]} allowFontScaling>
          Connected
        </Text>
      </View>
    </View>
  );

  const renderConnectedEmpty = () => (
    <PawpleEmptyState style={styles.sectionEmpty} title={connectedEmptyTitle} />
  );

  const renderRow = ({ item }) => {
    if (item.list_kind === 'ended_anonymous') {
      return (
        <View style={styles.row}>
          <View style={[styles.avatarWrap, hubTheme.avatarFallback]}>
            <View style={[styles.anonymousAvatar, hubTheme.avatarFallback]} />
          </View>
          <Pressable
            onPress={() => openEndedAnonymousThread(item)}
            style={({ pressed }) => [styles.threadPress, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={MATING_CHAT_ENDED_TITLE}
          >
            <Text style={[styles.title, hubTheme.title]} numberOfLines={1} allowFontScaling>
              {MATING_CHAT_ENDED_TITLE}
            </Text>
            <Text style={[styles.preview, hubTheme.preview]} numberOfLines={2} allowFontScaling>
              {MATING_CHAT_ENDED_SUBTITLE}
            </Text>
          </Pressable>
        </View>
      );
    }

    const resolved = resolveChannelPets(item, ownedPetIds);
    const preview = String(item.last_message_body ?? '').trim();
    const timeLabel = preview ? formatChatListTime(item.last_message_at) : null;

    return (
      <View style={styles.row}>
        <Pressable
          onPress={() => openConnectedProfile(resolved)}
          style={({ pressed }) => [styles.avatarPress, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Open ${resolved.otherPetName} profile`}
        >
          {resolved.otherPhotoUrl ? (
            <View style={[styles.avatarWrap, hubTheme.avatarFallback]}>
              <Image source={{ uri: resolved.otherPhotoUrl }} style={styles.avatar} />
            </View>
          ) : (
            <PetContextSelector photoUrl={null} size={48} />
          )}
        </Pressable>
        <Pressable
          onPress={() => openThread(item, resolved)}
          style={({ pressed }) => [styles.threadPress, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Open chat with ${resolved.otherPetName}`}
        >
          <View style={styles.titleRow}>
            <Pressable
              onPress={() => openConnectedProfile(resolved)}
              style={({ pressed }) => [styles.namePress, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${resolved.otherPetName} profile`}
            >
              <Text style={[styles.title, hubTheme.title]} numberOfLines={1} allowFontScaling>
                {resolved.otherPetName}
              </Text>
            </Pressable>
            <Ionicons
              name="paw"
              size={14}
              color={theme.colors.brand.sage.value}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </View>
          {preview ? (
            <View style={styles.previewRow}>
              <Text style={[styles.preview, hubTheme.preview]} numberOfLines={1} allowFontScaling>
                {preview}
              </Text>
              {timeLabel ? (
                <Text style={[styles.time, hubTheme.time]} numberOfLines={1} allowFontScaling>
                  {timeLabel}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => {
            setUnpawTargetId(resolved.otherPetId);
            setReportPetName(resolved.otherPetName ?? 'this pet');
            setConnectedSafetyOpen(true);
          }}
          hitSlop={12}
          style={({ pressed }) => [styles.connectedMenuPress, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${resolved.otherPetName}`}
        >
          <Feather
            name="more-horizontal"
            size={22}
            color={theme.colors.text.muted.light}
          />
        </Pressable>
      </View>
    );
  };

  return (
    <ScreenWrapper headerContent={chatHeader}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand.sage.value} />
        </View>
      ) : error ? (
        <LoadErrorRetry onRetry={load} style={styles.center} />
      ) : hubFullyEmpty ? (
        <View style={styles.center}>
          <PawpleEmptyState style={styles.hubEmpty} title={connectedEmptyTitle} />
        </View>
      ) : (
        <FlatList
          data={sortedChannels}
          keyExtractor={(item) => String(item.channel_id ?? item.id)}
          renderItem={renderRow}
          ListHeaderComponent={renderHubHeader}
          ListEmptyComponent={renderConnectedEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load({ isRefresh: true })}
              tintColor={theme.colors.brand.sage.value}
              colors={[theme.colors.brand.sage.value]}
            />
          }
        />
      )}

      <ContentSafetyMenu
        visible={connectedSafetyOpen}
        showUnpaw
        showReport={false}
        showBlock={false}
        onClose={() => setConnectedSafetyOpen(false)}
        onUnpaw={() => {
          setConnectedSafetyOpen(false);
          unpawFlow.requestUnpaw();
        }}
      />

      <UnpawConfirmSheet
        visible={unpawFlow.confirmVisible}
        busy={unpawFlow.busy}
        onConfirm={async () => {
          try {
            await unpawFlow.confirmUnpaw();
          } catch (e) {
            console.error('[MatingChatList] unpaw', e);
            Toast.show({ type: 'error', text1: "Couldn't unpaw. Try again." });
          }
        }}
        onClose={unpawFlow.cancelUnpaw}
      />

      <UnpawReportPrompt
        visible={unpawFlow.reportPromptVisible}
        petName={reportPetName}
        onNo={unpawFlow.dismissReportPrompt}
        onYes={() => {
          unpawFlow.dismissReportPrompt();
          setReportOpen(true);
        }}
      />

      <ReportSheet
        visible={reportOpen}
        targetType="mating_interest"
        targetId={unpawFlow.reportContext?.targetId}
        reportedUserId={unpawFlow.reportContext?.reportedUserId}
        blockablePets={
          unpawTargetId
            ? [{ id: unpawTargetId, name: reportPetName || 'Pet' }]
            : []
        }
        onClose={() => {
          setReportOpen(false);
        }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  listContent: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 32,
    flexGrow: 1,
  },
  hubSections: {
    gap: 24,
    marginBottom: 8,
  },
  interestedSection: {
    gap: 12,
  },
  connectedSection: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  interestedCarousel: {
    marginHorizontal: -24,
  },
  interestedCarouselContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  interestedCardSlot: {
    overflow: 'visible',
  },
  sectionEmpty: {
    alignSelf: 'stretch',
    paddingVertical: theme.spacing.md,
  },
  hubEmpty: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: 12,
    gap: 12,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  avatarPress: {
    alignSelf: 'flex-start',
  },
  threadPress: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  anonymousAvatar: {
    flex: 1,
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  namePress: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  time: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.muted.light,
    flexShrink: 0,
  },
  preview: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
  },
  connectedMenuPress: {
    alignSelf: 'center',
    marginLeft: 4,
  },
});
