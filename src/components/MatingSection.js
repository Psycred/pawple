import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import PawpleConfirmModal from './PawpleConfirmModal';
import MatingLocationGateModal from './MatingLocationGateModal';
import MatingSetupModal from './MatingSetupModal';
import { isForegroundLocationGranted } from '../lib/locationPermission';
import { promptNotificationPermissionIfNeeded } from '../lib/notifications';
import PetTraitsSection from './PetTraitsSection';
import {
  DEFAULT_MATING_RADIUS_KM,
  MATING_COMPANIONSHIP_OFF_CONFIRM_ACTION,
  MATING_COMPANIONSHIP_OFF_CONFIRM_BODY,
  MATING_COMPANIONSHIP_OFF_CONFIRM_CANCEL,
  MATING_COMPANIONSHIP_OFF_CONFIRM_TITLE,
  MATING_RADIUS_KM_OPTIONS,
  SHOW_MATING_RADIUS_PICKER,
  fetchMatingRadiusKm,
  updateMatingRadiusKm,
} from '../services/mating';
import { isValidMatingGender } from '../lib/matingEligibility';
import {
  updatePetCompanionDiscovery,
  updatePetGender,
  updatePetMatingBreedPreference,
} from '../services/pets';

/**
 * Owner About — Mating section (intent, distance, traits).
 * Internal companion identifiers stay stable; the product label is "Open to Mating".
 */
