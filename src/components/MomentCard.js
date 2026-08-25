import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useActivePet } from '../contexts/ActivePetContext';
import { theme } from '../config/theme';
import { buildPetAttribution, buildShareMetaLine, shareMoment } from '../lib/shareUtils';
import { buildPetEntries } from '../utils/resolveFeedPet';
import ActionBar from './ActionBar';
import PostCard from './PostCard';
import ShareCard from './ShareCard';

/**
 * Feed moment: calm memory card + heart/share outside (no metrics).
 */
export default function MomentCard({ moment, userPets = [], initialLiked = false, onLikeToggle }) {
  const navigation = useNavigation();
  const { setPet } = useActivePet();
  const [liked, setLiked] = useState(initialLiked);
  const [isShareActive, setIsShareActive] = useState(false);
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
      <ActionBar isLiked={liked} onLike={handleLike} onShare={handleShare} />

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
