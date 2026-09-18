import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MeetupCard from '../components/MeetupCard';
import MeetupUnavailableModal from '../components/MeetupUnavailableModal';
import LoadErrorRetry from '../components/LoadErrorRetry';
import { openMeetupIfAvailable } from '../lib/openMeetupIfAvailable';
import ScreenWrapper from '../components/ScreenWrapper';
import { theme } from '../config/theme';
import { useActivePet } from '../contexts/ActivePetContext';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { getDemoMeetupsForFeed } from '../data/demoFeed';
import {
  applyDemoMeetupRsvp,
  getDemoJoinedMeetupIdsForPet,
} from '../data/demoMeetupRsvp';
import {
  fetchPetHostingMeetupsByPet,
  fetchPetParticipatingMeetups,
  sortMeetupsByDateAsc,
} from '../services/meetups';

const SEGMENT_ACTIVE_BG = '#9EB8A0';
const SEGMENT_ACTIVE_TEXT = '#FFFFFF';

const HORIZONTAL_PADDING = 24;
const CARD_GAP = 16;

const TABS = [
  { key: 'going', label: 'Going' },
  { key: 'hosting', label: 'Hosting' },
];

function mergeMeetupsById(...groups) {
  const byId = new Map();
  groups.flat().forEach((meetup) => {
    if (meetup?.id) {
      byId.set(String(meetup.id), meetup);
    }
  });
  return sortMeetupsByDateAsc([...byId.values()]);
}

/**
 * Dev-only private Going/Hosting membership from demo fixtures.
 * Going = session-joined viewer pets; Hosting = pet listed in meetup_hosts.
 */
function getDemoMembershipMeetups(petId) {
  if (!__DEV__ || !petId) {
    return { going: [], hosting: [] };
  }

  const petKey = String(petId);
  const joinedIds = new Set(getDemoJoinedMeetupIdsForPet(petKey));
  const fixtures = getDemoMeetupsForFeed()
    .map((meetup) => applyDemoMeetupRsvp(meetup))
    .filter((meetup) => meetup?.status === 'upcoming');

  return {
    going: fixtures.filter((meetup) => joinedIds.has(String(meetup.id))),
    hosting: fixtures
      .filter((meetup) =>
        (meetup.meetup_hosts ?? []).some(
          (row) => String(row?.pet_id ?? '') === petKey,
        ),
      )
      .map((meetup) => ({ ...meetup, is_hosting: true })),
  };
}

function MeetupSegmentedControl({ activeTab, onSelect, surfaces }) {
  return (
    <View
      style={[styles.segmentContainer, { backgroundColor: surfaces.profileTraitChipBackground }]}
      accessibilityRole="tablist"
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <Text
              style={[
                styles.segmentText,
                !active && { color: surfaces.meetupMetaText },
                active && styles.segmentTextActive,
              ]}
              allowFontScaling
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SkeletonCard({ opacity, fillColor }) {
  return (
    <Animated.View style={[styles.skeletonCard, { backgroundColor: fillColor, opacity }]} />
  );
}

function MeetupListSkeleton({ fillColor }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.skeletonList}>
      <SkeletonCard opacity={pulse} fillColor={fillColor} />
      <SkeletonCard opacity={pulse} fillColor={fillColor} />
      <SkeletonCard opacity={pulse} fillColor={fillColor} />
    </View>
  );
}

function EmptyState({ surfaces }) {
  return (
    <View style={[styles.emptyWrap, { backgroundColor: surfaces.backgroundCard }]}>
      <Text style={[styles.emptyText, { color: surfaces.profileHeroBioColor }]} allowFontScaling>
        Nothing yet.
      </Text>
    </View>
  );
}

/**
 * My Meetups — full-width Going / Hosting lists for the active pet.
 */
