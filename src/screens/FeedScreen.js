import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventCarousel from '../components/EventCarousel';
import LoadErrorRetry from '../components/LoadErrorRetry';
import MeetupCard from '../components/MeetupCard';
import MomentCard from '../components/MomentCard';
import { theme } from '../config/theme';
import { isDemoContentEnabled } from '../config/environment';
import {
  DEMO_FEED_CAROUSEL_SIZE,
  DEMO_FEED_SHOW_ALL_MEETUPS,
  getDemoMeetupsForFeed,
  getDemoMomentsForFeed,
  isDemoMomentId,
  USE_DEMO_FEED_WHEN_EMPTY,
} from '../data/demoFeed';
import { applyDemoMeetupRsvp } from '../data/demoMeetupRsvp';
import {
  DEFAULT_FEED_MOMENT_PAGE_LIMIT,
  fetchFeedMoments,
  fetchUserFeedLocation,
  sortFeedMoments,
} from '../services/moments';
import { fetchMeetups, filterShowablePublicMeetups, isDemoMeetupId, extractMeetupHostPetIds } from '../services/meetups';
import { fetchBlockedPetIds, isBlockedByPetIds } from '../services/blocks';
import { getCachedLocation } from '../lib/locationManager';
import { supabase } from '../lib/supabase';
import { useMeetupFeedLogic } from '../hooks/useMeetupFeedLogic';
import { withHonestMeetupDistance } from '../utils/distanceUtils';