export default function MatingSection({
  petId,
  petName,
  petGender = '',
  matingBreedPreference = '',
  lookingForCompanion = false,
  petTraits = [],
  onCompanionChange,
  onTraitsChange,
  onGenderChange,
  onBreedPreferenceChange,
}) {
  const [companionOn, setCompanionOn] = useState(lookingForCompanion);
  const [companionBusy, setCompanionBusy] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_MATING_RADIUS_KM);
  const [radiusSheet, setRadiusSheet] = useState(false);
  const [radiusBusy, setRadiusBusy] = useState(false);
  const [offConfirmVisible, setOffConfirmVisible] = useState(false);
  const [setupVisible, setSetupVisible] = useState(false);
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [locationGateVisible, setLocationGateVisible] = useState(false);

  useEffect(() => {
    setCompanionOn(lookingForCompanion);
  }, [lookingForCompanion]);

  useEffect(() => {
    if (!SHOW_MATING_RADIUS_PICKER) {
      return undefined;
    }
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

  const applyCompanionToggle = useCallback(
    async (next) => {
      if (!petId || companionBusy) {
        return;
      }
      const previous = companionOn;
      setCompanionBusy(true);
      try {
        await updatePetCompanionDiscovery(petId, next);
        setCompanionOn(next);
        onCompanionChange?.(next);
        return true;
      } catch (e) {
        console.error('[MatingSection] toggle', e);
        setCompanionOn(previous);
        return false;
      } finally {
        setCompanionBusy(false);
      }
    },
    [companionBusy, companionOn, onCompanionChange, petId],
  );

  const openMatingSetup = useCallback(() => {
    setSetupError('');
    setSetupVisible(true);
  }, []);

  const handleToggle = useCallback(
    async (next) => {
      if (!petId || companionBusy) {
        return;
      }
      if (!next && companionOn) {
        setOffConfirmVisible(true);
        return;
      }
      if (next) {
        const granted = await isForegroundLocationGranted();
        if (!granted) {
          setLocationGateVisible(true);
          return;
        }
        openMatingSetup();
        return;
      }
      applyCompanionToggle(next);
    },
    [applyCompanionToggle, companionBusy, companionOn, openMatingSetup, petId],
  );

  const handleSetupConfirm = useCallback(
    async ({ gender, breedPreference }) => {
      if (!petId || setupSaving || companionBusy) {
        return;
      }
      setSetupSaving(true);
      setSetupError('');
      try {
        const locationGranted = await isForegroundLocationGranted();
        if (!locationGranted) {
          setSetupError('Location is required for Open to Mating.');
          return;
        }

        await promptNotificationPermissionIfNeeded();

        if (gender) {
          const updated = await updatePetGender(petId, gender);
          onGenderChange?.(updated?.gender ?? gender);
        }
        const prefRow = await updatePetMatingBreedPreference(petId, breedPreference);
        onBreedPreferenceChange?.(prefRow?.mating_breed_preference ?? breedPreference);
        const enabled = await applyCompanionToggle(true);
        if (!enabled) {
          setSetupError('Could not enable Open to Mating. Try again.');
          return;
        }
        setSetupVisible(false);
      } catch (e) {
        console.error('[MatingSection] mating setup', e);
        setSetupError('Could not save Mating setup. Try again.');
      } finally {
        setSetupSaving(false);
      }
    },
    [
      applyCompanionToggle,
      companionBusy,
      onBreedPreferenceChange,
      onGenderChange,
      petId,
      setupSaving,
    ],
  );

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

  const displayName = petName?.trim() || 'Pet';
  const surfaces = useRuntimeThemeColors();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: surfaces.textPrimary }]} allowFontScaling>
        Mating
      </Text>

      <View style={[styles.card, { backgroundColor: surfaces.backgroundCard }]}>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: surfaces.textPrimary }]} allowFontScaling>
            Open to Mating
          </Text>
          <Pressable
            onPress={() => handleToggle(!companionOn)}
            disabled={companionBusy}
            style={[
              styles.switchTrack,
              { backgroundColor: surfaces.border },
              companionOn && styles.switchTrackOn,
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: companionOn, busy: companionBusy }}
            accessibilityLabel="Open to Mating"
          >
            <View
              style={[
                styles.switchThumb,
                { backgroundColor: surfaces.backgroundCard },
                companionOn && styles.switchThumbOn,
              ]}
            />
          </Pressable>
        </View>

        {SHOW_MATING_RADIUS_PICKER ? (
          <Pressable
            onPress={() => setRadiusSheet(true)}
            style={({ pressed }) => [styles.distanceRow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Distance Within ${radiusKm} km`}
          >
            <Text style={[styles.distanceLabel, { color: surfaces.textPrimary }]} allowFontScaling>
              Distance
            </Text>
            <Text style={styles.distanceValue} allowFontScaling>
              {`Within ${radiusKm} km`}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <PetTraitsSection
        petId={petId}
        petName={petName}
        traits={petTraits}
        onTraitsChange={onTraitsChange}
      />

      <Modal
        visible={radiusSheet && SHOW_MATING_RADIUS_PICKER}
        transparent
        animationType="slide"
        onRequestClose={() => setRadiusSheet(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setRadiusSheet(false)} />
        <View style={[styles.sheet, { backgroundColor: surfaces.backgroundCard }]}>
          <View style={[styles.handle, { backgroundColor: surfaces.border }]} />
          <Text style={[styles.sheetTitle, { color: surfaces.textPrimary }]} allowFontScaling>
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
                  { backgroundColor: surfaces.backgroundScreen },
                  selected && styles.radiusOptionSelected,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Within ${km} km`}
              >
                <Text
                  style={[
                    styles.radiusOptionText,
                    { color: surfaces.textPrimary },
                    selected && styles.radiusOptionTextSelected,
                  ]}
                  allowFontScaling
                >
                  {`Within ${km} km`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Modal>

      <PawpleConfirmModal
        visible={offConfirmVisible}
        busy={companionBusy}
        onClose={() => setOffConfirmVisible(false)}
        onConfirm={() => {
          setOffConfirmVisible(false);
          applyCompanionToggle(false);
        }}
        title={MATING_COMPANIONSHIP_OFF_CONFIRM_TITLE}
        body={MATING_COMPANIONSHIP_OFF_CONFIRM_BODY.replace('[Pet Name]', displayName)}
        cancelLabel={MATING_COMPANIONSHIP_OFF_CONFIRM_CANCEL}
        confirmLabel={MATING_COMPANIONSHIP_OFF_CONFIRM_ACTION}
        icon="pause-circle"
        iconTone="neutral"
        confirmTone="sage"
      />

      <MatingLocationGateModal
        visible={locationGateVisible}
        onClose={() => setLocationGateVisible(false)}
        onGranted={() => {
          setLocationGateVisible(false);
          openMatingSetup();
        }}
      />

      <MatingSetupModal
        visible={setupVisible}
        petName={petName}
        existingGender={isValidMatingGender(petGender) ? petGender : ''}
        existingBreedPreference={matingBreedPreference}
        saving={setupSaving || companionBusy}
        errorText={setupError}
        onConfirm={handleSetupConfirm}
        onClose={() => {
          if (!setupSaving && !companionBusy) {
            setSetupVisible(false);
            setSetupError('');
          }
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
    marginBottom: 12,
  },
  card: {
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
  },
  switchTrack: {
    width: 52,
    height: 32,
    borderRadius: 16,
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
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
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
  },
  distanceValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.brand.sageDark.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.components.bottomSheet.backdrop,
  },
  sheet: {
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
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.xl,
    marginBottom: 16,
  },
  radiusOption: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginBottom: 8,
  },
  radiusOptionSelected: {
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  radiusOptionText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
  },
  radiusOptionTextSelected: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.brand.sageDark.value,
  },
  confirmSheet: {
    backgroundColor: theme.colors.background.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 34,
    gap: 16,
  },
  confirmBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    color: theme.colors.text.secondary.light,
  },
  confirmDestructive: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sage.value,
  },
  confirmDestructiveText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  confirmCancel: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.muted.light,
  },
});
