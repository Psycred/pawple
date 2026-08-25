import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

/**
 * Off-screen share artwork — captured to an image (react-native-view-shot) for sharing.
 * Pawple aesthetic: warm paper, inked photo frame, Kalam caption, quiet metadata.
 * Presentational only; mounted hidden by MomentCard and captured on demand.
 */
export default function ShareCard({ photoUri, caption, attribution, dateLine, onReady }) {
  const [layoutReady, setLayoutReady] = useState(false);
  const [imageReady, setImageReady] = useState(!photoUri);
  const hasReportedReady = useRef(false);

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
    // onLoad means the remote image is decoded; onError also releases a failed share attempt.
    setImageReady(true);
  }, []);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={styles.image}
          resizeMode="cover"
          onLoad={handleImageSettled}
          onError={handleImageSettled}
        />
      ) : (
        <View style={styles.image} />
      )}

      {caption ? (
        <Text style={styles.caption} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}

      {attribution ? <Text style={styles.attribution}>{attribution}</Text> : null}

      {dateLine ? <Text style={styles.meta}>{dateLine}</Text> : null}

      <Text style={styles.footer}>pawple.app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 400,
    height: 500,
    backgroundColor: '#FBFAF8',
    borderRadius: 20,
    padding: 24,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#7A4F46',
    opacity: 0.85,
  },
  caption: {
    fontFamily: 'Kalam',
    fontSize: 24,
    color: '#2F2F2F',
    marginTop: 16,
  },
  attribution: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#4A4A4A',
    marginTop: 6,
  },
  meta: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#9A9A9A',
    marginTop: 4,
  },
  footer: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: '#B7B0A5',
    textAlign: 'center',
    marginTop: 20,
  },
});