/** Inject a meetup suggestion after every Nth moment in the main vertical feed. */
const MEETUP_INJECTION_INTERVAL = 9;

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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [meetups, setMeetups] = useState([]);
  const [realMoments, setRealMoments] = useState([]);
  const [pendingMoments, setPendingMoments] = useState([]);
  const [likedIds, setLikedIds] = useState(new Set());
  const [userPets, setUserPets] = useState([]);
  const [blockedPetIds, setBlockedPetIds] = useState(() => new Set());
  const [userFeedLocation, setUserFeedLocation] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [momentPage, setMomentPage] = useState(0);
  const [hasMoreMoments, setHasMoreMoments] = useState(true);
  const [loadingMoreMoments, setLoadingMoreMoments] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const hasCompletedInitialLoadRef = useRef(false);
  const feedGenerationRef = useRef(0);
  const feedLoadInProgressRef = useRef(false);
  const loadingMoreMomentsRef = useRef(false);
  const momentPageRef = useRef(0);
  const hasMoreMomentsRef = useRef(true);

  const loadFeed = useCallback(async (opts = {}) => {
    const { isRefresh, isBackground } = opts;
    const generation = feedGenerationRef.current + 1;
    feedGenerationRef.current = generation;
    feedLoadInProgressRef.current = true;

    if (isRefresh) {
      setRefreshing(true);
    } else if (!isBackground) {
      setLoading(true);
    }
    if (!isBackground) {
      setLoadError(false);
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const feedLocation = user?.id ? await fetchUserFeedLocation(user.id) : null;

      // Viewer coordinates for meetup "X km away" — cached only, never prompts here.
      const viewerCoords = await getCachedLocation().catch(() => null);

      const [meetupsData, momentsPageResult, likesRes, petsRes, blockedIds] = await Promise.all([
        fetchMeetups(),
        fetchFeedMoments(user?.id, feedLocation, 0, DEFAULT_FEED_MOMENT_PAGE_LIMIT),
        user?.id
          ? supabase.from('likes').select('moment_id').eq('user_id', user.id)
          : Promise.resolve({ data: [], error: null }),
        user?.id
          ? supabase
              .from('pets')
              .select('id, name, photo_url, pet_type, breed')
              .eq('owner_id', user.id)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        user?.id ? fetchBlockedPetIds().catch((err) => {
          console.error('[Supabase]', err);
          return [];
        }) : Promise.resolve([]),
      ]);

      if (likesRes.error) {
        console.error('[Supabase]', likesRes.error);
      }
      if (petsRes.error) {
        console.error('[Supabase]', petsRes.error);
      }

      const realMeetups = meetupsData ?? [];
      const firstMomentPage = momentsPageResult?.moments ?? [];
      const likedMomentIds = likesRes.error ? [] : (likesRes.data ?? []).map((row) => row.moment_id);
      const viewerPets = petsRes.error ? [] : petsRes.data ?? [];
      const blockedSet = new Set((blockedIds ?? []).map(String));

      // Meetups stay complete because carousel and inline ordering require global proximity.
      let nextMeetups = realMeetups;

      if (USE_DEMO_FEED_WHEN_EMPTY) {
        const demoMeetups = getDemoMeetupsForFeed();
        if (realMeetups.length === 0) {
          nextMeetups = demoMeetups;
        } else {
          const realIds = new Set(realMeetups.map((m) => String(m.id)));
          nextMeetups = [
            ...realMeetups,
            ...demoMeetups.filter((d) => !realIds.has(String(d.id))),
          ];
        }
        console.log('[FeedScreen] Demo meetups merged:', {
          demoCount: demoMeetups.length,
          realCount: realMeetups.length,
          total: nextMeetups.length,
        });
      }

      // Apply session-local demo state, then keep only showable public meetups.
      nextMeetups = filterShowablePublicMeetups(
        nextMeetups.map((m) =>
          isDemoContentEnabled && isDemoMeetupId(m?.id)
            ? applyDemoMeetupRsvp(m, viewerPets)
            : m,
        ),
      );

      // Honest distance only — omit when GPS or venue coords are missing.
      nextMeetups = nextMeetups.map((m) =>
        withHonestMeetupDistance(m, viewerCoords),
      );

      // Hide meetups hosted by blocked pets (client filter; RLS does not filter blocks).
      nextMeetups = nextMeetups.filter(
        (m) => !isBlockedByPetIds(extractMeetupHostPetIds(m), blockedSet),
      );

      const visibleMoments = firstMomentPage.filter(
        (m) => !isBlockedByPetIds(m?.pet_ids ?? [], blockedSet),
      );

      if (generation !== feedGenerationRef.current) {
        return;
      }

      setCurrentUserId(user?.id ?? null);
      setUserFeedLocation(feedLocation);
      setMeetups(nextMeetups);
      setRealMoments(visibleMoments);
      setBlockedPetIds(blockedSet);
      momentPageRef.current = 0;
      hasMoreMomentsRef.current = Boolean(momentsPageResult?.hasMore);
      setMomentPage(0);
      setHasMoreMoments(hasMoreMomentsRef.current);
      setUserPets(viewerPets);
      setLikedIds(new Set(likedMomentIds.map(String)));
      setLoadError(false);
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
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const incoming = route.params?.newMoment;
      if (incoming) {
        // Optimistic insert: show the brand-new moment immediately, dedupe by id.
        setPendingMoments((prev) =>
          prev.some((m) => String(m.id) === String(incoming.id)) ? prev : [incoming, ...prev],
        );
        navigation.setParams({ newMoment: undefined });
      }
      loadFeed({ isBackground: hasCompletedInitialLoadRef.current });
    }, [loadFeed, route.params?.refreshFeed, route.params?.newMoment, navigation]),
  );

  const onRefresh = useCallback(() => {
    loadFeed({ isRefresh: true });
  }, [loadFeed]);

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
    const source = (() => {
      if (!pendingMoments.length) {
        return feedMoments;
      }
      const seen = new Set();
      const merged = [];
      for (const m of [...pendingMoments, ...feedMoments]) {
        const key = String(m?.id);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        merged.push(m);
      }
      return sortFeedMoments(merged, userFeedLocation);
    })();
    return source.filter((m) => !isBlockedByPetIds(m?.pet_ids ?? [], blockedPetIds));
  }, [blockedPetIds, feedMoments, pendingMoments, userFeedLocation]);

  const useExpandedDemoFeed = USE_DEMO_FEED_WHEN_EMPTY && DEMO_FEED_SHOW_ALL_MEETUPS;

  const { headerMeetups, feedRows, meetupRowCount } = useMeetupFeedLogic({
    meetups,
    currentUserId,
    mergedMoments,
    injectionInterval: MEETUP_INJECTION_INTERVAL,
    carouselSize: useExpandedDemoFeed ? DEMO_FEED_CAROUSEL_SIZE : undefined,
  });

  useEffect(() => {
    if (loading) {
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

  const handleLikeToggle = useCallback(async (postId, liked) => {
    if (!postId) {
      return;
    }
    const sid = String(postId);
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (liked) {
        next.add(sid);
      } else {
        next.delete(sid);
      }
      return next;
    });
    if (isDemoMomentId(String(postId))) {
      return;
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        return;
      }

      if (liked) {
        const { error } = await supabase.from('likes').insert({ user_id: user.id, moment_id: sid });
        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('moment_id', sid);
        if (error) {
          throw error;
        }
      }
    } catch (e) {
      console.error('[Supabase]', e);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (liked) {
          next.delete(sid);
        } else {
          next.add(sid);
        }
        return next;
      });
    }
  }, []);

  const openPlanMeetup = useCallback(() => {
    navigation.getParent()?.navigate('CreateMeetupScreen');
  }, [navigation]);

  const openCaptureMoment = useCallback(() => {
    navigation.navigate('CreateMomentScreen');
  }, [navigation]);

  const isEmpty = !loading && !loadError && meetups.length === 0 && mergedMoments.length === 0;
  const showCarousel = headerMeetups.length > 0;

  const scrollBottomPad = theme.feed.shellPaddingBottom + Math.max(tabBarHeight - theme.spacing.lg, 0);

  const renderFeedItem = useCallback(
    ({ item: row }) => {
      if (row.type === 'moment') {
        const moment = row.data;
        return (
          <MomentCard
            moment={moment}
            userPets={userPets}
            viewerUserId={currentUserId}
            initialLiked={likedIds.has(String(moment.id))}
            onLikeToggle={handleLikeToggle}
            onPetBlocked={handlePetBlocked}
          />
        );
      }

      return (
        <MeetupCard
          meetup={row.data}
          viewerPets={userPets}
          viewerId={currentUserId}
        />
      );
    },
    [currentUserId, handleLikeToggle, handlePetBlocked, likedIds, userPets],
  );

  const keyExtractor = useCallback((row) => String(row.key), []);

  const listHeaderComponent = useMemo(() => {
    if (loading || isEmpty || !showCarousel) {
      return null;
    }

    return (
      <>
        <EventCarousel
          data={headerMeetups}
          maxSlides={useExpandedDemoFeed ? DEMO_FEED_CAROUSEL_SIZE : 3}
          viewerPets={userPets}
          viewerId={currentUserId}
        />
        <View style={styles.carouselGap} />
      </>
    );
  }, [
    currentUserId,
    headerMeetups,
    isEmpty,
    loading,
    showCarousel,
    useExpandedDemoFeed,
    userPets,
  ]);

  const listEmptyComponent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.brand.sage.value} />
        </View>
      );
    }

    if (loadError) {
      return <LoadErrorRetry onRetry={() => loadFeed()} />;
    }

    if (!isEmpty) {
      return null;
    }

    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle} allowFontScaling>
          Nothing here yet.
        </Text>
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
      </View>
    );
  }, [isEmpty, loadError, loadFeed, loading, openCaptureMoment, openPlanMeetup]);

  const listFooterComponent = useMemo(() => {
    if (!loadingMoreMoments) {
      return null;
    }

    return (
      <View style={styles.loadingMoreWrap}>
        <ActivityIndicator size="small" color={theme.colors.brand.sage.value} />
      </View>
    );
  }, [loadingMoreMoments]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <FlatList
        style={styles.scroll}
        data={loading || loadError || isEmpty ? [] : feedRows}
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
    </SafeAreaView>
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
    paddingTop: theme.feed.shellPaddingTop,
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
  carouselGap: {
    height: theme.feed.carouselSectionGap,
  },
  emptyWrap: {
    flex: 1,
    minHeight: 320,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  emptyTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.lg,
    lineHeight: Math.round(theme.fontSizes.lg * theme.lineHeights.normal),
    color: theme.colors.text.primary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  emptyActions: {
    alignItems: 'center',
    gap: theme.spacing.sm,
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
