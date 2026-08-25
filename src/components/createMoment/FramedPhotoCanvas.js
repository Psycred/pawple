import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import FeedImageTreatment from '../FeedImageTreatment';

const MIN_PINCH = 1;
const MAX_PINCH = 3.5;

function clamp(value, min, max) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/**
 * Pinch + pan inside a fixed mat — image moves, frame stays outside (parent draws frame).
 */
const FramedPhotoCanvas = forwardRef(function FramedPhotoCanvas({ uri, onViewportLayout }, ref) {
  const viewportW = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const imageW = useSharedValue(0);
  const imageH = useSharedValue(0);
  const baseScale = useSharedValue(1);
  const pinchScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pinchStart = useSharedValue(1);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  const clampTranslation = () => {
    'worklet';
    const total = baseScale.value * pinchScale.value;
    const dw = imageW.value * total;
    const dh = imageH.value * total;
    const maxX = Math.max(0, (dw - viewportW.value) / 2);
    const maxY = Math.max(0, (dh - viewportH.value) / 2);
    translateX.value = clamp(translateX.value, -maxX, maxX);
    translateY.value = clamp(translateY.value, -maxY, maxY);
  };

  useEffect(() => {
    if (!uri) {
      return;
    }
    Image.getSize(
      uri,
      (w, h) => {
        imageW.value = w;
        imageH.value = h;
        if (viewportW.value > 0 && viewportH.value > 0) {
          const cover = Math.max(viewportW.value / w, viewportH.value / h);
          baseScale.value = cover;
          pinchScale.value = 1;
          translateX.value = 0;
          translateY.value = 0;
        }
      },
      () => {},
    );
  }, [uri, baseScale, imageH, imageW, pinchScale, translateX, translateY, viewportH, viewportW]);

  useImperativeHandle(ref, () => ({
    getFramingState() {
      return {
        viewportWidth: viewportW.value,
        viewportHeight: viewportH.value,
        imageWidth: imageW.value,
        imageHeight: imageH.value,
        totalScale: baseScale.value * pinchScale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      };
    },
  }));

  const onLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width <= 0 || height <= 0) {
      return;
    }
    viewportW.value = width;
    viewportH.value = height;
    onViewportLayout?.({ width, height });
    if (imageW.value > 0 && imageH.value > 0) {
      const cover = Math.max(width / imageW.value, height / imageH.value);
      baseScale.value = cover;
      pinchScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
    }
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinchStart.value = pinchScale.value;
    })
    .onUpdate((e) => {
      pinchScale.value = clamp(pinchStart.value * e.scale, MIN_PINCH, MAX_PINCH);
      clampTranslation();
    })
    .onEnd(() => {
      clampTranslation();
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = panStartX.value + e.translationX;
      translateY.value = panStartY.value + e.translationY;
      clampTranslation();
    })
    .onEnd(() => {
      clampTranslation();
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const imageStyle = useAnimatedStyle(() => {
    const total = baseScale.value * pinchScale.value;
    const w = imageW.value * total;
    const h = imageH.value * total;
    return {
      width: w,
      height: h,
      position: 'absolute',
      left: viewportW.value / 2 - w / 2 + translateX.value,
      top: viewportH.value / 2 - h / 2 + translateY.value,
    };
  });

  if (!uri) {
    return <View style={styles.mat} onLayout={onLayout} />;
  }

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.mat} onLayout={onLayout}>
        <Animated.View style={[styles.imageHost, imageStyle]}>
          <FeedImageTreatment uri={uri} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
});

export default FramedPhotoCanvas;

const styles = StyleSheet.create({
  mat: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  imageHost: {
    overflow: 'hidden',
  },
});
