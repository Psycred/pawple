import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../config/theme';

/**
 * Legacy route — no longer part of required onboarding (PAW-222 N2).
 * Immediately continues into the app; OS notification prompt runs after pet submit.
 */
export default function OnboardingFinalScreen({ navigation }) {
  const { refreshProfile } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const continueToApp = async () => {
      try {
        await refreshProfile?.();
      } finally {
        if (!cancelled) {
          navigation.replace('MainTabs', { screen: 'FeedScreen' });
        }
      }
    };
    continueToApp();
    return () => {
      cancelled = true;
    };
  }, [navigation, refreshProfile]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background.screen }}>
      <ActivityIndicator color={theme.colors.primary.light} />
    </View>
  );
}
