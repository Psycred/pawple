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
import React, { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/navigation/navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainTabs from './src/navigation/MainTabs';
import AuthScreen from './src/screens/AuthScreen';
import InviteCodeScreen from './src/screens/InviteCodeScreen';
import LegalScreen from './src/screens/LegalScreen';
import LocationSettingsScreen from './src/screens/LocationSettingsScreen';
import ManagePetsScreen from './src/screens/ManagePetsScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import EditPetScreen from './src/screens/EditPetScreen';
import OnboardingUserScreen from './src/screens/OnboardingUserScreen';
import OnboardingPetsScreen from './src/screens/OnboardingPetsScreen';
import OnboardingFinalScreen from './src/screens/OnboardingFinalScreen';
import PrivacySettingsScreen from './src/screens/PrivacySettingsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TermsOfServiceScreen from './src/screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import CreateMeetupScreen from './src/screens/CreateMeetupScreen';
import MeetupDetailsScreen from './src/screens/MeetupDetailsScreen';
import MyMeetupsScreen from './src/screens/MyMeetupsScreen';
import PublicUserProfileScreen from './src/screens/PublicUserProfileScreen';
import CreateMomentScreen from './src/screens/CreateMomentScreen';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ActivePetProvider, useActivePet } from './src/contexts/ActivePetContext';
import { refreshProfileLocationOnAppOpen } from './src/lib/profileLocation';

const Stack = createNativeStackNavigator();

/** Pull the moment id out of pawple://moment/{id} (any host/path arrangement). */
function parseMomentId(url) {
  if (!url) {
    return null;
  }
  try {
    const { hostname, path } = Linking.parse(url);
    let raw = null;
    if (hostname === 'moment') {
      raw = path;
    } else if (path && path.includes('moment/')) {
      raw = path.split('moment/')[1];
    }
    if (!raw) {
      return null;
    }
    return raw.split('/')[0].split('?')[0] || null;
  } catch (e) {
    return null;
  }
}

function AppNavigator() {
  const { user, authLoading, profileLoading, hasProfile, hasCompletedOnboarding } = useAuth();
  const { loading: petLoading } = useActivePet();

  useEffect(() => {
    // pawple://moment/{id} → open the app to the Feed, carrying the moment id.
    // (No standalone moment-detail screen exists yet; Feed is the closest destination.)
    const handleUrl = (url) => {
      const momentId = parseMomentId(url);
      if (!momentId || !navigationRef.isReady()) {
        return;
      }
      navigationRef.navigate('MainTabs', {
        screen: 'FeedScreen',
        params: { sharedMomentId: momentId, openedAt: Date.now() },
      });
    };

    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  // Returning users only: silent coarse refresh or native OS prompt — never custom onboarding UI.
  useEffect(() => {
    if (authLoading || profileLoading || !user?.id || !hasCompletedOnboarding) {
      return;
    }
    refreshProfileLocationOnAppOpen(user.id);
  }, [authLoading, hasCompletedOnboarding, profileLoading, user?.id]);

  if (authLoading || (user && profileLoading) || (user && petLoading)) {
    return (
      <View style={styles.bootstrapContainer}>
        <ActivityIndicator color={theme.colors.primary.light} />
      </View>
    );
  }

  const initialRoute = !user
    ? 'Auth'
    : hasCompletedOnboarding
      ? 'MainTabs'
      : hasProfile
        ? 'OnboardingPets'
        : 'OnboardingUser';

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator key={user?.id ?? 'guest'} initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="InviteCodeScreen" component={InviteCodeScreen} />
        <Stack.Screen name="OnboardingUser" component={OnboardingUserScreen} />
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
            headerStyle: { backgroundColor: theme.colors.background.light },
            headerTintColor: theme.colors.text.primary.light,
            headerTitleStyle: {
              fontFamily: theme.fonts.heading,
              color: theme.colors.text.primary.light,
            },
          }}
        />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{
            headerShown: true,
            title: 'My Profile',
            headerBackTitleVisible: false,
            headerStyle: { backgroundColor: theme.colors.background.light },
            headerTintColor: theme.colors.text.primary.light,
            headerTitleStyle: {
              fontFamily: theme.fonts.heading,
              color: theme.colors.text.primary.light,
            },
          }}
        />
        <Stack.Screen
          name="EditPet"
          component={EditPetScreen}
          options={{
            headerShown: true,
            title: 'Edit Pet',
            headerBackTitleVisible: false,
            headerStyle: { backgroundColor: theme.colors.background.light },
            headerTintColor: theme.colors.text.primary.light,
            headerTitleStyle: {
              fontFamily: theme.fonts.heading,
              color: theme.colors.text.primary.light,
            },
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
            headerStyle: { backgroundColor: theme.colors.background.light },
            headerTintColor: theme.colors.text.primary.light,
            headerTitleStyle: {
              fontFamily: theme.fonts.heading,
              color: theme.colors.text.primary.light,
            },
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
            headerStyle: { backgroundColor: theme.colors.background.light },
            headerTintColor: theme.colors.text.primary.light,
            headerTitleStyle: {
              fontFamily: theme.fonts.heading,
              color: theme.colors.text.primary.light,
            },
          }}
        />
        <Stack.Screen
          name="LocationSettings"
          component={LocationSettingsScreen}
          options={{
            headerShown: true,
            title: 'Location Preferences',
            headerBackTitleVisible: false,
            headerStyle: { backgroundColor: theme.colors.background.light },
            headerTintColor: theme.colors.text.primary.light,
            headerTitleStyle: {
              fontFamily: theme.fonts.heading,
              color: theme.colors.text.primary.light,
            },
          }}
        />
        <Stack.Screen
          name="PrivacySettings"
          component={PrivacySettingsScreen}
          options={{
            headerShown: true,
            title: 'Privacy',
            headerBackTitleVisible: false,
            headerStyle: { backgroundColor: theme.colors.background.light },
            headerTintColor: theme.colors.text.primary.light,
            headerTitleStyle: {
              fontFamily: theme.fonts.heading,
              color: theme.colors.text.primary.light,
            },
          }}
        />
        <Stack.Screen
          name="Legal"
          component={LegalScreen}
          options={({ route }) => ({
            headerShown: true,
            title: route?.params?.type === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions',
            headerBackTitleVisible: false,
            headerStyle: { backgroundColor: theme.colors.background.light },
            headerTintColor: theme.colors.text.primary.light,
            headerTitleStyle: {
              fontFamily: theme.fonts.heading,
              color: theme.colors.text.primary.light,
            },
          })}
        />
        <Stack.Screen name="MainTabs" component={MainTabs} />
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
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
          <AuthProvider>
            <ActivePetProvider>
              <AppNavigator />
              <Toast />
            </ActivePetProvider>
          </AuthProvider>
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
