import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PawpleStorageImage from './PawpleStorageImage';
import PetContextSelector from './PetContextSelector';
import { Feather } from '@expo/vector-icons';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { HEADER_ICON_TARGET, HEADER_MIN_HEIGHT } from '../utils/layout';

const THREAD_AVATAR_SIZE = 30;

/**
 * Pet-centric chat thread header — quiet back, small avatar, pet name, safety slot.
 */
export default function ChatThreadHeader({
  petName,
  photoUrl,
  onBack,
  onOpenProfile,
  headerRight = null,
}) {
  const surfaces = useRuntimeThemeColors();
  const name = String(petName ?? '').trim() || 'Pet';
  const canOpenProfile = typeof onOpenProfile === 'function';
  const headerTheme = useMemo(
    () => ({
      name: { color: surfaces.textPrimary },
      avatarFallback: {
        backgroundColor: surfaces.isDark
          ? surfaces.meetupChipBackground
          : theme.colors.brand.sageLight.light,
      },
    }),
    [surfaces.isDark, surfaces.meetupChipBackground, surfaces.textPrimary],
  );

  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        <Pressable
          onPress={onBack}
          hitSlop={theme.spacing.sm}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather
            name="chevron-left"
            size={theme.fontSizes.lg}
            color={theme.colors.text.secondary.light}
          />
        </Pressable>
      </View>

      <Pressable
        onPress={onOpenProfile}
        disabled={!canOpenProfile}
        style={({ pressed }) => [
          styles.identity,
          canOpenProfile && pressed && styles.pressed,
        ]}
        accessibilityRole={canOpenProfile ? 'button' : 'text'}
        accessibilityLabel={canOpenProfile ? `Open ${name} profile` : name}
      >
        {photoUrl ? (
          <View style={[styles.avatarWrap, headerTheme.avatarFallback]}>
            <PawpleStorageImage source={{ uri: photoUrl }} style={styles.avatar} />
          </View>
        ) : (
          <PetContextSelector photoUrl={null} size={THREAD_AVATAR_SIZE} />
        )}
        <Text style={[styles.name, headerTheme.name]} numberOfLines={1} allowFontScaling>
          {name}
        </Text>
      </Pressable>

      <View style={[styles.headerSide, styles.headerRight]}>{headerRight}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: HEADER_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    gap: 6,
  },
  headerSide: {
    minWidth: HEADER_ICON_TARGET,
    justifyContent: 'center',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  iconButton: {
    width: HEADER_ICON_TARGET,
    height: HEADER_ICON_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -theme.spacing.sm,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 0,
  },
  avatarWrap: {
    width: THREAD_AVATAR_SIZE,
    height: THREAD_AVATAR_SIZE,
    borderRadius: THREAD_AVATAR_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  name: {
    flexShrink: 1,
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
