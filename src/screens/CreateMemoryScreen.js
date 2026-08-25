import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';

/**
 * Journal entry flow for a new memory (content TBD).
 * Opened from the Moment tab creation hub.
 */
export default function CreateMemoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Text style={styles.title}>Add Memory</Text>
      <Text style={styles.subtitle}>Your journal composer will go here.</Text>
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Text style={styles.closeLabel}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background.light,
    paddingHorizontal: theme.spacing.xl,
    justifyContent: 'center',
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  closeBtn: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    minHeight: theme.components.button.minHeight,
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.8,
  },
  closeLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.action.primary.light,
    fontWeight: theme.fontWeights.semibold,
  },
});
