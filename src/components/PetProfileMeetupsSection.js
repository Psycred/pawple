import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../config/theme';

/**
 * Quiet Community-header action → full My Meetups screen.
 */
export default function PetProfileMeetupsSection() {
  const navigation = useNavigation();

  const openMyMeetups = useCallback(() => {
    const stackNav = navigation.getParent?.() ?? navigation;
    stackNav.navigate('MyMeetupsScreen');
  }, [navigation]);

  return (
    <Pressable
      onPress={openMyMeetups}
      hitSlop={8}
      style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="My Meetups"
    >
      <Text style={styles.linkText} allowFontScaling>
        My Meetups
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linkButton: {
    paddingVertical: theme.spacing.xs,
  },
  linkText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.brand.sage.light,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
