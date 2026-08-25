import React from 'react';
import * as Notifications from 'expo-notifications';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import NotificationNudge from '../components/NotificationNudge';
import { theme } from '../config/theme';

/**
 * Post-pet onboarding: soft ask for notifications. OS dialog only when user taps Enable.
 */
export default function OnboardingFinalScreen({ navigation }) {
  const continueToApp = () => {
    navigation.replace('MainTabs', { screen: 'FeedScreen' });
  };

  const handleEnableNotifications = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        console.log('[Onboarding] Notifications enabled');
      }
    } catch (error) {
      console.log('[OnboardingFinal] Notification permission error:', error);
    } finally {
      continueToApp();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <NotificationNudge onEnablePress={handleEnableNotifications} onDismiss={continueToApp} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxxl,
  },
});
