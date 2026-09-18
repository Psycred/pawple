import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { formatMomentDate, formatMomentDisplayDate } from '../services/moments';
import BlockConfirmSheet from './BlockConfirmSheet';
import ContentSafetyMenu from './ContentSafetyMenu';
import CrayonFrameOverlay from './CrayonFrameOverlay';
import DiscoverPawAction from './DiscoverPawAction';
import MatingNotForMeAction from './MatingNotForMeAction';
import FeedImageTreatment from './FeedImageTreatment';
import PostCard from './PostCard';
import ReportSheet from './ReportSheet';
import { scrapbookTiltTransform } from '../utils/scrapbookTilt';

const TEXT_INSET = theme.feed.frameGap;
/** Meetup card distance treatment — quiet sage metadata, no directions. */
const DISTANCE_SAGE = '#6E8E73';

/**
 * Discover surface — Moment visual language with Paw outside the card (not feed heart/share).
 * Pet name is the only profile navigation affordance; identity is always pet UUID.
 */
export default function DiscoverMomentCard({
  petId,
  petName,
  photoUri,
  caption = '',
  memoryDate = '',
  location = '',
  variant = 'moment',
  momentId = null,
  momentOwnerId = null,
  reportedUserId = null,
  pawInterestId = null,
  profilePhotoDate = '',
  pawExpressed = false,
  pawBusy = false,
  pawStateKnown = true,
  distanceKm = null,
  showNotForMe = false,
  notForMeBusy = false,
  onNotForMePress,
  onOpenProfile,
  onPawPress,
  onPetBlocked,
  onProfileReportSubmitted,
}) {
  const surfaces = useRuntimeThemeColors();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  const isMoment = variant === 'moment';
  const resolvedPetName = String(petName ?? 'Pet').trim() || 'Pet';
  const resolvedPetId = petId != null ? String(petId) : null;

  const petEntries = useMemo(
    () => [
      {
        name: resolvedPetName,
        petId: resolvedPetId,
      },
    ],
    [resolvedPetId, resolvedPetName],
  );

  const distanceLabel = useMemo(() => {
    const km = Number(distanceKm);
    if (!Number.isFinite(km) || km < 0) {
      return null;
    }
    return `${Math.round(km)} km away`;
  }, [distanceKm]);

  const displayDate = useMemo(() => {
    if (isMoment && memoryDate && typeof memoryDate === 'object') {
      return formatMomentDisplayDate(memoryDate);
    }
    if (!isMoment) {
      return formatMomentDate(profilePhotoDate || memoryDate);
    }
    return String(memoryDate ?? '').trim();
  }, [isMoment, memoryDate, profilePhotoDate]);

  const handlePetPress = useCallback(
    (resolvedId) => {
      if (!resolvedId) {
        return;
      }
      onOpenProfile?.(resolvedId);
    },
    [onOpenProfile],
  );

  const blockablePet = useMemo(
    () => (resolvedPetId ? [{ id: resolvedPetId, name: resolvedPetName }] : []),
    [resolvedPetId, resolvedPetName],
  );

  // Interested passes pawInterestId even on moment cards. Discover passes it on profile cards only.
  const hasPawInterestReport =
    pawInterestId != null && String(pawInterestId).trim() !== '';
  const reportTargetType = hasPawInterestReport
    ? 'mating_interest'
    : isMoment
      ? 'moment'
      : 'pet';
  const reportTargetId = hasPawInterestReport
    ? pawInterestId
    : isMoment
      ? momentId
      : resolvedPetId;
  const reportAccountId = hasPawInterestReport || !isMoment
    ? reportedUserId
    : momentOwnerId;

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openReport = useCallback(() => {
    setMenuOpen(false);
    setReportOpen(true);
  }, []);
  const openBlock = useCallback(() => {
    setMenuOpen(false);
    setBlockOpen(true);
  }, []);

  const petNameStyle = { color: surfaces.feedPetNameColor };
  const metaTextStyle = { color: surfaces.feedMetaColor };

  const renderProfileFallbackCard = () => (
    <View style={styles.cardSlot}>
      <View style={[styles.card, { backgroundColor: surfaces.feedCardBackground }]}>
        <View style={styles.imageSection}>
          <View style={[styles.tiltedPhotoWrap, { transform: scrapbookTiltTransform() }]}>
            <View style={[styles.framedPhoto, { backgroundColor: surfaces.feedCardBackground }]}>
              <View style={[styles.photoMat, { backgroundColor: surfaces.feedScrapbookPaperFill }]}>
                <View style={[styles.squareStage, { backgroundColor: surfaces.feedScrapbookPaperFill }]}>
                  <View style={[styles.profilePhotoWell, { backgroundColor: surfaces.feedScrapbookPaperFill }]}>
                    <View style={[styles.profilePhotoFrame, { backgroundColor: surfaces.feedScrapbookPaperFill }]}>
                      <FeedImageTreatment uri={photoUri} resizeMode="contain" />
                    </View>
                  </View>
                </View>
              </View>
              <CrayonFrameOverlay />
            </View>
          </View>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.textColumn}>
            <View style={[styles.petRow, styles.petNamesAboveMeta]}>
              <Text style={[styles.petDash, petNameStyle]} allowFontScaling>
                —
              </Text>
              <View style={styles.petNamesWrap}>
                {resolvedPetId ? (
                  <Pressable
                    onPress={() => handlePetPress(resolvedPetId)}
                    style={({ pressed }) => pressed && styles.petNamePressed}
                    accessibilityRole="link"
                    accessibilityLabel={`View ${resolvedPetName}'s profile`}
                    hitSlop={8}
                  >
                    <Text style={[styles.petNames, petNameStyle]} allowFontScaling>
                      {resolvedPetName}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.petNames, petNameStyle]} allowFontScaling>
                    {resolvedPetName}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.metaShelf}>
              <View style={styles.metaRow}>
                <Text
                  style={[styles.metaLeft, metaTextStyle]}
                  numberOfLines={1}
                  allowFontScaling
                  includeFontPadding={false}
                >
                  {displayDate}
                </Text>
                <Text
                  style={styles.brand}
                  allowFontScaling
                  includeFontPadding={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  pawple
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      {isMoment ? (
        <PostCard
          photoUri={photoUri}
          caption={caption}
          petEntries={petEntries}
          onPetPress={handlePetPress}
          location={location}
          date={displayDate}
          captionFontFamily={theme.fonts.feedCaptionHand}
        />
      ) : (
        renderProfileFallbackCard()
      )}

      <View style={styles.actionRow}>
        <View style={styles.pawActions}>
          <DiscoverPawAction
            expressed={pawExpressed}
            busy={pawBusy}
            stateKnown={pawStateKnown}
            onPress={onPawPress}
          />
          {showNotForMe ? (
            <MatingNotForMeAction onPress={onNotForMePress} busy={notForMeBusy} />
          ) : null}
        </View>
        {distanceLabel ? (
          <View style={styles.distanceRow} accessibilityLabel={distanceLabel}>
            <Feather name="navigation" size={12} color={DISTANCE_SAGE} />
            <Text style={styles.distanceText} numberOfLines={1} allowFontScaling>
              {distanceLabel}
            </Text>
          </View>
        ) : null}
        <View style={styles.actionSpacer} />
        <Pressable
          onPress={openMenu}
          style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Safety options for ${resolvedPetName}`}
        >
          <Feather name="more-horizontal" size={22} color={theme.feed.actionIconColor} />
        </Pressable>
      </View>

      <ContentSafetyMenu
        visible={menuOpen}
        title="Safety"
        showReport
        showBlock={blockablePet.length > 0}
        blockLabel={`Block ${resolvedPetName}`}
        onReport={openReport}
        onBlock={openBlock}
        onClose={closeMenu}
      />

      <ReportSheet
        visible={reportOpen}
        targetType={reportTargetType}
        targetId={reportTargetId}
        reportedUserId={reportAccountId}
        blockablePets={blockablePet}
        onClose={() => setReportOpen(false)}
        onSubmitted={(result) => {
          if (!isMoment && result?.demo === false) {
            onProfileReportSubmitted?.();
          }
        }}
        onBlocked={(pet) => {
          onPetBlocked?.(pet);
          setReportOpen(false);
        }}
      />

      <BlockConfirmSheet
        visible={blockOpen}
        pet={blockablePet[0] ?? null}
        onClose={() => setBlockOpen(false)}
        onBlocked={(pet) => {
          onPetBlocked?.(pet);
          setBlockOpen(false);
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.feed.actionRowMarginTop,
    paddingHorizontal: theme.feed.frameGap,
  },
  pawActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  actionSpacer: {
    flex: 1,
  },
  moreButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  cardSlot: {
    width: '100%',
    overflow: 'visible',
  },
  card: {
    width: '100%',
    aspectRatio: theme.feed.postAspectRatio,
    backgroundColor: theme.feed.cardBackground,
    borderRadius: theme.feed.postcardRadius,
    overflow: 'hidden',
    flexDirection: 'column',
    shadowColor: theme.shadowsRN.sm.shadowColor,
    shadowOpacity: theme.feed.shadowOpacity,
    shadowRadius: theme.feed.shadowRadius,
    shadowOffset: { width: 0, height: theme.feed.shadowOffsetY },
    elevation: 1,
  },
  imageSection: {
    flex: theme.feed.imageSectionFlexRatio,
    minHeight: 0,
    width: '100%',
  },
  tiltedPhotoWrap: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  framedPhoto: {
    flex: 1,
    width: '100%',
    position: 'relative',
    backgroundColor: theme.feed.cardBackground,
  },
  photoMat: {
    flex: 1,
    margin: theme.feed.frameGap,
    overflow: 'hidden',
    borderRadius: theme.feed.photoInnerRadius,
    backgroundColor: theme.feed.scrapbookPaperFill,
  },
  squareStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.feed.scrapbookPaperFill,
  },
  profilePhotoWell: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.feed.scrapbookPaperFill,
  },
  profilePhotoFrame: {
    width: '76%',
    aspectRatio: 1,
    maxHeight: '100%',
    overflow: 'hidden',
    borderRadius: theme.feed.photoInnerRadius,
    backgroundColor: theme.feed.scrapbookPaperFill,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: theme.spacing.sm,
  },
  distanceText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: DISTANCE_SAGE,
  },
  contentSection: {
    flex: theme.feed.textSectionFlexRatio,
    minHeight: 0,
    paddingTop: theme.feed.imageToCaptionGap,
    paddingBottom: theme.feed.metaToBottomGap,
    justifyContent: 'flex-start',
  },
  textColumn: {
    flex: 1,
    marginLeft: TEXT_INSET,
    marginRight: TEXT_INSET,
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  petDash: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.feed.petNameFontSize,
    lineHeight: theme.feed.petNameLineHeight,
    color: theme.feed.petNameColor,
    marginRight: theme.spacing.xs,
  },
  petNamesWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  petNames: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.feed.petNameFontSize,
    lineHeight: theme.feed.petNameLineHeight,
    color: theme.feed.petNameColor,
  },
  petNamePressed: {
    opacity: theme.opacity.pressedUi,
  },
  petNamesAboveMeta: {
    marginBottom: theme.feed.petToMetaGap,
  },
  metaShelf: {
    marginTop: 'auto',
    width: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    minHeight: theme.feed.metaLineHeight,
    gap: theme.spacing.sm,
  },
  metaLeft: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: theme.feed.metaFontSize,
    lineHeight: theme.feed.metaLineHeight,
    color: theme.colors.text.muted.value,
    textAlignVertical: 'center',
  },
  brand: {
    fontFamily: 'Inter-Medium',
    fontSize: theme.feed.brandFontSize,
    lineHeight: theme.feed.metaLineHeight,
    color: theme.colors.text.signature.value,
    letterSpacing: theme.feed.brandLetterSpacing,
    textTransform: 'lowercase',
    textAlignVertical: 'center',
  },
});
