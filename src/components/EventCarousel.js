import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { theme } from '../config/theme';
import MeetupCard from './MeetupCard';

/**
 * Top-of-feed horizontal carousel — upcoming meetups, snap + pagination dots.
 * @param {number} [maxSlides=3]
 */
export default function EventCarousel({
  data = [],
  maxSlides = 3,
  viewerPets = [],
  viewerId = null,
}) {
  const slides = useMemo(
    () => (Array.isArray(data) ? data : []).slice(0, Math.max(1, maxSlides)),
    [data, maxSlides],
  );
  const { width: windowWidth } = Dimensions.get('window');
  const [activeIndex, setActiveIndex] = useState(0);

  const cardWidth = windowWidth * theme.feed.carouselCardWidthRatio;
  const cardGap = theme.feed.carouselCardGap;
  const snapInterval = cardWidth + cardGap;

  const onScroll = useCallback(
    (e) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / Math.max(snapInterval, 1));
      const clamped = Math.max(0, Math.min(slides.length - 1, next));
      setActiveIndex(clamped);
    },
    [snapInterval, slides.length],
  );

  if (slides.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Upcoming meetups">
      <ScrollView
        horizontal
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onScrollEndDrag={onScroll}
        contentContainerStyle={styles.row}
      >
        {slides.map((meetup, index) => {
          const isLast = index === slides.length - 1;
          return (
            <View
              key={String(meetup.id ?? index)}
              style={[styles.cardSlot, { width: cardWidth }, isLast && styles.cardSlotLast]}
            >
              <MeetupCard
                meetup={meetup}
                style={styles.carouselMeetupCard}
                viewerPets={viewerPets}
                viewerId={viewerId}
              />
            </View>
          );
        })}
      </ScrollView>

      {slides.length > 1 ? (
        <View style={styles.dots} accessibilityRole="tablist">
          {slides.map((meetup, index) => (
            <View
              key={String(meetup.id ?? `dot-${index}`)}
              style={[
                styles.dot,
                index === slides.length - 1 && styles.dotLast,
                index === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
              accessibilityLabel={
                index === activeIndex
                  ? `Meetup ${index + 1} of ${slides.length}, current`
                  : `Meetup ${index + 1} of ${slides.length}`
              }
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginHorizontal: -theme.feed.shellPaddingHorizontal,
  },
  row: {
    paddingLeft: theme.feed.shellPaddingHorizontal,
    paddingBottom: theme.spacing.sm,
  },
  cardSlot: {
    marginRight: theme.feed.carouselCardGap,
  },
  cardSlotLast: {
    marginRight: 0,
  },
  carouselMeetupCard: {
    marginBottom: 0,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  dot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.spacing.xs,
    marginRight: theme.spacing.sm,
  },
  dotLast: {
    marginRight: 0,
  },
  dotActive: {
    backgroundColor: theme.colors.brand.sage.value,
  },
  dotInactive: {
    backgroundColor: theme.colors.text.muted.light,
  },
});
