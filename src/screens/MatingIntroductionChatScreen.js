import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import BlockConfirmSheet from '../components/BlockConfirmSheet';
import ContentSafetyMenu from '../components/ContentSafetyMenu';
import LoadErrorRetry from '../components/LoadErrorRetry';
import ReportSheet from '../components/ReportSheet';
import ScreenWrapper from '../components/ScreenWrapper';
import { theme } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import {
  INTRO_CHAT_LINK_FORBIDDEN_MESSAGE,
  MATING_CHAT_DISCLAIMER,
  fetchIntroductionChannelById,
  fetchIntroductionMessages,
  introductionMessageBodyContainsLink,
  sendIntroductionMessage,
} from '../services/mating';

const DISCLAIMER_KEY = '@pawple/mating_intro_disclaimer_ack_v1';

/**
 * Consent-gated mating introduction chat — not open DMs.
 * Compose fails closed when channel is frozen or RLS denies INSERT.
 */
export default function MatingIntroductionChatScreen({ navigation, route }) {
  const channelId = route?.params?.channelId ?? null;
  const otherPetName = route?.params?.otherPetName ?? 'Pet';
  const otherPetId = route?.params?.otherPetId ?? null;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [channel, setChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [otherOwnerId, setOtherOwnerId] = useState(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    if (!channelId) {
      setLoading(false);
      setError(true);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const ch = await fetchIntroductionChannelById(channelId);
      if (!ch) {
        setChannel(null);
        setError(true);
        return;
      }
      setChannel(ch);

      const ownerId =
        user?.id && String(ch.owner_low_id) === String(user.id)
          ? ch.owner_high_id
          : ch.owner_low_id;
      setOtherOwnerId(ownerId);

      const rows = await fetchIntroductionMessages(channelId);
      setMessages(rows);

      const ack = await AsyncStorage.getItem(`${DISCLAIMER_KEY}:${channelId}`);
      if (!ack) {
        setShowDisclaimer(true);
      }
    } catch (e) {
      console.error('[MatingIntroChat]', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [channelId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Soft realtime refresh while focused — fail closed still enforced by RLS.
  useEffect(() => {
    if (!channelId) {
      return undefined;
    }
    const interval = setInterval(() => {
      fetchIntroductionMessages(channelId)
        .then(setMessages)
        .catch((e) => console.error('[MatingIntroChat] poll', e));
    }, 8000);
    return () => clearInterval(interval);
  }, [channelId]);

  const acknowledgeDisclaimer = useCallback(async () => {
    try {
      await AsyncStorage.setItem(`${DISCLAIMER_KEY}:${channelId}`, '1');
    } catch (e) {
      console.error('[MatingIntroChat] disclaimer ack', e);
    }
    setShowDisclaimer(false);
  }, [channelId]);

  const canCompose = channel?.status === 'open';
  const draftHasLink = introductionMessageBodyContainsLink(draft);
  const canSend = canCompose && !sending && Boolean(draft.trim()) && !draftHasLink;

  const handleSend = useCallback(async () => {
    if (!canSend) {
      return;
    }
    setSending(true);
    try {
      const row = await sendIntroductionMessage(channelId, draft);
      setMessages((prev) => [...prev, row]);
      setDraft('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd?.({ animated: true }));
    } catch (e) {
      console.error('[MatingIntroChat] send', e);
      // Re-check channel — mutual may have broken.
      try {
        const ch = await fetchIntroductionChannelById(channelId);
        setChannel(ch);
      } catch (refreshErr) {
        console.error('[Supabase]', refreshErr);
      }
      Toast.show({
        type: 'error',
        text1: e?.userMessage || e?.message || "Couldn't send.",
      });
    } finally {
      setSending(false);
    }
  }, [canSend, channelId, draft]);

  const title = `Introduction · ${otherPetName}`;

  return (
    <ScreenWrapper
      title={title}
      showBackButton
      onClose={() => navigation.goBack()}
      headerRight={
        <Pressable
          onPress={() => setSafetyOpen(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Safety"
        >
          <Feather name="more-horizontal" size={22} color={theme.colors.text.primary.light} />
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand.sage.value} />
        </View>
      ) : error || !channel ? (
        <LoadErrorRetry onRetry={load} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={88}
        >
          {!canCompose ? (
            <View style={styles.frozenBanner}>
              <Text style={styles.frozenText} allowFontScaling>
                Introduction is paused.
              </Text>
            </View>
          ) : null}

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.empty} allowFontScaling>
                A quiet place to introduce yourselves.
              </Text>
            }
            renderItem={({ item }) => {
              const mine = String(item.sender_user_id) === String(user?.id);
              return (
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text
                    style={[styles.bubbleText, mine && styles.bubbleTextMine]}
                    allowFontScaling
                  >
                    {item.body}
                  </Text>
                </View>
              );
            }}
          />

          <View style={styles.composer}>
            {canCompose && draftHasLink ? (
              <Text style={styles.linkHint} allowFontScaling>
                {INTRO_CHAT_LINK_FORBIDDEN_MESSAGE}
              </Text>
            ) : null}
            <View style={styles.composerRow}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={canCompose ? 'Message' : 'Paused'}
                placeholderTextColor={theme.colors.placeholder?.value ?? '#9A9A9A'}
                editable={canCompose && !sending}
                maxLength={2000}
                multiline
                accessibilityLabel="Message"
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                style={({ pressed }) => [
                  styles.sendBtn,
                  !canSend && styles.sendDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                {sending ? (
                  <ActivityIndicator color={theme.colors.text.inverse.value} />
                ) : (
                  <Feather name="arrow-up" size={20} color={theme.colors.text.inverse.value} />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={showDisclaimer} transparent animationType="fade">
        <View style={styles.disclaimerBackdrop}>
          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimerTitle} allowFontScaling>
              Before you continue
            </Text>
            <Text style={styles.disclaimerBody} allowFontScaling>
              {MATING_CHAT_DISCLAIMER}
            </Text>
            <Pressable
              onPress={acknowledgeDisclaimer}
              style={({ pressed }) => [styles.disclaimerBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.disclaimerBtnText} allowFontScaling>
                Continue
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ContentSafetyMenu
        visible={safetyOpen}
        showReport
        showBlock={Boolean(otherPetId)}
        blockLabel="Block pet"
        onClose={() => setSafetyOpen(false)}
        onReport={() => {
          setSafetyOpen(false);
          setReportOpen(true);
        }}
        onBlock={() => {
          setSafetyOpen(false);
          setBlockOpen(true);
        }}
      />

      <ReportSheet
        visible={reportOpen}
        targetType="introduction_chat"
        targetId={channelId}
        reportedUserId={otherOwnerId}
        blockablePets={
          otherPetId ? [{ id: otherPetId, name: otherPetName }] : []
        }
        onClose={() => setReportOpen(false)}
      />

      <BlockConfirmSheet
        visible={blockOpen}
        pet={otherPetId ? { id: otherPetId, name: otherPetName } : null}
        onClose={() => setBlockOpen(false)}
        onBlocked={() => {
          setBlockOpen(false);
          load();
        }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frozenBanner: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  frozenText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.brand.sageDark.value,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  empty: {
    marginTop: 48,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.brand.sage.value,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.background.card,
  },
  bubbleText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    color: theme.colors.text.primary.light,
  },
  bubbleTextMine: {
    color: theme.colors.text.inverse.value,
  },
  composer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.light,
    backgroundColor: theme.colors.background.screen,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  linkHint: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background.card,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sage.value,
  },
  sendDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  disclaimerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  disclaimerCard: {
    width: '100%',
    borderRadius: 22,
    padding: 24,
    backgroundColor: theme.colors.background.card,
    gap: 16,
  },
  disclaimerTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.text.primary.light,
  },
  disclaimerBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    color: theme.colors.text.secondary.light,
  },
  disclaimerBtn: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sage.value,
  },
  disclaimerBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
});
