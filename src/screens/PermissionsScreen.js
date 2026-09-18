import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import {
  getCameraPermissionState,
  resolveCameraPermission,
} from '../lib/createMomentPermissions';
import {
  getLocationPermissionState,
  requestLocationPermission,
} from '../lib/locationManager';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
} from '../lib/notifications';
import { openAppSettings } from '../lib/permissions';

const DEFAULT_PERMISSION = Object.freeze({
  status: 'undetermined',
  canAskAgain: true,
});

const PERMISSIONS = Object.freeze([
  {
    key: 'location',
    icon: 'map-pin',
    title: 'Location',
    description:
      'Prioritise nearby Moments and Meetups and show approximate distance in Discover while you use the app.',
  },
  {
    key: 'camera',
    icon: 'camera',
    title: 'Camera',
    description: 'Take photos for your pet profile and moments.',
  },
  {
    key: 'notifications',
    icon: 'bell',
    title: 'Notifications',
    description: 'Stay aware of paws, messages, and Pawple updates.',
  },
]);

function permissionPresentation(permission) {
  if (permission?.status === 'granted') {
    return { statusLabel: 'Granted', actionLabel: 'Open Settings' };
  }
  if (permission?.canAskAgain === false) {
    return { statusLabel: 'Needs attention', actionLabel: 'Open Settings' };
  }
  return { statusLabel: 'Not granted', actionLabel: 'Allow' };
}

export default function PermissionsScreen({ route }) {
  const surfaces = useRuntimeThemeColors();
  const focusKey = route?.params?.focusKey ?? null;
  const [permissionStates, setPermissionStates] = useState({
    location: DEFAULT_PERMISSION,
    camera: DEFAULT_PERMISSION,
    notifications: DEFAULT_PERMISSION,
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [busyPermission, setBusyPermission] = useState(null);
  const mountedRef = useRef(true);
  const refreshGenerationRef = useRef(0);

  const permissionsTheme = useMemo(
    () => ({
      safe: { backgroundColor: surfaces.backgroundScreen },
      card: {
        backgroundColor: surfaces.backgroundCard,
        borderColor: surfaces.border,
      },
      iconWrap: {
        backgroundColor: surfaces.isDark
          ? surfaces.meetupChipBackground
          : theme.colors.brand.sageLight.light,
      },
      title: { color: surfaces.textPrimary },
      description: { color: surfaces.textSecondary },
      status: { color: surfaces.textMuted },
    }),
    [
      surfaces.backgroundCard,
      surfaces.backgroundScreen,
      surfaces.border,
      surfaces.isDark,
      surfaces.meetupChipBackground,
      surfaces.textMuted,
      surfaces.textPrimary,
      surfaces.textSecondary,
    ],
  );

  const refreshPermissions = useCallback(async () => {
    const generation = refreshGenerationRef.current + 1;
    refreshGenerationRef.current = generation;

    const [location, camera, notifications] = await Promise.all([
      getLocationPermissionState(),
      getCameraPermissionState(),
      getNotificationPermissionState(),
    ]);

    if (!mountedRef.current || generation !== refreshGenerationRef.current) {
      return;
    }

    setPermissionStates({ location, camera, notifications });
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshPermissions();
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, [refreshPermissions]);

  useFocusEffect(
    useCallback(() => {
      refreshPermissions();
    }, [refreshPermissions]),
  );

  const handlePermissionAction = useCallback(
    async (key) => {
      if (busyPermission) {
        return;
      }

      const current = permissionStates[key] ?? DEFAULT_PERMISSION;
      const mustUseSettings =
        current.status === 'granted' || current.canAskAgain === false;

      setBusyPermission(key);
      try {
        if (mustUseSettings) {
          await openAppSettings();
          return;
        }

        if (key === 'location') {
          await requestLocationPermission();
        } else if (key === 'camera') {
          await resolveCameraPermission('settings');
        } else if (key === 'notifications') {
          const granted = await requestNotificationPermission();
          if (granted) {
            const { registerDevicePushTokenIfGranted } = await import('../lib/pushNotifications');
            await registerDevicePushTokenIfGranted();
          }
        }

        await refreshPermissions();
      } finally {
        if (mountedRef.current) {
          setBusyPermission(null);
        }
      }
    },
    [busyPermission, permissionStates, refreshPermissions],
  );

  return (
    <SafeAreaView style={[styles.safe, permissionsTheme.safe]} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {initialLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.brand.sageDark.light} />
          </View>
        ) : (
          PERMISSIONS.map((permission) => {
            const current = permissionStates[permission.key] ?? DEFAULT_PERMISSION;
            const presentation = permissionPresentation(current);
            const isBusy = busyPermission === permission.key;

            const isFocused = focusKey === permission.key;

            return (
              <View
                key={permission.key}
                style={[styles.card, permissionsTheme.card, isFocused && styles.cardFocused]}
              >
                <View style={styles.permissionHeader}>
                  <View style={[styles.iconWrap, permissionsTheme.iconWrap]}>
                    <Feather
                      name={permission.icon}
                      size={theme.fontSizes.xl}
                      color={theme.colors.brand.sageDark.light}
                    />
                  </View>
                  <View style={styles.copy}>
                    <Text style={[styles.title, permissionsTheme.title]}>{permission.title}</Text>
                    <Text style={[styles.description, permissionsTheme.description]}>
                      {permission.description}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Text style={[styles.status, permissionsTheme.status]}>{presentation.statusLabel}</Text>
                  <Pressable
                    onPress={() => handlePermissionAction(permission.key)}
                    disabled={Boolean(busyPermission)}
                    style={({ pressed }) => [
                      styles.action,
                      pressed && styles.actionPressed,
                      busyPermission && styles.actionDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${presentation.actionLabel} for ${permission.title}`}
                    accessibilityState={{ disabled: Boolean(busyPermission), busy: isBusy }}
                  >
                    {isBusy ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.text.inverse.light}
                      />
                    ) : (
                      <Text style={styles.actionText}>{presentation.actionLabel}</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  content: {
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    flexGrow: 1,
  },
  loading: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.light,
  },
  cardFocused: {
    borderColor: theme.colors.brand.sage.value,
    borderWidth: 1,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  copy: {
    flex: 1,
    marginLeft: theme.spacing.lg,
  },
  title: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
  },
  description: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: 20,
    color: theme.colors.text.secondary.light,
  },
  actionRow: {
    marginTop: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
  action: {
    minHeight: 48,
    minWidth: 112,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sage.light,
  },
  actionPressed: {
    opacity: 0.84,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.light,
  },
});
