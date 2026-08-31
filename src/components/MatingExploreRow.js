import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../config/theme';
import { formatDistanceKm } from '../services/mating';

function formatMeta(pet) {
  const parts = [];
  const breed = String(pet?.breed ?? '').trim();
  const gender = String(pet?.gender ?? '').trim();
  const age = pet?.age != null ? String(pet.age).trim() : '';
  if (breed) {
    parts.push(breed);
  }
  if (gender) {
    parts.push(gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase());
  }
  if (age && age.toLowerCase() !== 'unknown') {
    const n = Number(age);
    parts.push(Number.isFinite(n) ? `${age} ${n === 1 ? 'yr' : 'yrs'}` : age);
  }
  return parts.join(' • ');
}

/**
 * Calm exploration / interest row — navigate only; no Paw on the list.
 */
export default function MatingExploreRow({ pet, distanceKm, onPress, onMorePress }) {
  const meta = formatMeta(pet);
  const distance = formatDistanceKm(distanceKm);
  const name = pet?.name?.trim() || 'Pet';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}'s profile`}
    >
      <View style={styles.avatarWrap}>
        {pet?.photo_url ? (
          <Image source={{ uri: pet.photo_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Feather name="camera" size={20} color={theme.colors.brand.sage.value} />
          </View>
        )}
      </View>
      <View style={styles.textCol}>
        <Text style={styles.name} numberOfLines={1} allowFontScaling>
          {name}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1} allowFontScaling>
            {meta}
          </Text>
        ) : null}
        {distance ? (
          <Text style={styles.distance} numberOfLines={1} allowFontScaling>
            {distance}
          </Text>
        ) : null}
      </View>
      {onMorePress ? (
        <Pressable
          onPress={(e) => {
            e?.stopPropagation?.();
            onMorePress();
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Safety options for ${name}`}
        >
          <Feather name="more-horizontal" size={20} color={theme.colors.text.muted.light} />
        </Pressable>
      ) : (
        <Feather name="chevron-right" size={20} color={theme.colors.text.muted.light} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.background.card,
    marginBottom: 12,
    gap: 12,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: theme.fonts.semibold,
    fontSize: 18,
    color: theme.colors.text.primary.light,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
  },
  distance: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
