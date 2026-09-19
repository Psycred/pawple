import React from 'react';
import { Alert, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AccountSheet from './AccountSheet';
import { useAuth } from '../contexts/AuthContext';

/**
 * Compatibility wrapper around the account settings sheet.
 */
export default function UserSheet(props) {
  const navigation = useNavigation();
  const { openLogoutConfirm, openDeleteConfirm } = useAuth();
  const {
    onClose,
    onManagePets: _onManagePetsFromProps,
    onLocationPreferences: _onLocationPreferencesFromProps,
    onPrivacy: _onPrivacyFromProps,
    onSendFeedback: _onSendFeedbackFromProps,
    onTermsPolicy: _onTermsPolicyFromProps,
    onAboutPawple: _onAboutPawpleFromProps,
    onInviteFriends: _onInviteFriendsFromProps,
    onDeleteAccount: _onDeleteAccountFromProps,
    onLogout: _onLogoutFromProps,
    ...restProps
  } = props;

  const handleManagePets = () => {
    const stackNav = navigation.getParent?.()?.getParent?.();
    if (stackNav?.navigate) {
      stackNav.navigate('ManagePets');
      return;
    }
    navigation.navigate('ManagePets');
  };

  const handleLocationPreferences = () => {
    console.log('[Settings] Opened Location');
    const stackNav = navigation.getParent?.()?.getParent?.();
    if (stackNav?.navigate) {
      stackNav.navigate('LocationSettings');
      return;
    }
    navigation.navigate('LocationSettings');
  };

  const handlePrivacy = () => {
    console.log('[Settings] Opened Privacy');
    const stackNav = navigation.getParent?.()?.getParent?.();
    if (stackNav?.navigate) {
      stackNav.navigate('PrivacySettings');
      return;
    }
    navigation.navigate('PrivacySettings');
  };

  const handleSendFeedback = async () => {
    console.log('[Settings] Opened Feedback');
    const feedbackMailto = 'mailto:hello@pawple.app?subject=Pawple%20Feedback';
    const canOpen = await Linking.canOpenURL(feedbackMailto);
    if (canOpen) {
      await Linking.openURL(feedbackMailto);
      return;
    }
    Alert.alert('Feedback', 'Email composer is unavailable on this device.');
  };

  const navigateLegal = (screen) => {
    const stackNav = navigation.getParent?.()?.getParent?.();
    if (stackNav?.navigate) {
      stackNav.navigate(screen);
      return;
    }
    navigation.navigate(screen);
  };

  const handleTermsPolicy = () => {
    console.log('[Settings] Opened Terms & Privacy Policy');
    Alert.alert('Legal', 'Choose what to read', [
      {
        text: 'Terms of Service',
        onPress: () => navigateLegal('TermsOfService'),
      },
      {
        text: 'Privacy Policy',
        onPress: () => navigateLegal('PrivacyPolicy'),
      },
      {
        text: 'Community Guidelines',
        onPress: () => navigateLegal('CommunityGuidelines'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAboutPawple = () => {
    Alert.alert('About Pawple', 'Pawple v1.0.0\nA calm scrapbook for pet parents.\n© 2026 Pawple');
  };

  const handleInviteFriends = () => {
    console.log('[Settings] Invite Friends tapped');
  };

  const handleDeleteAccount = () => {
    onClose?.();
    openDeleteConfirm();
  };

  const handleLogout = () => {
    onClose?.();
    openLogoutConfirm();
  };

  return (
    <AccountSheet
      {...restProps}
      onClose={onClose}
      onManagePets={handleManagePets}
      onLocationPreferences={handleLocationPreferences}
      onPrivacy={handlePrivacy}
      onSendFeedback={handleSendFeedback}
      onTermsPolicy={handleTermsPolicy}
      onAboutPawple={handleAboutPawple}
      onInviteFriends={handleInviteFriends}
      onDeleteAccount={handleDeleteAccount}
      onLogout={handleLogout}
      appVersionLabel="1.0.0 (beta)"
    />
  );
}
