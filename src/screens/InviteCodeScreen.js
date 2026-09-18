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
import RequiredBadge from '../components/RequiredBadge';
import { useAuth } from '../contexts/AuthContext';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import {
  BETA_BOOTSTRAP_INVITE_CODE,
  getDefaultDevelopmentInviteCode,
  getPendingInvite,
  storePendingInvite,
  validateInviteCode,
} from '../lib/onboardingInvite';

export default function InviteCodeScreen({ navigation }) {
  const { user, refreshProfile, pendingInviteCode } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('This invite may have expired or already been used.');
  const [fieldError, setFieldError] = useState('');
  const surfaces = useRuntimeThemeColors();

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    const ensureSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        navigation.replace('Welcome');
      }
    };
    ensureSession();
  }, [navigation, user?.id]);

  // Prefill from retained deep-link invite; never overwrite a pending code with beta bootstrap.
  useEffect(() => {
    let cancelled = false;
    const hydrateInvite = async () => {
      const fromContext = String(pendingInviteCode ?? '')
        .trim()
        .replace(/^@/, '')
        .toUpperCase();
      const fromStorage = user?.id ? await getPendingInvite(user.id) : null;
      const pending = fromContext || String(fromStorage ?? '').trim().replace(/^@/, '').toUpperCase();
      if (cancelled) {
        return;
      }
      if (pending) {
        setInviteCode(pending);
        return;
      }
      const bootstrap =
        getDefaultDevelopmentInviteCode() || BETA_BOOTSTRAP_INVITE_CODE;
      setInviteCode(String(bootstrap).replace(/^@/, ''));
    };
    hydrateInvite();
    return () => {
      cancelled = true;
    };
  }, [pendingInviteCode, user?.id]);

  const showInviteErrorModal = (message) => {
    const nextMessage = message ?? 'This invite may have expired or already been used.';
    setErrorMessage(nextMessage);
    setFieldError(nextMessage);
    setShowErrorModal(true);
    AccessibilityInfo.announceForAccessibility?.(nextMessage);
  };

  const handleContinue = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      showInviteErrorModal('Enter your invite code');
      return;
    }

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser?.id) {
      Alert.alert('Session Required', 'Please sign in before entering your invite code.', [
        { text: 'OK', onPress: () => navigation.replace('Welcome') },
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
    <SafeAreaView style={[styles.safe, { backgroundColor: surfaces.backgroundScreen }]}>
      <View style={styles.container}>
        <Pressable
          onPress={() => navigation.replace('Welcome')}
          style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
        >
          <Feather name="chevron-left" size={theme.fontSizes.lg} color={theme.colors.text.primary.light} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Enter your invite code</Text>
        <View style={styles.labelRow}>
          <Text style={styles.label} allowFontScaling>
            Invite code
          </Text>
          <RequiredBadge />
        </View>
        <TextInput
          style={[styles.input, fieldError && styles.inputError]}
          placeholder="PAW-XXXXXX"
          placeholderTextColor={theme.colors.text.muted.light}
          value={inviteCode}
          onChangeText={(value) => {
            setInviteCode(value);
            if (fieldError) {
              setFieldError('');
            }
          }}
          autoCapitalize="characters"
          editable={!loading}
        />
        {fieldError ? (
          <Text style={styles.inlineError} accessibilityLiveRegion="polite" allowFontScaling>
            {fieldError}
          </Text>
        ) : null}
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [styles.joinButton, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.joinText}>{loading ? 'Checking…' : 'Continue'}</Text>
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
              Terms
            </Text>
            {', '}
            <Text
              style={styles.consentLink}
              onPress={() => navigation.navigate('PrivacyPolicy')}
              accessibilityRole="link"
              accessibilityLabel="Open Privacy Policy"
            >
              Privacy Policy
            </Text>
            {', and '}
            <Text
              style={styles.consentLink}
              onPress={() => navigation.navigate('CommunityGuidelines')}
              accessibilityRole="link"
              accessibilityLabel="Open Community Guidelines"
            >
              Community Guidelines
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
            <Text style={styles.modalTitle}>Invite not valid</Text>
            <Text style={styles.modalBody}>{errorMessage}</Text>
            <Pressable
              onPress={() => setShowErrorModal(false)}
              style={({ pressed }) => [styles.modalButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="OK"
            >
              <Text style={styles.modalButtonText}>OK</Text>
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
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
    marginBottom: theme.spacing.sm,
  },
  inputError: {
    borderColor: theme.colors.feedback.error.value,
  },
  inlineError: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.feedback.error.value,
    marginBottom: theme.spacing.md,
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
