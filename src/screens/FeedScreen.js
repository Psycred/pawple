import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppHeader from '../components/AppHeader';
import EventCarousel from '../components/EventCarousel';
import LoadErrorRetry from '../components/LoadErrorRetry';
import PawpleEmptyState from '../components/PawpleEmptyState';
import { FEED_EMPTY_BODY, FEED_EMPTY_TITLE } from '../content/legalDocuments';
import MeetupCard from '../components/MeetupCard';
import MomentCard from '../components/MomentCard';
import { theme } from '../config/theme';
import { isDemoContentEnabled, isLocalDevRuntime } from '../config/environment';
import {
  DEMO_FEED_CAROUSEL_SIZE,
  DEMO_FEED_SHOW_ALL_MEETUPS,
  getDemoMeetupsForFeed,
  getDemoMomentsForFeed,
  USE_DEMO_FEED_WHEN_EMPTY,
} from '../data/demoFeed';
import { applyDemoMeetupRsvp } from '../data/demoMeetupRsvp';
import {
  DEFAULT_FEED_MOMENT_PAGE_LIMIT,
  fetchFeedMoments,
  fetchUserFeedLocation,
  sortFeedMoments,
} from '../services/moments';
import {
  fetchMeetupsForFeed,
  filterShowablePublicMeetups,
  isDemoMeetupId,
  extractMeetupHostPetIds,
} from '../services/meetups';
import { fetchBlockedPetIds, isBlockedByPetIds } from '../services/blocks';
import { fetchViewerHeartedPetIds } from '../services/momentHearts';
import { supabase } from '../lib/supabase';
import { readCachedFeedSnapshot, writeCachedFeedSnapshot } from '../lib/feedCache';
import { refreshViewerFeedLocationOnAppOpen } from '../lib/viewerFeedLocation';
import { createFeedSessionSeed, sortMomentsForFeed } from '../lib/feedProximity';
import { isForegroundLocationGranted } from '../lib/locationPermission';
import { useMeetupFeedLogic } from '../hooks/useMeetupFeedLogic';
import { useNotifications } from '../contexts/NotificationContext';
import { useActivePet } from '../contexts/ActivePetContext';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

/** Inject a meetup suggestion after every Nth moment in the main vertical feed. */
const MEETUP_INJECTION_INTERVAL = 9;

/** Skip focus-triggered reloads when Feed was refreshed recently. */
const FOCUS_RELOAD_MIN_INTERVAL_MS = 45_000;

