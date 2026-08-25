import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOTAL_INVITES = 5;
const INVITE_REMAINING_CACHE_KEY = 'inviteUnusedCount';

const generateCode = () => {
  let code = 'PAW-';
  for (let i = 0; i < 6; i += 1) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
};

export default function InviteSheet({ visible, onClose, onRemainingChange }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(320)).current;

  const unusedInvites = useMemo(() => invites.filter((item) => item.status === 'unused'), [invites]);
  const currentInvite = unusedInvites[0] ?? null;
  const remaining = unusedInvites.length;
  const usedCount = useMemo(() => invites.filter((item) => item.status === 'used').length, [invites]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (currentInvite?.code) {
      AccessibilityInfo.announceForAccessibility?.(
        `Invite code ${currentInvite.code}. ${remaining} of ${TOTAL_INVITES} invites remaining.`,
      );
    } else {
      AccessibilityInfo.announceForAccessibility?.('All invites sent. Check back later.');
    }
  }, [currentInvite?.code, remaining, visible]);

  const notifyRemaining = useCallback(
    async (count) => {
      onRemainingChange?.(count);
      try {
        await AsyncStorage.setItem(INVITE_REMAINING_CACHE_KEY, String(count));
      } catch (error) {
        console.log('[InviteSheet] Cache write failed:', error);
      }
    },
    [onRemainingChange],
  );

  const hydrateInvites = useCallback(async () => {
    if (!user?.id) {
      setInvites([]);
      notifyRemaining(0);
      return;
    }
    setLoading(true);
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('invites')
        .select('id, code, status, user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      const rows = existing ?? [];
      if (rows.length < TOTAL_INVITES) {
        const existingCodes = new Set(rows.map((item) => item.code));
        const toCreateCount = TOTAL_INVITES - rows.length;
        // Prefer server-side generation if the RPC exists; fallback keeps app working in older DBs.
        let insertedWithRpc = false;
        const { error: rpcError } = await supabase.rpc('ensure_user_invites', {
          target_user_id: user.id,
          target_count: TOTAL_INVITES,
        });
        if (!rpcError) {
          insertedWithRpc = true;
        } else {
          console.log('[InviteSheet] RPC ensure_user_invites unavailable, using client fallback:', rpcError?.message);
        }

        if (!insertedWithRpc) {
          const newCodes = [];
          while (newCodes.length < toCreateCount) {
            const nextCode = generateCode();
            if (!existingCodes.has(nextCode)) {
              existingCodes.add(nextCode);
              newCodes.push(nextCode);
            }
          }

          const payload = newCodes.map((code) => ({
            user_id: user.id,
            code,
            status: 'unused',
          }));

          const { error: insertError } = await supabase.from('invites').insert(payload);
          if (insertError) {
            throw insertError;
          }
        }

        const { data: refreshed, error: refetchError } = await supabase
          .from('invites')
          .select('id, code, status, user_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        if (refetchError) {
          throw refetchError;
        }
        setInvites(refreshed ?? []);
        await notifyRemaining((refreshed ?? []).filter((item) => item.status === 'unused').length);
      } else {
        setInvites(rows);
        await notifyRemaining(rows.filter((item) => item.status === 'unused').length);
      }
    } catch (error) {
      console.log('[InviteSheet] Load error:', error);
      Alert.alert('Invites', 'Could not load invite codes right now.');
    } finally {
      setLoading(false);
    }
  }, [notifyRemaining, user?.id]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    hydrateInvites();
  }, [hydrateInvites, visible]);

  useEffect(() => {
    if (!visible) {
      backdropOpacity.setValue(0);
      sheetY.setValue(320);
      return;
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(sheetY, { toValue: 0, tension: 68, friction: 12, useNativeDriver: true }),
    ]).start();
  }, [backdropOpacity, sheetY, visible]);

  const closeAnimated = useCallback(
    (then) => {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 320, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) then?.();
      });
    },
    [backdropOpacity, sheetY],
  );

  const sharePayload = currentInvite?.code ? `Join me on Pawple! Use code: ${currentInvite.code} to get started.` : '';

  const handleShareWhatsApp = async () => {
    if (!sharePayload) return;
    try {
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(sharePayload)}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (!canOpen) {
        Alert.alert('WhatsApp', 'WhatsApp is not available on this device.');
        return;
      }
      await Linking.openURL(whatsappUrl);
    } catch (error) {
      console.log('[InviteSheet] WhatsApp share error:', error);
      Alert.alert('Invites', 'Could not share via WhatsApp.');
    }
  };

  const handleShareEmail = async () => {
    if (!sharePayload) return;
    try {
      const mailto = `mailto:?subject=${encodeURIComponent('Join Pawple')}&body=${encodeURIComponent(sharePayload)}`;
      const canOpen = await Linking.canOpenURL(mailto);
      if (!canOpen) {
        Alert.alert('Email', 'Email app is unavailable on this device.');
        return;
      }
      await Linking.openURL(mailto);
    } catch (error) {
      console.log('[InviteSheet] Email share error:', error);
      Alert.alert('Invites', 'Could not share via email.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeAnimated(onClose)}>
      <View style={styles.root}>
        <Pressable style={styles.backdropPress} onPress={() => closeAnimated(onClose)} accessibilityLabel="Close invites">
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, theme.spacing.md),
              transform: [{ translateY: sheetY }],
            },
          ]}
        >
          <Text style={styles.title}>Invite to Pawple</Text>

          {loading ? (
            <Text style={styles.helper}>Loading invite codes...</Text>
          ) : currentInvite ? (
            <>
              <Text style={styles.codeLabel}>Your Invite Code</Text>
              <Text style={styles.code}>{currentInvite.code}</Text>
              <Text style={styles.counter}>{`${usedCount} of ${TOTAL_INVITES} invites sent.`}</Text>
            </>
          ) : (
            <>
              <Text style={styles.counter}>All invites sent. Check back later!</Text>
            </>
          )}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleShareWhatsApp}
              disabled={!currentInvite || loading}
              style={({ pressed }) => [
                styles.shareButton,
                (!currentInvite || loading) && styles.actionDisabled,
                pressed && styles.actionPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Share invite via WhatsApp"
            >
              <View style={styles.shareButtonInner}>
                <Feather name="message-circle" size={theme.fontSizes.md} color={theme.components.button.primaryText} />
                <Text style={styles.shareText}>WhatsApp</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={handleShareEmail}
              disabled={!currentInvite || loading}
              style={({ pressed }) => [
                styles.shareButton,
                styles.shareButtonGap,
                (!currentInvite || loading) && styles.actionDisabled,
                pressed && styles.actionPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Share invite via Email"
            >
              <View style={styles.shareButtonInner}>
                <Feather name="mail" size={theme.fontSizes.md} color={theme.components.button.primaryText} />
                <Text style={styles.shareText}>Email</Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    ...theme.shadowsRN.sm,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
  codeLabel: {
    marginTop: theme.spacing.lg,
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
  code: {
    marginVertical: theme.spacing.md,
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.primary.light,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  counter: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  helper: {
    marginVertical: theme.spacing.lg,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  shareButton: {
    flex: 1,
    minHeight: theme.components.button.minHeight,
    borderRadius: theme.spacing.md + theme.spacing.xs - theme.spacing.xs + 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary.light,
    paddingVertical: theme.spacing.md,
  },
  shareButtonGap: {
    marginLeft: theme.spacing.md,
  },
  shareButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  shareText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.components.button.primaryText,
    fontWeight: theme.fontWeights.semibold,
  },
  actionPressed: {
    opacity: 0.86,
  },
  actionDisabled: {
    opacity: 0.5,
  },
});
