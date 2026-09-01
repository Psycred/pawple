/**
 * Meetup carousel + main-feed sorting for FeedScreen.
 *
 * Phase 1a: city-scoped bulletin board — sort by soonest start, not km distance.
 * Carousel: user's meetup (if any) + next soonest others in the same city.
 * Vertical feed: nine Moments followed by the next-soonest Meetup.
 */

import { getMeetupStartTimestamp } from '../lib/meetupPublicFilter';

export const MEETUP_RECENT_WINDOW = 3;
export const MEETUP_CAROUSEL_SIZE = 3;
export const DEFAULT_MEETUP_INJECTION_INTERVAL = 9;

/** @deprecated Bulletin board no longer uses km radius — kept for test imports. */
export const MEETUP_FEED_RADIUS_KM = 50;

function getMeetupSortTimestamp(meetup) {
  return getMeetupStartTimestamp(meetup) ?? Number.MAX_SAFE_INTEGER;
}

/** Soonest first; unparseable dates sink to the end. */
export function sortMeetupsByStartTime(meetups = []) {
  return [...meetups].sort(
    (a, b) => getMeetupSortTimestamp(a) - getMeetupSortTimestamp(b),
  );
}

/** @deprecated Use sortMeetupsByStartTime — distance labels removed in Phase 1a. */
export function sortMeetupsByDistance(meetups) {
  return sortMeetupsByStartTime(meetups);
}

/** @deprecated Radius filtering removed — city filter happens upstream. */
export function filterMeetupsWithinRadius(meetups, _radiusKm = MEETUP_FEED_RADIUS_KM) {
  return sortMeetupsByStartTime(meetups);
}

/**
 * Top carousel (max `carouselSize`, default 3):
 * 0 = user's own meetup (soonest if they have several),
 * 1–2 = next soonest excluding own; or 3 soonest when no own meetup.
 */
export function buildCarouselMeetups(meetups, currentUserId, carouselSize = MEETUP_CAROUSEL_SIZE) {
  if (!meetups?.length) {
    return { slides: [], ids: [] };
  }

  const cap = Math.max(1, Number(carouselSize) || MEETUP_CAROUSEL_SIZE);
  const sorted = sortMeetupsByStartTime(meetups);
  const ownMeetups = currentUserId
    ? sorted.filter((m) => String(m?.user_id) === String(currentUserId))
    : [];
  const ownMeetup = ownMeetups[0] ?? null;

  const slides = [];
  if (ownMeetup) {
    slides.push({ ...ownMeetup, isPinned: true });
    const others = sorted.filter((m) => String(m.id) !== String(ownMeetup.id));
    slides.push(...others.slice(0, cap - 1));
  } else {
    slides.push(...sorted.slice(0, cap));
  }

  const trimmed = slides.slice(0, cap);
  return {
    slides: trimmed,
    ids: trimmed.map((m) => String(m.id)),
  };
}

/** @deprecated Phase A queue used km radius — city filter is upstream now. */
export function buildPhaseAQueue(meetups, carouselIds, _radiusKm = MEETUP_FEED_RADIUS_KM) {
  const carouselIdSet = new Set(carouselIds.map(String));
  return sortMeetupsByStartTime(meetups).filter(
    (m) => !carouselIdSet.has(String(m.id)),
  );
}

function pushToSlidingWindow(window, id, maxSize = MEETUP_RECENT_WINDOW) {
  window.push(String(id));
  while (window.length > maxSize) {
    window.shift();
  }
}

/**
 * Pick a random meetup, optionally excluding the sliding-window cooldown IDs.
 * When total meetups <= 3, cooldown is disabled to avoid an empty pool.
 */
export function pickRandomMeetup(allMeetups, recentlySeenIds, disableCooldown = false) {
  if (!allMeetups.length) {
    return null;
  }

  let pool = allMeetups;
  if (!disableCooldown && recentlySeenIds.length > 0) {
    const blocked = new Set(recentlySeenIds.map(String));
    const filtered = allMeetups.filter((m) => !blocked.has(String(m.id)));
    if (filtered.length > 0) {
      pool = filtered;
    }
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

/** Build the strict 9 Moments → next-soonest Meetup vertical sequence. */
export function buildMeetupInjectionRows({
  moments = [],
  allMeetups = [],
  carouselIds = [],
  injectionInterval = DEFAULT_MEETUP_INJECTION_INTERVAL,
  recentWindowSize = MEETUP_RECENT_WINDOW,
}) {
  const carouselIdSet = new Set(carouselIds.map(String));
  const inlineMeetups = sortMeetupsByStartTime(allMeetups).filter(
    (meetup) => !carouselIdSet.has(String(meetup.id)),
  );
  const recentlySeen = [...carouselIds.map(String)];
  let meetupIndex = 0;

  const rows = [];
  moments.forEach((moment, index) => {
    rows.push({
      type: 'moment',
      data: moment,
      key: `moment-${moment?.id ?? index}`,
    });

    if ((index + 1) % injectionInterval === 0 && meetupIndex < inlineMeetups.length) {
      const injected = inlineMeetups[meetupIndex];
      meetupIndex += 1;
      pushToSlidingWindow(recentlySeen, injected.id, recentWindowSize);
      rows.push({
        type: 'meetup',
        data: injected,
        key: `meetup-inject-${injected.id}-${index}`,
      });
    }
  });

  return {
    rows,
    recentlySeenIds: recentlySeen.slice(-recentWindowSize),
  };
}

/** Backward-compatible alias that now follows the canonical 9:1 composition. */
export function buildExpandedMeetupFeedRows({
  moments = [],
  allMeetups = [],
  carouselIds = [],
  injectionInterval = DEFAULT_MEETUP_INJECTION_INTERVAL,
}) {
  return buildMeetupInjectionRows({
    moments,
    allMeetups,
    carouselIds,
    injectionInterval,
  });
}
