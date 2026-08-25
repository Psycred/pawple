import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../config/theme';

const LINK_ACTIVE = '#9EB8A0';

/**
 * Owner-only entry point on the pet About tab → full My Meetups screen.
 */
export default function PetProfileMeetupsSection() {
  const navigation = useNavigation();

  const openMyMeetups = useCallback(() => {
    const stackNav = navigation.getParent?.() ?? navigation;
    stackNav.navigate('MyMeetupsScreen');
  }, [navigation]);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={openMyMeetups}
        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="My Meetups"
      >
        <Text style={styles.linkText} allowFontScaling>
          My Meetups
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  linkButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  linkText: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    color: LINK_ACTIVE,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
