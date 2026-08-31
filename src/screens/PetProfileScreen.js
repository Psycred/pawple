import React, { useCallback, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import MomentCard from '../components/MomentCard';
import MatingSection from '../components/MatingSection';
import PetCompanionCommunitySection from '../components/PetCompanionCommunitySection';
import PetProfileMeetupsSection from '../components/PetProfileMeetupsSection';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { useActivePet } from '../contexts/ActivePetContext';
import { fetchMomentsForPet, formatMomentDisplayDate } from '../services/moments';
import {
  fetchPetProfile,
} from '../services/pets';
import { getPetTypeDisplayLabel } from '../utils/petDisplay';

const TABS = [
  { key: 'journal', label: 'Journal' },
  { key: 'about', label: 'About' },
];

const SEGMENT_ACTIVE_BG = theme.colors.brand.sage.light;
const SEGMENT_ACTIVE_TEXT = theme.colors.text.inverse.light;
const SEGMENT_INACTIVE_TEXT = theme.colors.text.secondary.light;

/** Hero typography — Apple-inspired hierarchy for the profile header. */
const HERO_NAME_COLOR = '#3A312E';
const HERO_MUTED_COLOR = '#666666';
const HERO_BIO_COLOR = '#888888';
const HERO_TRAIT_BG = '#F5F5F5';
const HERO_COMPANION_BG = '#9EB8A0';

function formatHeroAge(age) {
  const raw = age != null ? String(age).trim() : '';
  if (!raw || raw.toLowerCase() === 'unknown') {
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  const unit = n === 1 ? 'yr' : 'yrs';
  return `${raw} ${unit}`;
}

function formatHeroSubtitle(pet) {
  const typeLabel = getPetTypeDisplayLabel(pet);
  const agePart = formatHeroAge(pet?.age);
  if (typeLabel && agePart) {
    return `${typeLabel} • ${agePart}`;
  }
  return typeLabel || agePart || null;
}

function normalizeTraits(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((trait) => typeof trait === 'string' && trait.trim())
    .map((trait) => trait.trim());
}

function truncateBio(bio, maxLength = 100) {
  const trimmed = String(bio ?? '').trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function formatLocationLabel(value) {
  return String(value ?? '').trim().replace(/[;.]+$/, '').trim() || null;
}

function PetProfileHero({ pet, ownerCity, lookingForCompanion, petTraits = [] }) {
  const subtitle = formatHeroSubtitle(pet);
  const bio = truncateBio(pet?.bio);
  const traits = normalizeTraits(petTraits);
  const locationLabel = formatLocationLabel(ownerCity);

  return (
    <View style={styles.heroSection}>
      <View style={styles.heroAvatarShadow}>
        <View style={styles.heroAvatarWrap}>
          {pet?.photo_url ? (
            <Image
              source={{ uri: pet.photo_url }}
              style={styles.heroAvatarImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroAvatarFallback}>
              <Feather name="camera" size={32} color={theme.colors.brand.sage.light} />
            </View>
          )}
        </View>
      </View>

      <Text style={styles.heroName} allowFontScaling>
        {pet?.name || 'Pet'}
      </Text>

      {subtitle ? (
        <Text style={styles.heroSubtitle} allowFontScaling>
          {subtitle}
        </Text>
      ) : null}

      {locationLabel ? (
        <Text style={styles.heroLocation} allowFontScaling>
          {locationLabel}
        </Text>
      ) : null}

      {bio ? (
        <Text style={styles.heroBio} allowFontScaling>
          {bio}
        </Text>
      ) : null}

      {lookingForCompanion ? (
        <View style={styles.companionBadge}>
          <Text style={styles.companionBadgeText} allowFontScaling>
            Open to Companionship
          </Text>
        </View>
      ) : null}

      {traits.length > 0 ? (
        <View style={styles.traitsRow}>
          {traits.map((trait) => (
            <View key={trait} style={styles.traitChip}>
              <Text style={styles.traitChipText} allowFontScaling>
                {trait}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function formatDetailValue(val) {
  if (!val) {
    return null;
  }
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
}

function ProfileSegmentedControl({ activeKey, onSelect }) {
  return (
    <View style={styles.segmentWrap} accessibilityRole="tablist">
      {TABS.map((tab) => {
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
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} allowFontScaling>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DetailRow({ label, value }) {
  if (!value) {
    return null;
  }
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel} allowFontScaling>
        {label}
      </Text>
      <Text style={styles.detailValue} allowFontScaling>
        {value}
      </Text>
    </View>
  );
}

/**
 * Pet-first profile — Journal (moments) and About (details + community signals).
 */
export default function PetProfileScreen() {
  const { user } = useAuth();
  const { activePetId, loading: petLoading } = useActivePet();

  const [activeTab, setActiveTab] = useState('journal');
  const [pet, setPet] = useState(null);
  const [ownerCity, setOwnerCity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [hostedCount, setHostedCount] = useState(0);
  const [participatedCount, setParticipatedCount] = useState(0);
  const [isOwner, setIsOwner] = useState(true);
  const [lookingForCompanion, setLookingForCompanion] = useState(false);
  const [matingDescription, setMatingDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [profileHidden, setProfileHidden] = useState(false);
  const [petTraits, setPetTraits] = useState([]);

  const loadProfile = useCallback(async () => {
    if (!activePetId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const profileData = await fetchPetProfile(activePetId, user?.id ?? null);

      if (!profileData) {
        setProfileHidden(true);
        setPet(null);
        setPetTraits([]);
        setPosts([]);
        return;
      }

      setProfileHidden(false);
      const data = profileData.pet ?? null;
      const petTraits = Array.isArray(data?.traits) ? data.traits : [];
      setPet(data);
      setPetTraits(petTraits);
      setOwnerCity(profileData.ownerCity ?? null);
      setHostedCount(profileData.hosted_count ?? 0);
      setParticipatedCount(profileData.participated_count ?? 0);
      setIsOwner(Boolean(profileData.isOwner));
      setLookingForCompanion(Boolean(profileData.pet?.is_looking_for_companion));
      setMatingDescription(profileData.pet?.mating_description ?? '');

      const petMoments = await fetchMomentsForPet(activePetId);
      setPosts(petMoments);
    } catch (error) {
      console.error('[PetProfileScreen] Fetch error', error);
    } finally {
      setLoading(false);
    }
  }, [activePetId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const details = useMemo(() => {
    const breedRaw = typeof pet?.breed === 'string' ? pet.breed.trim() : '';
    const petTypeRaw = typeof pet?.pet_type === 'string' ? pet.pet_type.trim() : '';
    const genderRaw = typeof pet?.gender === 'string' ? pet.gender.trim() : '';
    const ageValue = pet?.age != null ? String(pet.age).trim() : '';
    const species = formatDetailValue(petTypeRaw);
    const breed = formatDetailValue(breedRaw);
    const gender = formatDetailValue(genderRaw);

    let breedDisplay = '';
    if (species && breed) {
      breedDisplay = `${species} · ${breed}`;
    } else if (breed) {
      breedDisplay = breed;
    } else if (species) {
      breedDisplay = species;
    }

    const vaccinatedRaw = pet?.vaccinated;
    let vaccinatedLabel = null;
    if (vaccinatedRaw === true) {
      vaccinatedLabel = 'Vaccinated';
    } else if (vaccinatedRaw === false) {
      vaccinatedLabel = 'Not vaccinated';
    } else if (typeof vaccinatedRaw === 'string') {
      const normalized = vaccinatedRaw.trim().toLowerCase();
      if (normalized === 'yes' || normalized === 'true') {
        vaccinatedLabel = 'Vaccinated';
      }
      if (normalized === 'no' || normalized === 'false') {
        vaccinatedLabel = 'Not vaccinated';
      }
    }

    const ageDisplay =
      ageValue && ageValue !== 'Unknown'
        ? `${ageValue} ${ageValue === '1' ? 'yr' : 'yrs'}`
        : '';

    return {
      breedDisplay,
      ageDisplay: ageDisplay && ageDisplay !== 'Unknown' ? ageDisplay : '',
      gender: gender && gender !== 'Unknown' ? gender : '',
      vaccinatedLabel,
    };
  }, [pet]);

  const feedMoments = useMemo(
    () =>
      posts.map((m) => ({
        id: m.id,
        photo_url: m.image_url ?? m.photo_url ?? null,
        caption: m.caption ?? '',
        location: m.location ?? '',
        memory_date: formatMomentDisplayDate(m),
        created_at: m.created_at ?? '',
        pet_names: m.pet_names ?? '',
      })),
    [posts],
  );

  const petListForCards = useMemo(
    () => (pet?.id ? [{ id: pet.id, name: pet.name }] : []),
    [pet?.id, pet?.name],
  );

  const renderJournal = () => {
    if (loading) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator color={theme.colors.brand.sage.light} />
        </View>
      );
    }

    if (feedMoments.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText} allowFontScaling>
            No memories yet. Tap + to add one.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={feedMoments}
        keyExtractor={(item, index) => item.id?.toString?.() || String(index)}
        renderItem={({ item }) => (
          <View style={styles.momentSlot}>
            <MomentCard moment={item} userPets={petListForCards} />
          </View>
        )}
        contentContainerStyle={styles.journalList}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderAbout = () => {
    if (loading) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator color={theme.colors.brand.sage.light} />
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.aboutContent}
        showsVerticalScrollIndicator={false}
      >
        {isOwner && activePetId ? (
          <MatingSection
            petId={activePetId}
            petName={pet?.name}
            lookingForCompanion={lookingForCompanion}
            matingDescription={matingDescription}
            onCompanionChange={setLookingForCompanion}
            onDescriptionChange={setMatingDescription}
          />
        ) : null}

        {!isOwner && pet?.mating_description ? (
          <View style={styles.matingReadOnly}>
            <Text style={styles.sectionTitle} allowFontScaling>
              About mating
            </Text>
            <Text style={styles.matingReadOnlyBody} allowFontScaling>
              {pet.mating_description}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle} allowFontScaling>
          Details
        </Text>
        <View style={styles.detailsCard}>
          <DetailRow label="Name" value={pet?.name} />
          <DetailRow label="Breed" value={details.breedDisplay} />
          <DetailRow label="Age" value={details.ageDisplay} />
          <DetailRow label="Gender" value={details.gender} />
          <DetailRow label="Vaccination" value={details.vaccinatedLabel} />
          {ownerCity ? <DetailRow label="City" value={ownerCity} /> : null}
        </View>

        <PetCompanionCommunitySection
          showToggle={false}
          hostedCount={hostedCount}
          participatedCount={participatedCount}
          communityAction={
            isOwner && activePetId ? <PetProfileMeetupsSection /> : null
          }
        />
      </ScrollView>
    );
  };

  if (petLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <AppHeader />
        <View style={styles.tabLoading}>
          <ActivityIndicator color={theme.colors.brand.sage.light} />
        </View>
      </SafeAreaView>
    );
  }

  if (profileHidden) {
    return (
      <SafeAreaView style={styles.screen}>
        <AppHeader />
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText} allowFontScaling>
            This profile is not available.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader />

      <PetProfileHero
        pet={pet}
        ownerCity={ownerCity}
        lookingForCompanion={lookingForCompanion}
        petTraits={petTraits}
      />

      <ProfileSegmentedControl activeKey={activeTab} onSelect={setActiveTab} />

      <View style={styles.tabBody}>
        {activeTab === 'journal' ? renderJournal() : renderAbout()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  heroAvatarShadow: {
    borderRadius: 55,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  heroAvatarWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: 'hidden',
    backgroundColor: theme.colors.background.card,
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
  },
  heroAvatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  heroName: {
    marginTop: 16,
    fontFamily: theme.fonts.semibold,
    fontSize: 28,
    color: HERO_NAME_COLOR,
    textAlign: 'center',
  },
  heroSubtitle: {
    marginTop: 6,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: HERO_MUTED_COLOR,
    textAlign: 'center',
  },
  heroLocation: {
    marginTop: 4,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: HERO_MUTED_COLOR,
    textAlign: 'center',
  },
  heroBio: {
    marginTop: 8,
    paddingHorizontal: 8,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    fontStyle: 'italic',
    color: HERO_BIO_COLOR,
    textAlign: 'center',
    lineHeight: 20,
  },
  companionBadge: {
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: HERO_COMPANION_BG,
  },
  companionBadgeText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.text.inverse.value,
    textAlign: 'center',
  },
  traitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  traitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: HERO_TRAIT_BG,
  },
  traitChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: HERO_NAME_COLOR,
  },
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.card,
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
    backgroundColor: SEGMENT_ACTIVE_BG,
  },
  segmentText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: SEGMENT_INACTIVE_TEXT,
  },
  segmentTextActive: {
    color: SEGMENT_ACTIVE_TEXT,
    fontFamily: theme.fonts.semibold,
  },
  tabBody: {
    flex: 1,
  },
  journalList: {
    paddingBottom: theme.spacing.xxl,
  },
  momentSlot: {
    paddingHorizontal: theme.feed.shellPaddingHorizontal,
  },
  aboutContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  sectionTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.md,
  },
  detailsCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  detailRow: {
    gap: theme.spacing.xs,
  },
  detailLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
  detailValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  tabLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxxl,
  },
  emptyStateText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
  matingReadOnly: {
    marginBottom: 32,
  },
  matingReadOnlyBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    color: theme.colors.text.secondary.light,
  },
});
