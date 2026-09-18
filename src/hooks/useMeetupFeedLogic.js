import { useMemo } from 'react';
import { enrichMeetupsWithVenueDistance } from '../utils/distanceUtils';
import {
  buildCarouselMeetups,
  buildMeetupInjectionRows,
  DEFAULT_MEETUP_INJECTION_INTERVAL,
} from '../utils/meetupFeedLogic';

/**
 * Carousel + main-feed meetup sorting for FeedScreen.
 *
 * Phase A.1: meetups filtered by current/base city (+ aliases, 100 km); global when unset.
 * Carousel: three nearest upcoming meetups or random three.
 * Vertical feed: nine Moments followed by one Meetup, with occasional completed injection.
 */
export function useMeetupFeedLogic({
  meetups = [],
  currentUserId = null,
  mergedMoments = [],
  injectionInterval = DEFAULT_MEETUP_INJECTION_INTERVAL,
  carouselSize,
  userFeedLocation = null,
  locationGranted = false,
  sessionSeed = 0,
}) {
  const meetupsForFeed = useMemo(
    () => enrichMeetupsWithVenueDistance(meetups, userFeedLocation),
    [meetups, userFeedLocation],
  );

  const { headerMeetups, carouselIds } = useMemo(() => {
    const { slides, ids } = buildCarouselMeetups(
      meetupsForFeed,
      currentUserId,
      carouselSize,
      userFeedLocation,
      { locationGranted, sessionSeed },
    );
    return { headerMeetups: slides, carouselIds: ids };
  }, [meetupsForFeed, currentUserId, carouselSize, userFeedLocation, locationGranted, sessionSeed]);

  const feedResult = useMemo(
    () =>
      buildMeetupInjectionRows({
        moments: mergedMoments,
        allMeetups: meetupsForFeed,
        carouselIds,
        injectionInterval,
        userLocation: userFeedLocation,
        locationGranted,
        sessionSeed,
        currentUserId,
      }),
    [
      mergedMoments,
      meetupsForFeed,
      carouselIds,
      injectionInterval,
      userFeedLocation,
      locationGranted,
      sessionSeed,
      currentUserId,
    ],
  );

  return {
    headerMeetups,
    feedRows: feedResult.rows,
    recentlySeenIds: feedResult.recentlySeenIds,
    carouselIds,
    meetupRowCount: feedResult.rows.filter((row) => row.type === 'meetup').length,
  };
}
