import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { openAppSettings } from '../lib/permissions';
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
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [remainingInvites, setRemainingInvites] = useState(5);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const surfaces = useRuntimeThemeColors();

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

  /** OS is the only real notification control — no trapped in-app switch. */
  const handleOpenNotifications = () => {
    openAppSettings();
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
                backgroundColor: surfaces.backgroundElevated,
                paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
                transform: [{ translateY: sheetY }],
              },
            ]}
          >
            <SafeAreaView style={[styles.safeArea, { backgroundColor: surfaces.backgroundElevated }]}>
              <Pressable
                onPress={runAndClose(onManagePets)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Manage Pets"
              >
                <View style={styles.rowLeft}>
                  <Feather name="users" size={theme.fontSizes.xl} color={theme.colors.text.muted.light} />
                  <Text style={[styles.rowTitle, { color: surfaces.textPrimary }]}>Manage Pets</Text>
                </View>
                <Feather name="chevron-right" size={theme.fontSizes.md} color={theme.colors.text.muted.light} />
              </Pressable>

              <View style={[styles.divider, { borderBottomColor: surfaces.border }]} />

              <Pressable
                onPress={handleOpenNotifications}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <View style={styles.rowLeft}>
                  <Feather name="bell" size={theme.fontSizes.xl} color={theme.colors.text.muted.light} />
                  <Text style={[styles.rowTitle, { color: surfaces.textPrimary }]}>Notifications</Text>
                </View>
                <Feather name="chevron-right" size={theme.fontSizes.md} color={theme.colors.text.muted.light} />
              </Pressable>

              <View style={[styles.divider, { borderBottomColor: surfaces.border }]} />

              <Pressable
                onPress={remainingInvites > 0 ? handleOpenInviteSheet : undefined}
                disabled={remainingInvites === 0 || invitesLoading}
                style={({ pressed }) => [
                  styles.row,
                  (remainingInvites === 0 || invitesLoading) && styles.rowDisabled,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Invite, ${remainingInvites} left`}
              >
                <View style={styles.rowLeft}>
                  <Feather name="share-2" size={theme.fontSizes.xl} color={theme.colors.text.muted.light} />
                  <Text style={[styles.rowTitle, { color: surfaces.textPrimary }]}>Invite</Text>
                </View>
                <View
                  style={[
                    styles.inviteBadge,
                    remainingInvites === 0 && { backgroundColor: surfaces.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.inviteBadgeText,
                      remainingInvites === 0 && { color: surfaces.textMuted },
                    ]}
                  >
                    {`${remainingInvites} left`}
                  </Text>
                </View>
              </Pressable>

              <View style={[styles.divider, { borderBottomColor: surfaces.border }]} />

              <Pressable
                onPress={runAndClose(onLogout)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Log out"
              >
                <View style={styles.rowLeft}>
                  <Feather name="log-out" size={theme.fontSizes.xl} color={theme.colors.text.muted.light} />
                  <Text style={[styles.rowTitle, { color: surfaces.textPrimary }]}>Log out</Text>
                </View>
                <Feather name="chevron-right" size={theme.fontSizes.md} color={theme.colors.text.muted.light} />
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
  },
  divider: {
    borderBottomWidth: 1,
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
});