export default function MyMeetupsScreen({ navigation }) {
  const rootNavigation = useNavigation();
  const { activePetId } = useActivePet();
  const surfaces = useRuntimeThemeColors();

  const [activeTab, setActiveTab] = useState('going');
  const [goingMeetups, setGoingMeetups] = useState([]);
  const [hostingMeetups, setHostingMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [unavailableOpen, setUnavailableOpen] = useState(false);
  const [manageMeetup, setManageMeetup] = useState(null);
  const loadRequestRef = useRef(0);

  const stackNavigation = useMemo(
    () => rootNavigation.getParent?.() ?? navigation,
    [navigation, rootNavigation],
  );

  const loadMeetups = useCallback(async ({ isRefresh = false } = {}) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError(false);

    try {
      if (!activePetId) {
        setGoingMeetups([]);
        setHostingMeetups([]);
        return;
      }

      const [going, hosting] = await Promise.all([
        fetchPetParticipatingMeetups(activePetId),
        fetchPetHostingMeetupsByPet(activePetId),
      ]);

      if (requestId !== loadRequestRef.current) {
        return;
      }

      // Fast Lane: merge private demo Going/Hosting only in development builds.
      if (__DEV__) {
        const demo = getDemoMembershipMeetups(activePetId);
        setGoingMeetups(mergeMeetupsById(going, demo.going));
        setHostingMeetups(mergeMeetupsById(hosting, demo.hosting));
      } else {
        setGoingMeetups(going);
        setHostingMeetups(hosting);
      }
      setLoadError(false);
    } catch (error) {
      console.error('[MyMeetups] load failed', error);
      setLoadError(true);
      setGoingMeetups([]);
      setHostingMeetups([]);
    } finally {
      if (requestId !== loadRequestRef.current) {
        return;
      }
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [activePetId]);

  const onRefresh = useCallback(() => {
    loadMeetups({ isRefresh: true });
  }, [loadMeetups]);

  useFocusEffect(
    useCallback(() => {
      loadMeetups();
    }, [loadMeetups]),
  );

  const openMeetupDetails = useCallback(
    (meetup) => {
      openMeetupIfAvailable({
        navigation: stackNavigation,
        meetupId: meetup?.id,
        meetup,
        onUnavailable: () => setUnavailableOpen(true),
      });
    },
    [stackNavigation],
  );

  const activeMeetups = activeTab === 'going' ? goingMeetups : hostingMeetups;
  const actionVariant = activeTab === 'going' ? 'going' : 'hosting';

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={SEGMENT_ACTIVE_BG}
      colors={[SEGMENT_ACTIVE_BG]}
    />
  );

  const renderMeetup = useCallback(
    ({ item, index }) => (
      <MeetupCard
        meetup={item}
        actionVariant={actionVariant}
        onManage={actionVariant === 'hosting' ? setManageMeetup : undefined}
        onPress={openMeetupDetails}
        style={index < activeMeetups.length - 1 ? styles.meetupCard : styles.meetupCardLast}
      />
    ),
    [actionVariant, activeMeetups.length, openMeetupDetails],
  );

  return (
    <ScreenWrapper
      title="My Meetups"
      showBackButton
      onClose={() => stackNavigation.goBack()}
      backgroundColor={surfaces.meetupCardBackground}
      contentStyle={[styles.screenContent, { backgroundColor: surfaces.meetupCardBackground }]}
      titleStyle={[styles.headerTitle, { color: surfaces.profileHeroNameColor }]}
    >
      <View style={styles.body}>
        <MeetupSegmentedControl
          activeTab={activeTab}
          onSelect={setActiveTab}
          surfaces={surfaces}
        />

        {loading ? (
          <MeetupListSkeleton fillColor={surfaces.meetupSkeletonFill} />
        ) : loadError ? (
          <ScrollView
            contentContainerStyle={styles.emptyScrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            <LoadErrorRetry onRetry={() => loadMeetups()} />
          </ScrollView>
        ) : activeMeetups.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyScrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            <EmptyState surfaces={surfaces} />
          </ScrollView>
        ) : (
          <FlatList
            data={activeMeetups}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMeetup}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          />
        )}
      </View>

      <Modal
        visible={manageMeetup != null}
        transparent
        animationType="fade"
        onRequestClose={() => setManageMeetup(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setManageMeetup(null)} />
        <View style={[styles.sheet, { backgroundColor: surfaces.meetupCardBackground }]}>
          <Text
            style={[styles.sheetTitle, { color: surfaces.profileHeroNameColor }]}
            numberOfLines={2}
            allowFontScaling
          >
            {manageMeetup?.title || 'Meetup'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
            onPress={() => {
              const meetup = manageMeetup;
              setManageMeetup(null);
              openMeetupDetails(meetup);
            }}
          >
            <Text style={[styles.sheetRowText, { color: surfaces.profileHeroNameColor }]} allowFontScaling>
              View details
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}
            onPress={() => setManageMeetup(null)}
          >
            <Text style={[styles.sheetCancelText, { color: surfaces.meetupMetaText }]} allowFontScaling>
              Close
            </Text>
          </Pressable>
        </View>
      </Modal>

      <MeetupUnavailableModal
        visible={unavailableOpen}
        onClose={() => setUnavailableOpen(false)}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 4,
    marginTop: 8,
    marginBottom: 24,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: SEGMENT_ACTIVE_BG,
  },
  segmentText: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  segmentTextActive: {
    color: SEGMENT_ACTIVE_TEXT,
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyScrollContent: {
    flexGrow: 1,
  },
  meetupCard: {
    marginBottom: CARD_GAP,
  },
  meetupCardLast: {
    marginBottom: 0,
  },
  skeletonList: {
    gap: CARD_GAP,
  },
  skeletonCard: {
    height: 280,
    borderRadius: 20,
  },
  emptyWrap: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sheetTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 16,
  },
  sheetRow: {
    minHeight: 52,
    justifyContent: 'center',
  },
  sheetRowText: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
  },
  sheetCancel: {
    marginTop: 16,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
