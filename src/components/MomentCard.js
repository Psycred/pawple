import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useActivePet } from '../contexts/ActivePetContext';
import { theme } from '../config/theme';
import { isDemoMomentId } from '../data/demoFeed';
import { deleteMoment } from '../services/moments';
import { heartMoment } from '../services/momentHearts';
import { buildPetEntries } from '../utils/resolveFeedPet';
import {
  presentMomentShareChooser,
  shareMomentInstagramImage,
  shareMomentWithPreview,
} from '../utils/shareFeedPost';
import ActionBar from './ActionBar';
import InstagramMomentJournalCard, {
  INSTAGRAM_MOMENT_JOURNAL_LAYOUT_SIZE,
  INSTAGRAM_MOMENT_JOURNAL_OUTPUT_SIZE,
} from './InstagramMomentJournalCard';
import BlockConfirmSheet from './BlockConfirmSheet';
import PawpleConfirmModal from './PawpleConfirmModal';
import ContentSafetyMenu from './ContentSafetyMenu';
import PostCard from './PostCard';
import ReportSheet from './ReportSheet';
import ShareCard, { MOMENT_SHARE_OUTPUT_SIZE, SHARE_LAYOUT_SIZE } from './ShareCard';

const SHARE_CARD_READY_TIMEOUT_MS = 2500;