/** Append a real Moment page without allowing offset-page overlap to duplicate cards. */
function appendUniqueMoments(current, incoming) {
  const seen = new Set(current.map((moment) => String(moment?.id)));
  const additions = incoming.filter((moment) => {
    const id = String(moment?.id);
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
  return additions.length ? [...current, ...additions] : current;
}

export default function FeedScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const tabBarHeight = useBottomTabBarHeight();
  const { hasUnreadNotifications } = useNotifications();
  const { userPets: viewerPets, refreshUserPets } = useActivePet();
  const surfaces = useRuntimeThemeColors();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [meetups, setMeetups] = useState([]);
  const [realMoments, setRealMoments] = useState([]);
  const [pendingMoments, setPendingMoments] = useState([]);
  const [blockedPetIds, setBlockedPetIds] = useState(() => new Set());
  const [userFeedLocation, setUserFeedLocation] = useState(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [heartedPetIds, setHeartedPetIds] = useState(() => new Set());
  const [feedSessionSeed, setFeedSessionSeed] = useState(() => createFeedSessionSeed());
  const [currentUserId, setCurrentUserId] = useState(null);
  const [momentPage, setMomentPage] = useState(0);
  const [hasMoreMoments, setHasMoreMoments] = useState(true);
  const [loadingMoreMoments, setLoadingMoreMoments] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasDisplayedFeed, setHasDisplayedFeed] = useState(false);
  const hasCompletedInitialLoadRef = useRef(false);
  const hasDisplayedFeedRef = useRef(false);
  const feedGenerationRef = useRef(0);
  const feedLoadInProgressRef = useRef(false);
  const loadingMoreMomentsRef = useRef(false);
  const momentPageRef = useRef(0);
  const hasMoreMomentsRef = useRef(true);
  const viewerPetsRef = useRef(viewerPets);
  const lastLoadedPetsKeyRef = useRef('');
  const lastSuccessfulFeedLoadAtRef = useRef(0);
  const shouldRefreshAfterCacheHydrateRef = useRef(false);

  viewerPetsRef.current = viewerPets;

  const applyCachedSnapshot = useCallback((cached) => {
    if (!cached) {
      return;
    }

    setCurrentUserId(cached.userId ?? null);
    // Re-apply the same showability gate as fresh loads — cache may be stale.
    setMeetups(filterShowablePublicMeetups(cached.meetups ?? []));
    setRealMoments(cached.realMoments ?? []);
    setBlockedPetIds(new Set(cached.blockedPetIds ?? []));
    setUserFeedLocation(cached.userFeedLocation ?? null);
    setLocationGranted(Boolean(cached.locationGranted));
    setHeartedPetIds(new Set(cached.heartedPetIds ?? []));
    momentPageRef.current = cached.momentPage ?? 0;
    setMomentPage(momentPageRef.current);
    hasMoreMomentsRef.current = Boolean(cached.hasMoreMoments);
    setHasMoreMoments(hasMoreMomentsRef.current);
    setLoadError(false);
    hasCompletedInitialLoadRef.current = true;
    hasDisplayedFeedRef.current = true;
    setHasDisplayedFeed(true);
    setLoading(false);
  }, []);

  const loadFeed = useCallback(async (opts = {}) => {
    const { isRefresh, isBackground } = opts;
    const generation = feedGenerationRef.current + 1;
    feedGenerationRef.current = generation;
    feedLoadInProgressRef.current = true;

    if (isRefresh) {
      setRefreshing(true);
      setFeedSessionSeed(createFeedSessionSeed());
    } else if (!isBackground && !hasDisplayedFeedRef.current) {
      // First visit only — returning to Feed keeps the last cards visible.
      setLoading(true);
      if (!hasCompletedInitialLoadRef.current) {
        setFeedSessionSeed(createFeedSessionSeed());
      }
    }
    if (!isBackground) {
      setLoadError(false);
      setLoadMoreError(false);
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id ?? null;

      const [feedLocation, meetupsData, momentsPageResult, blockedIds, granted, heartedIds] =
        await Promise.all([
          userId ? fetchUserFeedLocation(userId) : Promise.resolve(null),
          fetchMeetupsForFeed(),
          fetchFeedMoments(userId, null, 0, DEFAULT_FEED_MOMENT_PAGE_LIMIT),
          userId
            ? fetchBlockedPetIds(userId).catch((err) => {
                console.error('[Supabase]', err);
                return [];
              })
            : Promise.resolve([]),
          isForegroundLocationGranted(),
          userId ? fetchViewerHeartedPetIds(userId) : Promise.resolve(new Set()),
        ]);

      const realMeetups = meetupsData ?? [];
      const firstMomentPage = momentsPageResult?.moments ?? [];
      const ownedPets = viewerPetsRef.current ?? [];
      const blockedSet = new Set((blockedIds ?? []).map(String));

      let nextMeetups = realMeetups;

      // Dev fixtures only when the feed has no real meetups — never mix demos into
      // production pools (city filtering would drop them and collapse the carousel).
      if (USE_DEMO_FEED_WHEN_EMPTY && realMeetups.length === 0) {
        nextMeetups = getDemoMeetupsForFeed();
        if (isLocalDevRuntime) {
          console.log('[FeedScreen] Demo meetups loaded (empty real feed):', {
            demoCount: nextMeetups.length,
          });
        }
      }

      // Apply session-local demo state, then keep only showable public meetups.
      nextMeetups = filterShowablePublicMeetups(
        nextMeetups.map((m) =>
          isDemoContentEnabled && isDemoMeetupId(m?.id)
            ? applyDemoMeetupRsvp(m, ownedPets)
            : m,
        ),
      );

      // Hide meetups hosted by blocked pets (client filter; RLS does not filter blocks).
      nextMeetups = nextMeetups.filter(
        (m) => !isBlockedByPetIds(extractMeetupHostPetIds(m), blockedSet),
      );

      const visibleMoments = sortFeedMoments(
        firstMomentPage.filter((m) => !isBlockedByPetIds(m?.pet_ids ?? [], blockedSet)),
        feedLocation,
      );

      if (generation !== feedGenerationRef.current) {
        return;
      }

      setCurrentUserId(user?.id ?? null);
      setUserFeedLocation(feedLocation);
      setLocationGranted(Boolean(granted));
      setHeartedPetIds(heartedIds instanceof Set ? heartedIds : new Set(heartedIds));
      setMeetups(nextMeetups);
      setRealMoments(visibleMoments);
      setBlockedPetIds(blockedSet);
      momentPageRef.current = 0;
      hasMoreMomentsRef.current = Boolean(momentsPageResult?.hasMore);
      setMomentPage(0);
      setHasMoreMoments(hasMoreMomentsRef.current);
      lastLoadedPetsKeyRef.current = ownedPets
        .map((pet) => String(pet?.id ?? ''))
        .filter(Boolean)
        .join(',');
      lastSuccessfulFeedLoadAtRef.current = Date.now();
      setLoadError(false);

      if (user?.id) {
        void writeCachedFeedSnapshot(user.id, {
          meetups: nextMeetups,
          realMoments: visibleMoments,
          blockedPetIds: [...blockedSet],
          userFeedLocation: feedLocation,
          locationGranted: Boolean(granted),
          heartedPetIds: [
            ...(heartedIds instanceof Set ? heartedIds : new Set(heartedIds)),
          ],
          momentPage: 0,
          hasMoreMoments: Boolean(momentsPageResult?.hasMore),
        });
      }
    } catch (error) {
      if (generation !== feedGenerationRef.current) {
        return;
      }
      console.error('[FeedScreen] Load feed failed:', error);
      if (!isBackground) {
        setLoadError(true);
        setMeetups([]);
        setRealMoments([]);
        momentPageRef.current = 0;
        hasMoreMomentsRef.current = false;
        setMomentPage(0);
        setHasMoreMoments(false);
      }
    } finally {
      if (generation === feedGenerationRef.current) {
        feedLoadInProgressRef.current = false;
        hasCompletedInitialLoadRef.current = true;
        hasDisplayedFeedRef.current = true;
        setHasDisplayedFeed(true);
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const run = async () => {
        const incoming = route.params?.newMoment;
        if (incoming) {
          // Optimistic insert: show the brand-new moment immediately, dedupe by id.
          setPendingMoments((prev) =>
            prev.some((m) => String(m.id) === String(incoming.id)) ? prev : [incoming, ...prev],
          );
          navigation.setParams({ newMoment: undefined });
        }

        if (!hasDisplayedFeedRef.current) {
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!cancelled && user?.id) {
              const cached = await readCachedFeedSnapshot(user.id);
              if (!cancelled && cached) {
                applyCachedSnapshot(cached);
                shouldRefreshAfterCacheHydrateRef.current = true;
              }
            }
          } catch (error) {
            console.log('[FeedScreen] feed cache hydrate failed:', error?.message ?? error);
          }
        }

        if (cancelled) {
          return;
        }

        const forceReload =
          Boolean(route.params?.refreshFeed) || shouldRefreshAfterCacheHydrateRef.current;
        if (route.params?.refreshFeed) {
          navigation.setParams({ refreshFeed: undefined });
        }
        if (shouldRefreshAfterCacheHydrateRef.current) {
          shouldRefreshAfterCacheHydrateRef.current = false;
        }

        const isBackground = hasDisplayedFeedRef.current;
        const recentlyLoaded =
          lastSuccessfulFeedLoadAtRef.current > 0 &&
          Date.now() - lastSuccessfulFeedLoadAtRef.current < FOCUS_RELOAD_MIN_INTERVAL_MS;

        if (isBackground && !forceReload && recentlyLoaded) {
          return;
        }

        loadFeed({ isBackground });
      };

      run();

      return () => {
        cancelled = true;
      };
    }, [applyCachedSnapshot, loadFeed, route.params?.refreshFeed, route.params?.newMoment, navigation]),
  );

  useEffect(() => {
    const petsKey = (viewerPets ?? [])
      .map((pet) => String(pet?.id ?? ''))
      .filter(Boolean)
      .join(',');
    if (!hasDisplayedFeed || !petsKey || petsKey === lastLoadedPetsKeyRef.current) {
      return;
    }
    loadFeed({ isBackground: true });
  }, [hasDisplayedFeed, loadFeed, viewerPets]);

  // Re-read refreshed device city/GPS for Meetup ranking without blocking or reloading the feed.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      void (async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user?.id) {
            return;
          }
          await refreshViewerFeedLocationOnAppOpen();
          const feedLocation = await fetchUserFeedLocation(user.id);
          setUserFeedLocation(feedLocation);
        } catch (error) {
          console.log('[FeedScreen] foreground location refresh skipped:', error?.message ?? error);
        }
      })();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      await refreshUserPets();
    } catch (error) {
      console.error('[FeedScreen] refresh user pets failed:', error);
    }
    loadFeed({ isRefresh: true });
  }, [loadFeed, refreshUserPets]);

  const loadMore = useCallback(async () => {
    if (
      feedLoadInProgressRef.current ||
      loadingMoreMomentsRef.current ||
      !hasMoreMoments ||
      !hasMoreMomentsRef.current
    ) {
      return;
    }

    const nextPage = Math.max(momentPage, momentPageRef.current) + 1;
    const generation = feedGenerationRef.current;
    loadingMoreMomentsRef.current = true;
    setLoadingMoreMoments(true);
    setLoadMoreError(false);

    try {
      const result = await fetchFeedMoments(
        currentUserId,
        userFeedLocation,
        nextPage,
        DEFAULT_FEED_MOMENT_PAGE_LIMIT,
      );

      // A focus refresh or pull-to-refresh supersedes this older page request.
      if (generation !== feedGenerationRef.current) {
        return;
      }

      setRealMoments((current) =>
        appendUniqueMoments(
          current,
          (result?.moments ?? []).filter(
            (m) => !isBlockedByPetIds(m?.pet_ids ?? [], blockedPetIds),
          ),
        ),
      );
      momentPageRef.current = nextPage;
      hasMoreMomentsRef.current = Boolean(result?.hasMore);
      setMomentPage(nextPage);
      setHasMoreMoments(hasMoreMomentsRef.current);
    } catch (error) {
      console.error('[Supabase]', error);
      if (generation === feedGenerationRef.current) {
        setLoadMoreError(true);
      }
    } finally {
      loadingMoreMomentsRef.current = false;
      setLoadingMoreMoments(false);
    }
  }, [blockedPetIds, currentUserId, hasMoreMoments, momentPage, userFeedLocation]);

  const handlePetBlocked = useCallback((pet) => {
    const petId = String(pet?.id ?? '');
    if (!petId) {
      return;
    }
    setBlockedPetIds((prev) => {
      const next = new Set(prev);
      next.add(petId);
      return next;
    });
    setRealMoments((prev) =>
      prev.filter((m) => !isBlockedByPetIds(m?.pet_ids ?? [], [petId])),
    );
    setPendingMoments((prev) =>
      prev.filter((m) => !isBlockedByPetIds(m?.pet_ids ?? [], [petId])),
    );
    setMeetups((prev) =>
      prev.filter((m) => !isBlockedByPetIds(extractMeetupHostPetIds(m), [petId])),
    );
  }, []);

  const demoMoments = useMemo(
    () => (USE_DEMO_FEED_WHEN_EMPTY ? getDemoMomentsForFeed() : []),
    [],
  );
  const feedMoments = useMemo(
    () => (demoMoments.length ? [...realMoments, ...demoMoments] : realMoments),
    [demoMoments, realMoments],
  );

  // Merge optimistic moments above fetched ones; dedupe so a refetch never doubles a card.
  const mergedMoments = useMemo(() => {
    let merged = feedMoments;
    if (pendingMoments.length) {
      const seen = new Set();
      const combined = [];
      for (const m of [...pendingMoments, ...feedMoments]) {
        const key = String(m?.id);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        combined.push(m);
      }
      merged = combined;
    }
    return sortMomentsForFeed(merged, userFeedLocation, {
      locationGranted,
      heartedPetIds,
      sessionSeed: feedSessionSeed,
    }).filter((m) => !isBlockedByPetIds(m?.pet_ids ?? [], blockedPetIds));
  }, [
    blockedPetIds,
    feedMoments,
    feedSessionSeed,
    heartedPetIds,
    locationGranted,
    pendingMoments,
    userFeedLocation,
  ]);

  const useExpandedDemoFeed = USE_DEMO_FEED_WHEN_EMPTY && DEMO_FEED_SHOW_ALL_MEETUPS;

  const { headerMeetups, feedRows, meetupRowCount } = useMeetupFeedLogic({
    meetups,
    currentUserId,
    mergedMoments,
    injectionInterval: MEETUP_INJECTION_INTERVAL,
    carouselSize: useExpandedDemoFeed ? DEMO_FEED_CAROUSEL_SIZE : undefined,
    userFeedLocation,
    locationGranted,
    sessionSeed: feedSessionSeed,
  });

  useEffect(() => {
    if (!isLocalDevRuntime || loading) {
      return;
    }
    const inlineMeetups = feedRows.filter((row) => row.type === 'meetup').length;
    console.log('[FeedScreen] Meetups loaded:', {
      totalMeetups: meetups.length,
      carouselMeetups: headerMeetups.length,
      inlineMeetups,
      momentRows: feedRows.filter((row) => row.type === 'moment').length,
      expandedDemoFeed: useExpandedDemoFeed,
    });
  }, [loading, meetups.length, headerMeetups.length, feedRows, meetupRowCount, useExpandedDemoFeed]);

  const openPlanMeetup = useCallback(() => {
    navigation.getParent()?.navigate('CreateMeetupScreen');
  }, [navigation]);

  const openCaptureMoment = useCallback(() => {
    navigation.navigate('CreateMomentScreen');
  }, [navigation]);

  const showBlockingLoader = loading && !hasDisplayedFeed;
  const isEmpty =
    hasDisplayedFeed &&
    !showBlockingLoader &&
    !loadError &&
    meetups.length === 0 &&
    mergedMoments.length === 0;
  const showCarousel = headerMeetups.length > 0;
  const scrollBottomPad = theme.feed.shellPaddingBottom + Math.max(tabBarHeight - theme.spacing.lg, 0);

  const handleMomentDeleted = useCallback((momentId) => {
    const id = String(momentId);
    setRealMoments((prev) => prev.filter((moment) => String(moment?.id) !== id));
    setPendingMoments((prev) => prev.filter((moment) => String(moment?.id) !== id));
  }, []);

  const renderFeedItem = useCallback(
    ({ item: row }) => {
      if (row.type === 'moment') {
        const moment = row.data;
        return (
          <MomentCard
            moment={moment}
            userPets={viewerPets}
            viewerUserId={currentUserId}
            onPetBlocked={handlePetBlocked}
            onMomentDeleted={handleMomentDeleted}
          />
        );
      }

      return (
        <MeetupCard
          meetup={row.data}
          viewerPets={viewerPets}
          viewerId={currentUserId}
        />
      );
    },
    [currentUserId, handleMomentDeleted, handlePetBlocked, viewerPets],
  );

  const keyExtractor = useCallback((row) => String(row.key), []);

  const listHeaderComponent = useMemo(() => {
    if (showBlockingLoader || isEmpty) {
      return null;
    }

    return (
      <>
        {showCarousel ? (
          <>
            <EventCarousel
              data={headerMeetups}
              maxSlides={useExpandedDemoFeed ? DEMO_FEED_CAROUSEL_SIZE : 3}
              viewerPets={viewerPets}
              viewerId={currentUserId}
            />
            <View style={styles.carouselGap} />
          </>
        ) : null}
      </>
    );
  }, [
    currentUserId,
    headerMeetups,
    isEmpty,
    showBlockingLoader,
    showCarousel,
    useExpandedDemoFeed,
    viewerPets,
  ]);

  const listEmptyComponent = useMemo(() => {
    if (showBlockingLoader) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.brand.sage.value} />
        </View>
      );
    }

    if (loadError) {
      return (
        <LoadErrorRetry
          onRetry={() => loadFeed({ isBackground: hasDisplayedFeedRef.current })}
        />
      );
    }

    if (!isEmpty) {
      return null;
    }

    return (
      <PawpleEmptyState
        style={styles.emptyWrap}
        title={FEED_EMPTY_TITLE}
        body={FEED_EMPTY_BODY}
      >
        <View style={styles.emptyActions}>
          <Pressable
            onPress={openPlanMeetup}
            style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
            accessibilityRole="button"
            accessibilityLabel="Plan a meetup"
          >
            <Text style={styles.pillText} allowFontScaling>
              Plan a meetup
            </Text>
          </Pressable>
          <Pressable
            onPress={openCaptureMoment}
            style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
            accessibilityRole="button"
            accessibilityLabel="Capture a moment"
          >
            <Text style={styles.pillText} allowFontScaling>
              Capture a moment
            </Text>
          </Pressable>
        </View>
      </PawpleEmptyState>
    );
  }, [isEmpty, loadError, loadFeed, openCaptureMoment, openPlanMeetup, showBlockingLoader]);

  const retryLoadMore = useCallback(() => {
    setLoadMoreError(false);
    loadMore();
  }, [loadMore]);

  const listFooterComponent = useMemo(() => {
    if (loadMoreError) {
      return (
        <View style={styles.loadMoreErrorWrap}>
          <Text style={[styles.loadMoreErrorText, { color: surfaces.textSecondary }]} allowFontScaling>
            Couldn&apos;t load more.
          </Text>
          <Pressable
            onPress={retryLoadMore}
            style={({ pressed }) => [styles.loadMoreRetry, pressed && styles.pillPressed]}
            accessibilityRole="button"
            accessibilityLabel="Try loading more moments"
          >
            <Text style={styles.loadMoreRetryText} allowFontScaling>
              Try again
            </Text>
          </Pressable>
        </View>
      );
    }

    if (!loadingMoreMoments) {
      return null;
    }

    return (
      <View style={styles.loadingMoreWrap}>
        <ActivityIndicator size="small" color={theme.colors.brand.sage.value} />
      </View>
    );
  }, [loadMoreError, loadingMoreMoments, retryLoadMore, surfaces.textSecondary]);

  return (
    <View style={[styles.safe, { backgroundColor: surfaces.backgroundScreen }]}>
      <AppHeader
        showSettings={false}
        showNotifications
        hasUnreadNotifications={hasUnreadNotifications}
      />
      <FlatList
        style={[styles.scroll, { backgroundColor: surfaces.backgroundScreen }]}
        data={showBlockingLoader || (loadError && !hasDisplayedFeed) || isEmpty ? [] : feedRows}
        renderItem={renderFeedItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={listFooterComponent}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollBottomPad },
          isEmpty && styles.scrollContentEmpty,
          loadError && styles.scrollContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.brand.sage.value}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.feed.shellPaddingHorizontal,
  },
  scrollContentEmpty: {
    flexGrow: 1,
  },
  loadingWrap: {
    flex: 1,
    minHeight: 240,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
  loadingMoreWrap: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  loadMoreErrorWrap: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  loadMoreErrorText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: Math.round(theme.fontSizes.sm * theme.lineHeights.normal),
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
  },
  loadMoreRetry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  loadMoreRetryText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.brand.sage.value,
  },
  carouselGap: {
    height: theme.feed.carouselSectionGap,
  },
  cityHintWrap: {
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background.card,
  },
  cityHintText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: Math.round(theme.fontSizes.sm * theme.lineHeights.normal),
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
  },
  emptyWrap: {
    flex: 1,
    minHeight: 320,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  emptyActions: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pill: {
    minHeight: theme.components.button.minHeight,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.meetupCta,
    backgroundColor: theme.colors.brand.sage.value,
  },
  pillPressed: {
    opacity: theme.opacity.pressedUi,
  },
  pillText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    lineHeight: Math.round(theme.fontSizes.md * theme.lineHeights.normal),
    color: theme.colors.text.inverse.value,
  },
});
