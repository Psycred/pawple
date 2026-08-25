import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';
import PetContextSelector from './PetContextSelector';

const { petBarHeight } = theme.feed;
const HEADER_PET_PHOTO_SIZE = 28;

/**
 * Fixed pet context strip: avatar + name + chevron.
 * Reuse on Profile, Journal, Events, Settings — same props contract.
 */
export default function ActivePetContextBar({ pet, onPress, disabled, rightAccessory }) {
  const name = pet?.name?.trim() || 'Your pet';
  const photo = pet?.avatarUrl ?? pet?.photo_url;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.bar, pressed && styles.barPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Active pet ${name}. Tap to switch pet.`}
      accessibilityHint="Opens list of your pets"
    >
      <View style={styles.avatarWrap}>
        <PetContextSelector photoUrl={photo} size={HEADER_PET_PHOTO_SIZE} style={styles.avatar} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.rightSlot}>
        <Text style={styles.chevron} accessibilityElementsHidden>
          ▾
        </Text>
        {rightAccessory}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: petBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background.light,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.light,
  },
  barPressed: {
    opacity: 0.88,
  },
  avatarWrap: {
    marginRight: theme.spacing.sm,
  },
  avatar: {
    width: HEADER_PET_PHOTO_SIZE,
    height: HEADER_PET_PHOTO_SIZE,
    borderRadius: HEADER_PET_PHOTO_SIZE / 2,
  },
  name: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary.light,
  },
  chevron: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    marginLeft: theme.spacing.xs,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
});
