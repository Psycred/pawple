import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import {
  getDefaultDevelopmentInviteCode,
  storePendingInvite,
  validateInviteCode,
} from '../lib/onboardingInvite';

export default function InviteCodeScreen({ navigation }) {
  const { user, refreshProfile } = useAuth();
  const [inviteCode, setInviteCode] = useState(getDefaultDevelopmentInviteCode);
  const [loading, setLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('That invite may have expired or already been used.');

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    const ensureSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        navigation.replace('Auth');
      }
    };
    ensureSession();
  }, [navigation, user?.id]);

  const showInviteErrorModal = (message) => {
    setErrorMessage(message ?? 'That invite may have expired or already been used.');
    setShowErrorModal(true);
    AccessibilityInfo.announceForAccessibility?.('Invalid invite code. That invite may have expired or already been used.');
  };

  const handleContinue = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      showInviteErrorModal();
      return;
    }

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser?.id) {
      Alert.alert('Session Required', 'Please sign in before entering your invite code.', [
        { text: 'OK', onPress: () => navigation.replace('Auth') },
      ]);
      return;
    }

    setLoading(true);
    try {
      const result = await validateInviteCode(code, currentUser.id);
      if (!result.ok) {
        if (result.reason === 'own_invite') {
          showInviteErrorModal('You cannot redeem your own invite code.');
        } else {
          showInviteErrorModal();
        }
        return;
      }

      await storePendingInvite(currentUser.id, result.code);
      await refreshProfile?.();
      console.log('[Invite] Code validated (not consumed):', result.code);
      navigation.replace('OnboardingUser', { inviteCode: result.code });
    } catch (err) {
      console.error('[InviteCodeScreen] invite check error', err);
      showInviteErrorModal();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Pressable
          onPress={() => navigation.replace('Auth')}
          style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
        >
          <Feather name="chevron-left" size={theme.fontSizes.lg} color={theme.colors.text.primary.light} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Enter your invite code</Text>
        <TextInput
          style={styles.input}
          placeholder="PAW-XXXXXX"
          placeholderTextColor={theme.colors.text.muted.light}
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
          editable={!loading}
        />
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [styles.joinButton, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.joinText}>{loading ? 'Checking...' : 'Continue'}</Text>
        </Pressable>

        <View style={styles.consentWrap}>
          <Text style={styles.consentText}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.consentLink}
              onPress={() => navigation.navigate('TermsOfService')}
              accessibilityRole="link"
              accessibilityLabel="Open Terms of Service"
            >
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text
              style={styles.consentLink}
              onPress={() => navigation.navigate('PrivacyPolicy')}
              accessibilityRole="link"
              accessibilityLabel="Open Privacy Policy"
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </View>

      <Modal visible={showErrorModal} transparent animationType="fade" onRequestClose={() => setShowErrorModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdropPress}
            onPress={() => setShowErrorModal(false)}
            accessibilityLabel="Dismiss error message"
          />

          <View style={styles.modalCard} accessibilityViewIsModal accessible>
            <Text style={styles.modalTitle}>Invalid Invite Code</Text>
            <Text style={styles.modalBody}>{errorMessage}</Text>
            <Pressable
              onPress={() => setShowErrorModal(false)}
              style={({ pressed }) => [styles.modalButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Got it"
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.xxxl,
  },
  backButton: {
    position: 'absolute',
    left: theme.spacing.xxl,
    top: theme.spacing.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    marginLeft: theme.spacing.xs,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.text.primary.light,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  input: {
    minHeight: theme.components.input.minHeight,
    backgroundColor: theme.components.input.background,
    borderColor: theme.components.input.border,
    borderWidth: 1,
    borderRadius: theme.components.input.borderRadius,
    paddingVertical: theme.components.input.paddingVertical,
    paddingHorizontal: theme.components.input.paddingHorizontal,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.lg,
  },
  joinButton: {
    minHeight: theme.components.button.minHeight,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.brand.sage.light,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
  },
  joinText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
    fontWeight: theme.fontWeights.semibold,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  consentWrap: {
    marginTop: theme.spacing.lg + theme.spacing.xs,
    paddingHorizontal: theme.spacing.xl,
  },
  consentText: {
    ...theme.fonts.legalDisclosure,
    textAlign: 'center',
  },
  consentLink: {
    ...theme.fonts.legalLink,
    color: theme.colors.brand.sage.light,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(47, 47, 47, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalBackdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '85%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: theme.spacing.xs },
    shadowOpacity: 0.08,
    shadowRadius: theme.spacing.sm,
    elevation: 3,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: Platform.select({ ios: 'Inter-SemiBold', android: 'Inter-SemiBold', default: 'System' }),
    fontWeight: theme.fontWeights.semibold,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: Platform.select({ ios: 'Inter-Regular', android: 'Inter-Regular', default: 'System' }),
    fontWeight: theme.fontWeights.regular,
    fontSize: theme.fontSizes.md - 1,
    color: theme.colors.text.secondary.light,
    lineHeight: theme.fontSizes.xl + 2,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  modalButton: {
    backgroundColor: theme.colors.brand.sage.light,
    borderRadius: theme.borderRadius.xl + 2,
    paddingVertical: theme.components.button.paddingVertical,
    paddingHorizontal: theme.spacing.xxl,
    minHeight: theme.components.button.minHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    color: theme.colors.text.inverse.value,
    fontFamily: theme.fonts?.button?.family ?? theme.fonts.body,
    fontWeight: theme.fontWeights.semibold,
    fontSize: theme.fontSizes.md - 1,
  },
});
