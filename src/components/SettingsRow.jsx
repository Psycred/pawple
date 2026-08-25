import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';

/**
 * Reusable row for account sheet actions.
 */
export default function SettingsRow({
  label,
  subtitle,
  onPress,
  showChevron = true,
  chevronSize = theme.fontSizes.md,
  iconName,
  iconColor,
  danger = false,
  withTopGap = false,
  accessibilityLabel,
}) {
  return (
    <View style={[styles.wrapper, withTopGap && styles.withTopGap]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
      >
        {iconName ? (
          <Ionicons
            name={iconName}
            size={20}
            color={iconColor ?? theme.colors.text.muted.light}
            style={styles.leftIcon}
          />
        ) : null}
        <View style={styles.textBlock}>
          <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showChevron ? (
          <Ionicons name="chevron-forward" size={chevronSize} color={theme.colors.text.muted.light} />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  withTopGap: {
    marginTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  row: {
    minHeight: 44,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textBlock: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  leftIcon: {
    marginRight: theme.spacing.sm,
  },
  rowPressed: {
    opacity: 0.8,
  },
  label: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  labelDanger: {
    color: theme.colors.destructive?.light ?? theme.colors.error.light,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
});
