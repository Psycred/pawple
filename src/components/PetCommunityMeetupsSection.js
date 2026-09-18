import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MeetupCard from './MeetupCard';
import MeetupUnavailableModal from './MeetupUnavailableModal';
import LoadErrorRetry from './LoadErrorRetry';
import { openMeetupIfAvailable } from '../lib/openMeetupIfAvailable';
import { theme } from '../config/theme';
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

const COMMUNITY_TABS = [
  { key: 'hosted', label: 'Hosted' },
  { key: 'joined', label: 'Joined' },
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

function getDemoMembershipMeetups(petId) {
  if (!__DEV__ || !petId) {
    return { joined: [], hosted: [] };
  }

  const petKey = String(petId);
  const joinedIds = new Set(getDemoJoinedMeetupIdsForPet(petKey));
  const fixtures = getDemoMeetupsForFeed()
    .map((meetup) => applyDemoMeetupRsvp(meetup))
    .filter((meetup) => meetup?.status === 'upcoming');

  return {
    joined: fixtures.filter((meetup) => joinedIds.has(String(meetup.id))),
    hosted: fixtures
      .filter((meetup) =>
        (meetup.meetup_hosts ?? []).some((row) => String(row?.pet_id ?? '') === petKey),
      )
      .map((meetup) => ({ ...meetup, is_hosting: true })),
  };
}

function CommunitySegmentedControl({ activeKey, onSelect }) {
  const surfaces = useRuntimeThemeColors();

  return (
    <View
      style={[styles.segmentWrap, { backgroundColor: surfaces.backgroundCard }]}
      accessibilityRole="tablist"
    >
      {COMMUNITY_TABS.map((tab) => {
        const active = tab.key === activeKey;
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
                { color: surfaces.textSecondary },
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

/**
 * Design Wave 1 (D3): Hosted / Joined meetup lists inline on the pet About tab.
 */
export default function PetCommunityMeetupsSection({ petId }) {
  const navigation = useNavigation();
  const surfaces = useRuntimeThemeColors();
  const [activeTab, setActiveTab] = useState('hosted');
  const [joinedMeetups, setJoinedMeetups] = useState([]);
  const [hostedMeetups, setHostedMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [unavailableOpen, setUnavailableOpen] = useState(false);
  const loadRequestRef = useRef(0);

  const stackNavigation = useMemo(
    () => navigation.getParent?.() ?? navigation,
    [navigation],
  );

  const loadMeetups = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoading(true);
    setLoadError(false);

    try {
      if (!petId) {
        setJoinedMeetups([]);
        setHostedMeetups([]);
        return;
      }

      const [joined, hosted] = await Promise.all([
        fetchPetParticipatingMeetups(petId),
        fetchPetHostingMeetupsByPet(petId),
      ]);

      if (requestId !== loadRequestRef.current) {
        return;
      }

      if (__DEV__) {
        const demo = getDemoMembershipMeetups(petId);
        setJoinedMeetups(mergeMeetupsById(joined, demo.joined));
        setHostedMeetups(mergeMeetupsById(hosted, demo.hosted));
      } else {
        setJoinedMeetups(joined);
        setHostedMeetups(hosted);
      }
    } catch (error) {
      console.error('[PetCommunityMeetups] load failed', error);
      setLoadError(true);
      setJoinedMeetups([]);
      setHostedMeetups([]);
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [petId]);

  useEffect(() => {
    loadMeetups();
  }, [loadMeetups]);

  const activeMeetups = activeTab === 'hosted' ? hostedMeetups : joinedMeetups;
  const emptyCopy = activeTab === 'hosted' ? 'Nothing hosted yet.' : 'Nothing joined yet.';

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

  return (
    <View style={styles.wrap}>
      <CommunitySegmentedControl activeKey={activeTab} onSelect={setActiveTab} />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.brand.sage.light} />
        </View>
      ) : loadError ? (
        <LoadErrorRetry onRetry={loadMeetups} />
      ) : activeMeetups.length === 0 ? (
        <View style={[styles.emptyWrap, { backgroundColor: surfaces.backgroundCard }]}>
          <Text style={[styles.emptyText, { color: surfaces.textMuted }]} allowFontScaling>
            {emptyCopy}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {activeMeetups.map((meetup, index) => (
            <MeetupCard
              key={String(meetup.id)}
              meetup={meetup}
              actionVariant="none"
              onPress={openMeetupDetails}
              style={index < activeMeetups.length - 1 ? styles.meetupCard : styles.meetupCardLast}
            />
          ))}
        </View>
      )}

      <MeetupUnavailableModal
        visible={unavailableOpen}
        onClose={() => setUnavailableOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  segmentWrap: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.full,
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: theme.colors.brand.sage.light,
  },
  segmentText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
  },
  segmentTextActive: {
    color: theme.colors.text.inverse.light,
    fontFamily: theme.fonts.semibold,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  list: {
    gap: theme.spacing.md,
  },
  meetupCard: {
    marginBottom: 0,
  },
  meetupCardLast: {
    marginBottom: 0,
  },
});
