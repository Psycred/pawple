import { Feather, Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { areMatingSurfacesVisible } from '../config/phase1aSurfaces';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { MATING_DISCOVER_TAB_ACCESSIBILITY_LABEL } from '../content/legalDocuments';
import { useActivePet } from '../contexts/ActivePetContext';
import { useAuth } from '../contexts/AuthContext';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import FeedScreen from '../screens/FeedScreen';
import MatingChatListScreen from '../screens/MatingChatListScreen';
import MatingDiscoveryScreen from '../screens/MatingDiscoveryScreen';
import MomentHubScreen from '../screens/MomentScreen';
import PetProfileScreen from '../screens/PetProfileScreen';
import PetContextSelector from '../components/PetContextSelector';

const Tab = createBottomTabNavigator();

const TAB_ICON_SIZE = 24;
const PLUS_ICON_SIZE = 28;
const TAB_LABEL_SIZE = 11;
const TAB_ACTIVE_COLOR = theme.colors.brand.sage.light;
const TAB_INACTIVE_COLOR = theme.colors.tabBar.inactive;
const TAB_BAR_EXTRA_BOTTOM = 8;
const MAX_PET_LABEL_LENGTH = 12;
const PET_TAB_PHOTO_SIZE = 28;

/** Skip repeat mating-tab checks when state was resolved recently for this pet. */
const MATING_TABS_REFRESH_MIN_INTERVAL_MS = 45_000;

function formatPetTabLabel(name) {
  const characters = [...String(name ?? '').trim()];
  if (characters.length === 0) {
    return 'Pets';
  }
  if (characters.length <= MAX_PET_LABEL_LENGTH) {
    return characters.join('');
  }
  return `${characters.slice(0, MAX_PET_LABEL_LENGTH - 1).join('')}…`;
}

function petInitial(name) {
  const trimmed = String(name ?? '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'P';
}

/** Two quiet Pawple-green prints identify Mating in every tab state. */
function MatingTabIcon() {
  return (
    <View style={matingIconStyles.pair} accessibilityElementsHidden>
      <Ionicons
        name="paw"
        color={TAB_ACTIVE_COLOR}
        size={14}
        style={matingIconStyles.first}
      />
      <Ionicons
        name="paw"
        color={TAB_ACTIVE_COLOR}
        size={14}
        style={matingIconStyles.second}
      />
    </View>
  );
}

function PetTabIcon({ photoUrl, name }) {
  const initial = petInitial(name);

  return (
    <View style={petTabStyles.ring}>
      {photoUrl ? (
        <PetContextSelector photo_url={photoUrl} size={PET_TAB_PHOTO_SIZE} />
      ) : (
        <View style={petTabStyles.fallback}>
          <Text style={petTabStyles.initial}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

const matingIconStyles = StyleSheet.create({
  pair: {
    width: 28,
    height: 24,
  },
  first: {
    position: 'absolute',
    left: 2,
    bottom: 1,
    transform: [{ rotate: '-18deg' }],
  },
  second: {
    position: 'absolute',
    right: 2,
    top: 1,
    transform: [{ rotate: '18deg' }],
  },
});

const petTabStyles = StyleSheet.create({
  ring: {
    borderRadius: PET_TAB_PHOTO_SIZE / 2 + 2,
    padding: 0,
  },
  fallback: {
    width: PET_TAB_PHOTO_SIZE,
    height: PET_TAB_PHOTO_SIZE,
    borderRadius: PET_TAB_PHOTO_SIZE / 2,
    backgroundColor: theme.colors.brand.sageLight.light,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  initial: {
    fontFamily: theme.fonts.medium,
    fontSize: 11,
    color: theme.colors.brand.sageDark.value,
  },
});

/**
 * Main bottom tabs: Feed | + (sheet hub) | Discover | Chat | active pet.
 * Route names stay stable for `navigation.navigate('FeedScreen')`, stack pushes, and resets.
 */
export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  const { activePetId, activePet } = useActivePet();
  const { user } = useAuth();
  const surfaces = useRuntimeThemeColors();
  const matingVisible = areMatingSurfacesVisible();

  const [showDiscoverTab, setShowDiscoverTab] = useState(false);
  const [showChatTab, setShowChatTab] = useState(false);
  const [matingStatePetId, setMatingStatePetId] = useState(null);
  const matingRefreshSequenceRef = useRef(0);
  const lastMatingTabsRefreshAtRef = useRef(0);
  const lastMatingTabsRefreshPetIdRef = useRef(null);
  const prevActivePetIdRef = useRef(undefined);

  const tabLabelFamily = 'Inter-Medium';
  const paddingBottom = Math.max(insets.bottom, 0) + TAB_BAR_EXTRA_BOTTOM;
  const tabBarHeight = 56 + paddingBottom;
  const petTabLabel = formatPetTabLabel(activePet?.name);
  const matingStateIsForActivePet =
    activePetId != null && String(matingStatePetId) === String(activePetId);

  const markMatingTabsRefreshed = useCallback((petId) => {
    lastMatingTabsRefreshAtRef.current = Date.now();
    lastMatingTabsRefreshPetIdRef.current = petId ?? null;
  }, []);

  const refreshMatingTabs = useCallback(async ({ force = false } = {}) => {
    const refreshSequence = matingRefreshSequenceRef.current + 1;
    matingRefreshSequenceRef.current = refreshSequence;

    if (!force) {
      const samePet =
        activePetId != null &&
        String(lastMatingTabsRefreshPetIdRef.current) === String(activePetId);
      const recentlyRefreshed =
        lastMatingTabsRefreshAtRef.current > 0 &&
        Date.now() - lastMatingTabsRefreshAtRef.current < MATING_TABS_REFRESH_MIN_INTERVAL_MS;
      if (samePet && recentlyRefreshed) {
        return;
      }
    }

    if (!matingVisible || !user?.id || !activePetId) {
      setMatingStatePetId(activePetId ?? null);
      setShowDiscoverTab(false);
      setShowChatTab(false);
      markMatingTabsRefreshed(activePetId ?? null);
      return;
    }

    try {
      const { data: activePet, error: companionError } = await supabase
        .from('pets')
        .select('id, is_looking_for_companion')
        .eq('id', activePetId)
        .eq('owner_id', user.id)
        .maybeSingle();

      if (companionError) {
        throw companionError;
      }

      if (refreshSequence !== matingRefreshSequenceRef.current) {
        return;
      }

      const activePetOpenToMating = Boolean(activePet?.is_looking_for_companion);
      setMatingStatePetId(activePetId);
      setShowDiscoverTab(activePetOpenToMating);

      if (!activePetOpenToMating) {
        setShowChatTab(false);
        markMatingTabsRefreshed(activePetId);
        return;
      }

      setShowChatTab(true);
      markMatingTabsRefreshed(activePetId);
    } catch (e) {
      console.error('[BottomTabNavigator] mating tabs', e);
      if (refreshSequence === matingRefreshSequenceRef.current) {
        setMatingStatePetId(activePetId);
        setShowDiscoverTab(false);
        setShowChatTab(false);
      }
    }
  }, [activePetId, markMatingTabsRefreshed, matingVisible, user?.id]);

  const handleMatingAvailabilityChange = useCallback(
    (nextOpenToMating) => {
      setMatingStatePetId(activePetId);
      setShowDiscoverTab(Boolean(nextOpenToMating));
      if (!nextOpenToMating) {
        setShowChatTab(false);
        return;
      }
      refreshMatingTabs({ force: true });
    },
    [activePetId, refreshMatingTabs],
  );

  useEffect(() => {
    const petChanged = prevActivePetIdRef.current !== activePetId;
    prevActivePetIdRef.current = activePetId;
    refreshMatingTabs({ force: petChanged });
  }, [activePetId, refreshMatingTabs]);

  useFocusEffect(
    useCallback(() => {
      refreshMatingTabs();
    }, [refreshMatingTabs]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshMatingTabs({ force: true });
      }
    });
    return () => {
      subscription.remove();
    };
  }, [refreshMatingTabs]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TAB_INACTIVE_COLOR,
        tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: surfaces.backgroundScreen,
          height: tabBarHeight,
          paddingTop: theme.spacing.sm,
          paddingBottom,
          borderTopWidth: 0,
        },
        tabBarItemStyle: {
          minHeight: 48,
        },
        tabBarLabelStyle: {
          fontFamily: tabLabelFamily,
          fontSize: TAB_LABEL_SIZE,
          fontWeight: theme.fontWeights.medium,
          letterSpacing: 0.1,
          marginTop: theme.spacing.xs / 2,
        },
      }}
    >
      <Tab.Screen
        name="FeedScreen"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={TAB_ICON_SIZE} />
          ),
          tabBarAccessibilityLabel: 'Feed tab',
        }}
      />
      <Tab.Screen
        name="CreateHub"
        component={MomentHubScreen}
        options={{
          tabBarLabel: 'Create',
          tabBarIcon: ({ color }) => <Feather name="plus" color={color} size={PLUS_ICON_SIZE} />,
          tabBarAccessibilityLabel: 'Create menu',
        }}
      />
      {matingVisible && matingStateIsForActivePet && showDiscoverTab ? (
        <Tab.Screen
          name="MatingDiscoverTab"
          component={MatingDiscoveryScreen}
          initialParams={{ fromTab: true }}
          options={{
            tabBarLabel: 'Discover',
            tabBarLabelStyle: { color: TAB_ACTIVE_COLOR },
            tabBarIcon: () => <MatingTabIcon />,
            tabBarAccessibilityLabel: MATING_DISCOVER_TAB_ACCESSIBILITY_LABEL,
          }}
        />
      ) : null}
      {matingVisible && matingStateIsForActivePet && showDiscoverTab && showChatTab ? (
        <Tab.Screen
          name="MatingChatTab"
          component={MatingChatListScreen}
          options={{
            tabBarLabel: 'Chat',
            tabBarIcon: () => (
              <Feather
                name="message-circle"
                color={TAB_INACTIVE_COLOR}
                size={TAB_ICON_SIZE}
              />
            ),
            tabBarAccessibilityLabel: 'Chat',
          }}
        />
      ) : null}
      <Tab.Screen
        name="PetsScreen"
        options={{
          tabBarLabel: petTabLabel,
          tabBarIcon: () => (
            <PetTabIcon
              photoUrl={activePet?.photo_url}
              name={activePet?.name}
            />
          ),
          tabBarAccessibilityLabel: 'Pets tab',
        }}
      >
        {(props) => (
          <PetProfileScreen
            {...props}
            onMatingAvailabilityChange={handleMatingAvailabilityChange}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
