import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../config/theme';
import BlockConfirmSheet from './BlockConfirmSheet';
import ContentSafetyMenu from './ContentSafetyMenu';
import MatingExploreRow from './MatingExploreRow';
import ReportSheet from './ReportSheet';
import {
  DEFAULT_MATING_RADIUS_KM,
  MATING_DESCRIPTION_MAX,
  MATING_RADIUS_KM_OPTIONS,
  fetchInboundInterest,
  fetchMatingRadiusKm,
  updateMatingDescription,
  updateMatingRadiusKm,
} from '../services/mating';
import { updatePetCompanionDiscovery } from '../services/pets';

/**
 * Owner About — Mating section (intent, distance, explore entry, inbound interest).
 * Keep "Open to Companionship" copy per CURRENT.md Founder lock.
 */
export default function MatingSection({
  petId,
  petName,
  lookingForCompanion = false,
  matingDescription = '',
  onCompanionChange,
  onDescriptionChange,
}) {
  const navigation = useNavigation();
  const [companionOn, setCompanionOn] = useState(lookingForCompanion);
  const [companionBusy, setCompanionBusy] = useState(false);
  const [description, setDescription] = useState(matingDescription ?? '');
  const [descSaving, setDescSaving] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_MATING_RADIUS_KM);
  const [radiusSheet, setRadiusSheet] = useState(false);
  const [radiusBusy, setRadiusBusy] = useState(false);
  const [interest, setInterest] = useState([]);
  const [interestLoading, setInterestLoading] = useState(false);
  const [interestError, setInterestError] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

  useEffect(() => {
    setCompanionOn(lookingForCompanion);
  }, [lookingForCompanion]);

  useEffect(() => {
    setDescription(matingDescription ?? '');
  }, [matingDescription]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const km = await fetchMatingRadiusKm();
        if (!cancelled) {
          setRadiusKm(km);
        }
      } catch (e) {
        console.error('[MatingSection] radius', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadInterest = useCallback(async () => {
    if (!petId || !companionOn) {
      setInterest([]);
      return;
    }
    setInterestLoading(true);
    setInterestError(false);
    try {
      const rows = await fetchInboundInterest(petId);
      setInterest(rows);
    } catch (e) {
      console.error('[MatingSection] interest', e);
      setInterestError(true);
      setInterest([]);
    } finally {
      setInterestLoading(false);
    }
  }, [companionOn, petId]);

  useEffect(() => {
    loadInterest();
  }, [loadInterest]);

  const handleToggle = useCallback(
    async (next) => {
      if (!petId || companionBusy) {
        return;
      }
      const previous = companionOn;
      setCompanionOn(next);
      setCompanionBusy(true);
      try {
        await updatePetCompanionDiscovery(petId, next);
        onCompanionChange?.(next);
        if (!next) {
          setInterest([]);
        }
      } catch (e) {
        console.error('[MatingSection] toggle', e);
        setCompanionOn(previous);
      } finally {
        setCompanionBusy(false);
      }
    },
    [companionBusy, companionOn, onCompanionChange, petId],
  );

  const handleSaveDescription = useCallback(async () => {
    if (!petId || descSaving) {
      return;
    }
    setDescSaving(true);
    try {
      const updated = await updateMatingDescription(petId, description);
      onDescriptionChange?.(updated?.mating_description ?? '');
    } catch (e) {
      console.error('[MatingSection] description', e);
    } finally {
      setDescSaving(false);
    }
  }, [descSaving, description, onDescriptionChange, petId]);

  const handleRadiusSelect = useCallback(
    async (km) => {
      if (radiusBusy) {
        return;
      }
      setRadiusBusy(true);
      try {
        await updateMatingRadiusKm(km);
        setRadiusKm(km);
        setRadiusSheet(false);
      } catch (e) {
        console.error('[MatingSection] radius save', e);
      } finally {
        setRadiusBusy(false);
      }
    },
    [radiusBusy],
  );

  const openDiscovery = useCallback(() => {
    navigation.navigate('MatingDiscoveryScreen', {
      petId,
      petName: petName || 'Pet',
    });
  }, [navigation, petId, petName]);

  const openPet = useCallback(
    (fromPet, pawInterestId) => {
      if (!fromPet?.id) {
        return;
      }
      navigation.navigate('ViewPetProfileScreen', {
        petId: fromPet.id,
        source: 'interest',
        viewerPetId: petId,
        pawInterestId: pawInterestId ?? null,
      });
    },
    [navigation, petId],
  );

  const openInterestSafety = useCallback((row) => {
    const fromPet = row.from_pet ?? { id: row.from_pet_id, name: 'Pet' };
    setReportTarget({
      pawInterestId: row.id,
      reportedUserId: row.from_owner_id,
      blockablePet: fromPet,
    });
    setSafetyOpen(true);
  }, []);

  const displayName = petName?.trim() || 'Pet';

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle} allowFontScaling>
        Mating
      </Text>

      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel} allowFontScaling>
            Open to Companionship
          </Text>
          <Pressable
            onPress={() => handleToggle(!companionOn)}
            disabled={companionBusy}
            style={[styles.switchTrack, companionOn && styles.switchTrackOn]}
            accessibilityRole="switch"
            accessibilityState={{ checked: companionOn, busy: companionBusy }}
            accessibilityLabel="Open to Companionship"
          >
            <View style={[styles.switchThumb, companionOn && styles.switchThumbOn]} />
          </Pressable>
        </View>

        <Text style={styles.fieldLabel} allowFontScaling>
          About mating
        </Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          onEndEditing={handleSaveDescription}
          placeholder="Calm temperament. First litter planned. Health checks up to date."
          placeholderTextColor={theme.colors.placeholder?.value ?? '#9A9A9A'}
          multiline
          maxLength={MATING_DESCRIPTION_MAX}
          editable={!descSaving}
          accessibilityLabel="About mating"
        />

        <Pressable
          onPress={() => setRadiusSheet(true)}
          style={({ pressed }) => [styles.distanceRow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Distance Within ${radiusKm} km`}
        >
          <Text style={styles.distanceLabel} allowFontScaling>
            Distance
          </Text>
          <Text style={styles.distanceValue} allowFontScaling>
            {`Within ${radiusKm} km`}
          </Text>
        </Pressable>

        <Pressable
          onPress={openDiscovery}
          style={({ pressed }) => [styles.exploreLink, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`For ${displayName}`}
        >
          <Text style={styles.exploreLinkText} allowFontScaling>
            {`For ${displayName}`}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.interestTitle} allowFontScaling>
        {`Interest in ${displayName}`}
      </Text>
      {!companionOn ? (
        <Text style={styles.quietEmpty} allowFontScaling>
          Open to Companionship to receive interest.
        </Text>
      ) : interestLoading ? (
        <ActivityIndicator color={theme.colors.brand.sage.value} style={styles.loader} />
      ) : interestError ? (
        <Pressable onPress={loadInterest} accessibilityRole="button">
          <Text style={styles.retry} allowFontScaling>
            Couldn&apos;t load. Try again.
          </Text>
        </Pressable>
      ) : interest.length === 0 ? (
        <Text style={styles.quietEmpty} allowFontScaling>
          No interest yet
        </Text>
      ) : (
        interest.map((row) => {
          const fromPet = row.from_pet ?? row.from_pet_id;
          const pet =
            typeof fromPet === 'object' && fromPet
              ? fromPet
              : { id: row.from_pet_id, name: 'Pet' };
          return (
            <MatingExploreRow
              key={String(row.id)}
              pet={pet}
              onPress={() => openPet(pet, row.id)}
              onMorePress={() => openInterestSafety(row)}
            />
          );
        })
      )}

      <Modal
        visible={radiusSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setRadiusSheet(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setRadiusSheet(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle} allowFontScaling>
            Distance
          </Text>
          {MATING_RADIUS_KM_OPTIONS.map((km) => {
            const selected = km === radiusKm;
            return (
              <Pressable
                key={km}
                onPress={() => handleRadiusSelect(km)}
                disabled={radiusBusy}
                style={({ pressed }) => [
                  styles.radiusOption,
                  selected && styles.radiusOptionSelected,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Within ${km} km`}
              >
                <Text
                  style={[styles.radiusOptionText, selected && styles.radiusOptionTextSelected]}
                  allowFontScaling
                >
                  {`Within ${km} km`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Modal>

      <ContentSafetyMenu
        visible={safetyOpen}
        showReport
        showBlock={Boolean(reportTarget?.blockablePet?.id)}
        blockLabel={`Block ${reportTarget?.blockablePet?.name || 'pet'}`}
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
        targetId={reportTarget?.pawInterestId}
        reportedUserId={reportTarget?.reportedUserId}
        blockablePets={
          reportTarget?.blockablePet?.id
            ? [{ id: reportTarget.blockablePet.id, name: reportTarget.blockablePet.name }]
            : []
        }
        onClose={() => {
          setReportOpen(false);
          setReportTarget(null);
        }}
      />

      <BlockConfirmSheet
        visible={blockOpen}
        pet={
          reportTarget?.blockablePet?.id
            ? { id: reportTarget.blockablePet.id, name: reportTarget.blockablePet.name }
            : null
        }
        onClose={() => setBlockOpen(false)}
        onBlocked={() => {
          setBlockOpen(false);
          setReportTarget(null);
          loadInterest();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
    marginBottom: 12,
  },
  card: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 28,
    gap: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleLabel: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  switchTrack: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.border.light,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: theme.colors.brand.sage.light,
  },
  switchThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.background.card,
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  fieldLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
  input: {
    minHeight: 72,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.colors.background.screen,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    textAlignVertical: 'top',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  distanceLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  distanceValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.brand.sageDark.value,
  },
  exploreLink: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  exploreLinkText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.brand.sageDark.value,
  },
  interestTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    marginBottom: 12,
  },
  quietEmpty: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    marginBottom: 8,
  },
  loader: {
    marginVertical: 16,
  },
  retry: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.brand.sage.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.components.bottomSheet.backdrop,
  },
  sheet: {
    backgroundColor: theme.colors.background.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border.light,
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.text.primary.light,
    marginBottom: 16,
  },
  radiusOption: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: theme.colors.background.screen,
    marginBottom: 8,
  },
  radiusOptionSelected: {
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  radiusOptionText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  radiusOptionTextSelected: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.brand.sageDark.value,
  },
});
