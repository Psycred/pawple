import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';
import PawpleStorageImage from './PawpleStorageImage';

export const MOMENT_SHARE_OUTPUT_SIZE = 1080;
export const SHARE_LAYOUT_SIZE = 540;

/**
 * Dedicated square artwork for external sharing only.
 * The visible Pawple Moment card remains the separate 4:5 PostCard.
 */
export default function ShareCard({ photoUri, caption, attribution, dateLine, onReady }) {
  const [layoutReady, setLayoutReady] = useState(false);
  const [imageReady, setImageReady] = useState(!photoUri);
  const hasReportedReady = useRef(false);

  // FlatList reuse can swap the photo without remounting — reset readiness.
  useEffect(() => {
    hasReportedReady.current = false;
    setImageReady(!photoUri);
  }, [photoUri]);

  useEffect(() => {
    if (!layoutReady || !imageReady || hasReportedReady.current) {
      return;
    }

    hasReportedReady.current = true;
    onReady?.();
  }, [imageReady, layoutReady, onReady]);

  const handleLayout = useCallback(() => {
    setLayoutReady(true);
  }, []);

  const handleImageSettled = useCallback(() => {
    // A failed remote image must not leave the native share action waiting forever.
    setImageReady(true);
  }, []);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={styles.imageMat}>
        {photoUri ? (
          <PawpleStorageImage
            source={{ uri: photoUri }}
            style={styles.image}
            resizeMode="cover"
            onLoad={handleImageSettled}
            onError={handleImageSettled}
          />
        ) : (
          <View style={styles.image} />
        )}
      </View>

      <View style={styles.copy}>
        {caption ? (
          <Text style={styles.caption} numberOfLines={2}>
            {caption}
          </Text>
        ) : null}

        {attribution ? <Text style={styles.attribution}>{attribution}</Text> : null}

        <View style={styles.footerRow}>
          <Text style={styles.meta} numberOfLines={1}>
            {dateLine}
          </Text>
          <Text style={styles.footer}>pawple</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SHARE_LAYOUT_SIZE,
    height: SHARE_LAYOUT_SIZE,
    backgroundColor: theme.colors.background.card,
    padding: theme.spacing.xxl,
  },
  imageMat: {
    width: 320,
    height: 320,
    alignSelf: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: theme.feed.memoryFrameStrokeWidth,
    borderColor: theme.feed.memoryFrameColor,
    backgroundColor: theme.colors.background.card,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  copy: {
    flex: 1,
    paddingTop: theme.spacing.lg,
  },
  caption: {
    fontFamily: theme.fonts.feedCaptionHand,
    fontSize: theme.fontSizes.xxl,
    lineHeight: 30,
    color: theme.colors.text.primary.value,
  },
  attribution: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.text.secondary.value,
    marginTop: theme.spacing.sm,
  },
  footerRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
  },
  meta: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: 18,
    color: theme.colors.text.muted.value,
  },
  footer: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    lineHeight: 18,
    color: theme.colors.text.signature.value,
    letterSpacing: 1,
    textTransform: 'lowercase',
  },
});
