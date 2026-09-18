import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import DiscoverMomentCard from '../components/DiscoverMomentCard';
import LoadErrorRetry from '../components/LoadErrorRetry';
import MatingSurfaceHeader from '../components/MatingSurfaceHeader';
import PawpleEmptyState from '../components/PawpleEmptyState';
import ScreenWrapper from '../components/ScreenWrapper';
import UnpawConfirmSheet from '../components/UnpawConfirmSheet';
import UnpawReportPrompt from '../components/UnpawReportPrompt';
import ReportSheet from '../components/ReportSheet';
import { theme } from '../config/theme';
import { useActivePet } from '../contexts/ActivePetContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import {
  MATING_DISCOVER_EMPTY_NO_MATCHES_BODY,
  MATING_DISCOVER_EMPTY_NO_MATCHES_TITLE,
  MATING_DISCOVER_EMPTY_STALE_LOCATION_BODY,
  MATING_DISCOVER_EMPTY_STALE_LOCATION_TITLE,
  MATING_DISCOVER_UPDATE_LOCATION_ACTION,
} from '../content/legalDocuments';
import { useMatingUnpawFlow } from '../hooks/useMatingUnpawFlow';
import { promptNotificationPermissionIfNeeded } from '../lib/notifications';
import { openAppSettings, requestLocationPermissionJIT } from '../lib/permissions';
import { fetchApproximateCoords, saveLatestProfileLocation } from '../lib/profileLocation';
import { fetchDiscoverMomentMap, fetchDiscoverProfileMeta } from '../services/discoverMoments';
import {
  expressPaw,
  fetchDiscoverPawState,
  fetchMatingDiscoveryContext,
  fetchMatingOpportunities,
  petsHaveMutualPaw,
} from '../services/mating';

/**
 * Discover tab — browse nearby companion pets via moment/profile cards with inline Paw.
 */
