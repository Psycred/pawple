import React, { useCallback, useMemo, useState } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
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
import PawpleEmptyState from '../components/PawpleEmptyState';
import {
  PET_JOURNAL_EMPTY_BODY,
  PET_JOURNAL_EMPTY_TITLE,
} from '../content/legalDocuments';
import PawpleStorageImage from '../components/PawpleStorageImage';
import MatingSection from '../components/MatingSection';
import PetCompanionCommunitySection from '../components/PetCompanionCommunitySection';
import PetCommunityMeetupsSection from '../components/PetCommunityMeetupsSection';
import { areMatingSurfacesVisible } from '../config/phase1aSurfaces';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
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
  const surfaces = useRuntimeThemeColors();
  const subtitle = formatHeroSubtitle(pet);
  const bio = truncateBio(pet?.bio);
  const traits = normalizeTraits(petTraits);
  const locationLabel = formatLocationLabel(ownerCity);

  return (
    <View style={styles.heroSection}>
      <View style={styles.heroAvatarShadow}>
        <View style={[styles.heroAvatarWrap, { backgroundColor: surfaces.backgroundCard }]}>
          {pet?.photo_url ? (
            <PawpleStorageImage
              source={{ uri: pet.photo_url }}
              style={styles.heroAvatarImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroAvatarFallback}>
              {lookingForCompanion ? (
                <Ionicons
                  name="paw"
                  size={32}
                  color={theme.colors.brand.sage.value}
                />
              ) : (
                <Feather name="camera" size={32} color={theme.colors.brand.sage.light} />
              )}
            </View>
          )}
        </View>
      </View>

      <Text style={[styles.heroName, { color: surfaces.profileHeroNameColor }]} allowFontScaling>
        {pet?.name || 'Pet'}
      </Text>

      {subtitle ? (
        <Text style={[styles.heroSubtitle, { color: surfaces.profileHeroMutedColor }]} allowFontScaling>
          {subtitle}
        </Text>
      ) : null}

      {locationLabel ? (
        <Text style={[styles.heroLocation, { color: surfaces.profileHeroMutedColor }]} allowFontScaling>
          {locationLabel}
        </Text>
      ) : null}

      {bio ? (
        <Text style={[styles.heroBio, { color: surfaces.profileHeroBioColor }]} allowFontScaling>
          {bio}
        </Text>
      ) : null}

      {lookingForCompanion ? (
        <View style={styles.companionBadge}>
          <Ionicons
            name="paw"
            size={12}
            color={theme.colors.text.inverse.value}
            style={styles.companionBadgeIcon}
          />
          <Text style={styles.companionBadgeText} allowFontScaling>
            Open to Mating
          </Text>
        </View>
      ) : null}

      {traits.length > 0 ? (
        <View style={styles.traitsRow}>
          {traits.map((trait) => (
            <View
              key={trait}
              style={[styles.traitChip, { backgroundColor: surfaces.profileTraitChipBackground }]}
            >
              <Text style={[styles.traitChipText, { color: surfaces.profileHeroNameColor }]} allowFontScaling>
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
  const surfaces = useRuntimeThemeColors();

  return (
    <View
      style={[styles.segmentWrap, { backgroundColor: surfaces.backgroundCard }]}
      accessibilityRole="tablist"
    >
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

function DetailRow({ label, value, isLast = false }) {
  const surfaces = useRuntimeThemeColors();

  if (!value) {
    return null;
  }
  return (
    <View
      style={[
        styles.detailRow,
        !isLast && styles.detailRowDivider,
        !isLast && { borderBottomColor: surfaces.border },
      ]}
    >
      <Text style={[styles.detailLabel, { color: surfaces.textMuted }]} allowFontScaling>
        {label}
      </Text>
      <Text style={[styles.detailValue, { color: surfaces.textPrimary }]} allowFontScaling>
        {value}
      </Text>
    </View>
  );
}

/**
 * Pet-first profile — Journal (moments) and About (details + community signals).
 */
export default function PetProfileScreen({ onMatingAvailabilityChange }) {
  const { user } = useAuth();
  const { activePetId, loading: petLoading } = useActivePet();
  const surfaces = useRuntimeThemeColors();

  const [activeTab, setActiveTab] = useState('journal');
  const [pet, setPet] = useState(null);
  const [ownerCity, setOwnerCity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [hostedCount, setHostedCount] = useState(0);
  const [participatedCount, setParticipatedCount] = useState(0);
  const [isOwner, setIsOwner] = useState(true);
  const [lookingForCompanion, setLookingForCompanion] = useState(false);
  const [matingBreedPreference, setMatingBreedPreference] = useState('');
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
      setMatingBreedPreference(profileData.pet?.mating_breed_preference ?? '');
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

    const genderDisplay = gender && gender !== 'Unknown' ? gender : '';

    let ageGenderDisplay = '';
    if (ageDisplay && genderDisplay) {
      ageGenderDisplay = `${ageDisplay} · ${genderDisplay}`;
    } else {
      ageGenderDisplay = ageDisplay || genderDisplay;
    }

    return {
      breedDisplay,
      ageGenderDisplay,
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
        moment_date: m.moment_date ?? null,
        created_at: m.created_at ?? '',
        pet_names: m.pet_names ?? '',
        pet_ids: Array.isArray(m.pet_ids) ? m.pet_ids : [],
        user_id: m.user_id ?? user?.id ?? null,
        heart_count: Math.max(0, Number(m.heart_count) || 0),
        viewer_has_hearted: Boolean(m.viewer_has_hearted),
      })),
    [posts, user?.id],
  );

  const petListForCards = useMemo(
    () => (pet?.id ? [{ id: pet.id, name: pet.name }] : []),
    [pet?.id, pet?.name],
  );

  const handleCompanionChange = useCallback(
    (nextOpenToMating) => {
      setLookingForCompanion(Boolean(nextOpenToMating));
      onMatingAvailabilityChange?.(Boolean(nextOpenToMating));
    },
    [onMatingAvailabilityChange],
  );

  const handleMomentDeleted = useCallback((momentId) => {
    const id = String(momentId);
    setPosts((prev) => prev.filter((moment) => String(moment?.id) !== id));
  }, []);

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
        <PawpleEmptyState
          style={styles.emptyState}
          title={PET_JOURNAL_EMPTY_TITLE}
          body={PET_JOURNAL_EMPTY_BODY}
        />
      );
    }

    return (
      <FlatList
        data={feedMoments}
        keyExtractor={(item, index) => item.id?.toString?.() || String(index)}
        renderItem={({ item }) => (
          <View style={styles.momentSlot}>
            <MomentCard
              moment={item}
              userPets={petListForCards}
              viewerUserId={user?.id ?? null}
              onMomentDeleted={handleMomentDeleted}
            />
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
        {areMatingSurfacesVisible() && isOwner && activePetId ? (
          <MatingSection
            petId={activePetId}
            petName={pet?.name}
            petGender={pet?.gender}
            matingBreedPreference={matingBreedPreference}
            lookingForCompanion={lookingForCompanion}
            petTraits={petTraits}
            onCompanionChange={handleCompanionChange}
            onTraitsChange={(traits) => {
              setPetTraits(traits);
              setPet((currentPet) =>
                currentPet ? { ...currentPet, traits } : currentPet,
              );
            }}
            onGenderChange={(gender) =>
              setPet((currentPet) =>
                currentPet ? { ...currentPet, gender } : currentPet,
              )
            }
            onBreedPreferenceChange={(preference) => {
              setMatingBreedPreference(preference);
              setPet((currentPet) =>
                currentPet
                  ? { ...currentPet, mating_breed_preference: preference }
                  : currentPet,
              );
            }}
          />
        ) : null}

        {areMatingSurfacesVisible() && !isOwner && pet?.mating_description ? (
          <View style={styles.matingReadOnly}>
            <Text style={[styles.sectionTitle, { color: surfaces.textPrimary }]} allowFontScaling>
              About mating
            </Text>
            <Text style={[styles.matingReadOnlyBody, { color: surfaces.textSecondary }]} allowFontScaling>
              {pet.mating_description}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: surfaces.textPrimary }]} allowFontScaling>
          Details
        </Text>
        <View style={[styles.detailsCard, { backgroundColor: surfaces.backgroundCard }]}>
          {(() => {
            const rows = [
              pet?.name ? { key: 'name', label: 'Name', value: pet.name } : null,
              details.breedDisplay ? { key: 'breed', label: 'Breed', value: details.breedDisplay } : null,
              details.ageGenderDisplay
                ? { key: 'ageGender', label: 'Age / Gender', value: details.ageGenderDisplay }
                : null,
              details.vaccinatedLabel
                ? { key: 'vaccination', label: 'Vaccination', value: details.vaccinatedLabel }
                : null,
              ownerCity ? { key: 'city', label: 'City', value: ownerCity } : null,
            ].filter(Boolean);

            return rows.map((row, index) => (
              <DetailRow
                key={row.key}
                label={row.label}
                value={row.value}
                isLast={index === rows.length - 1}
              />
            ));
          })()}
        </View>

        {isOwner && activePetId ? (
          <>
            <PetCompanionCommunitySection
              showToggle={false}
              hostedCount={hostedCount}
              participatedCount={participatedCount}
            />
            <PetCommunityMeetupsSection petId={activePetId} />
          </>
        ) : null}
      </ScrollView>
    );
  };

  if (petLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: surfaces.backgroundScreen }]}>
        <AppHeader />
        <View style={styles.tabLoading}>
          <ActivityIndicator color={theme.colors.brand.sage.light} />
        </View>
      </SafeAreaView>
    );
  }

  if (profileHidden) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: surfaces.backgroundScreen }]}>
        <AppHeader />
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: surfaces.textMuted }]} allowFontScaling>
            This profile is not available.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: surfaces.backgroundScreen }]}>
      <AppHeader />

      <PetProfileHero
        pet={pet}
        ownerCity={ownerCity}
        lookingForCompanion={areMatingSurfacesVisible() && lookingForCompanion}
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
    textAlign: 'center',
  },
  heroSubtitle: {
    marginTop: 6,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    textAlign: 'center',
  },
  heroLocation: {
    marginTop: 4,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    textAlign: 'center',
  },
  heroBio: {
    marginTop: 8,
    paddingHorizontal: 8,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  companionBadge: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: HERO_COMPANION_BG,
  },
  companionBadgeIcon: {
    marginTop: 1,
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
  },
  traitChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
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
    backgroundColor: SEGMENT_ACTIVE_BG,
  },
  segmentText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
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
    marginBottom: theme.spacing.md,
  },
  detailsCard: {
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: 20,
    paddingVertical: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: theme.spacing.sm,
  },
  detailRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
  },
  detailValue: {
    flex: 1,
    marginLeft: theme.spacing.lg,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    textAlign: 'right',
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
    textAlign: 'center',
  },
  matingReadOnly: {
    marginBottom: 32,
  },
  matingReadOnlyBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
  },
});
