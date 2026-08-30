import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InviteSheet from '../components/InviteSheet';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { deleteAccount } from '../lib/deleteAccount';
import { exportUserData, shareUserDataExport } from '../lib/exportAccount';
import { openAppSettings } from '../lib/permissions';

const APPEARANCE_KEY = 'settings.appearance';
const DISTANCE_KEY = 'settings.distanceUnit';

const VALUE_DEFAULTS = {
  appearance: 'System',
  distance: 'km',
};

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [inviteVisible, setInviteVisible] = useState(false);
  const [remainingInvites, setRemainingInvites] = useState(5);
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [appearance, setAppearance] = useState(VALUE_DEFAULTS.appearance);
  const [distanceUnit, setDistanceUnit] = useState(VALUE_DEFAULTS.distance);

  const sectionHeader = useCallback(
    (title) => (
      <Text accessibilityRole="header" style={styles.sectionHeader}>
        {title}
      </Text>
    ),
    [],
  );

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [appearanceValue, distanceValue] = await Promise.all([
          AsyncStorage.getItem(APPEARANCE_KEY),
          AsyncStorage.getItem(DISTANCE_KEY),
        ]);
        if (appearanceValue) setAppearance(appearanceValue);
        if (distanceValue) setDistanceUnit(distanceValue);
      } catch (error) {
        console.log('[Settings] hydrate error', error);
      }
    };
    hydrate();
  }, []);

  const handleManageNotifications = useCallback(() => {
    openAppSettings();
  }, []);

  const handleAppearance = useCallback(() => {
    const options = ['System', 'Light', 'Dark'];
    Alert.alert('Appearance', 'Choose how Pawple should appear.', [
      ...options.map((value) => ({
        text: value,
        onPress: async () => {
          setAppearance(value);
          await AsyncStorage.setItem(APPEARANCE_KEY, value);
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const handleDistanceUnit = useCallback(async () => {
    const next = distanceUnit === 'km' ? 'miles' : 'km';
    setDistanceUnit(next);
    await AsyncStorage.setItem(DISTANCE_KEY, next);
  }, [distanceUnit]);

  const showExportToast = useCallback((message) => {
    if (ToastAndroid?.show) {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Download My Data', message);
  }, []);

  const handleExportData = useCallback(async () => {
    if (exportingData || !user?.id) return;
    try {
      setExportingData(true);
      const payload = await exportUserData();
      await shareUserDataExport(payload);
      showExportToast('Your data is ready to save or share.');
    } catch (error) {
      console.log('[Settings] export error', error);
      Alert.alert(
        'Download My Data',
        'Could not prepare your export right now. Please try again.',
      );
    } finally {
      setExportingData(false);
    }
  }, [exportingData, showExportToast, user?.id]);

  const handleLogout = useCallback(() => {
    Alert.alert('Logout?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        },
      },
    ]);
  }, [navigation]);

  const performDeleteAccount = useCallback(async () => {
    if (deletingAccount || !user?.id) return;
    try {
      setDeletingAccount(true);
      await deleteAccount();
      navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
    } catch (error) {
      console.error('[Settings] delete account error', error);
      Alert.alert(
        'Delete Account',
        'Could not delete your account right now. Please try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', style: 'destructive', onPress: performDeleteAccount },
        ],
      );
    } finally {
      setDeletingAccount(false);
    }
  }, [deletingAccount, navigation, user?.id]);

  const handleDeleteAccount = useCallback(() => {
    if (deletingAccount) return;
    Alert.alert('Delete account?', 'This removes your profile, pets, invites, and posts from Pawple.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: performDeleteAccount,
      },
    ]);
  }, [deletingAccount, performDeleteAccount]);

  const appVersion = useMemo(() => 'v1.0.0', []);

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          {sectionHeader('ACCOUNT')}
          <View style={styles.group}>
            <SettingRow icon="user" title="My Profile" onPress={() => navigation.navigate('EditProfile')} />
            <SettingRow
              icon="calendar"
              title="My Meetups"
              onPress={() => navigation.navigate('MyMeetupsScreen')}
            />
            <SettingRow icon="users" title="Manage Pets" onPress={() => navigation.navigate('ManagePets')} />
            <SettingRow
              icon="share-2"
              title="Invite Friends"
              onPress={() => setInviteVisible(true)}
              rightNode={
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{String(remainingInvites)}</Text>
                </View>
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          {sectionHeader('PRIVACY & DATA')}
          <View style={styles.group}>
            <SettingRow
              icon="bell"
              title="Notifications"
              subtitle="Opens your device notification settings"
              onPress={handleManageNotifications}
            />
            <SettingRow icon="map-pin" title="Location Permissions" onPress={openAppSettings} />
            <SettingRow icon="image" title="Photo & Media" onPress={openAppSettings} />
            <SettingRow
              icon="download"
              title="Download My Data"
              subtitle="JSON file on this device"
              onPress={handleExportData}
              rightNode={
                exportingData ? <ActivityIndicator size="small" color={theme.colors.text.muted.light} /> : undefined
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          {sectionHeader('APP PREFERENCES')}
          <View style={styles.group}>
            <SettingRow
              icon={appearance === 'Dark' ? 'moon' : 'sun'}
              title="Appearance"
              onPress={handleAppearance}
              rightNode={<Text style={styles.rightMeta}>{appearance}</Text>}
            />
            <SettingRow
              icon="globe"
              title="Distance Units"
              onPress={handleDistanceUnit}
              rightNode={<Text style={styles.rightMeta}>{distanceUnit}</Text>}
            />
          </View>
        </View>

        <View style={[styles.section, styles.lastSection]}>
          {sectionHeader('SUPPORT & LEGAL')}
          <View style={styles.group}>
            <SettingRow
              icon="info"
              title="About Pawple"
              onPress={() => Alert.alert('About Pawple', 'Pawple is your calm scrapbook for pet memories.')}
              rightNode={<Text style={styles.rightMeta}>{appVersion}</Text>}
            />
            <SettingRow
              icon="file-text"
              title="Terms of Service"
              onPress={() => navigation.navigate('TermsOfService')}
            />
            <SettingRow icon="shield" title="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />
            <SettingRow
              icon="mail"
              title="Contact Support"
              onPress={() => Linking.openURL('mailto:support@pawple.app')}
            />
          </View>
        </View>

        <View style={styles.bottomActions}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [styles.bottomActionRow, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Feather name="log-out" size={theme.fontSizes.xl} color={theme.colors.text.muted.light} />
            <Text style={styles.bottomActionText}>Log Out</Text>
          </Pressable>

          <Pressable
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            style={({ pressed }) => [
              styles.bottomActionRow,
              styles.deleteActionRow,
              pressed && !deletingAccount && styles.rowPressed,
              deletingAccount && styles.bottomActionDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            accessibilityState={{ disabled: deletingAccount, busy: deletingAccount }}
          >
            {deletingAccount ? (
              <ActivityIndicator size="small" color={theme.colors.danger.value} />
            ) : (
              <Feather name="trash-2" size={theme.fontSizes.xl} color={theme.colors.danger.value} />
            )}
            <Text style={styles.deleteActionText}>
              {deletingAccount ? 'Deleting…' : 'Delete Account'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <InviteSheet visible={inviteVisible} onClose={() => setInviteVisible(false)} onRemainingChange={setRemainingInvites} />
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
  rightNode,
  hideChevron = false,
  rightIcon = 'chevron-right',
  rightIconSize = theme.fontSizes.md,
  danger = false,
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} accessibilityRole="button">
      <View style={styles.rowLeft}>
        <Feather name={icon} size={theme.fontSizes.xl} color={danger ? theme.colors.danger.value : theme.colors.text.muted.light} />
        <View>
          <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      {rightNode ??
        (!hideChevron ? (
          <Feather
            name={rightIcon}
            size={rightIconSize}
            color={danger ? theme.colors.danger.value : theme.colors.text.muted.light}
          />
        ) : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    paddingTop: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.xxl,
  },
  lastSection: {
    marginBottom: theme.spacing.md,
  },
  bottomActions: {
    marginTop: theme.spacing.xxxl - theme.spacing.xs * 2,
    marginBottom: theme.spacing.xxxl - theme.spacing.xs * 2,
  },
  bottomActionRow: {
    minHeight: theme.components.button.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.light,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.components.button.paddingVertical,
  },
  deleteActionRow: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xxxl - theme.spacing.xs * 2,
  },
  bottomActionText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
  deleteActionText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.danger.value,
    textAlign: 'center',
  },
  bottomActionDisabled: {
    opacity: 0.6,
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
    marginLeft: theme.spacing.lg,
    fontFamily: 'Inter-Medium',
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.muted.value,
    textTransform: 'uppercase',
  },
  group: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.light,
    overflow: 'hidden',
  },
  row: {
    minHeight: 44,
    paddingVertical: theme.components.button.paddingVertical,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  rowPressed: {
    opacity: 0.84,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  rowTitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  rowTitleDanger: {
    color: theme.colors.danger.value,
  },
  rowSubtitle: {
    marginTop: theme.spacing.xs / 2,
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
  badge: {
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.accent.sage,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.inverse.value,
    fontWeight: theme.fontWeights.semibold,
  },
  rightMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
});
