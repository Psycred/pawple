import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import LoadErrorRetry from '../components/LoadErrorRetry';
import MatingExploreRow from '../components/MatingExploreRow';
import ScreenWrapper from '../components/ScreenWrapper';
import { theme } from '../config/theme';
import { useActivePet } from '../contexts/ActivePetContext';
import { supabase } from '../config/supabase';
import {
  fetchMatingOpportunities,
  fetchMatingRadiusKm,
} from '../services/mating';

/**
 * Discovery for the active (or route) pet — orient, then To explore.
 * No inbound interest, swipe deck, or list-row Paw.
 */
export default function MatingDiscoveryScreen({ navigation, route }) {
  const { activePetId } = useActivePet();
  const petId = route?.params?.petId ?? activePetId;
  const routeName = route?.params?.petName;

  const [pet, setPet] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [radiusKm, setRadiusKm] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!petId) {
      setLoading(false);
      setPet(null);
      setOpportunities([]);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        throw new Error('Sign in required');
      }

      const [{ data: petRow, error: petError }, radius] = await Promise.all([
        supabase
          .from('pets')
          .select(
            'id, name, breed, gender, age, photo_url, mating_description, is_looking_for_companion, owner_id',
          )
          .eq('id', petId)
          .eq('owner_id', user.id)
          .maybeSingle(),
        fetchMatingRadiusKm(),
      ]);

      if (petError) {
        console.error('[Supabase]', petError);
        throw petError;
      }

      setPet(petRow);
      setRadiusKm(radius);

      if (!petRow?.is_looking_for_companion) {
        setOpportunities([]);
        return;
      }

      const rows = await fetchMatingOpportunities(petId);
      setOpportunities(rows);
    } catch (e) {
      console.error('[MatingDiscovery]', e);
      setError(true);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const displayName = (routeName || pet?.name || 'Pet').trim() || 'Pet';
  const optedIn = Boolean(pet?.is_looking_for_companion);

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

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      <View style={styles.orientCard}>
        <View style={styles.orientAvatar}>
          {pet?.photo_url ? (
            <Image source={{ uri: pet.photo_url }} style={styles.orientImage} />
          ) : (
            <View style={styles.orientFallback}>
              <Feather name="camera" size={24} color={theme.colors.brand.sage.value} />
            </View>
          )}
        </View>
        <View style={styles.orientText}>
          <Text style={styles.orientName} allowFontScaling>
            {displayName}
          </Text>
          <Text style={styles.orientMeta} numberOfLines={2} allowFontScaling>
            {[pet?.breed, pet?.gender, pet?.age]
              .map((v) => String(v ?? '').trim())
              .filter(Boolean)
              .join(' • ') || 'Exploring for this pet'}
          </Text>
          {pet?.mating_description ? (
            <Text style={styles.orientAbout} numberOfLines={3} allowFontScaling>
              {pet.mating_description}
            </Text>
          ) : null}
        </View>
      </View>

      {optedIn && !loading && !error ? (
        <Text style={styles.exploreHeading} allowFontScaling>
          To explore
        </Text>
      ) : null}
    </View>
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
      return (
        <LoadErrorRetry
          onRetry={load}
          style={styles.center}
        />
      );
    }

    if (!pet) {
      return (
        <View style={styles.center}>
          <Text style={styles.emptyTitle} allowFontScaling>
            Pet not found
          </Text>
        </View>
      );
    }

    if (!optedIn) {
      return (
        <View style={styles.stateCard}>
          <Text style={styles.emptyTitle} allowFontScaling>
            {`For ${displayName}`}
          </Text>
          <Text style={styles.emptyBody} allowFontScaling>
            Open to Companionship to discover suitable opportunities nearby.
          </Text>
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
        </View>
      );
    }

    if (opportunities.length === 0) {
      return (
        <View style={styles.stateCard}>
          <Text style={styles.emptyTitle} allowFontScaling>
            Nothing to explore yet
          </Text>
          <Text style={styles.emptyBody} allowFontScaling>
            {`No suitable opportunities for ${displayName} within ${radiusKm} km yet.`}
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <ScreenWrapper
      title={`For ${displayName}`}
      showBackButton
      onClose={() => navigation.goBack()}
    >
      {loading || error || !pet || !optedIn || opportunities.length === 0 ? (
        <View style={styles.scrollPad}>
          {pet ? renderHeader() : null}
          {renderBody()}
        </View>
      ) : (
        <FlatList
          data={opportunities}
          keyExtractor={(item) => String(item.pet_id)}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MatingExploreRow
              pet={{
                id: item.pet_id,
                name: item.name,
                breed: item.breed,
                gender: item.gender,
                age: item.age,
                photo_url: item.photo_url,
              }}
              distanceKm={item.distance_km}
              onPress={() => openCandidate(item)}
            />
          )}
        />
      )}
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
  headerBlock: {
    marginBottom: 8,
  },
  orientCard: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.background.card,
    marginBottom: 28,
  },
  orientAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  orientImage: {
    width: '100%',
    height: '100%',
  },
  orientFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orientText: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  orientName: {
    fontFamily: theme.fonts.semibold,
    fontSize: 18,
    color: theme.colors.text.primary.light,
  },
  orientMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
  },
  orientAbout: {
    marginTop: 4,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    fontStyle: 'italic',
    color: theme.colors.text.muted.light,
  },
  exploreHeading: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    marginBottom: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  stateCard: {
    paddingVertical: 24,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
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
