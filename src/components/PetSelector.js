import { Feather } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../config/theme';

function PetSelector({ pet, onPress, accessibilityHint }) {
  const petName = pet?.name?.trim() || 'Your pet';
  const initial = petName.charAt(0).toUpperCase() || 'P';

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
        <Image source={{ uri: pet.photo_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.initial}>{initial}</Text>
        </View>
      )}
      <Text style={styles.petName} numberOfLines={1}>
        {petName}
      </Text>
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
    backgroundColor: theme.colors.card.light,
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
    color: theme.colors.text.primary.light,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semibold,
    fontFamily: theme.fonts.body,
  },
  petName: {
    marginRight: theme.spacing.xs,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    fontWeight: theme.fontWeights.semibold,
  },
});
