import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const SCREEN_BG = '#FFFCF8';
const SKELETON = '#E8E4DF';

function SkeletonBlock({ style, opacity }) {
  return <Animated.View style={[styles.block, style, { opacity }]} />;
}

/**
 * Pulsing placeholder blocks while meetup details load.
 */
export default function MeetupDetailsSkeleton() {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.wrap}>
      <SkeletonBlock style={styles.title} opacity={pulse} />
      <SkeletonBlock style={styles.metaRow} opacity={pulse} />
      <SkeletonBlock style={styles.hostLine} opacity={pulse} />
      <SkeletonBlock style={styles.participants} opacity={pulse} />
      <View style={styles.divider} />
      <SkeletonBlock style={styles.sectionLabel} opacity={pulse} />
      <SkeletonBlock style={styles.sectionBody} opacity={pulse} />
      <SkeletonBlock style={styles.sectionLabel} opacity={pulse} />
      <SkeletonBlock style={styles.sectionBodyShort} opacity={pulse} />
      <SkeletonBlock style={styles.sectionLabel} opacity={pulse} />
      <SkeletonBlock style={styles.sectionBodyTall} opacity={pulse} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  block: {
    backgroundColor: SKELETON,
    borderRadius: 12,
  },
  title: {
    height: 32,
    width: '88%',
    borderRadius: 14,
    marginBottom: 20,
  },
  metaRow: {
    height: 28,
    width: '100%',
    marginBottom: 20,
  },
  hostLine: {
    height: 20,
    width: '55%',
    marginBottom: 20,
  },
  participants: {
    height: 56,
    width: '100%',
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1E8DF',
    marginBottom: 24,
  },
  sectionLabel: {
    height: 14,
    width: 56,
    borderRadius: 8,
    marginBottom: 10,
  },
  sectionBody: {
    height: 22,
    width: '72%',
    marginBottom: 24,
  },
  sectionBodyShort: {
    height: 22,
    width: '48%',
    marginBottom: 24,
  },
  sectionBodyTall: {
    height: 80,
    width: '100%',
    borderRadius: 14,
  },
});
