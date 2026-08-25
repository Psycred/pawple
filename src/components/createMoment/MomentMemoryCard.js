import { Feather } from '@expo/vector-icons';
import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { theme } from '../../config/theme';
import { scrapbookTiltTransform } from '../../utils/scrapbookTilt';
import { formatDayMonthYear } from '../../utils/formatMomentDate';
import CrayonFrameOverlay from '../CrayonFrameOverlay';
import FramedPhotoCanvas from './FramedPhotoCanvas';

/**
 * Live preview of the saved memory card — 4:5, ~83% photo / ~17% annotation.
 */
export default function MomentMemoryCard({
  imageUri,
  framingRef,
  annotationRevealed,
  caption,
  onCaptionChange,
  pets,
  selectedPetIds,
  onTogglePet,
  location,
  onLocationChange,
  memoryDate,
  onMemoryDateChange,
  defaultDateLabel,
}) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - theme.createMoment.cardHorizontalInset;
  const annotationOpacity = useRef(new Animated.Value(theme.createMoment.annotationFadedOpacity)).current;

  React.useEffect(() => {
    Animated.timing(annotationOpacity, {
      toValue: annotationRevealed ? 1 : theme.createMoment.annotationFadedOpacity,
      duration: theme.createMoment.revealDurationMs,
      useNativeDriver: true,
    }).start();
  }, [annotationRevealed, annotationOpacity]);

  const metaParts = useMemo(() => {
    const datePart = (memoryDate || defaultDateLabel || '').trim();
    const locPart = location.trim();
    return [datePart, locPart].filter(Boolean);
  }, [memoryDate, location, defaultDateLabel]);

  const metaLine = metaParts.join(' • ');
  const showEditableFields = annotationRevealed;

  return (
    <View style={[styles.cardOuter, { width: cardWidth }]}>
      <View style={styles.card}>
        <View style={styles.photoSection}>
          {imageUri ? (
            <View style={styles.framedPhoto}>
              <View style={styles.photoMat}>
                <View style={[styles.tiltedInner, { transform: scrapbookTiltTransform() }]}>
                  <FramedPhotoCanvas ref={framingRef} uri={imageUri} />
                </View>
              </View>
              <CrayonFrameOverlay />
            </View>
          ) : (
            <View style={styles.emptyPhoto}>
              <Feather name="image" size={28} color={theme.createMoment.emptyIconColor} />
              <Text style={styles.emptyLabel} allowFontScaling>
                Add a memory
              </Text>
            </View>
          )}
        </View>

        <Animated.View
          style={[
            styles.annotationSection,
            { opacity: annotationOpacity },
          ]}
        >
          {showEditableFields ? (
            <View style={styles.annotationInner}>
              <TextInput
                style={styles.captionInput}
                placeholder="Morning walk 🐾"
                placeholderTextColor={theme.colors.placeholder.value}
                value={caption}
                onChangeText={onCaptionChange}
                maxLength={150}
                multiline
                textAlignVertical="top"
                allowFontScaling
                accessibilityLabel="Memory caption"
              />

              {pets.length > 0 ? (
                <View style={styles.petRow}>
                  <Text style={styles.petDash} allowFontScaling>
                    —
                  </Text>
                  <View style={styles.petNamesWrap}>
                    {pets.map((p, index) => {
                      const sid = String(p.id);
                      const selected = selectedPetIds.has(sid);
                      const name = p.name?.trim() || 'Pet';
                      return (
                        <React.Fragment key={sid}>
                          {index > 0 ? (
                            <Text style={styles.petSep} allowFontScaling>
                              {' '}
                              &{' '}
                            </Text>
                          ) : null}
                          <Pressable
                            onPress={() => onTogglePet(p.id)}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${name}`}
                          >
                            <Text
                              style={[styles.petName, selected && styles.petNameSelected]}
                              allowFontScaling
                            >
                              {name}
                            </Text>
                          </Pressable>
                        </React.Fragment>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.metaRow}>
                <TextInput
                  style={styles.metaInput}
                  placeholder={defaultDateLabel}
                  placeholderTextColor={theme.createMoment.metaPlaceholderColor}
                  value={memoryDate}
                  onChangeText={onMemoryDateChange}
                  allowFontScaling
                  accessibilityLabel="Memory date"
                />
                <Text style={styles.metaDot} allowFontScaling>
                  {' '}
                  •{' '}
                </Text>
                <TextInput
                  style={[styles.metaInput, styles.metaInputFlex]}
                  placeholder="Location"
                  placeholderTextColor={theme.createMoment.metaPlaceholderColor}
                  value={location}
                  onChangeText={onLocationChange}
                  allowFontScaling
                  accessibilityLabel="Memory location"
                />
              </View>

              <View style={styles.metaPreviewRow}>
                <Text style={styles.metaPreview} numberOfLines={1} allowFontScaling>
                  {metaLine || defaultDateLabel}
                </Text>
                <Text style={styles.brand} allowFontScaling>
                  pawple
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.annotationPlaceholder}>
              <View style={styles.placeholderLine} />
              <View style={[styles.placeholderLine, styles.placeholderLineShort]} />
              <View style={styles.metaPreviewRow}>
                <Text style={styles.metaPreviewMuted} numberOfLines={1} allowFontScaling>
                  {defaultDateLabel}
                </Text>
                <Text style={styles.brandMuted} allowFontScaling>
                  pawple
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    alignSelf: 'center',
    overflow: 'visible',
  },
  card: {
    width: '100%',
    aspectRatio: theme.feed.postAspectRatio,
    backgroundColor: theme.createMoment.cardBackground,
    borderRadius: theme.createMoment.cardRadius,
    overflow: 'hidden',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOpacity: theme.createMoment.cardShadowOpacity,
    shadowRadius: theme.createMoment.cardShadowRadius,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  photoSection: {
    flex: theme.createMoment.imageSectionRatio,
    minHeight: 0,
    width: '100%',
  },
  framedPhoto: {
    flex: 1,
    width: '100%',
    position: 'relative',
    backgroundColor: theme.createMoment.cardBackground,
  },
  photoMat: {
    flex: 1,
    margin: theme.feed.frameGap,
    overflow: 'hidden',
    borderRadius: theme.feed.photoInnerRadius,
    backgroundColor: theme.createMoment.cardBackground,
  },
  tiltedInner: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  emptyPhoto: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  emptyLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.createMoment.emptyLabelSize,
    color: theme.createMoment.emptyLabelColor,
    marginTop: theme.spacing.sm,
  },
  annotationSection: {
    flex: theme.createMoment.annotationSectionRatio,
    minHeight: 0,
    paddingHorizontal: theme.feed.frameGap,
    paddingTop: 6,
    paddingBottom: 8,
    justifyContent: 'flex-start',
  },
  annotationInner: {
    flex: 1,
    minHeight: 0,
  },
  annotationPlaceholder: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  placeholderLine: {
    height: 10,
    borderRadius: 4,
    backgroundColor: theme.createMoment.placeholderFill,
    marginBottom: 6,
    width: '72%',
  },
  placeholderLineShort: {
    width: '42%',
    marginBottom: 8,
  },
  captionInput: {
    fontFamily: theme.createMoment.captionFontFamily,
    fontSize: theme.createMoment.captionFontSize,
    lineHeight: Math.round(theme.createMoment.captionFontSize * 1.35),
    color: theme.createMoment.captionColor,
    padding: 0,
    margin: 0,
    minHeight: 24,
    maxHeight: 48,
    backgroundColor: 'transparent',
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  petDash: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.createMoment.petFontSize,
    color: theme.createMoment.petColor,
    marginRight: 4,
  },
  petNamesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flex: 1,
  },
  petSep: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.createMoment.petFontSize,
    color: theme.createMoment.petColor,
  },
  petName: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.createMoment.petFontSize,
    color: theme.createMoment.petColorMuted,
  },
  petNameSelected: {
    color: theme.createMoment.petColor,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    opacity: 0.85,
  },
  metaInput: {
    fontFamily: theme.fonts.body,
    fontSize: theme.createMoment.metaFontSize,
    color: theme.createMoment.metaColor,
    padding: 0,
    margin: 0,
    minWidth: 48,
    backgroundColor: 'transparent',
  },
  metaInputFlex: {
    flex: 1,
  },
  metaDot: {
    fontFamily: theme.fonts.body,
    fontSize: theme.createMoment.metaFontSize,
    color: theme.createMoment.metaPlaceholderColor,
  },
  metaPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    gap: theme.spacing.sm,
  },
  metaPreview: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.createMoment.metaFontSize,
    color: theme.createMoment.metaColor,
  },
  metaPreviewMuted: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.createMoment.metaFontSize,
    color: theme.createMoment.metaPlaceholderColor,
  },
  brand: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.createMoment.brandFontSize,
    color: theme.createMoment.brandColor,
    textTransform: 'lowercase',
  },
  brandMuted: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.createMoment.brandFontSize,
    color: theme.createMoment.brandColor,
    opacity: 0.65,
    textTransform: 'lowercase',
  },
});
