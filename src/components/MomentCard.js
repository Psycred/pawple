import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useActivePet } from '../contexts/ActivePetContext';
import { theme } from '../config/theme';
import { buildPetAttribution, buildShareMetaLine, shareMoment } from '../lib/shareUtils';
import { buildPetEntries } from '../utils/resolveFeedPet';
import ActionBar from './ActionBar';
import BlockConfirmSheet from './BlockConfirmSheet';
import ContentSafetyMenu from './ContentSafetyMenu';
import PostCard from './PostCard';
import ReportSheet from './ReportSheet';
import ShareCard from './ShareCard';

/**
 * Feed moment: calm memory card + heart/share outside (no metrics).
 * Quiet more → report / block (PAW-47). Own moments hide safety actions.
 */
export default function MomentCard({
  moment,
  userPets = [],
  initialLiked = false,
  onLikeToggle,
  viewerUserId = null,
  onPetBlocked,
}) {
  const navigation = useNavigation();
  const { setPet } = useActivePet();
  const [liked, setLiked] = useState(initialLiked);
  const [isShareActive, setIsShareActive] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockPetTarget, setBlockPetTarget] = useState(null);
  const shareCardRef = useRef(null);
  const shareInProgressRef = useRef(false);

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

  const shareNames = useMemo(
    () => petEntries.map((entry) => entry.name).filter(Boolean),
    [petEntries],
  );
  const shareMeta = useMemo(
    () => ({ caption: post.caption ?? '', location: post.location, memory_date: post.date }),
    [post.caption, post.location, post.date],
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

  const canShowSafety = Boolean(moment?.id) && !isOwnMoment;

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

  const handleLike = useCallback(() => {
    setLiked((prev) => {
      const next = !prev;
      onLikeToggle?.(moment?.id, next);
      return next;
    });
  }, [moment?.id, onLikeToggle]);

  const handleShare = useCallback(() => {
    if (isShareActive || shareInProgressRef.current) {
      return;
    }
    setIsShareActive(true);
  }, [isShareActive]);

  const handleShareCardReady = useCallback(async () => {
    if (shareInProgressRef.current) {
      return;
    }

    shareInProgressRef.current = true;
    try {
      // Let the native image/layout commit for one frame before view-shot captures it.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await shareMoment(
        {
          id: moment?.id,
          caption: post.caption ?? '',
          location: post.location,
          memory_date: post.date,
          created_at: moment?.created_at,
        },
        shareNames,
        shareCardRef,
      );
    } finally {
      shareInProgressRef.current = false;
      setIsShareActive(false);
    }
  }, [moment?.created_at, moment?.id, post.caption, post.date, post.location, shareNames]);

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
      <ActionBar
        isLiked={liked}
        onLike={handleLike}
        onShare={handleShare}
        onMore={canShowSafety ? openMenu : undefined}
      />

      {isShareActive ? (
        <View ref={shareCardRef} collapsable={false} style={styles.shareCardHost} pointerEvents="none">
          <ShareCard
            photoUri={post.photoUri}
            caption={post.caption}
            attribution={buildPetAttribution(shareNames)}
            dateLine={buildShareMetaLine(shareMeta)}
            onReady={handleShareCardReady}
          />
        </View>
      ) : null}

      <ContentSafetyMenu
        visible={menuOpen}
        title="Moment"
        showReport
        showBlock={blockablePets.length > 0}
        blockLabel={
          blockablePets.length === 1
            ? `Block ${blockablePets[0].name}`
            : 'Block pet'
        }
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: theme.feed.itemGap,
  },
  // Mounted only while sharing, then pushed off-screen so view-shot can capture it.
  shareCardHost: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: 400,
    height: 500,
  },
});
