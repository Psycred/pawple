import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import InviteSheet from './InviteSheet';

const SHEET_HIDDEN_Y = 340;
const SPRING_CONFIG = {
  damping: 24,
  mass: 1,
  stiffness: 220,
  useNativeDriver: true,
};
const INVITE_REMAINING_CACHE_KEY = 'inviteUnusedCount';

/**
 * Private account menu shown from the top-right gear trigger.
 */
export default function AccountSheet({
  visible,
  onClose,
  onManagePets,
  onLogout,
  onLocationPreferences,
  onPrivacy,
  onSendFeedback,
  onTermsPolicy,
  onAboutPawple,
  onInviteFriends,
  onDeleteAccount,
  appVersionLabel = '1.0.0 (beta)',
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SHEET_HIDDEN_Y)).current;
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsManagedByOS, setNotificationsManagedByOS] = useState(false);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [remainingInvites, setRemainingInvites] = useState(5);
  const [invitesLoading, setInvitesLoading] = useState(false);

  const checkNotificationStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[Notification Check Error]', error);
      return false;
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[Notification Request Error]', error);
      return false;
    }
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(sheetY, { toValue: 0, ...SPRING_CONFIG }),
      ]).start();
      return;
    }
    backdropOpacity.setValue(0);
    sheetY.setValue(SHEET_HIDDEN_Y);
  }, [visible, backdropOpacity, sheetY]);

  useEffect(() => {
    const init = async () => {
      try {
        await checkNotificationStatus();
      } catch (error) {
        console.error('[Settings Init Error]', error);
        // Don't crash the app
      }
    };
    init();
  }, []);

  useEffect(() => {
    const syncNotificationStateFromOS = async () => {
      if (!visible) {
        return;
      }
      setNotificationsLoading(true);
      try {
        const isGranted = await checkNotificationStatus();
        setNotificationsEnabled(isGranted);
        setNotificationsManagedByOS(isGranted);
      } catch (error) {
        console.log('[Notifications] Load failed:', error);
      } finally {
        setNotificationsLoading(false);
      }
    };
    syncNotificationStateFromOS();
  }, [visible]);

  useEffect(() => {
    const loadInviteCount = async () => {
      if (!visible) {
        return;
      }
      try {
        const cached = await AsyncStorage.getItem(INVITE_REMAINING_CACHE_KEY);
        if (cached != null) {
          const parsed = Number(cached);
          if (!Number.isNaN(parsed)) {
            setRemainingInvites(parsed);
          }
        }
      } catch (error) {
        console.log('[Settings] Invite cache read failed:', error);
      }
      if (!user?.id) {
        return;
      }
      setInvitesLoading(true);
      try {
        const { data, error } = await supabase
          .from('invites')
          .select('status')
          .eq('user_id', user.id);
        if (error) {
          throw error;
        }
        const rows = data ?? [];
        const unusedCount = rows.filter((item) => item.status === 'unused').length;
        setRemainingInvites(rows.length === 0 ? 5 : unusedCount);
      } catch (error) {
        console.log('[Settings] Invite count load failed:', error);
      } finally {
        setInvitesLoading(false);
      }
    };
    loadInviteCount();
  }, [user?.id, visible]);

  const showErrorToast = () => {
    const message = 'Failed to update preferences';
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Preferences', message);
  };

  const handleToggleNotifications = async (value) => {
    if (!value) {
      return;
    }
    setNotificationsLoading(true);
    try {
      const permissionGranted = await requestNotificationPermission();
      const statusGranted = await checkNotificationStatus();
      const isGranted = permissionGranted && statusGranted;
      setNotificationsEnabled(isGranted);
      setNotificationsManagedByOS(isGranted);
      console.log(`[Notifications] Toggled: ${isGranted}`);
      if (!isGranted) {
        showErrorToast();
      }
    } catch (error) {
      console.log('[Notifications] Toggle failed:', error);
      showErrorToast();
    } finally {
      setNotificationsLoading(false);
    }
  };

  const closeAnimated = (afterClose) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(sheetY, { toValue: SHEET_HIDDEN_Y, ...SPRING_CONFIG }),
    ]).start(({ finished }) => {
      if (finished) {
        afterClose?.();
      }
    });
  };

  const closeOnly = () => closeAnimated(onClose);

  const runAndClose = (action) => () => {
    closeAnimated(() => {
      onClose?.();
      action?.();
    });
  };

  const handleOpenInviteSheet = () => {
    onInviteFriends?.();
    setInviteSheetVisible(true);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={closeOnly}>
        <View style={styles.root}>
          <Pressable
            style={styles.backdropPress}
            onPress={closeOnly}
            accessibilityRole="button"
            accessibilityLabel="Close account settings"
          >
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
          </Pressable>

          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
                transform: [{ translateY: sheetY }],
              },
            ]}
          >
            <SafeAreaView style={styles.safeArea}>
              <Pressable
                onPress={runAndClose(onManagePets)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Manage Pets"
              >
                <View style={styles.rowLeft}>
                  <Feather name="users" size={theme.fontSizes.xl} color={theme.colors.text.muted.light} />
                  <Text style={styles.rowTitle}>Manage Pets</Text>
                </View>
                <Feather name="chevron-right" size={theme.fontSizes.md} color={theme.colors.text.muted.light} />
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={styles.notificationsRow}
              >
                <View style={styles.notificationsLeft}>
                  <Feather name="bell" size={theme.fontSizes.xl} color={theme.colors.text.muted.light} />
                  <View style={styles.notificationsText}>
                    <Text style={styles.rowTitle}>Push Notifications</Text>
                    <Text style={styles.notificationSubtitle}>Likes, meetup invites, and journal reminders</Text>
                  </View>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleToggleNotifications}
                  disabled={notificationsLoading || notificationsManagedByOS}
                  trackColor={{
                    false: theme.colors.border.light,
                    true: theme.colors.primary.light,
                  }}
                  thumbColor={theme.colors.background.light}
                  ios_backgroundColor={theme.colors.border.light}
                  accessibilityLabel={`Push Notifications, ${notificationsEnabled ? 'On' : 'Off'}`}
                  accessibilityRole="switch"
                />
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                onPress={remainingInvites > 0 ? handleOpenInviteSheet : undefined}
                disabled={remainingInvites === 0 || invitesLoading}
                style={({ pressed }) => [styles.row, styles.inviteRow, (remainingInvites === 0 || invitesLoading) && styles.rowDisabled, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Invite Friends, ${remainingInvites} left`}
              >
                <View style={styles.rowLeft}>
                  <Feather name="share-2" size={theme.fontSizes.xl} color={theme.colors.text.muted.light} />
                  <Text style={styles.rowTitle}>Invite Friends</Text>
                </View>
                <View style={[styles.inviteBadge, remainingInvites === 0 && styles.inviteBadgeDisabled]}>
                  <Text style={[styles.inviteBadgeText, remainingInvites === 0 && styles.inviteBadgeTextDisabled]}>
                    {`${remainingInvites} Left`}
                  </Text>
                </View>
              </Pressable>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      <InviteSheet
        visible={inviteSheetVisible}
        onClose={() => setInviteSheetVisible(false)}
        onRemainingChange={(count) => setRemainingInvites(count)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.text.primary.light,
    opacity: 0.35,
  },
  sheet: {
    backgroundColor: theme.colors.background.light,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg + theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    ...theme.shadowsRN.sm,
  },
  safeArea: {
    backgroundColor: theme.colors.background.light,
  },
  row: {
    minHeight: theme.components.button.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rowTitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary.light,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  inviteBadge: {
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  inviteBadgeText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.primary.dark,
    fontWeight: theme.fontWeights.semibold,
  },
  inviteBadgeDisabled: {
    backgroundColor: theme.colors.border.light,
  },
  inviteBadgeTextDisabled: {
    color: theme.colors.text.muted.light,
  },
  notificationsRow: {
    minHeight: theme.components.button.minHeight,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  inviteRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  notificationsLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: theme.spacing.md,
  },
  notificationsText: {
    marginLeft: theme.spacing.md,
  },
  notificationSubtitle: {
    marginTop: theme.spacing.xs / 2,
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
});
