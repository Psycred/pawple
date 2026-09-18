import { Feather } from '@expo/vector-icons';
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PawpleStorageImage from './PawpleStorageImage';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

function PetSelector({ pet, onPress, accessibilityHint, identityLoading = false }) {
  const surfaces = useRuntimeThemeColors();
  const trimmedName = pet?.name?.trim() ?? '';
  const petName = identityLoading ? '' : trimmedName || 'Pets';
  const initial = trimmedName ? trimmedName.charAt(0).toUpperCase() : 'P';

  if (!pet?.photo_url) {
    console.log('[PetSelector] Missing photo_url for active pet', pet?.id ?? 'unknown');
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.selector}
      accessibilityRole="button"
      accessibilityLabel="Switch active pet"
      accessibilityHint={accessibilityHint}
    >
      {pet?.photo_url ? (
        <PawpleStorageImage
          source={{ uri: pet.photo_url }}
          style={[styles.avatar, { backgroundColor: surfaces.backgroundCard }]}
        />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={[styles.initial, { color: surfaces.textPrimary }]}>{initial}</Text>
        </View>
      )}
      {petName ? (
        <Text style={[styles.petName, { color: surfaces.textPrimary }]} numberOfLines={1}>
          {petName}
        </Text>
      ) : null}
      <Feather name="chevron-down" size={theme.fontSizes.md} color={theme.colors.text.muted.light} />
    </TouchableOpacity>
  );
}

export default memo(PetSelector);

const styles = StyleSheet.create({
  selector: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  avatar: {
    width: theme.feed.avatarSize,
    height: theme.feed.avatarSize,
    borderRadius: theme.feed.avatarSize / 2,
    marginRight: theme.spacing.sm,
  },
  avatarFallback: {
    width: theme.feed.avatarSize,
    height: theme.feed.avatarSize,
    borderRadius: theme.feed.avatarSize / 2,
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary.light,
  },
  initial: {
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semibold,
    fontFamily: theme.fonts.body,
  },
  petName: {
    marginRight: theme.spacing.xs,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
  },
});
