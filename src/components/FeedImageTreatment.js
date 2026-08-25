import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { theme } from '../config/theme';

/**
 * Moment photo with a soft warm wash — keeps the pet as focus, not filters on top of UI chrome.
 */
export default function FeedImageTreatment({ uri }) {
  if (!uri) {
    return <View style={styles.wrap} />;
  }

  return (
    <View style={styles.wrap}>
      <Image source={{ uri }} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
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
            backgroundColor: theme.feed.desaturateVeilColor,
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
