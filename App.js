import { theme } from './src/config/theme'; // ← REQUIRED: Theme import
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { Kalam_400Regular } from '@expo-google-fonts/kalam';
import { ShadowsIntoLight_400Regular } from '@expo-google-fonts/shadows-into-light';
import { useFonts } from 'expo-font';
import Toast from 'react-native-toast-message';
import React, { useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { navigationRef } from './src/navigation/navigationRef';
import { resetToUnauthenticatedEntry } from './src/navigation/resetToUnauthenticatedEntry';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainTabs from './src/navigation/MainTabs';
import WelcomeScreen from './src/screens/WelcomeScreen';
import AgeGateScreen from './src/screens/AgeGateScreen';
import AuthScreen from './src/screens/AuthScreen';
import InviteCodeScreen from './src/screens/InviteCodeScreen';
import { storePendingInvite } from './src/lib/onboardingInvite';
import { parseInviteCodeFromUrl } from './src/lib/inviteLinks';
import LegalScreen from './src/screens/LegalScreen';
import LocationSettingsScreen from './src/screens/LocationSettingsScreen';
import ManagePetsScreen from './src/screens/ManagePetsScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import EditPetScreen from './src/screens/EditPetScreen';
import OnboardingUserScreen from './src/screens/OnboardingUserScreen';
import UnderAgeDeclineScreen from './src/screens/UnderAgeDeclineScreen';
import OnboardingPetsScreen from './src/screens/OnboardingPetsScreen';
import OnboardingFinalScreen from './src/screens/OnboardingFinalScreen';
import PrivacySettingsScreen from './src/screens/PrivacySettingsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PermissionsScreen from './src/screens/PermissionsScreen';
import MomentDetailsScreen from './src/screens/MomentDetailsScreen';
import TermsOfServiceScreen from './src/screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import CommunityGuidelinesScreen from './src/screens/CommunityGuidelinesScreen';
import CreateMeetupScreen from './src/screens/CreateMeetupScreen';
import MeetupDetailsScreen from './src/screens/MeetupDetailsScreen';
import MyMeetupsScreen from './src/screens/MyMeetupsScreen';
import PublicUserProfileScreen from './src/screens/PublicUserProfileScreen';
import CreateMomentScreen from './src/screens/CreateMomentScreen';
import MatingChatListScreen from './src/screens/MatingChatListScreen';
import MatingIntroductionChatScreen from './src/screens/MatingIntroductionChatScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import PawpleAnnouncementScreen from './src/screens/PawpleAnnouncementScreen';
import ViewPetProfileScreen from './src/screens/ViewPetProfileScreen';
import { AppearanceProvider, useAppearance } from './src/contexts/AppearanceContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ActivePetProvider, useActivePet } from './src/contexts/ActivePetContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { PhotoValidationProvider } from './src/contexts/PhotoValidationContext';
import { configurePushNotificationHandlers } from './src/lib/pushNotifications';
import {
  buildNotificationFromPushData,
  getNotificationDestination,
} from './src/lib/notificationNavigation';
import { assertContractEnvironment } from './src/config/environment';
import { areMatingSurfacesVisible } from './src/config/phase1aSurfaces';
import { parseShareDestination } from './src/lib/publicShareLinks';
import {
  clearPendingShareDestination,
  getPendingShareDestination,
  storePendingShareDestination,
} from './src/lib/pendingShareDestination';

const Stack = createNativeStackNavigator();

function parseInviteCode(url) {
  // Shared helper: custom scheme + https://pawple.com/invite/CODE
  return parseInviteCodeFromUrl(url);
}

function navigateToShareDestination(destination) {
  if (!destination?.id || !navigationRef.isReady()) {
    return false;
  }

  if (destination.type === 'moment') {
    navigationRef.navigate('MomentDetailsScreen', {
      momentId: destination.id,
      openedAt: destination.openedAt ?? Date.now(),
    });
    return true;
  }

  if (destination.type === 'meetup') {
    navigationRef.navigate('MeetupDetailsScreen', {
      meetupId: destination.id,
      openedAt: destination.openedAt ?? Date.now(),
    });
    return true;
  }

  return false;
}

function PushNotificationBootstrap() {
  const { setPet } = useActivePet();

  useEffect(() => {
    let cleanup = () => {};

    configurePushNotificationHandlers({
      onNotificationResponse: (response) => {
        const data = response?.notification?.request?.content?.data ?? {};
        const notification = buildNotificationFromPushData(data);
        const destination = getNotificationDestination(notification);
        if (!destination || !navigationRef.isReady()) {
          return;
        }

        if (notification?.targetPetId && typeof setPet === 'function') {
          setPet(String(notification.targetPetId));
        }

        navigationRef.navigate(destination.screen, destination.params);
      },
    }).then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      cleanup();
    };
  }, [setPet]);

  return null;
}

