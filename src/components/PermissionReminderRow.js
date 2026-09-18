import { Feather } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

/**
 * In-app permission reminder — no title, calm body, Ok / Not now (Phase 4).
 */
export default function PermissionReminderRow({
  body,
  iconName = 'map-pin',
  onOk,
  onNotNow,
}) {
  const surfaces = useRuntimeThemeColors();
  const reminderTheme = useMemo(
    () => ({
      card: {
        backgroundColor: surfaces.isDark
          ? surfaces.meetupChipBackground
          : theme.colors.brand.sageLight.light,
      },
      body: { color: surfaces.textPrimary },
      secondaryBtn: { backgroundColor: surfaces.backgroundCard },
      secondaryBtnText: { color: surfaces.textSecondary },
    }),
    [
      surfaces.backgroundCard,
      surfaces.isDark,
      surfaces.meetupChipBackground,
      surfaces.textPrimary,
      surfaces.textSecondary,
    ],
  );

  return (
    <View style={[styles.card, reminderTheme.card]}>
      <View style={styles.iconWrap}>
        <Feather name={iconName} size={20} color={theme.colors.brand.sageDark.value} />
      </View>
      <Text style={[styles.body, reminderTheme.body]} allowFontScaling>
        {body}
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onNotNow}
          style={({ pressed }) => [
            styles.secondaryBtn,
            reminderTheme.secondaryBtn,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Text style={[styles.secondaryBtnText, reminderTheme.secondaryBtnText]} allowFontScaling>
            Not now
          </Text>
        </Pressable>
        <Pressable
          onPress={onOk}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Open permissions"
        >
          <Text style={styles.primaryBtnText} allowFontScaling>
            Ok
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  iconWrap: {
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: Math.round(theme.fontSizes.md * theme.lineHeights.normal),
    color: theme.colors.text.primary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  primaryBtn: {
    minHeight: 44,
    minWidth: 112,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sage.value,
  },
  primaryBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  secondaryBtn: {
    minHeight: 44,
    minWidth: 112,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.card,
  },
  secondaryBtnText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
