import { Feather, Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useActivePet } from '../contexts/ActivePetContext';
import FeedScreen from '../screens/FeedScreen';
import MomentHubScreen from '../screens/MomentScreen';
import PetProfileScreen from '../screens/PetProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_ICON_SIZE = 24;
const PLUS_ICON_SIZE = 28;
const TAB_LABEL_SIZE = 11;
const TAB_ACTIVE_COLOR = theme.colors.brand.sage.light;
const TAB_INACTIVE_COLOR = theme.colors.tabBar.inactive;
const TAB_BAR_EXTRA_BOTTOM = 8;
const MAX_PET_LABEL_LENGTH = 12;

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

/**
 * Main bottom tabs: Feed | + (sheet hub) | active pet.
 * Route names stay stable for `navigation.navigate('FeedScreen')`, stack pushes, and resets.
 */
export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  const { activePetId } = useActivePet();
  const [activePetName, setActivePetName] = useState(null);
  const tabLabelFamily = 'Inter-Medium';
  const paddingBottom = Math.max(insets.bottom, 0) + TAB_BAR_EXTRA_BOTTOM;
  const tabBarHeight = 56 + paddingBottom;
  const petTabLabel = formatPetTabLabel(activePetName);

  useEffect(() => {
    let current = true;

    if (!activePetId) {
      setActivePetName(null);
      return () => {
        current = false;
      };
    }

    const loadActivePetName = async () => {
      try {
        const { data, error } = await supabase
          .from('pets')
          .select('name')
          .eq('id', activePetId)
          .maybeSingle();

        if (error) {
          throw error;
        }
        if (current) {
          setActivePetName(data?.name ?? null);
        }
      } catch (error) {
        console.error('[Supabase]', error);
        if (current) {
          setActivePetName(null);
        }
      }
    };

    setActivePetName(null);
    loadActivePetName();

    return () => {
      current = false;
    };
  }, [activePetId]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TAB_ACTIVE_COLOR,
        tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: theme.colors.background.screen,
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
      <Tab.Screen
        name="PetsScreen"
        component={PetProfileScreen}
        options={{
          tabBarLabel: petTabLabel,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'paw' : 'paw-outline'} color={color} size={TAB_ICON_SIZE} />
          ),
          tabBarAccessibilityLabel: 'Pets tab',
        }}
      />
    </Tab.Navigator>
  );
}
