import { useMemo } from 'react';
import {
  buildCarouselMeetups,
  buildMeetupInjectionRows,
  DEFAULT_MEETUP_INJECTION_INTERVAL,
} from '../utils/meetupFeedLogic';

/**
 * Carousel + main-feed meetup sorting for FeedScreen.
 *
 * - Carousel: own meetup + nearest meetups.
 * - Vertical feed: nine Moments followed by the next-nearest Meetup.
 */
export function useMeetupFeedLogic({
  meetups = [],
  currentUserId = null,
  mergedMoments = [],
  injectionInterval = DEFAULT_MEETUP_INJECTION_INTERVAL,
  carouselSize,
}) {
  const { headerMeetups, carouselIds } = useMemo(() => {
    const { slides, ids } = buildCarouselMeetups(meetups, currentUserId, carouselSize);
    return { headerMeetups: slides, carouselIds: ids };
  }, [meetups, currentUserId, carouselSize]);

  const feedResult = useMemo(
    () =>
      buildMeetupInjectionRows({
        moments: mergedMoments,
        allMeetups: meetups,
        carouselIds,
        injectionInterval,
      }),
    [mergedMoments, meetups, carouselIds, injectionInterval],
  );

  return {
    headerMeetups,
    feedRows: feedResult.rows,
    recentlySeenIds: feedResult.recentlySeenIds,
    carouselIds,
    meetupRowCount: feedResult.rows.filter((row) => row.type === 'meetup').length,
  };
}
