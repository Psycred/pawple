import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { scrapbookTiltTransform } from '../utils/scrapbookTilt';
import CrayonFrameOverlay from './CrayonFrameOverlay';
import FeedImageTreatment from './FeedImageTreatment';

/** Square capture canvas — the 4:5 Moment card is scaled to full height inside it. */
export const INSTAGRAM_MOMENT_JOURNAL_LAYOUT_SIZE = 540;
export const INSTAGRAM_MOMENT_JOURNAL_OUTPUT_SIZE = 1080;
/** Width of the feed-faithful 4:5 card inside the square (540 × 4/5). */
export const INSTAGRAM_MOMENT_JOURNAL_CARD_WIDTH =
  INSTAGRAM_MOMENT_JOURNAL_LAYOUT_SIZE * theme.feed.postAspectRatio;

const TEXT_INSET = theme.feed.frameGap;

/**
 * Square Instagram export — a centered, full-height resize of the feed PostCard.
 * The only format change is the 1:1 canvas; proportions match PostCard exactly.
 */
export default function InstagramMomentJournalCard({
  photoUri,
  caption,
  petEntries = [],
  date = '',
  location = '',
  onReady,
}) {
  const surfaces = useRuntimeThemeColors();
  const [layoutReady, setLayoutReady] = useState(false);
  const [imageReady, setImageReady] = useState(!photoUri);
  const [frameReady, setFrameReady] = useState(false);
  const hasReportedReady = useRef(false);

  const metaLine = useMemo(
    () => [date, location].map((part) => String(part ?? '').trim()).filter(Boolean).join(' • '),
    [date, location],
  );

  const resolvedPetEntries = useMemo(
    () =>
      (petEntries ?? [])
        .map((entry) => ({
          name: String(entry?.name ?? '').trim(),
        }))
        .filter((entry) => entry.name),
    [petEntries],
  );

  const hasCaption = Boolean(String(caption ?? '').trim());
  const hasPet = resolvedPetEntries.length > 0;
  const petNameStyle = { color: surfaces.feedPetNameColor };
  const metaTextStyle = { color: surfaces.feedMetaColor };

  useEffect(() => {
    hasReportedReady.current = false;
    setImageReady(!photoUri);
    setFrameReady(false);
  }, [photoUri]);

  useEffect(() => {
    if (!layoutReady || !imageReady || !frameReady || hasReportedReady.current) {
      return;
    }
    hasReportedReady.current = true;
    onReady?.();
  }, [frameReady, imageReady, layoutReady, onReady]);

  const handleLayout = useCallback(() => {
    setLayoutReady(true);
  }, []);

  const handleImageSettled = useCallback(() => {
    setImageReady(true);
  }, []);

  const handleFrameReady = useCallback(() => {
    setFrameReady(true);
  }, []);

  return (
    <View
      style={[styles.squareCanvas, { backgroundColor: surfaces.feedScreenBackground }]}
      onLayout={handleLayout}
    >
      <View style={styles.cardSlot}>
        <View style={[styles.card, { backgroundColor: surfaces.feedCardBackground }]}>
          <View style={styles.imageSection}>
            <View style={[styles.tiltedPhotoWrap, { transform: scrapbookTiltTransform() }]}>
              <View style={[styles.framedPhoto, { backgroundColor: surfaces.feedCardBackground }]}>
                <View style={[styles.photoMat, { backgroundColor: surfaces.feedCardBackground }]}>
                  <FeedImageTreatment uri={photoUri} onImageSettled={handleImageSettled} />
                </View>
                <CrayonFrameOverlay onFrameReady={handleFrameReady} />
              </View>
            </View>
          </View>

          <View style={styles.contentSection}>
            <View style={styles.textColumn}>
              {hasCaption ? (
                <Text
                  style={[
                    styles.caption,
                    { color: surfaces.feedCaptionColor },
                    hasPet ? styles.captionWithPetBelow : styles.captionSolo,
                  ]}
                  numberOfLines={2}
                >
                  {String(caption).trim()}
                </Text>
              ) : null}

              {hasPet ? (
                <View style={[styles.petRow, styles.petNamesAboveMeta]}>
                  <Text style={[styles.petDash, petNameStyle]}>—</Text>
                  <View style={styles.petNamesWrap}>
                    {resolvedPetEntries.map((entry, index) => (
                      <Text key={`${entry.name}-${index}`} style={[styles.petNames, petNameStyle]}>
                        {index > 0 ? ', ' : ''}
                        {entry.name}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.metaShelf}>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLeft, metaTextStyle]} numberOfLines={1} includeFontPadding={false}>
                    {metaLine}
                  </Text>
                  <Text
                    style={styles.brand}
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
    </View>
  );
}

const styles = StyleSheet.create({
  squareCanvas: {
    width: INSTAGRAM_MOMENT_JOURNAL_LAYOUT_SIZE,
    height: INSTAGRAM_MOMENT_JOURNAL_LAYOUT_SIZE,
    backgroundColor: theme.feed.screenBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSlot: {
    width: INSTAGRAM_MOMENT_JOURNAL_CARD_WIDTH,
    height: INSTAGRAM_MOMENT_JOURNAL_LAYOUT_SIZE,
    overflow: 'visible',
  },
  card: {
    width: '100%',
    height: '100%',
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
    backgroundColor: theme.feed.cardBackground,
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
  caption: {
    fontFamily: theme.fonts.feedCaptionHand,
    fontSize: theme.feed.captionFontSize,
    lineHeight: theme.feed.captionLineHeight,
    color: theme.feed.captionColor,
    marginTop: 0,
  },
  captionWithPetBelow: {
    marginBottom: theme.feed.captionToPetGap,
  },
  captionSolo: {
    marginBottom: theme.feed.petToMetaGap,
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
