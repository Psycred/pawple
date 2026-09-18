import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../config/theme';

/**
 * Hand-drawn frame on the OUTSIDE mat edge — warm maroon-brown, subtle, never inside the photo.
 */
export default function CrayonFrameOverlay({ onFrameReady }) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const stroke = theme.feed.memoryFrameStrokeWidth;
  const inset = stroke / 2;
  const w = size.w;
  const h = size.h;

  useEffect(() => {
    if (size.w > 0 && size.h > 0) {
      onFrameReady?.();
    }
  }, [onFrameReady, size.h, size.w]);

  const path =
    w > 0 && h > 0
      ? [
          `M ${inset + 1} ${inset}`,
          `L ${w - inset - 0.5} ${inset + 0.5}`,
          `L ${w - inset} ${h - inset - 1}`,
          `L ${inset + 0.5} ${h - inset}`,
          'Z',
        ].join(' ')
      : '';

  return (
    <View
      style={styles.host}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== size.w || height !== size.h) {
          setSize({ w: width, h: height });
        }
      }}
    >
      {path ? (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path
            d={path}
            fill="none"
            stroke={theme.feed.memoryFrameColor}
            strokeWidth={stroke}
            strokeOpacity={theme.feed.memoryFrameOpacity}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
  },
});
