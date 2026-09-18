import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
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
import { Feather } from '@expo/vector-icons';
import InviteSheet from '../components/InviteSheet';
import { theme } from '../config/theme';
import { useAppearance } from '../contexts/AppearanceContext';
import { useAuth } from '../contexts/AuthContext';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { exportUserData, shareUserDataExport } from '../lib/exportAccount';

const DISTANCE_KEY = 'settings.distanceUnit';

const VALUE_DEFAULTS = {
  distance: 'km',
};

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, openLogoutConfirm, openDeleteConfirm, lifecycleBusy } = useAuth();
  const { preference: appearance, setAppearancePreference } = useAppearance();
  const surfaces = useRuntimeThemeColors();
  const [inviteVisible, setInviteVisible] = useState(false);
  const [remainingInvites, setRemainingInvites] = useState(5);
  const [exportingData, setExportingData] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState(VALUE_DEFAULTS.distance);

  const sectionHeader = useCallback(
    (title) => (
      <Text
        accessibilityRole="header"
        style={[styles.sectionHeader, { color: surfaces.textMuted }]}
      >
        {title}
      </Text>
    ),
    [surfaces.textMuted],
  );

  useEffect(() => {
    const hydrate = async () => {
      try {
        const distanceValue = await AsyncStorage.getItem(DISTANCE_KEY);
        if (distanceValue) setDistanceUnit(distanceValue);
      } catch (error) {
        console.log('[Settings] hydrate error', error);
      }
    };
    hydrate();
  }, []);

  const handleAppearance = useCallback(() => {
    const options = ['System', 'Light', 'Dark'];
    Alert.alert('Appearance', 'Choose how Pawple should appear.', [
      ...options.map((value) => ({
        text: value,
        onPress: () => {
          void setAppearancePreference(value);
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [setAppearancePreference]);

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

  const appVersion = 'v1.0.0';
  const groupCardStyle = {
    backgroundColor: surfaces.backgroundCard,
    borderColor: surfaces.border,
  };

  return (
    <SafeAreaView
      style={[styles.safe, { paddingTop: insets.top, backgroundColor: surfaces.backgroundScreen }]}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          {sectionHeader('ACCOUNT')}
          <View style={[styles.group, groupCardStyle]}>
            <SettingRow icon="user" title="My Profile" onPress={() => navigation.navigate('EditProfile')} />
            <SettingRow icon="users" title="Manage Pets" onPress={() => navigation.navigate('ManagePets')} />
            <SettingRow
              icon="share-2"
              title="Invite"
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
          <View style={[styles.group, groupCardStyle]}>
            <SettingRow
              icon="shield"
              title="Permissions"
              onPress={() => navigation.navigate('Permissions')}
            />
            <SettingRow
              icon="download"
              title="Download My Data"
              subtitle="JSON file on this device"
              onPress={handleExportData}
              rightNode={
                exportingData ? <ActivityIndicator size="small" color={theme.colors.text.muted.light} /> : undefined
              }
            />
            <SettingRow
              icon="eye-off"
              title="Blocked pets"
              onPress={() => navigation.navigate('PrivacySettings')}
            />
          </View>
        </View>

        <View style={styles.section}>
          {sectionHeader('APP PREFERENCES')}
          <View style={[styles.group, groupCardStyle]}>
            <SettingRow
              icon={appearance === 'Dark' ? 'moon' : 'sun'}
              title="Appearance"
              onPress={handleAppearance}
              rightNode={<Text style={[styles.rightMeta, { color: surfaces.textMuted }]}>{appearance}</Text>}
            />
            <SettingRow
              icon="globe"
              title="Distance Units"
              onPress={handleDistanceUnit}
              rightNode={<Text style={[styles.rightMeta, { color: surfaces.textMuted }]}>{distanceUnit}</Text>}
            />
          </View>
        </View>

        <View style={[styles.section, styles.lastSection]}>
          {sectionHeader('SUPPORT & LEGAL')}
          <View style={[styles.group, groupCardStyle]}>
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
              icon="book-open"
              title="Community Guidelines"
              onPress={() => navigation.navigate('CommunityGuidelines')}
            />
            <SettingRow
              icon="mail"
              title="Contact Support"
              onPress={() => Linking.openURL('mailto:support@pawple.app')}
            />
          </View>
        </View>

        <View style={styles.bottomActions}>
          <Pressable
            onPress={openLogoutConfirm}
            disabled={lifecycleBusy}
            style={({ pressed }) => [
              styles.bottomActionRow,
              groupCardStyle,
              pressed && !lifecycleBusy && styles.rowPressed,
              lifecycleBusy && styles.bottomActionDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Feather name="log-out" size={theme.fontSizes.xl} color={theme.colors.text.muted.light} />
            <Text style={styles.bottomActionText}>Log Out</Text>
          </Pressable>

          <Pressable
            onPress={openDeleteConfirm}
            disabled={lifecycleBusy}
            style={({ pressed }) => [
              styles.bottomActionRow,
              styles.deleteActionRow,
              groupCardStyle,
              pressed && !lifecycleBusy && styles.rowPressed,
              lifecycleBusy && styles.bottomActionDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            accessibilityState={{ disabled: lifecycleBusy, busy: lifecycleBusy }}
          >
            {lifecycleBusy ? (
              <ActivityIndicator size="small" color={theme.colors.danger.value} />
            ) : (
              <Feather name="trash-2" size={theme.fontSizes.xl} color={theme.colors.danger.value} />
            )}
            <Text style={styles.deleteActionText}>
              {lifecycleBusy ? 'Deleting…' : 'Delete Account'}
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
  const surfaces = useRuntimeThemeColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: surfaces.border },
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
    >
      <View style={styles.rowLeft}>
        <Feather
          name={icon}
          size={theme.fontSizes.xl}
          color={danger ? theme.colors.danger.value : surfaces.textMuted}
        />
        <View>
          <Text style={[styles.rowTitle, { color: surfaces.textPrimary }, danger && styles.rowTitleDanger]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.rowSubtitle, { color: surfaces.textMuted }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>

      {rightNode ??
        (!hideChevron ? (
          <Feather
            name={rightIcon}
            size={rightIconSize}
            color={danger ? theme.colors.danger.value : surfaces.textMuted}
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
