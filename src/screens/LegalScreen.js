import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { theme } from '../config/theme';

/**
 * Retired conflicting legal surface.
 * Canonical copy lives on TermsOfService / PrivacyPolicy.
 * Keep this route so older navigate('Legal') calls still land on honest screens.
 */
export default function LegalScreen({ navigation, route }) {
  useEffect(() => {
    const target = route?.params?.type === 'privacy' ? 'PrivacyPolicy' : 'TermsOfService';
    navigation.replace(target);
  }, [navigation, route?.params?.type]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={theme.colors.primary.light} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.screen,
  },
});
