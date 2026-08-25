import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import UserSheet from '../components/UserSheet';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useActivePet } from '../contexts/ActivePetContext';
import { getLikedPostIds, toggleLikedPost } from '../utils/pawpleStorage';
import { DEMO_FEED_POSTS, DEMO_FEED_ROTATION_EVENTS, DEMO_UPCOMING_EVENTS } from '../data/demoFeed';
import { buildFeedItemLayoutGetters, buildRotatedFeed } from '../utils/feedRotation';
import { formatFeedPostDate, shareFeedPost } from '../utils/shareFeedPost';

const { width: SCREEN_W } = Dimensions.get('window');
const POST_W = SCREEN_W - 32;
const CAPTION_FONT = 'Kalam';
const LINE_GAP = 6;

/* ——— Upcoming horizontal strip (demo events until Supabase is wired) ——— */
function UpcomingPawBumps({ events = [] }) {
  if (events.length === 0) {
    return null;
  }
  const topEvents = events.slice(0, 3);
  return (
    <View style={upStyles.wrap}>
      <Text style={upStyles.heading} accessibilityRole="header">
        Upcoming Paw-Bumps
      </Text>
      <FlatList
        data={topEvents}
        keyExtractor={(item) => item.id}
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        alwaysBounceHorizontal
        alwaysBounceVertical={false}
        scrollEventThrottle={16}
        scrollEnabled={topEvents.length > 1}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={upStyles.row}
        renderItem={({ item: ev }) => (
          <View style={upStyles.card}>
            <Text style={upStyles.cardTitle}>{ev.title}</Text>
            <Text style={upStyles.cardMeta}>{ev.location}</Text>
            <Text style={upStyles.cardMeta}>{ev.when}</Text>
            <Pressable
              style={({ pressed }) => [upStyles.cta, pressed && upStyles.ctaPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${ev.title}. Count us in`}
            >
              <Text style={upStyles.ctaText}>Count Us In</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const upStyles = StyleSheet.create({
  wrap: {
    marginBottom: theme.spacing.lg,
  },
  heading: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.feed.postHorizontalInset,
  },
  row: {
    paddingHorizontal: theme.feed.postHorizontalInset,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  card: {
    width: Math.min(SCREEN_W * 0.72, 280),
    backgroundColor: theme.colors.card.light,
    borderRadius: 16,
    padding: 16,
    ...theme.shadowsRN.sm,
  },
  cardTitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.sm,
  },
  cardMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    marginBottom: theme.spacing.xs,
  },
  cta: {
    marginTop: theme.spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary.light,
    borderRadius: theme.borderRadius.md,
  },
  ctaPressed: { opacity: 0.92 },
  ctaText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semibold,
    color: theme.components.button.primaryText,
  },
});

/* ——— Post card (image ~70% + text ~30%) ——— */
function FeedPostCard({ post }) {
  const vignetteEnd = `rgba(143, 175, 155, ${theme.feed.vignettePrimaryOpacity})`;

  return (
    <View style={postStyles.card} accessibilityLabel={`Photo post. ${post.caption}`}>
      <View style={postStyles.imageShell}>
        <Image source={{ uri: post.imageUri }} style={postStyles.image} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(143,175,155,0)', vignetteEnd]}
          start={{ x: 0.5, y: 0.25 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>
      <View style={postStyles.textBlock}>
        <Text style={[postStyles.caption, { fontFamily: CAPTION_FONT }]} numberOfLines={2}>
          {post.caption}
        </Text>
        <Text style={postStyles.identity}>{post.identityLabel}</Text>
        <Text style={postStyles.location}>{post.location}</Text>
        <Text style={[postStyles.date, { fontFamily: CAPTION_FONT }]}>
          {post.dateDisplay ?? formatFeedPostDate(post.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const postStyles = StyleSheet.create({
  card: {
    width: POST_W,
    alignSelf: 'center',
    aspectRatio: theme.feed.postAspectRatio,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.card.light,
  },
  imageShell: {
    flex: 7,
    borderWidth: 2.5,
    borderColor: theme.feed.crayonBorder,
    borderRadius: 12,
    overflow: 'hidden',
    margin: 0,
  },
  image: {
    flex: 1,
    width: '100%',
  },
  textBlock: {
    flex: 3,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: theme.colors.card.light,
  },
  caption: {
    fontSize: 18,
    color: theme.colors.text.primary.light,
    marginBottom: LINE_GAP,
  },
  identity: {
    fontFamily: theme.fonts.body,
    fontWeight: '600',
    fontSize: 15,
    color: theme.colors.text.primary.light,
    marginBottom: LINE_GAP,
  },
  location: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.text.secondary.light,
    marginBottom: LINE_GAP,
  },
  date: {
    fontSize: 12,
    color: theme.colors.text.muted.light,
  },
});

const LIKE_HEART_PURPLE = '#7B61FF';

const DOUBLE_PUMP_SPRING = {
  friction: 4,
  tension: 180,
  useNativeDriver: true,
};

/** Apple-style double pump: out → recoil → smaller pump → settle (~300ms). No loops. */
function runLikeDoublePump(likeScale) {
  likeScale.stopAnimation();
  likeScale.setValue(1);
  Animated.sequence([
    Animated.spring(likeScale, { toValue: 1.25, ...DOUBLE_PUMP_SPRING }),
    Animated.spring(likeScale, { toValue: 0.92, ...DOUBLE_PUMP_SPRING }),
    Animated.spring(likeScale, { toValue: 1.12, ...DOUBLE_PUMP_SPRING }),
    Animated.spring(likeScale, { toValue: 1.0, ...DOUBLE_PUMP_SPRING }),
  ]).start(() => {
    likeScale.setValue(1);
  });
}

const LIKE_DEBOUNCE_MS = 1000;

/* ——— Heart + Share row (outside card) ——— */
function PostActionsRow({ liked, onToggleLike, onShare, likePumpNonce, onLikeReceived }) {
  const likeScale = useRef(new Animated.Value(1)).current;
  const lastTapRef = useRef(0);
  const prevPumpNonceRef = useRef(null);

  const playPumpOnly = useCallback(() => {
    runLikeDoublePump(likeScale);
  }, [likeScale]);

  /** Phase 2: parent stores `playPumpOnly` (e.g. for Supabase Realtime) to replay the pump without toggling. */
  useEffect(() => {
    onLikeReceived?.(playPumpOnly);
  }, [onLikeReceived, playPumpOnly]);

  /** Phase 2: increment `likePumpNonce` to replay double-pump from outside (no toggle). */
  useEffect(() => {
    if (likePumpNonce === undefined || likePumpNonce === null) {
      return;
    }
    if (prevPumpNonceRef.current === null) {
      prevPumpNonceRef.current = likePumpNonce;
      return;
    }
    if (likePumpNonce !== prevPumpNonceRef.current) {
      prevPumpNonceRef.current = likePumpNonce;
      playPumpOnly();
    }
  }, [likePumpNonce, playPumpOnly]);

  const handleHeartPress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < LIKE_DEBOUNCE_MS) {
      return;
    }
    lastTapRef.current = now;
    runLikeDoublePump(likeScale);
    onToggleLike();
  };

  return (
    <View style={actStyles.row}>
      <Pressable
        onPress={handleHeartPress}
        style={({ pressed }) => [actStyles.hit, pressed && actStyles.hitPressed]}
        accessibilityRole="button"
        accessibilityLabel={liked ? 'Unlike this post' : 'Like this post'}
      >
        <Animated.View style={{ transform: [{ scale: likeScale }] }}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={28}
            color={liked ? LIKE_HEART_PURPLE : theme.colors.text.muted.light}
          />
        </Animated.View>
      </Pressable>
      <Pressable
        onPress={onShare}
        style={({ pressed }) => [actStyles.hit, pressed && actStyles.hitPressed]}
        accessibilityRole="button"
        accessibilityLabel="Share this post"
      >
        <Ionicons name="share-outline" size={26} color={theme.colors.text.secondary.light} />
      </Pressable>
    </View>
  );
}

const actStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  hit: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hitPressed: { opacity: 0.85 },
});

/* ——— Screen ——— */
export default function HomeScreen({ navigation, route }) {
  const { activePetId, loading: petContextLoading } = useActivePet();

  const [pets, setPets] = useState([]);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [likedIds, setLikedIds] = useState([]);
  const [feedSessionKey, setFeedSessionKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [listHeaderHeight, setListHeaderHeight] = useState(0);
  const lastEndRefreshAt = useRef(0);

  const mapPostRow = useCallback((t, index, refreshKey) => {
    return {
      type: 'post',
      id: `post-${refreshKey}-${index}-${t.id}`,
      imageUri: t.imageUrl,
      caption: t.caption,
      identityLabel: t.petName ? `— ${t.petName}` : '—',
      location: t.location,
      createdAt: t.createdAt ?? new Date().toISOString(),
      dateDisplay: t.dateDisplay ?? null,
    };
  }, []);

  const fetchPets = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setIsAuthenticated(false);
      setPets([]);
      return;
    }
    setIsAuthenticated(true);
    const { data, error } = await supabase
      .from('pets')
      .select('id, name, photo_url, pet_type, pet_type_custom, breed')
      .eq('owner_id', user.id);
    if (error) {
      console.log('[Home] pets fetch error:', error);
      setPets([]);
      return;
    }
    const rows = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name ?? '',
      avatarUrl: row.photo_url || null,
      pet_type: row.pet_type ?? '',
      pet_type_custom: row.pet_type_custom ?? '',
      breed: row.breed ?? '',
    }));
    setPets(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPets();
    }, [fetchPets]),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const likes = await getLikedPostIds();
      if (!cancelled) {
        setLikedIds(likes);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const feedItems = useMemo(() => {
    // TODO Phase 2: Replace mocks with Supabase query WHERE pet_id IN (activePetId, followedPets)
    const mockPosts = DEMO_FEED_POSTS.map((post) => ({
      ...post,
      petId: post.petName ? post.petName.toLowerCase() : 'unknown',
    }));
    const selectedPet = pets.find((pet) => String(pet.id) === String(activePetId));
    const selectedSlug = selectedPet?.name ? selectedPet.name.toLowerCase() : null;
    const filteredPosts =
      activePetId && selectedSlug ? mockPosts.filter((post) => post.petId === selectedSlug) : [];
    const sourcePosts = filteredPosts.length > 0 ? filteredPosts : mockPosts;
    console.log(`[Feed] Rendering ${sourcePosts.length} posts`);
    return buildRotatedFeed(sourcePosts, mapPostRow, DEMO_FEED_ROTATION_EVENTS, feedSessionKey).filter(
      (item) => item.type !== 'event',
    );
  }, [activePetId, feedSessionKey, mapPostRow, pets]);

  const { getItemLayout } = useMemo(
    () => buildFeedItemLayoutGetters(feedItems, listHeaderHeight),
    [feedItems, listHeaderHeight],
  );

  const refreshFeed = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPets();
      setFeedSessionKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPets]);

  const onEndReached = useCallback(() => {
    const now = Date.now();
    if (now - lastEndRefreshAt.current < 4000) {
      return;
    }
    lastEndRefreshAt.current = now;
    refreshFeed();
  }, [refreshFeed]);

  const openAccountSheet = () => {
    setAccountSheetOpen(true);
  };
  const closeAccountSheet = () => setAccountSheetOpen(false);

  const onAddPet = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('name, city').eq('id', user.id).single();
    const params = {
      fullName: profile?.name ?? '',
      city: profile?.city ?? '',
    };
    const stackNav = navigation.getParent?.()?.getParent?.();
    if (stackNav?.navigate) {
      stackNav.navigate('OnboardingPets', params);
    } else {
      navigation.navigate('OnboardingPets', params);
    }
  };

  const onManagePets = () => {
    const stackNav = navigation.getParent?.()?.getParent?.();
    if (stackNav?.navigate) {
      stackNav.navigate('ManagePets');
      return;
    }
    navigation.navigate('ManagePets');
  };

  const onNotifications = () => {
    console.log('[Home] Notifications settings stub tapped');
  };

  const onLocationPreferences = () => {
    console.log('[Home] Location preferences settings stub tapped');
  };

  const onPrivacy = () => {
    console.log('[Home] Privacy settings stub tapped');
  };

  const onHelp = () => {
    console.log('[Home] Help & support stub tapped');
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    const stackNav = navigation.getParent?.()?.getParent?.();
    if (stackNav?.navigate) {
      stackNav.navigate('Auth');
      return;
    }
    navigation.navigate('Auth');
  };

  // Public viewing flags can be passed by future routes that show community/public pet context.
  const isPublicContext = Boolean(route?.params?.publicPetId) || Boolean(route?.params?.communityView);
  const showSettingsTrigger = isAuthenticated && !isPublicContext;

  const handleToggleLike = useCallback(async (postId) => {
    const next = await toggleLikedPost(postId);
    setLikedIds(next);
  }, []);

  const renderItem = useCallback(
    ({ item }) => {
      const liked = likedIds.includes(item.id);
      return (
        <View style={styles.feedItemWrap}>
          <FeedPostCard post={item} />
          <PostActionsRow
            liked={liked}
            onToggleLike={() => handleToggleLike(item.id)}
            onShare={() => shareFeedPost(item)}
          />
        </View>
      );
    },
    [likedIds, handleToggleLike],
  );

  const listHeader = useMemo(
    () => (
      <View onLayout={(e) => setListHeaderHeight(e.nativeEvent.layout.height)}>
        <UpcomingPawBumps events={DEMO_UPCOMING_EVENTS} />
      </View>
    ),
    [],
  );

  const feedEmptyComponent = useMemo(
    () => (
      <View style={styles.feedEmpty}>
        <Text style={styles.feedEmptyTitle}>No posts yet</Text>
        <Text style={styles.feedEmptySubtitle}>When your community shares moments, they will show up here.</Text>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.screen}>
      <AppHeader onPressSettings={showSettingsTrigger ? openAccountSheet : undefined} />

      {petContextLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={theme.colors.primary.light} />
        </View>
      ) : !activePetId ? (
        <View style={styles.feedEmpty}>
          <Feather name="plus-circle" size={32} color={theme.colors.text.muted.light} />
          <Text style={styles.feedEmptyTitle}>Add a pet to start your feed</Text>
          <Text style={styles.feedEmptySubtitle}>Once you add your first pet, your feed appears here.</Text>
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          nestedScrollEnabled
          getItemLayout={feedItems.length > 0 ? getItemLayout : undefined}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={feedEmptyComponent}
          contentContainerStyle={[styles.listContent, feedItems.length === 0 && styles.listContentEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFeed} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.35}
          accessibilityLabel="Home feed"
        />
      )}
      <UserSheet
        visible={accountSheetOpen}
        onClose={closeAccountSheet}
        onManagePets={onManagePets}
        onNotifications={onNotifications}
        onLocationPreferences={onLocationPreferences}
        onPrivacy={onPrivacy}
        onHelp={onHelp}
        onLogout={onLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background.light,
  },
  listContent: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  feedEmpty: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxxl,
    alignItems: 'center',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedEmptyTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  feedEmptySubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
    lineHeight: 22,
  },
  feedItemWrap: {
    marginBottom: theme.feed.itemGap,
  },
});