export default function MatingDiscoveryScreen({ navigation, route }) {
  const { activePetId } = useActivePet();
  const { user } = useAuth();
  const petId = route?.params?.petId ?? activePetId;
  const fromTab = Boolean(route?.params?.fromTab);

  const [pet, setPet] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [featuredMoments, setFeaturedMoments] = useState({});
  const [profileMeta, setProfileMeta] = useState({});
  const [locationFresh, setLocationFresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [locationUpdating, setLocationUpdating] = useState(false);
  const [pawBusyId, setPawBusyId] = useState(null);
  const [pawState, setPawState] = useState({
    outbound: new Set(),
    interestByCandidate: {},
    ready: false,
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [unpawTargetId, setUnpawTargetId] = useState(null);
  const [reportPetName, setReportPetName] = useState('');
  const loadSequenceRef = useRef(0);
  /** Pet id that current opportunities belong to — guards stale list on pet switch. */
  const resultsPetIdRef = useRef(null);
  /** Refs for preserveResults — avoid unstable useCallback deps that retrigger focus loads. */
  const petRef = useRef(null);
  const locationFreshRef = useRef(true);
  const errorRef = useRef(false);

  const refreshPawState = useCallback(
    async (rows, { preserveKnownOnFailure = false } = {}) => {
      if (!petId || !rows?.length) {
        setPawState({ outbound: new Set(), interestByCandidate: {}, ready: true });
        return;
      }
      const candidateIds = rows
        .map((row) => row?.pet_id ?? row?.id)
        .filter(Boolean);
      const state = await fetchDiscoverPawState(petId, candidateIds);
      if (!state.ok) {
        setPawState((prev) => {
          if (preserveKnownOnFailure && prev.ready) {
            return prev;
          }
          return { ...prev, ready: false };
        });
        return;
      }
      setPawState({
        outbound: state.outbound,
        interestByCandidate: state.interestByCandidate,
        ready: true,
      });
    },
    [petId],
  );

  const load = useCallback(async () => {
    const sequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = sequence;

    if (!petId) {
      setLoading(false);
      setPet(null);
      petRef.current = null;
      setOpportunities([]);
      resultsPetIdRef.current = null;
      return;
    }

    const preserveResults =
      resultsPetIdRef.current === petId &&
      Boolean(petRef.current?.is_looking_for_companion) &&
      locationFreshRef.current &&
      !errorRef.current &&
      petRef.current != null;

    if (!preserveResults) {
      setLoading(true);
    }
    setError(false);
    errorRef.current = false;
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser?.id) {
        throw new Error('Sign in required');
      }

      const { data: petRow, error: petError } = await supabase
        .from('pets')
        .select(
          'id, name, breed, gender, age, photo_url, mating_description, is_looking_for_companion, owner_id',
        )
        .eq('id', petId)
        .eq('owner_id', authUser.id)
        .maybeSingle();

      if (petError) {
        console.error('[Supabase]', petError);
        throw petError;
      }

      setPet(petRow);
      petRef.current = petRow;

      if (!petRow?.is_looking_for_companion) {
        setOpportunities([]);
        setFeaturedMoments({});
        setProfileMeta({});
        setPawState({ outbound: new Set(), interestByCandidate: {}, ready: true });
        setLocationFresh(true);
        resultsPetIdRef.current = null;
        return;
      }

      const context = await fetchMatingDiscoveryContext(petId);
      setLocationFresh(context.location_fresh);
      locationFreshRef.current = context.location_fresh;

      if (!context.location_fresh) {
        setOpportunities([]);
        setFeaturedMoments({});
        setProfileMeta({});
        setPawState({ outbound: new Set(), interestByCandidate: {}, ready: true });
        resultsPetIdRef.current = null;
        return;
      }

      const rows = await fetchMatingOpportunities(petId);
      if (sequence !== loadSequenceRef.current) {
        return;
      }

      const candidateIds = rows.map((row) => row.pet_id ?? row.id);
      const [momentMap, profileMap] = await Promise.all([
        fetchDiscoverMomentMap(candidateIds, petId),
        fetchDiscoverProfileMeta(candidateIds),
      ]);
      if (sequence !== loadSequenceRef.current) {
        return;
      }

      setOpportunities(rows);
      setFeaturedMoments(Object.fromEntries(momentMap));
      setProfileMeta(Object.fromEntries(profileMap));
      resultsPetIdRef.current = petId;
      try {
        await refreshPawState(rows, {
          preserveKnownOnFailure: preserveResults,
        });
      } catch (pawStateError) {
        console.error('[MatingDiscovery] paw state', pawStateError);
        setPawState((prev) => {
          if (preserveResults && prev.ready) {
            return prev;
          }
          return { ...prev, ready: false };
        });
      }
    } catch (e) {
      if (sequence !== loadSequenceRef.current) {
        return;
      }
      console.error('[MatingDiscovery]', e);
      if (!preserveResults) {
        setError(true);
        errorRef.current = true;
        setOpportunities([]);
        setFeaturedMoments({});
        setProfileMeta({});
        resultsPetIdRef.current = null;
      }
    } finally {
      if (sequence === loadSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [petId, refreshPawState]);

  const unpawFlow = useMatingUnpawFlow({
    viewerPetId: petId,
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

  const optedIn = Boolean(pet?.is_looking_for_companion);

  const handleUpdateLocation = useCallback(async () => {
    setLocationUpdating(true);
    try {
      const granted = await requestLocationPermissionJIT();
      if (!granted) {
        await openAppSettings();
        return;
      }
      const coords = await fetchApproximateCoords();
      if (coords && user?.id) {
        await saveLatestProfileLocation(user.id, coords);
      }
      await load();
    } catch (e) {
      console.error('[MatingDiscovery] location update', e);
      Toast.show({ type: 'error', text1: 'Could not update location.' });
    } finally {
      setLocationUpdating(false);
    }
  }, [load, user?.id]);

  const openCandidate = useCallback(
    (candidate) => {
      const id = candidate?.pet_id ?? candidate?.id;
      if (!id) {
        return;
      }
      navigation.navigate('ViewPetProfileScreen', {
        petId: id,
        source: 'discovery',
        viewerPetId: petId,
      });
    },
    [navigation, petId],
  );

  const dismissReportedProfileCard = useCallback((candidatePetId) => {
    const key = String(candidatePetId);
    setOpportunities((prev) =>
      prev.filter((row) => String(row.pet_id ?? row.id) !== key),
    );
  }, []);

  const handleRowPaw = useCallback(
    async (candidate) => {
      const candidateId = candidate?.pet_id ?? candidate?.id;
      if (!petId || !candidateId || pawBusyId || !pawState.ready) {
        return;
      }
      const key = String(candidateId);
      if (pawState.outbound.has(key)) {
        setUnpawTargetId(candidateId);
        setReportPetName(candidate?.name ?? 'this pet');
        unpawFlow.requestUnpaw();
        return;
      }
      setPawBusyId(candidateId);
      const hadOutbound = pawState.outbound.has(key);
      setPawState((prev) => {
        const outbound = new Set(prev.outbound);
        outbound.add(key);
        return { ...prev, outbound, ready: true };
      });
      try {
        await expressPaw(petId, candidateId);
        const isMutual = await petsHaveMutualPaw(petId, candidateId);
        if (isMutual) {
          await promptNotificationPermissionIfNeeded();
        }
        void load();
      } catch (e) {
        console.error('[MatingDiscovery] paw', e);
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
    [load, pawBusyId, pawState.outbound, pawState.ready, petId, unpawFlow],
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand.sage.value} />
        </View>
      );
    }

    if (error) {
      return <LoadErrorRetry onRetry={load} style={styles.center} />;
    }

    if (!pet) {
      return (
        <PawpleEmptyState
          style={styles.stateCard}
          title="Pet not found"
          body="This pet could not be loaded. Go back and try again."
        >
          {!fromTab ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.primaryBtnText} allowFontScaling>
                Go back
              </Text>
            </Pressable>
          ) : null}
        </PawpleEmptyState>
      );
    }

    if (!optedIn) {
      return (
        <PawpleEmptyState
          style={styles.stateCard}
          title="Not exploring yet"
          body="Open to Mating to discover suitable opportunities nearby."
        >
          {!fromTab ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Back to About"
            >
              <Text style={styles.primaryBtnText} allowFontScaling>
                Back to About
              </Text>
            </Pressable>
          ) : null}
        </PawpleEmptyState>
      );
    }

    if (!locationFresh) {
      return (
        <PawpleEmptyState
          style={styles.stateCard}
          title={MATING_DISCOVER_EMPTY_STALE_LOCATION_TITLE}
          body={MATING_DISCOVER_EMPTY_STALE_LOCATION_BODY}
        >
          <Pressable
            onPress={handleUpdateLocation}
            disabled={locationUpdating}
            style={({ pressed }) => [
              styles.primaryBtn,
              (pressed || locationUpdating) && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={MATING_DISCOVER_UPDATE_LOCATION_ACTION}
          >
            {locationUpdating ? (
              <ActivityIndicator color={theme.colors.text.inverse.value} />
            ) : (
              <Text style={styles.primaryBtnText} allowFontScaling>
                {MATING_DISCOVER_UPDATE_LOCATION_ACTION}
              </Text>
            )}
          </Pressable>
        </PawpleEmptyState>
      );
    }

    if (opportunities.length === 0) {
      return (
        <PawpleEmptyState
          style={[styles.stateCard, styles.noMatchesEmpty]}
          title={MATING_DISCOVER_EMPTY_NO_MATCHES_TITLE}
          body={MATING_DISCOVER_EMPTY_NO_MATCHES_BODY}
        />
      );
    }

    return null;
  };

  const showListOnly =
    optedIn && !loading && !error && locationFresh && opportunities.length > 0;

  const discoverHeader = (
    <MatingSurfaceHeader
      title="Discover"
      variant="discover"
      showBack={!fromTab}
      onBack={() => navigation.goBack()}
    />
  );

  return (
    <ScreenWrapper headerContent={discoverHeader}>
      {!showListOnly ? (
        <View style={styles.scrollPad}>
          {renderBody()}
        </View>
      ) : (
        <FlatList
          data={opportunities}
          keyExtractor={(item) => String(item.pet_id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const candidateId = String(item.pet_id);
            const featuredMoment = featuredMoments[candidateId] ?? null;
            const candidateProfile = profileMeta[candidateId] ?? null;
            const hasMoment = Boolean(featuredMoment);
            const photoUri = hasMoment
              ? featuredMoment?.image_url ?? featuredMoment?.photo_url ?? null
              : item.photo_url ?? null;
            const caption = hasMoment ? String(featuredMoment.caption ?? '').trim() : '';
            const location = hasMoment ? String(featuredMoment.location ?? '').trim() : '';

            return (
              <DiscoverMomentCard
                variant={hasMoment ? 'moment' : 'profile'}
                petId={item.pet_id}
                petName={item.name}
                photoUri={photoUri}
                caption={caption}
                location={location}
                memoryDate={hasMoment ? featuredMoment : ''}
                momentId={hasMoment ? featuredMoment.id : null}
                momentOwnerId={hasMoment ? featuredMoment.user_id : null}
                reportedUserId={candidateProfile?.ownerId ?? null}
                pawInterestId={hasMoment ? null : pawState.interestByCandidate[candidateId] ?? null}
                profilePhotoDate={candidateProfile?.photoDate ?? ''}
                distanceKm={item.distance_km}
                pawExpressed={pawState.outbound.has(candidateId)}
                pawStateKnown={pawState.ready}
                pawBusy={pawBusyId === item.pet_id}
                onProfileReportSubmitted={
                  hasMoment ? undefined : () => dismissReportedProfileCard(item.pet_id)
                }
                onOpenProfile={(resolvedPetId) => {
                  if (!resolvedPetId) {
                    return;
                  }
                  openCandidate({ ...item, pet_id: resolvedPetId });
                }}
                onPawPress={() => handleRowPaw(item)}
                onPetBlocked={() => load()}
              />
            );
          }}
        />
      )}

      <UnpawConfirmSheet
        visible={unpawFlow.confirmVisible}
        busy={unpawFlow.busy}
        onConfirm={async () => {
          try {
            await unpawFlow.confirmUnpaw();
          } catch (e) {
            console.error('[MatingDiscovery] unpaw', e);
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
  scrollPad: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  stateCard: {
    alignSelf: 'stretch',
  },
  // Stretch title/body to content width so PawpleEmptyState textAlign:center applies per line.
  noMatchesEmpty: {
    alignItems: 'stretch',
  },
  primaryBtn: {
    marginTop: 8,
    alignSelf: 'center',
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sage.value,
  },
  primaryBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
