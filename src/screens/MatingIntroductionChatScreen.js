import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
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
import ChatThreadHeader from '../components/ChatThreadHeader';
import ContentSafetyMenu from '../components/ContentSafetyMenu';
import DeleteChatConfirmSheet from '../components/DeleteChatConfirmSheet';
import LoadErrorRetry from '../components/LoadErrorRetry';
import ReportSheet from '../components/ReportSheet';
import UnpawConfirmSheet from '../components/UnpawConfirmSheet';
import UnpawReportPrompt from '../components/UnpawReportPrompt';
import ScreenWrapper from '../components/ScreenWrapper';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { useAuth } from '../contexts/AuthContext';
import {
  INTRO_CHAT_LINK_FORBIDDEN_MESSAGE,
  MATING_CHAT_DISCLAIMER,
  MATING_CHAT_DISCLAIMER_TITLE,
  consumeReportedIntroductionChatDismissal,
  flushPendingReportChatDismiss,
  getIntroductionChatView,
  getLocallySuppressedReportChatDismissChannelId,
  INTRODUCTION_CHAT_VIEW_POLL_MS,
  introductionMessageBodyContainsLink,
  sendIntroductionMessage,
  terminateIntroductionChatAfterReport,
} from '../services/mating';
import {
  MATING_CHAT_BACK_TO_CHAT,
  MATING_CHAT_EMPTY_COMPANION,
  MATING_CHAT_EMPTY_SAY_HELLO,
  MATING_CHAT_ENDED_BODY,
  MATING_CHAT_ENDED_SUBTITLE,
  MATING_CHAT_ENDED_TITLE,
  MATING_CHAT_REPORT_DONE_LINES,
} from '../content/legalDocuments';
import { formatMessageTime } from '../lib/formatChatTime';
import { useMatingUnpawFlow } from '../hooks/useMatingUnpawFlow';

const DISCLAIMER_KEY = '@pawple/mating_intro_disclaimer_ack_v1';

/**
 * Consent-gated mating introduction chat — not open DMs.
 * Compose fails closed when channel is frozen or RLS denies INSERT.
 */
