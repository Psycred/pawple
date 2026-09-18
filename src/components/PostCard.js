import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { scrapbookTiltTransform } from '../utils/scrapbookTilt';
import CrayonFrameOverlay from './CrayonFrameOverlay';
import FeedImageTreatment from './FeedImageTreatment';

/** Horizontal inset for text — lines up with inner photo edge (mat gap). */
const TEXT_INSET = theme.feed.frameGap;

/**
 * Premium postcard — strict 4:5, tilted framed photo, 8pt text rhythm.
 */
export default function PostCard({
  photoUri,
  caption,
  petNames,
  petEntries = [],
  onPetPress,
  location,
  date,
  captionFontFamily = theme.fonts.feedCaptionHand,
}) {
  const surfaces = useRuntimeThemeColors();
  const metaParts = useMemo(
    () => [date, location].filter((part) => String(part ?? '').trim()),
    [date, location],
  );
  const metaLine = metaParts.join(' • ');
  const resolvedPetEntries = useMemo(() => {
    if (Array.isArray(petEntries) && petEntries.length > 0) {
      return petEntries;
    }
    const line = String(petNames ?? '').trim();
    if (!line) {
      return [];
    }
    return line.split(',').map((name) => ({ name: name.trim(), petId: null }));
  }, [petEntries, petNames]);

  const hasCaption = Boolean(String(caption ?? '').trim());
  const hasPet = resolvedPetEntries.length > 0;
  const petNameStyle = { color: surfaces.feedPetNameColor };
  const metaTextStyle = { color: surfaces.feedMetaColor };

  return (
    <View style={styles.cardSlot}>
      <View style={[styles.card, { backgroundColor: surfaces.feedCardBackground }]}>
        <View style={styles.imageSection}>
          <View style={[styles.tiltedPhotoWrap, { transform: scrapbookTiltTransform() }]}>
            <View style={[styles.framedPhoto, { backgroundColor: surfaces.feedCardBackground }]}>
              <View style={[styles.photoMat, { backgroundColor: surfaces.feedCardBackground }]}>
                <FeedImageTreatment uri={photoUri} />
              </View>
              <CrayonFrameOverlay />
            </View>
          </View>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.textColumn}>
            {hasCaption ? (
              <Text
                style={[
                  styles.caption,
                  { fontFamily: captionFontFamily, color: surfaces.feedCaptionColor },
                  hasPet ? styles.captionWithPetBelow : styles.captionSolo,
                ]}
                numberOfLines={2}
                allowFontScaling
              >
                {caption}
              </Text>
            ) : null}
            {hasPet ? (
              <View style={[styles.petRow, styles.petNamesAboveMeta]}>
                <Text style={[styles.petDash, { color: surfaces.feedPetNameColor }]} allowFontScaling>
                  —
                </Text>
                <View style={styles.petNamesWrap}>
                  {resolvedPetEntries.map((entry, index) => (
                    <React.Fragment key={`${entry.name}-${index}`}>
                      {index > 0 ? (
                        <Text style={[styles.petNames, petNameStyle]} allowFontScaling>
                          ,{' '}
                        </Text>
                      ) : null}
                      {entry.petId && onPetPress ? (
                        // [PET ATTRIBUTION FIX] Use the EXACT demo pet-name style (styles.petNames).
                        // Removed the sage-green petNameLink override so user-posted names match
                        // demo cards exactly. Tap still opens the pet profile at the TOP.
                        <Pressable
                          onPress={() => onPetPress(entry.petId)}
                          style={({ pressed }) => pressed && styles.petNamePressed}
                          accessibilityRole="link"
                          accessibilityLabel={`View ${entry.name}'s profile`}
                          hitSlop={8}
                        >
                          <Text style={[styles.petNames, petNameStyle]} allowFontScaling>
                            {entry.name}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text style={[styles.petNames, petNameStyle]} allowFontScaling>
                          {entry.name}
                        </Text>
                      )}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.metaShelf}>
              <View style={styles.metaRow}>
                <Text
                  style={[styles.metaLeft, metaTextStyle]}
                  numberOfLines={1}
                  allowFontScaling
                  includeFontPadding={false}
                >
                  {metaLine}
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
}

const styles = StyleSheet.create({
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
  petNameLink: {
    color: theme.colors.brand.sageDark.value,
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
