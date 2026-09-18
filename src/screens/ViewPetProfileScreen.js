import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import BlockConfirmSheet from '../components/BlockConfirmSheet';
import PawpleStorageImage from '../components/PawpleStorageImage';
import ContentSafetyMenu from '../components/ContentSafetyMenu';
import LoadErrorRetry from '../components/LoadErrorRetry';
import MatingNotForMeAction from '../components/MatingNotForMeAction';
import MatingPawButton from '../components/MatingPawButton';
import ReportSheet from '../components/ReportSheet';
import UnpawConfirmSheet from '../components/UnpawConfirmSheet';
import UnpawReportPrompt from '../components/UnpawReportPrompt';
import ScreenWrapper from '../components/ScreenWrapper';
import { areMatingSurfacesVisible } from '../config/phase1aSurfaces';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { formatMatingIntroProfileCta } from '../content/legalDocuments';
import { useActivePet } from '../contexts/ActivePetContext';
import { useAuth } from '../contexts/AuthContext';
import { promptNotificationPermissionIfNeeded } from '../lib/notifications';
import {
  dismissIncomingPaw,
  expressPaw,
  petsHaveMutualPaw,
  fetchIntroductionChannelForPair,
  fetchInboundPaw,
  fetchOutboundPaw,
  fetchPawInterestForPair,
} from '../services/mating';
import { fetchPetProfile } from '../services/pets';
import { useMatingUnpawFlow } from '../hooks/useMatingUnpawFlow';

const HERO_COMPANION_BG = '#9EB8A0';

/**
 * Read-only pet profile for mating evaluation + profile-only Paw.
 * Fail closed on chat: only navigate when server channel status is open.
 */