export default function MatingIntroductionChatScreen({ navigation, route }) {
  const surfaces = useRuntimeThemeColors();
  const channelId = route?.params?.channelId ?? null;
  const viewerPetId = route?.params?.viewerPetId ?? null;
  const [otherPetName, setOtherPetName] = useState(null);
  const [otherPetId, setOtherPetId] = useState(null);
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [viewReady, setViewReady] = useState(false);
  const [error, setError] = useState(false);
  const [channel, setChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [otherOwnerId, setOtherOwnerId] = useState(null);
  const [otherPetPhotoUrl, setOtherPetPhotoUrl] = useState(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteChatOpen, setDeleteChatOpen] = useState(false);
  const [exitAfterUnpaw, setExitAfterUnpaw] = useState(false);
  const [chatView, setChatView] = useState(null);
  const [postReportFrozen, setPostReportFrozen] = useState(false);
  const listRef = useRef(null);
  const chatViewRef = useRef(chatView);
  const postReportFrozenRef = useRef(postReportFrozen);
  const exitAfterUnpawRef = useRef(exitAfterUnpaw);
  const viewReadyRef = useRef(viewReady);
  const loadedChannelIdRef = useRef(null);

  const threadTheme = useMemo(
    () => ({
      textPrimary: { color: surfaces.textPrimary },
      textSecondary: { color: surfaces.textSecondary },
      textMuted: { color: surfaces.textMuted },
      backgroundCard: { backgroundColor: surfaces.backgroundCard },
      backgroundScreen: { backgroundColor: surfaces.backgroundScreen },
      sageLightSurface: {
        backgroundColor: surfaces.isDark
          ? surfaces.meetupChipBackground
          : theme.colors.brand.sageLight.light,
      },
      bubbleTheirs: { backgroundColor: surfaces.backgroundCard },
    }),
    [
      surfaces.backgroundCard,
      surfaces.backgroundScreen,
      surfaces.isDark,
      surfaces.meetupChipBackground,
      surfaces.textMuted,
      surfaces.textPrimary,
      surfaces.textSecondary,
    ],
  );

  useEffect(() => {
    chatViewRef.current = chatView;
  }, [chatView]);

  useEffect(() => {
    postReportFrozenRef.current = postReportFrozen;
  }, [postReportFrozen]);

  useEffect(() => {
    exitAfterUnpawRef.current = exitAfterUnpaw;
  }, [exitAfterUnpaw]);

  useEffect(() => {
    viewReadyRef.current = viewReady;
  }, [viewReady]);

  useEffect(() => {
    loadedChannelIdRef.current = null;
    viewReadyRef.current = false;
  }, [channelId]);

  const isUnavailablePayload = useCallback(
    (payload) => !payload || payload.view === 'unavailable',
    [],
  );

  const clearOtherPartyIdentity = useCallback(() => {
    setMessages([]);
    setOtherOwnerId(null);
    setOtherPetId(null);
    setOtherPetName(null);
    setOtherPetPhotoUrl(null);
  }, []);

  const handleChannelUnavailable = useCallback(() => {
    clearOtherPartyIdentity();
    setChannel(null);
    setChatView('unavailable');
    setViewReady(true);
    setLoading(false);
    setError(false);
    if (exitAfterUnpawRef.current) {
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [clearOtherPartyIdentity, navigation]);

  const applyChatViewPayload = useCallback((payload) => {
    if (payload.view === 'ended_anonymous') {
      clearOtherPartyIdentity();
      setChannel({ id: payload.channel_id, status: payload.status });
      setChatView('ended_anonymous');
      setViewReady(true);
      setError(false);
      return true;
    }

    setChannel({ id: payload.channel_id, status: payload.status });
    setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    setOtherOwnerId(payload.other_owner_id ?? null);
    setOtherPetId(payload.other_pet_id ?? null);
    setOtherPetName(payload.other_pet_name ?? null);
    setOtherPetPhotoUrl(payload.other_pet_photo_url ?? null);
    setChatView(payload.view === 'reporter_frozen' ? 'reporter_frozen' : 'open');
    setViewReady(true);
    setError(false);
    return true;
  }, [clearOtherPartyIdentity]);

  const shouldDismissEndedChat = useCallback(() => {
    const view = chatViewRef.current;
    return (
      view === 'reporter_frozen' ||
      view === 'ended_anonymous' ||
      postReportFrozenRef.current === true
    );
  }, []);

  const dismissEndedChatIfNeeded = useCallback(async () => {
    if (!channelId || !shouldDismissEndedChat()) {
      return;
    }
    try {
      await consumeReportedIntroductionChatDismissal(channelId);
    } catch (e) {
      console.error('[MatingIntroChat] dismiss reported chat', e);
    }
  }, [channelId, shouldDismissEndedChat]);

  const exitChat = useCallback(() => {
    dismissEndedChatIfNeeded().finally(() => {
      setExitAfterUnpaw(false);
      setPostReportFrozen(false);
      navigation.goBack();
    });
  }, [dismissEndedChatIfNeeded, navigation]);

  const refreshChatView = useCallback(async () => {
    if (!channelId) {
      return;
    }
    try {
      const suppressedChannelId = await getLocallySuppressedReportChatDismissChannelId();
      const payload = await getIntroductionChatView(channelId);
      if (
        suppressedChannelId &&
        String(suppressedChannelId) === String(channelId) &&
        payload?.view === 'ended_anonymous'
      ) {
        clearOtherPartyIdentity();
        setChannel(null);
        setChatView('unavailable');
        setViewReady(true);
        setError(true);
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
        return;
      }
      if (isUnavailablePayload(payload)) {
        handleChannelUnavailable();
        return;
      }
      applyChatViewPayload(payload);
    } catch (e) {
      console.error('[MatingIntroChat] refresh', e);
    }
  }, [
    applyChatViewPayload,
    channelId,
    clearOtherPartyIdentity,
    handleChannelUnavailable,
    isUnavailablePayload,
    navigation,
  ]);

  const load = useCallback(async ({ background = false } = {}) => {
    if (!channelId) {
      setLoading(false);
      setViewReady(false);
      setError(true);
      loadedChannelIdRef.current = null;
      return;
    }

    const preserveThread =
      background ||
      (loadedChannelIdRef.current === channelId && viewReadyRef.current && !error);

    if (!preserveThread) {
      setLoading(true);
      setViewReady(false);
      clearOtherPartyIdentity();
    }
    setError(false);
    try {
      await flushPendingReportChatDismiss();
      const suppressedChannelId = await getLocallySuppressedReportChatDismissChannelId();
      const payload = await getIntroductionChatView(channelId);
      if (
        suppressedChannelId &&
        String(suppressedChannelId) === String(channelId) &&
        payload?.view === 'ended_anonymous'
      ) {
        clearOtherPartyIdentity();
        setChannel(null);
        setChatView('unavailable');
        setViewReady(true);
        setError(true);
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
        return;
      }
      if (isUnavailablePayload(payload)) {
        handleChannelUnavailable();
        return;
      }
      applyChatViewPayload(payload);
      loadedChannelIdRef.current = channelId;
      viewReadyRef.current = true;

      if (payload.view === 'open' && !preserveThread) {
        const ack = await AsyncStorage.getItem(`${DISCLAIMER_KEY}:${channelId}`);
        if (!ack) {
          setShowDisclaimer(true);
        }
      }
    } catch (e) {
      console.error('[MatingIntroChat]', e);
      if (!preserveThread) {
        setError(true);
        setViewReady(true);
        loadedChannelIdRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  }, [
    applyChatViewPayload,
    channelId,
    clearOtherPartyIdentity,
    error,
    handleChannelUnavailable,
    isUnavailablePayload,
    navigation,
  ]);

  const unpawFlow = useMatingUnpawFlow({
    viewerPetId,
    otherPetId,
    onUnpawComplete: () => {
      load();
      setExitAfterUnpaw(true);
    },
  });

  useFocusEffect(
    useCallback(() => {
      const preserveThread =
        loadedChannelIdRef.current === channelId && viewReadyRef.current;

      if (preserveThread) {
        load({ background: true });
      } else {
        load();
      }
      const interval = setInterval(refreshChatView, INTRODUCTION_CHAT_VIEW_POLL_MS);
      return () => clearInterval(interval);
    }, [channelId, load, refreshChatView]),
  );

  useEffect(() => {
    flushPendingReportChatDismiss().catch((e) => {
      console.error('[MatingIntroChat] flush pending dismiss on mount', e);
    });
  }, []);

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur', () => {
      dismissEndedChatIfNeeded();
    });
    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', () => {
      dismissEndedChatIfNeeded();
    });
    return () => {
      unsubscribeBlur();
      unsubscribeBeforeRemove();
    };
  }, [dismissEndedChatIfNeeded, navigation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        dismissEndedChatIfNeeded();
        return;
      }
      if (nextState === 'active') {
        flushPendingReportChatDismiss()
          .then(() => refreshChatView())
          .catch((e) => console.error('[MatingIntroChat] foreground refresh', e));
      }
    });
    return () => subscription.remove();
  }, [dismissEndedChatIfNeeded, refreshChatView]);

  useEffect(
    () => () => {
      dismissEndedChatIfNeeded();
    },
    [dismissEndedChatIfNeeded],
  );

  const acknowledgeDisclaimer = useCallback(async () => {
    try {
      await AsyncStorage.setItem(`${DISCLAIMER_KEY}:${channelId}`, '1');
    } catch (e) {
      console.error('[MatingIntroChat] disclaimer ack', e);
    }
    setShowDisclaimer(false);
  }, [channelId]);

  const openOtherPetProfile = useCallback(() => {
    if (!otherPetId || !viewerPetId) {
      return;
    }
    navigation.navigate('ViewPetProfileScreen', {
      petId: otherPetId,
      viewerPetId,
    });
  }, [navigation, otherPetId, viewerPetId]);

  const canCompose = chatView === 'open' && channel?.status === 'open';
  const canDeleteChat = Boolean(
    viewerPetId && otherPetId && chatView === 'open' && channel?.status === 'open',
  );
  const draftHasLink = introductionMessageBodyContainsLink(draft);
  const canSend = canCompose && !sending && Boolean(draft.trim()) && !draftHasLink;
  const hasSentMessage = useMemo(
    () => messages.some((item) => String(item.sender_user_id) === String(user?.id)),
    [messages, user?.id],
  );
  const composerPlaceholder = canCompose
    ? hasSentMessage
      ? 'Message…'
      : 'Say hello…'
    : 'Paused';

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
      try {
        const payload = await getIntroductionChatView(channelId);
        if (isUnavailablePayload(payload)) {
          handleChannelUnavailable();
          return;
        }
        applyChatViewPayload(payload);
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
  }, [
    applyChatViewPayload,
    canSend,
    channelId,
    draft,
    handleChannelUnavailable,
    isUnavailablePayload,
  ]);

  const handleReportSubmitted = useCallback(
    async (result) => {
      if (result?.demo || !channelId || !viewerPetId) {
        return;
      }
      try {
        await terminateIntroductionChatAfterReport(channelId, viewerPetId);
        setPostReportFrozen(true);
        await load();
      } catch (e) {
        console.error('[MatingIntroChat] terminate after report', e);
        Toast.show({ type: 'error', text1: "Couldn't close this conversation." });
      }
    },
    [channelId, load, viewerPetId],
  );

  const handleReportClose = useCallback(() => {
    setReportOpen(false);
    if (exitAfterUnpaw) {
      exitChat();
    }
  }, [exitAfterUnpaw, exitChat]);

  const showIdentityHeader =
    viewReady && !loading && (chatView === 'open' || chatView === 'reporter_frozen');

  const headerContent =
    chatView === 'ended_anonymous' ? (
      <ChatThreadHeader
        petName={MATING_CHAT_ENDED_TITLE}
        onBack={exitChat}
        headerRight={
          <View style={styles.headerSpacer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        }
      />
    ) : showIdentityHeader ? (
      <ChatThreadHeader
        petName={otherPetName}
        photoUrl={otherPetPhotoUrl}
        onBack={exitChat}
        onOpenProfile={chatView === 'open' ? openOtherPetProfile : undefined}
        headerRight={
          <Pressable
            onPress={() => setSafetyOpen(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Safety"
          >
            <Feather name="more-horizontal" size={20} color={theme.colors.text.muted.light} />
          </Pressable>
        }
      />
    ) : (
      <View style={styles.loadingHeader}>
        <Pressable
          onPress={exitChat}
          hitSlop={theme.spacing.sm}
          style={({ pressed }) => [styles.loadingHeaderBack, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={theme.fontSizes.xxl} color={theme.colors.text.primary.light} />
        </Pressable>
      </View>
    );

  const renderEndedAnonymous = () => (
    <View style={styles.endedWrap}>
      <Text style={[styles.endedTitle, threadTheme.textPrimary]} allowFontScaling>
        {MATING_CHAT_ENDED_TITLE}
      </Text>
      <Text style={[styles.endedSubtitle, threadTheme.textSecondary]} allowFontScaling>
        {MATING_CHAT_ENDED_SUBTITLE}
      </Text>
      <Text style={[styles.endedBody, threadTheme.textMuted]} allowFontScaling>
        {MATING_CHAT_ENDED_BODY}
      </Text>
      <Pressable
        onPress={exitChat}
        style={({ pressed }) => [styles.endedBackBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={MATING_CHAT_BACK_TO_CHAT}
      >
        <Text style={styles.endedBackBtnText} allowFontScaling>
          {MATING_CHAT_BACK_TO_CHAT}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <ScreenWrapper headerContent={headerContent}>
      {loading || !viewReady ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand.sage.value} />
        </View>
      ) : chatView === 'unavailable' && exitAfterUnpaw ? (
        <View style={styles.flex} />
      ) : error || !channel ? (
        <LoadErrorRetry onRetry={load} />
      ) : chatView === 'ended_anonymous' ? (
        renderEndedAnonymous()
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={88}
        >
          {!canCompose ? (
            <View style={[styles.frozenBanner, threadTheme.sageLightSurface]}>
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
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyCompanion, threadTheme.textSecondary]} allowFontScaling>
                  {MATING_CHAT_EMPTY_COMPANION}
                </Text>
                <Text style={[styles.emptySayHello, threadTheme.textMuted]} allowFontScaling>
                  {MATING_CHAT_EMPTY_SAY_HELLO}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = String(item.sender_user_id) === String(user?.id);
              const timeLabel = formatMessageTime(item.created_at);
              return (
                <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.bubbleMine : styles.bubbleTheirs,
                      !mine && threadTheme.bubbleTheirs,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        mine ? styles.bubbleTextMine : threadTheme.textPrimary,
                      ]}
                      allowFontScaling
                    >
                      {item.body}
                    </Text>
                  </View>
                  {timeLabel ? (
                    <Text
                      style={[styles.timestamp, threadTheme.textMuted, mine && styles.timestampMine]}
                      allowFontScaling
                    >
                      {timeLabel}
                    </Text>
                  ) : null}
                </View>
              );
            }}
          />

          <View style={[styles.composer, threadTheme.backgroundScreen]}>
            {canCompose && draftHasLink ? (
              <Text style={[styles.linkHint, threadTheme.textMuted]} allowFontScaling>
                {INTRO_CHAT_LINK_FORBIDDEN_MESSAGE}
              </Text>
            ) : null}
            <View style={[styles.composerSurface, threadTheme.backgroundCard]}>
              <TextInput
                style={[styles.composerInput, threadTheme.textPrimary]}
                value={draft}
                onChangeText={setDraft}
                placeholder={composerPlaceholder}
                placeholderTextColor={surfaces.placeholder}
                editable={canCompose && !sending}
                maxLength={2000}
                multiline
                accessibilityLabel="Message"
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                style={({ pressed }) => [
                  styles.sendAction,
                  !canSend && styles.sendDisabled,
                  pressed && canSend && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                {sending ? (
                  <ActivityIndicator color={theme.colors.brand.sage.value} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.sendLabel,
                      !canSend && styles.sendLabelDisabled,
                      !canSend && threadTheme.textMuted,
                    ]}
                    allowFontScaling
                  >
                    Send
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={showDisclaimer} transparent animationType="fade">
        <View style={styles.disclaimerBackdrop}>
          <View style={[styles.disclaimerCard, threadTheme.backgroundCard]}>
            <Text style={[styles.disclaimerTitle, threadTheme.textPrimary]} allowFontScaling>
              {MATING_CHAT_DISCLAIMER_TITLE}
            </Text>
            <Text style={[styles.disclaimerBody, threadTheme.textSecondary]} allowFontScaling>
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
        showDelete={canDeleteChat}
        deleteLabel="Delete chat"
        showViewProfile={Boolean(otherPetId && viewerPetId && chatView === 'open')}
        showUnpaw={canDeleteChat}
        showReport
        showBlock={Boolean(otherPetId)}
        blockLabel="Block pet"
        onClose={() => setSafetyOpen(false)}
        onDelete={() => {
          setSafetyOpen(false);
          setDeleteChatOpen(true);
        }}
        onViewProfile={() => {
          setSafetyOpen(false);
          openOtherPetProfile();
        }}
        onReport={() => {
          setSafetyOpen(false);
          setReportOpen(true);
        }}
        onUnpaw={() => {
          setSafetyOpen(false);
          unpawFlow.requestUnpaw();
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
        blockablePets={otherPetId ? [{ id: otherPetId, name: otherPetName }] : []}
        doneBodyLines={MATING_CHAT_REPORT_DONE_LINES}
        onSubmitted={handleReportSubmitted}
        onClose={handleReportClose}
      />

      <BlockConfirmSheet
        visible={blockOpen}
        pet={otherPetId ? { id: otherPetId, name: otherPetName } : null}
        onClose={() => setBlockOpen(false)}
        onBlocked={() => {
          setBlockOpen(false);
          exitChat();
        }}
      />

      <DeleteChatConfirmSheet
        visible={deleteChatOpen}
        channelId={channelId}
        viewerPetId={viewerPetId}
        petName={otherPetName}
        onClose={() => setDeleteChatOpen(false)}
        onDeleted={() => {
          setDeleteChatOpen(false);
          exitChat();
        }}
      />

      <UnpawConfirmSheet
        visible={unpawFlow.confirmVisible}
        busy={unpawFlow.busy}
        onConfirm={async () => {
          try {
            await unpawFlow.confirmUnpaw();
          } catch (e) {
            console.error('[MatingIntroChat] unpaw', e);
            Toast.show({ type: 'error', text1: "Couldn't unpaw. Try again." });
          }
        }}
        onClose={unpawFlow.cancelUnpaw}
      />

      <UnpawReportPrompt
        visible={unpawFlow.reportPromptVisible}
        petName={otherPetName}
        onNo={() => {
          unpawFlow.dismissReportPrompt();
          if (exitAfterUnpaw) {
            exitChat();
          }
        }}
        onYes={() => {
          unpawFlow.dismissReportPrompt();
          setReportOpen(true);
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
    paddingTop: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  emptyWrap: {
    marginTop: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyCompanion: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
  },
  emptySayHello: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
  bubbleWrap: {
    maxWidth: '80%',
    marginBottom: 14,
    gap: 6,
  },
  bubbleWrapMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  bubbleMine: {
    backgroundColor: theme.colors.brand.sage.value,
  },
  bubbleTheirs: {
    backgroundColor: theme.colors.background.card,
  },
  bubbleText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 23,
    color: theme.colors.text.primary.light,
  },
  bubbleTextMine: {
    color: theme.colors.text.inverse.value,
  },
  timestamp: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.muted.light,
    paddingHorizontal: 4,
  },
  timestampMine: {
    textAlign: 'right',
  },
  composer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
    backgroundColor: theme.colors.background.screen,
  },
  linkHint: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
  composerSurface: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.background.card,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingVertical: 10,
    paddingRight: 8,
    backgroundColor: 'transparent',
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  sendAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sendLabel: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.brand.sage.value,
  },
  sendLabelDisabled: {
    color: theme.colors.text.muted.light,
  },
  sendDisabled: {
    opacity: 0.5,
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
  headerSpacer: {
    width: 44,
    height: 44,
  },
  loadingHeader: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  loadingHeaderBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endedWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
    gap: 16,
  },
  endedTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.text.primary.light,
    textAlign: 'center',
  },
  endedSubtitle: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
  },
  endedBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
    marginTop: 8,
  },
  endedBackBtn: {
    marginTop: 24,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sage.value,
  },
  endedBackBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
});
