import React from 'react';
import { StyleSheet, View } from 'react-native';
import PawpleStorageImage from './PawpleStorageImage';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

/**
 * Moment photo with a soft warm wash — keeps the pet as focus, not filters on top of UI chrome.
 */
export default function FeedImageTreatment({ uri, resizeMode = 'cover', onImageSettled }) {
  const surfaces = useRuntimeThemeColors();

  if (!uri) {
    return <View style={[styles.wrap, { backgroundColor: surfaces.feedCardBackground }]} />;
  }

  const handleSettled = () => {
    onImageSettled?.();
  };

  return (
    <View style={[styles.wrap, { backgroundColor: surfaces.feedCardBackground }]}>
      <PawpleStorageImage
        source={{ uri }}
        style={styles.photo}
        resizeMode={resizeMode}
        accessibilityIgnoresInvertColors
        onLoad={handleSettled}
        onError={handleSettled}
      />
      <View
        style={[
          styles.wash,
          {
            backgroundColor: theme.feed.warmOverlayColor,
            opacity: theme.feed.warmOverlayOpacity,
          },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.veil,
          {
            backgroundColor: surfaces.feedDesaturateVeilColor,
            opacity: theme.feed.desaturateVeilOpacity,
          },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.feed.cardBackground,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
  },
});