export default function ViewPetProfileScreen({ navigation, route }) {
  const surfaces = useRuntimeThemeColors();
  const viewedPetId = route?.params?.petId ?? null;
  const viewerPetIdParam = route?.params?.viewerPetId ?? null;
  const pawInterestIdParam = route?.params?.pawInterestId ?? null;
  const { activePetId } = useActivePet();
  const { user } = useAuth();
  const viewerPetId = viewerPetIdParam || activePetId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pet, setPet] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [viewerOptedIn, setViewerOptedIn] = useState(false);
  const [expressed, setExpressed] = useState(false);
  const [pawBusy, setPawBusy] = useState(false);
  const [dismissBusy, setDismissBusy] = useState(false);
  const [hasInboundPaw, setHasInboundPaw] = useState(false);
  const [channel, setChannel] = useState(null);
  const [mutual, setMutual] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [viewerPetName, setViewerPetName] = useState(null);
  const [pawInterestId, setPawInterestId] = useState(pawInterestIdParam);

  const load = useCallback(async () => {
    if (!viewedPetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const profile = await fetchPetProfile(viewedPetId, user?.id ?? null);
      if (!profile?.pet) {
        setPet(null);
        setError(true);
        return;
      }
      setPet(profile.pet);
      setIsOwner(Boolean(profile.isOwner));

      // Phase 1a: do not load Paw / intro-chat state when mating surfaces are hidden.
      if (!areMatingSurfacesVisible()) {
        setViewerPetName(null);
        setViewerOptedIn(false);
        setExpressed(false);
        setMutual(false);
        setChannel(null);
        setPawInterestId(null);
        setHasInboundPaw(false);
        return;
      }

      let optedIn = false;
      if (viewerPetId && !profile.isOwner) {
        const viewerProfile = await fetchPetProfile(viewerPetId, user?.id ?? null);
        optedIn = Boolean(viewerProfile?.pet?.is_looking_for_companion);
        setViewerPetName(viewerProfile?.pet?.name ?? null);
        setViewerOptedIn(optedIn);

        if (optedIn) {
          const outbound = await fetchOutboundPaw(viewerPetId, viewedPetId);
          const inbound = await fetchInboundPaw(viewedPetId, viewerPetId);
          setExpressed(Boolean(outbound));
          setHasInboundPaw(Boolean(inbound));
          const interestRow =
            pawInterestIdParam != null
              ? { id: pawInterestIdParam }
              : await fetchPawInterestForPair(viewerPetId, viewedPetId);
          setPawInterestId(interestRow?.id ?? null);
          const isMutual = await petsHaveMutualPaw(viewerPetId, viewedPetId);
          setMutual(isMutual);
          if (isMutual) {
            const ch = await fetchIntroductionChannelForPair(viewerPetId, viewedPetId);
            setChannel(ch);
          } else {
            setChannel(null);
          }
        } else {
          setExpressed(false);
          setMutual(false);
          setChannel(null);
          setPawInterestId(null);
          setHasInboundPaw(false);
        }
      } else {
        setViewerPetName(null);
        setViewerOptedIn(false);
        setExpressed(false);
        setMutual(false);
        setChannel(null);
        setPawInterestId(null);
        setHasInboundPaw(false);
      }
    } catch (e) {
      console.error('[ViewPetProfile]', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id, viewedPetId, viewerPetId, pawInterestIdParam]);

  const unpawFlow = useMatingUnpawFlow({
    viewerPetId,
    otherPetId: viewedPetId,
    onUnpawComplete: load,
  });

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const canPaw = useMemo(
    () =>
      Boolean(
        areMatingSurfacesVisible() &&
          viewerPetId &&
          !isOwner &&
          viewerOptedIn &&
          pet?.is_looking_for_companion,
      ),
    [isOwner, pet?.is_looking_for_companion, viewerOptedIn, viewerPetId],
  );

  const introductionOpen = channel?.status === 'open';

  const handleNotForMe = useCallback(async () => {
    if (dismissBusy || !viewerPetId || !viewedPetId || mutual || !hasInboundPaw) {
      return;
    }
    setDismissBusy(true);
    try {
      await dismissIncomingPaw(viewerPetId, viewedPetId);
      navigation.goBack();
    } catch (e) {
      console.error('[ViewPetProfile] dismiss incoming paw', e);
      Toast.show({
        type: 'error',
        text1: e?.userMessage || e?.message || "Couldn't dismiss this paw.",
      });
    } finally {
      setDismissBusy(false);
    }
  }, [dismissBusy, hasInboundPaw, mutual, navigation, viewedPetId, viewerPetId]);

  const handlePaw = useCallback(async () => {
    if (!canPaw || pawBusy || !viewerPetId || !viewedPetId) {
      return;
    }
    if (expressed) {
      unpawFlow.requestUnpaw();
      return;
    }
    setPawBusy(true);
    try {
      const row = await expressPaw(viewerPetId, viewedPetId);
      setExpressed(true);
      setPawInterestId(row?.id ?? null);
      const isMutual = await petsHaveMutualPaw(viewerPetId, viewedPetId);
      setMutual(isMutual);
      if (isMutual) {
        await promptNotificationPermissionIfNeeded();
        let ch = await fetchIntroductionChannelForPair(viewerPetId, viewedPetId);
        if (!ch) {
          await new Promise((r) => setTimeout(r, 400));
          ch = await fetchIntroductionChannelForPair(viewerPetId, viewedPetId);
        }
        setChannel(ch);
      }
    } catch (e) {
      console.error('[ViewPetProfile] paw', e);
      Toast.show({
        type: 'error',
        text1: e?.userMessage || e?.message || "Couldn't update interest.",
      });
    } finally {
      setPawBusy(false);
    }
  }, [canPaw, expressed, pawBusy, unpawFlow, viewedPetId, viewerPetId]);

  const openIntroduction = useCallback(() => {
    if (!areMatingSurfacesVisible() || !introductionOpen || !channel?.id) {
      return;
    }
    navigation.navigate('MatingIntroductionChatScreen', {
      channelId: channel.id,
      otherPetId: viewedPetId,
      otherPetName: pet?.name,
      otherPetPhotoUrl: pet?.photo_url ?? null,
      viewerPetId,
    });
  }, [channel?.id, introductionOpen, navigation, pet?.name, viewedPetId, viewerPetId, viewerPetName]);

  const subtitle = useMemo(() => {
    if (!pet) {
      return null;
    }
    return [pet.breed, pet.gender, pet.age]
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
      .join(' • ');
  }, [pet]);

  const profileTheme = useMemo(
    () => ({
      avatarWrap: { backgroundColor: surfaces.backgroundCard },
      avatarFallback: {
        backgroundColor: surfaces.isDark
          ? surfaces.meetupChipBackground
          : theme.colors.brand.sageLight.light,
      },
      name: { color: surfaces.profileHeroNameColor },
      subtitle: { color: surfaces.profileHeroMutedColor },
      bio: { color: surfaces.profileHeroBioColor },
      sectionTitle: { color: surfaces.textPrimary },
      sectionBody: { color: surfaces.textSecondary },
      traitChip: { backgroundColor: surfaces.profileTraitChipBackground },
      traitText: { color: surfaces.profileHeroNameColor },
      pawHint: { color: surfaces.textMuted },
      introBtn: { backgroundColor: surfaces.backgroundCard },
    }),
    [
      surfaces.backgroundCard,
      surfaces.isDark,
      surfaces.meetupChipBackground,
      surfaces.profileHeroBioColor,
      surfaces.profileHeroMutedColor,
      surfaces.profileHeroNameColor,
      surfaces.profileTraitChipBackground,
      surfaces.textMuted,
      surfaces.textPrimary,
      surfaces.textSecondary,
    ],
  );

  return (
    <ScreenWrapper
      title={pet?.name || 'Pet'}
      showBackButton
      onClose={() => navigation.goBack()}
      headerRight={
        !isOwner && pet ? (
          <Pressable
            onPress={() => setSafetyOpen(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Safety"
          >
            <Feather name="more-horizontal" size={22} color={theme.colors.text.primary.light} />
          </Pressable>
        ) : null
      }
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand.sage.value} />
        </View>
      ) : error || !pet ? (
        <LoadErrorRetry onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={[styles.avatarWrap, profileTheme.avatarWrap]}>
              {pet.photo_url ? (
                <PawpleStorageImage source={{ uri: pet.photo_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarFallback, profileTheme.avatarFallback]}>
                  <Feather name="camera" size={32} color={theme.colors.brand.sage.value} />
                </View>
              )}
            </View>
            <Text style={[styles.name, profileTheme.name]} allowFontScaling>
              {pet.name}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, profileTheme.subtitle]} allowFontScaling>
                {subtitle}
              </Text>
            ) : null}
            {areMatingSurfacesVisible() && pet.is_looking_for_companion ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText} allowFontScaling>
                  Open to Mating
                </Text>
              </View>
            ) : null}
            {pet.bio ? (
              <Text style={[styles.bio, profileTheme.bio]} allowFontScaling>
                {String(pet.bio).trim().slice(0, 100)}
              </Text>
            ) : null}
          </View>

          {areMatingSurfacesVisible() && pet.mating_description ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, profileTheme.sectionTitle]} allowFontScaling>
                About mating
              </Text>
              <Text style={[styles.sectionBody, profileTheme.sectionBody]} allowFontScaling>
                {pet.mating_description}
              </Text>
            </View>
          ) : null}

          {Array.isArray(pet.traits) && pet.traits.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, profileTheme.sectionTitle]} allowFontScaling>
                Traits
              </Text>
              <View style={styles.traits}>
                {pet.traits.map((trait) => (
                  <View key={String(trait)} style={[styles.traitChip, profileTheme.traitChip]}>
                    <Text style={[styles.traitText, profileTheme.traitText]} allowFontScaling>
                      {trait}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Paw sits below evaluation context — never hero-adjacent. */}
          {areMatingSurfacesVisible() && canPaw ? (
            <View style={styles.pawBlock}>
              <View style={styles.pawRow}>
                <MatingPawButton
                  expressed={expressed}
                  matched={mutual}
                  busy={pawBusy || unpawFlow.busy}
                  onPress={handlePaw}
                  labelMatched="Matched"
                />
                {hasInboundPaw && !mutual ? (
                  <MatingNotForMeAction onPress={handleNotForMe} busy={dismissBusy} />
                ) : null}
              </View>
              {!expressed ? (
                <Text style={[styles.pawHint, profileTheme.pawHint]} allowFontScaling>
                  Express interest after you understand this pet.
                </Text>
              ) : mutual ? (
                <Text style={[styles.pawHint, profileTheme.pawHint]} allowFontScaling>
                  Tap to unpaw and end this connection.
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Quiet unlock only when server channel is open — no match celebration. */}
          {areMatingSurfacesVisible() && mutual && introductionOpen ? (
            <Pressable
              onPress={openIntroduction}
              style={({ pressed }) => [
                styles.introBtn,
                profileTheme.introBtn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={formatMatingIntroProfileCta(pet.name)}
            >
              <Text style={styles.introBtnText} allowFontScaling>
                {formatMatingIntroProfileCta(pet.name)}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      <ContentSafetyMenu
        visible={safetyOpen}
        showReport={Boolean(pawInterestId)}
        showBlock
        blockLabel={`Block ${pet?.name || 'pet'}`}
        onClose={() => setSafetyOpen(false)}
        onReport={() => {
          setSafetyOpen(false);
          setReportOpen(true);
        }}
        onBlock={() => {
          setSafetyOpen(false);
          setBlockOpen(true);
        }}
      />

      <ReportSheet
        visible={reportOpen}
        targetType="mating_interest"
        targetId={unpawFlow.reportContext?.targetId ?? pawInterestId}
        reportedUserId={unpawFlow.reportContext?.reportedUserId ?? pet?.owner_id}
        blockablePets={pet ? [{ id: pet.id, name: pet.name }] : []}
        onClose={() => setReportOpen(false)}
        onBlocked={() => {
          setReportOpen(false);
          navigation.goBack();
        }}
      />

      <BlockConfirmSheet
        visible={blockOpen}
        pet={pet ? { id: pet.id, name: pet.name } : null}
        onClose={() => setBlockOpen(false)}
        onBlocked={() => {
          setBlockOpen(false);
          navigation.goBack();
        }}
      />

      <UnpawConfirmSheet
        visible={unpawFlow.confirmVisible}
        busy={unpawFlow.busy}
        onConfirm={async () => {
          try {
            await unpawFlow.confirmUnpaw();
          } catch (e) {
            console.error('[ViewPetProfile] unpaw', e);
            Toast.show({ type: 'error', text1: "Couldn't unpaw. Try again." });
          }
        }}
        onClose={unpawFlow.cancelUnpaw}
      />

      <UnpawReportPrompt
        visible={unpawFlow.reportPromptVisible}
        petName={pet?.name}
        onNo={unpawFlow.dismissReportPrompt}
        onYes={() => {
          unpawFlow.dismissReportPrompt();
          setReportOpen(true);
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
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: 'hidden',
    backgroundColor: theme.colors.background.card,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  name: {
    marginTop: 16,
    fontFamily: theme.fonts.semibold,
    fontSize: 28,
    color: '#3A312E',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
  },
  badge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: HERO_COMPANION_BG,
  },
  badgeText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.text.inverse.value,
  },
  bio: {
    marginTop: 12,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    fontStyle: 'italic',
    color: '#888888',
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    marginBottom: 8,
  },
  sectionBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    color: theme.colors.text.secondary.light,
  },
  traits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  traitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  traitText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: '#3A312E',
  },
  pawBlock: {
    marginTop: 8,
    marginBottom: 20,
    gap: 10,
  },
  pawRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  pawHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
  introBtn: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.brand.sageMuted.value,
    paddingHorizontal: 20,
  },
  introBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.brand.sageDark.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