function waitForShareCardReady(isReady, waitersRef, timeoutMs = SHARE_CARD_READY_TIMEOUT_MS) {
  if (isReady()) {
    return Promise.resolve();
  }

  return Promise.race([
    new Promise((resolve) => {
      waitersRef.current.push(resolve);
    }),
    new Promise((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}

/**
 * Feed moment: calm memory card + heart/share outside (no metrics).
 * Quiet more â†’ report / block (PAW-47). Own moments hide safety actions.
 */
export default function MomentCard({
  moment,
  userPets = [],
  viewerUserId = null,
  onPetBlocked,
  onMomentDeleted,
}) {
  const navigation = useNavigation();
  const { setPet } = useActivePet();
  const [heartCount, setHeartCount] = useState(() =>
    Math.max(0, Number(moment?.heart_count) || 0),
  );
  const [viewerHasHearted, setViewerHasHearted] = useState(() =>
    Boolean(moment?.viewer_has_hearted),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockPetTarget, setBlockPetTarget] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const shareInProgressRef = useRef(false);
  const heartInProgressRef = useRef(false);
  const shareCardRef = useRef(null);
  const shareCardReadyRef = useRef(false);
  const shareReadyWaitersRef = useRef([]);
  const instagramJournalRef = useRef(null);
  const instagramJournalReadyRef = useRef(false);
  const instagramReadyWaitersRef = useRef([]);

  useEffect(() => {
    setHeartCount(Math.max(0, Number(moment?.heart_count) || 0));
    setViewerHasHearted(Boolean(moment?.viewer_has_hearted));
    heartInProgressRef.current = false;
  }, [moment?.heart_count, moment?.id, moment?.viewer_has_hearted]);

  useEffect(() => {
    shareCardReadyRef.current = false;
    shareReadyWaitersRef.current = [];
    instagramJournalReadyRef.current = false;
    instagramReadyWaitersRef.current = [];
  }, [moment?.id]);

  const post = useMemo(
    () => ({
      photoUri: moment?.photo_url ?? null,
      caption: String(moment?.caption ?? '').trim() || undefined,
      petNames: moment?.pet_names ?? '',
      location: moment?.location ?? '',
      date: moment?.memory_date ?? '',
    }),
    [moment],
  );

  const petEntries = useMemo(
    () => buildPetEntries(post.petNames, userPets),
    [post.petNames, userPets],
  );

  const isOwnMoment = useMemo(() => {
    if (!viewerUserId || !moment?.user_id) {
      return false;
    }
    return String(moment.user_id) === String(viewerUserId);
  }, [moment?.user_id, viewerUserId]);

  const blockablePets = useMemo(() => {
    const ownedIds = new Set((userPets ?? []).map((p) => String(p.id)));
    const ids = Array.isArray(moment?.pet_ids) ? moment.pet_ids : [];
    const names = String(moment?.pet_names ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return ids
      .map((id, index) => ({
        id: String(id),
        name: names[index] || names[0] || 'Pet',
      }))
      .filter((pet) => pet.id && !ownedIds.has(pet.id));
  }, [moment?.pet_ids, moment?.pet_names, userPets]);

  const isDemoMoment = isDemoMomentId(String(moment?.id ?? ''));
  const canShowSafety = Boolean(moment?.id) && !isOwnMoment && !isDemoMoment;
  const canShowOwnerMenu = Boolean(moment?.id) && isOwnMoment && !isDemoMoment;
  const canShowMenu = canShowSafety || canShowOwnerMenu;

  const handlePetPress = useCallback(
    async (petId) => {
      if (!petId) {
        return;
      }
      await setPet(petId);
      navigation.navigate('MainTabs', { screen: 'PetsScreen' });
    },
    [navigation, setPet],
  );

  const handleLike = useCallback(async () => {
    const momentId = moment?.id;
    if (!momentId || viewerHasHearted || heartInProgressRef.current) {
      return;
    }

    const previousHeartCount = heartCount;
    heartInProgressRef.current = true;

    // The first tap feels immediate; failed persistence restores the true prior state.
    setHeartCount(Math.max(1, previousHeartCount));
    setViewerHasHearted(true);

    if (isDemoMomentId(String(momentId))) {
      heartInProgressRef.current = false;
      return;
    }

    try {
      const persisted = await heartMoment(momentId);
      setHeartCount(persisted.heartCount);
      setViewerHasHearted(persisted.viewerHasHearted);
    } catch {
      setHeartCount(previousHeartCount);
      setViewerHasHearted(false);
      Toast.show({
        type: 'error',
        text1: "Couldn't add your heart. Try again.",
        position: 'bottom',
      });
    } finally {
      heartInProgressRef.current = false;
    }
  }, [heartCount, moment?.id, viewerHasHearted]);

  const shareLinkCaption = useMemo(() => {
    const petNames = String(moment?.pet_names ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const creatorPetName = petNames[0] || 'your pet';
    return `🐾 See ${creatorPetName}'s moment on Pawple`;
  }, [moment?.pet_names]);

  const runShareLink = useCallback(async () => {
    if (shareInProgressRef.current || !moment?.id) {
      return;
    }

    shareInProgressRef.current = true;

    try {
      await waitForShareCardReady(
        () => shareCardReadyRef.current,
        shareReadyWaitersRef,
      );

      await shareMomentWithPreview({
        captureRefTarget: shareCardRef,
        caption: shareLinkCaption,
        momentId: moment.id,
        userId: viewerUserId,
        captureWidth: MOMENT_SHARE_OUTPUT_SIZE,
        captureHeight: MOMENT_SHARE_OUTPUT_SIZE,
      });
    } catch (error) {
      console.warn('[MomentCard] share link failed', error);
      Toast.show({
        type: 'error',
        text1: "Couldn't open share right now.",
        position: 'bottom',
      });
    } finally {
      shareInProgressRef.current = false;
    }
  }, [moment?.id, shareLinkCaption, viewerUserId]);

  const runShareInstagram = useCallback(async () => {
    if (shareInProgressRef.current || !moment?.id) {
      return;
    }

    shareInProgressRef.current = true;

    try {
      await waitForShareCardReady(
        () => instagramJournalReadyRef.current,
        instagramReadyWaitersRef,
      );

      await shareMomentInstagramImage({
        captureRefTarget: instagramJournalRef,
        captureWidth: INSTAGRAM_MOMENT_JOURNAL_OUTPUT_SIZE,
        captureHeight: INSTAGRAM_MOMENT_JOURNAL_OUTPUT_SIZE,
      });
    } catch (error) {
      console.warn('[MomentCard] Instagram share failed', error);
      Toast.show({
        type: 'error',
        text1: "Couldn't open Instagram right now.",
        position: 'bottom',
      });
    } finally {
      shareInProgressRef.current = false;
    }
  }, [moment?.id]);

  const handleShare = useCallback(() => {
    if (shareInProgressRef.current || !moment?.id) {
      return;
    }

    presentMomentShareChooser({
      onShareLink: () => {
        void runShareLink();
      },
      onShareInstagram: () => {
        void runShareInstagram();
      },
    });
  }, [moment?.id, runShareInstagram, runShareLink]);

  const handleShareCardReady = useCallback(() => {
    shareCardReadyRef.current = true;
    const waiters = shareReadyWaitersRef.current.splice(0);
    waiters.forEach((resolve) => resolve());
  }, []);

  const handleInstagramJournalReady = useCallback(() => {
    instagramJournalReadyRef.current = true;
    const waiters = instagramReadyWaitersRef.current.splice(0);
    waiters.forEach((resolve) => resolve());
  }, []);

  const shareAttribution = useMemo(() => {
    const names = String(moment?.pet_names ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 2);
    return names.length ? `— ${names.join(' & ')}` : '';
  }, [moment?.pet_names]);

  const shareDateLine = useMemo(
    () =>
      [post.date, post.location]
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(' • '),
    [post.date, post.location],
  );

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const openReport = useCallback(() => {
    setMenuOpen(false);
    setReportOpen(true);
  }, []);

  const openBlock = useCallback(() => {
    setMenuOpen(false);
    const first = blockablePets[0] ?? null;
    if (first) {
      setBlockPetTarget(first);
    }
  }, [blockablePets]);

  const openEdit = useCallback(() => {
    setMenuOpen(false);
    if (!moment?.id) {
      return;
    }
    navigation.navigate('CreateMomentScreen', { editMomentId: moment.id });
  }, [moment?.id, navigation]);

  const confirmDelete = useCallback(() => {
    setMenuOpen(false);
    if (!moment?.id) {
      return;
    }
    setDeleteConfirmOpen(true);
  }, [moment?.id]);

  const runDeleteMoment = useCallback(async () => {
    if (!moment?.id || deleteBusy) {
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteMoment(moment.id);
      setDeleteConfirmOpen(false);
      onMomentDeleted?.(moment.id);
      Toast.show({
        type: 'success',
        text1: 'Moment deleted',
        position: 'bottom',
        visibilityTime: 1500,
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: "Couldn't delete moment. Try again.",
        position: 'bottom',
        visibilityTime: 1500,
      });
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteBusy, moment?.id, onMomentDeleted]);

  return (
    <View style={styles.wrap}>
      <PostCard
        photoUri={post.photoUri}
        caption={post.caption}
        petEntries={petEntries}
        onPetPress={handlePetPress}
        location={post.location}
        date={post.date}
        captionFontFamily={theme.fonts.feedCaptionHand}
      />

      <View pointerEvents="none" style={styles.shareCaptureHost}>
        <View ref={shareCardRef} collapsable={false}>
          <ShareCard
            photoUri={post.photoUri}
            caption={post.caption}
            attribution={shareAttribution}
            dateLine={shareDateLine}
            onReady={handleShareCardReady}
          />
        </View>
      </View>

      <View pointerEvents="none" style={styles.instagramCaptureHost}>
        <View ref={instagramJournalRef} collapsable={false}>
          <InstagramMomentJournalCard
            photoUri={post.photoUri}
            caption={post.caption}
            petEntries={petEntries}
            date={post.date}
            location={post.location}
            onReady={handleInstagramJournalReady}
          />
        </View>
      </View>
      <ActionBar
        isLiked={heartCount > 0}
        onLike={handleLike}
        onShare={handleShare}
        onMore={canShowMenu ? openMenu : undefined}
      />

      <ContentSafetyMenu
        visible={menuOpen}
        title="Moment"
        showEdit={canShowOwnerMenu}
        showDelete={canShowOwnerMenu}
        showReport={canShowSafety}
        showBlock={canShowSafety && blockablePets.length > 0}
        blockLabel={
          blockablePets.length === 1
            ? `Block ${blockablePets[0].name}`
            : 'Block pet'
        }
        onEdit={openEdit}
        onDelete={confirmDelete}
        onReport={openReport}
        onBlock={openBlock}
        onClose={closeMenu}
      />

      <ReportSheet
        visible={reportOpen}
        targetType="moment"
        targetId={moment?.id}
        reportedUserId={moment?.user_id}
        blockablePets={blockablePets}
        onClose={() => setReportOpen(false)}
        onBlocked={(pet) => onPetBlocked?.(pet)}
      />

      <BlockConfirmSheet
        visible={Boolean(blockPetTarget)}
        pet={blockPetTarget}
        onClose={() => setBlockPetTarget(null)}
        onBlocked={(pet) => {
          onPetBlocked?.(pet);
          setBlockPetTarget(null);
        }}
      />

      <PawpleConfirmModal
        visible={deleteConfirmOpen}
        busy={deleteBusy}
        onClose={() => {
          if (!deleteBusy) {
            setDeleteConfirmOpen(false);
          }
        }}
        onConfirm={runDeleteMoment}
        title="Delete moment?"
        body="This memory will be removed from Pawple."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        icon="trash-2"
        iconTone="caution"
        confirmTone="sage"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: theme.feed.itemGap,
  },
  shareCaptureHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SHARE_LAYOUT_SIZE,
    height: SHARE_LAYOUT_SIZE,
    opacity: 0,
    zIndex: -1,
  },
  instagramCaptureHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: INSTAGRAM_MOMENT_JOURNAL_LAYOUT_SIZE,
    height: INSTAGRAM_MOMENT_JOURNAL_LAYOUT_SIZE,
    opacity: 0,
    zIndex: -1,
  },
});