function stackHeaderOptions() {
  return {
    headerStyle: { backgroundColor: theme.colors.background.screen },
    headerTintColor: theme.colors.text.primary.light,
    headerTitleStyle: {
      fontFamily: theme.fonts.heading,
      color: theme.colors.text.primary.light,
    },
  };
}

function AppNavigator() {
  const {
    user,
    authLoading,
    profileLoading,
    hasProfile,
    hasCompletedOnboarding,
    hasAgeAttestation,
    pendingInviteCode,
    rememberPendingInvite,
  } = useAuth();
  const { colorMode } = useAppearance();
  const [navigationReady, setNavigationReady] = useState(false);
  const initialUrlHandledRef = useRef(false);
  const navigationTheme = {
    ...(colorMode === 'dark' ? DarkTheme : DefaultTheme),
    dark: colorMode === 'dark',
    colors: {
      primary: theme.colors.brand.sage.value,
      background: theme.colors.background.screen,
      card: theme.colors.background.card,
      text: theme.colors.text.primary.light,
      border: theme.colors.border.light,
      notification: theme.colors.brand.sage.value,
    },
  };
  const sharedHeaderOptions = stackHeaderOptions();

  useEffect(() => {
    const handleUrl = async (url) => {
      const inviteCode = parseInviteCode(url);

      if (inviteCode) {
        try {
          if (typeof rememberPendingInvite === 'function') {
            await rememberPendingInvite(inviteCode);
          } else {
            await storePendingInvite(user?.id ?? null, inviteCode);
          }
        } catch (error) {
          console.warn('[Invite] Could not store invite link:', error);
        }

        return;
      }

      const parsedDestination = parseShareDestination(url);
      if (!parsedDestination) {
        return;
      }

      const destination = {
        ...parsedDestination,
        openedAt: Date.now(),
      };
      await storePendingShareDestination(user?.id ?? null, destination);

      if (
        user?.id &&
        hasCompletedOnboarding &&
        navigationRef.isReady() &&
        navigateToShareDestination(destination)
      ) {
        await clearPendingShareDestination(user.id);
      }
    };

    if (!initialUrlHandledRef.current) {
      initialUrlHandledRef.current = true;
      Linking.getInitialURL().then(handleUrl).catch(() => {});
    }
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [hasCompletedOnboarding, rememberPendingInvite, user?.id]);

  useEffect(() => {
    if (!navigationReady || !user?.id || !hasCompletedOnboarding) {
      return;
    }

    let cancelled = false;
    const continueToPendingDestination = async () => {
      const destination = await getPendingShareDestination(user.id);
      if (
        cancelled ||
        !destination ||
        !navigateToShareDestination(destination)
      ) {
        return;
      }
      await clearPendingShareDestination(user.id);
    };

    continueToPendingDestination();
    return () => {
      cancelled = true;
    };
  }, [hasCompletedOnboarding, navigationReady, user?.id]);

  useEffect(() => {
    if (!navigationReady || authLoading || user) {
      return;
    }
    const state = navigationRef.getRootState();
    const currentRoute = state?.routes?.[state.index ?? 0]?.name;
    if (currentRoute === 'Welcome') {
      return;
    }
    resetToUnauthenticatedEntry();
  }, [authLoading, navigationReady, user]);

  if (authLoading || (user && profileLoading)) {
    return (
      <View style={[styles.bootstrapContainer, { backgroundColor: theme.colors.background.screen }]}>
        <ActivityIndicator color={theme.colors.primary.light} />
      </View>
    );
  }

  const initialRoute = !user
    ? 'Welcome'
    : hasCompletedOnboarding
      ? 'MainTabs'
      : hasProfile && hasAgeAttestation
        ? 'OnboardingPets'
        : hasProfile || pendingInviteCode
          ? 'OnboardingUser'
          : 'InviteCodeScreen';

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => setNavigationReady(true)}
    >
      <PushNotificationBootstrap />
      <Stack.Navigator
        key={user?.id ?? 'guest'}
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="AgeGate" component={AgeGateScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="InviteCodeScreen" component={InviteCodeScreen} />
        <Stack.Screen name="OnboardingUser" component={OnboardingUserScreen} />
        <Stack.Screen name="UnderAgeDecline" component={UnderAgeDeclineScreen} />
        <Stack.Screen name="OnboardingPets" component={OnboardingPetsScreen} />
        <Stack.Screen name="OnboardingFinal" component={OnboardingFinalScreen} />
        <Stack.Screen
          name="ManagePets"
          component={ManagePetsScreen}
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            headerShown: true,
            title: 'Settings',
            headerBackTitleVisible: false,
            ...sharedHeaderOptions,
          }}
        />
        <Stack.Screen
          name="Permissions"
          component={PermissionsScreen}
          options={{
            headerShown: true,
            title: 'Permissions',
            headerBackTitleVisible: false,
            ...sharedHeaderOptions,
          }}
        />
        <Stack.Screen
          name="MomentDetailsScreen"
          component={MomentDetailsScreen}
          options={{
            headerShown: true,
            title: 'Moment',
            headerBackTitleVisible: false,
            ...sharedHeaderOptions,
          }}
        />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{
            headerShown: true,
            title: 'My Profile',
            headerBackTitleVisible: false,
            ...sharedHeaderOptions,
          }}
        />
        <Stack.Screen
          name="EditPet"
          component={EditPetScreen}
          options={{
            headerShown: true,
            title: 'Edit Pet',
            headerBackTitleVisible: false,
            ...sharedHeaderOptions,
          }}
        />
        <Stack.Screen
          name="TermsOfService"
          component={TermsOfServiceScreen}
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Terms of Service',
            headerBackTitleVisible: false,
            ...sharedHeaderOptions,
          }}
        />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Privacy Policy',
            headerBackTitleVisible: false,
            ...sharedHeaderOptions,
          }}
        />
        <Stack.Screen
          name="CommunityGuidelines"
          component={CommunityGuidelinesScreen}
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Community Guidelines',
            headerBackTitleVisible: false,
            ...sharedHeaderOptions,
          }}
        />
        <Stack.Screen
          name="LocationSettings"
          component={LocationSettingsScreen}
          options={{
            headerShown: true,
            title: 'Location Preferences',
            headerBackTitleVisible: false,
            ...sharedHeaderOptions,
          }}
        />
        <Stack.Screen
          name="PrivacySettings"
          component={PrivacySettingsScreen}
          options={{
            headerShown: true,
            title: 'Blocked pets',
            headerBackTitleVisible: false,
            ...sharedHeaderOptions,
          }}
        />
        <Stack.Screen
          name="Legal"
          component={LegalScreen}
          options={({ route }) => ({
            headerShown: true,
            title: route?.params?.type === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions',
            headerBackTitleVisible: false,
            ...sharedHeaderOptions,
          })}
        />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PawpleAnnouncement"
          component={PawpleAnnouncementScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="CreateMomentScreen"
          component={CreateMomentScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="CreateMeetupScreen"
          component={CreateMeetupScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="MeetupDetailsScreen"
          component={MeetupDetailsScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="MyMeetupsScreen"
          component={MyMeetupsScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PublicUserProfileScreen"
          component={PublicUserProfileScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ViewPetProfileScreen"
          component={ViewPetProfileScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        {areMatingSurfacesVisible() ? (
          <>
            <Stack.Screen
              name="MatingChatListScreen"
              component={MatingChatListScreen}
              options={{ headerShown: false, animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="MatingIntroductionChatScreen"
              component={MatingIntroductionChatScreen}
              options={{ headerShown: false, animation: 'slide_from_right' }}
            />
          </>
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    assertContractEnvironment();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    Kalam: Kalam_400Regular,
    'ShadowsIntoLight-Regular': ShadowsIntoLight_400Regular,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
  });

  return (
    <GestureHandlerRootView style={styles.appRoot}>
      <SafeAreaProvider>
        {!fontsLoaded && !fontError ? (
          <View style={styles.bootstrapContainer}>
            <ActivityIndicator color={theme.colors.primary.light} />
          </View>
        ) : (
          <AppearanceProvider>
            <AuthProvider>
              <PhotoValidationProvider>
                <ActivePetProvider>
                  <NotificationProvider>
                    <AppNavigator />
                    <Toast />
                  </NotificationProvider>
                </ActivePetProvider>
              </PhotoValidationProvider>
            </AuthProvider>
          </AppearanceProvider>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  bootstrapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.light,
  },
});
