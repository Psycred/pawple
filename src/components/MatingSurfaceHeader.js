import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { useActivePet } from '../contexts/ActivePetContext';
import PetContextSelector from './PetContextSelector';
import PetSwitchBottomSheet from './PetSwitchBottomSheet';
import { HEADER_ICON_TARGET, HEADER_MIN_HEIGHT } from '../utils/layout';

const PET_AVATAR_SIZE = 40;

/**
 * Discover / Chat hub header — active-pet context + surface title.
 * Reuses PetContextSelector + PetSwitchBottomSheet (same flow as Feed pet switcher).
 */
export default function MatingSurfaceHeader({
  title,
  variant = 'discover',
  showBack = false,
  onBack,
}) {
  const surfaces = useRuntimeThemeColors();
  const navigation = useNavigation();
  const { activePetId, activePet, userPets, setPet } = useActivePet();
  const [sheetOpen, setSheetOpen] = useState(false);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const handleSelectPet = useCallback(
    async (petId) => {
      const pet = userPets.find((row) => String(row.id) === String(petId));
      await setPet(
        petId,
        pet ? { id: pet.id, name: pet.name, photo_url: pet.photo_url } : null,
      );
    },
    [setPet, userPets],
  );

  const handleAddPet = useCallback(() => {
    const parentNav = navigation.getParent?.();
    if (parentNav?.navigate) {
      parentNav.navigate('OnboardingPets', { mode: 'add' });
      return;
    }
    navigation.navigate('OnboardingPets', { mode: 'add' });
  }, [navigation]);

  const petControl = (
    <Pressable
      onPress={openSheet}
      style={({ pressed }) => [styles.petControl, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Switch active pet"
      accessibilityHint="Opens your pet list"
    >
      <PetContextSelector photoUrl={activePet?.photo_url} size={PET_AVATAR_SIZE} />
    </Pressable>
  );

  const sheet = (
    <PetSwitchBottomSheet
      visible={sheetOpen}
      pets={userPets}
      activePetId={activePetId}
      onSelectPet={handleSelectPet}
      onClose={closeSheet}
      onAddPet={handleAddPet}
    />
  );

  if (variant === 'chat') {
    return (
      <>
        <View style={styles.chatHeader}>
          {petControl}
          <Text
            style={[styles.chatTitle, { color: surfaces.textPrimary }]}
            allowFontScaling
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        <View style={[styles.separator, { backgroundColor: surfaces.border }]} />
        {sheet}
      </>
    );
  }

  return (
    <>
      {showBack ? (
        <View style={styles.backRow}>
          <Pressable
            onPress={onBack}
            hitSlop={theme.spacing.sm}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather
              name="chevron-left"
              size={theme.fontSizes.xxl}
              color={theme.colors.text.primary.light}
            />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.discoverHeader}>
        <Text style={[styles.discoverTitle, { color: surfaces.textPrimary }]} allowFontScaling>
          {title}
        </Text>
        {petControl}
      </View>
      <View style={[styles.separator, { backgroundColor: surfaces.border }]} />
      {sheet}
    </>
  );
}

const styles = StyleSheet.create({
  backRow: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  backButton: {
    width: HEADER_ICON_TARGET,
    height: HEADER_ICON_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -theme.spacing.sm,
  },
  discoverHeader: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 16,
  },
  discoverTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.creationTitle,
    lineHeight: Math.round(theme.fontSizes.creationTitle * theme.lineHeights.tight),
    color: theme.colors.text.primary.light,
  },
  chatHeader: {
    minHeight: HEADER_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    gap: 16,
  },
  chatTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
  },
  petControl: {
    alignSelf: 'flex-start',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border.light,
    marginHorizontal: 24,
    marginBottom: 8,
    opacity: 0.65,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
