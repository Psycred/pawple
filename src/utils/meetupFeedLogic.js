/**
 * Meetup carousel + main-feed sorting for FeedScreen.
 *
 * Phase A.1: city relevance (current/base + aliases + 100 km); global when unset.
 * Carousel: three nearest upcoming meetups (proximity) or random three (global).
 * Vertical feed: nine Moments followed by one Meetup, with occasional completed injection.
 */

import {
  MEETUP_FEED_RADIUS_KM,
  prepareMeetupFeedPools,
  seededShuffle,
} from '../lib/feedProximity.js';

export const MEETUP_RECENT_WINDOW = 3;
export const MEETUP_CAROUSEL_SIZE = 3;
export const DEFAULT_MEETUP_INJECTION_INTERVAL = 9;

/** @deprecated Use MEETUP_FEED_RADIUS_KM from feedProximity */
export { MEETUP_FEED_RADIUS_KM };

function pushToSlidingWindow(window, id, maxSize = MEETUP_RECENT_WINDOW) {
  window.push(String(id));
  while (window.length > maxSize) {
    window.shift();
  }
}

function stableMeetupRotation(meetups) {
  if (meetups.length < 2) {
    return [...meetups];
  }
  const seed = meetups
    .map((meetup) => String(meetup?.id ?? ''))
    .join('|')
    .split('')
    .reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0);
  const offset = seed % meetups.length;
  return [...meetups.slice(offset), ...meetups.slice(0, offset)];
}

function pickRotatingMeetup(pool, recentlySeenIds, cursor, cooldownSize) {
  if (!pool.length) {
    return { meetup: null, nextCursor: cursor };
  }

  const blocked = new Set(recentlySeenIds.slice(-cooldownSize).map(String));
  for (let offset = 0; offset < pool.length; offset += 1) {
    const index = (cursor + offset) % pool.length;
    const candidate = pool[index];
    if (!blocked.has(String(candidate.id))) {
      return {
        meetup: candidate,
        nextCursor: (index + 1) % pool.length,
      };
    }
  }

  const index = cursor % pool.length;
  return {
    meetup: pool[index],
    nextCursor: (index + 1) % pool.length,
  };
}

function pickCompletedMeetup(completedPool, seed, injectionIndex) {
  if (!completedPool?.length) {
    return null;
  }
  const shuffled = seededShuffle(completedPool, seed + injectionIndex);
  return shuffled[injectionIndex % shuffled.length];
}

/** Top carousel meetups for the current feed mode. */
export function buildCarouselMeetups(
  meetups,
  currentUserId,
  carouselSize = MEETUP_CAROUSEL_SIZE,
  userLocation = null,
  options = {},
) {
  if (!meetups?.length) {
    return { slides: [], ids: [] };
  }

  const {
    locationGranted = false,
    sessionSeed = 0,
  } = options;

  const pools = prepareMeetupFeedPools(
    meetups,
    userLocation,
    locationGranted,
    sessionSeed,
    currentUserId,
  );
  const cap = Math.max(1, Number(carouselSize) || MEETUP_CAROUSEL_SIZE);
  const trimmed = pools.carouselMeetups.slice(0, cap);

  return {
    slides: trimmed,
    ids: trimmed.map((m) => String(m.id)),
  };
}

/**
 * Build the strict 9 Moments → one Meetup sequence.
 * Proximity mode: upcoming within 100 km first; occasional global completed filler.
 */
export function buildMeetupInjectionRows({
  moments = [],
  allMeetups = [],
  carouselIds = [],
  injectionInterval = DEFAULT_MEETUP_INJECTION_INTERVAL,
  recentWindowSize = MEETUP_RECENT_WINDOW,
  userLocation = null,
  locationGranted = false,
  sessionSeed = 0,
  currentUserId = null,
}) {
  const pools = prepareMeetupFeedPools(
    allMeetups,
    userLocation,
    locationGranted,
    sessionSeed,
    currentUserId,
  );
  const carouselIdSet = new Set(carouselIds.map(String));
  const primaryPool = pools.injectionMeetups;
  const unseenInlineMeetups = primaryPool.filter(
    (meetup) => !carouselIdSet.has(String(meetup.id)),
  );
  const usesLocalPool =
    pools.mode === 'city' ||
    pools.mode === 'city-own-only' ||
    pools.mode === 'proximity' ||
    pools.mode === 'global-fallback';
  const repeatPool = stableMeetupRotation(
    usesLocalPool ? primaryPool : pools.injectionMeetups,
  );
  const completedPool = pools.completedPool ?? [];
  const useCompletedInjection = usesLocalPool;
  const cooldownSize = Math.min(
    Math.max(0, recentWindowSize),
    Math.max(0, primaryPool.length - 1),
  );
  const recentlySeen = carouselIds.map(String).slice(-cooldownSize);
  let unseenIndex = 0;
  let repeatCursor = 0;
  let injectionCount = 0;
  let awaitingCompleted = false;

  const rows = [];
  moments.forEach((moment, index) => {
    rows.push({
      type: 'moment',
      data: moment,
      key: `moment-${moment?.id ?? index}`,
    });

    if ((index + 1) % injectionInterval !== 0 || allMeetups.length === 0) {
      return;
    }

    let injected = null;
    injectionCount += 1;

    if (useCompletedInjection && awaitingCompleted && completedPool.length > 0) {
      injected = pickCompletedMeetup(completedPool, sessionSeed, injectionCount);
      awaitingCompleted = false;
    } else if (unseenIndex < unseenInlineMeetups.length) {
      injected = unseenInlineMeetups[unseenIndex];
      unseenIndex += 1;
      if (unseenIndex >= unseenInlineMeetups.length && completedPool.length > 0) {
        awaitingCompleted = true;
      }
    } else if (useCompletedInjection && completedPool.length > 0 && awaitingCompleted) {
      injected = pickCompletedMeetup(completedPool, sessionSeed, injectionCount);
      awaitingCompleted = false;
    } else {
      const selection = pickRotatingMeetup(
        repeatPool.length ? repeatPool : pools.injectionMeetups,
        recentlySeen,
        repeatCursor,
        cooldownSize,
      );
      injected = selection.meetup;
      repeatCursor = selection.nextCursor;
      if (useCompletedInjection && completedPool.length > 0) {
        awaitingCompleted = true;
      }
    }

    if (!injected) {
      return;
    }

    pushToSlidingWindow(recentlySeen, injected.id, cooldownSize);
    rows.push({
      type: 'meetup',
      data: injected,
      key: `meetup-inject-${injected.id}-${index}`,
    });
  });

  return {
    rows,
    recentlySeenIds: recentlySeen.slice(-cooldownSize),
  };
}

/** Backward-compatible alias that now follows the canonical 9:1 composition. */
export function buildExpandedMeetupFeedRows({
  moments = [],
  allMeetups = [],
  carouselIds = [],
  injectionInterval = DEFAULT_MEETUP_INJECTION_INTERVAL,
  userLocation = null,
  locationGranted = false,
  sessionSeed = 0,
  currentUserId = null,
}) {
  return buildMeetupInjectionRows({
    moments,
    allMeetups,
    carouselIds,
    injectionInterval,
    userLocation,
    locationGranted,
    sessionSeed,
    currentUserId,
  });
}

/** @deprecated Radius filtering removed — city filter happens upstream. */
export function filterMeetupsWithinRadius(meetups) {
  return meetups;
}

/** @deprecated Use buildCarouselMeetups */
export function buildPhaseAQueue(meetups, carouselIds) {
  const carouselIdSet = new Set(carouselIds.map(String));
  return meetups.filter((m) => !carouselIdSet.has(String(m.id)));
}
