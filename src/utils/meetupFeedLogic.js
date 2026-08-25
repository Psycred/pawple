/**
 * Meetup carousel + main-feed sorting for FeedScreen.
 *
 * Carousel: user's meetup (if any) + 2 nearest others.
 * Vertical feed: nine Moments followed by the next-nearest Meetup.
 */

export const MEETUP_FEED_RADIUS_KM = 50;
export const MEETUP_RECENT_WINDOW = 3;
export const MEETUP_CAROUSEL_SIZE = 3;
export const DEFAULT_MEETUP_INJECTION_INTERVAL = 9;

/** Read precomputed distance from enriched meetup rows. */
export function getMeetupDistanceKm(meetup) {
  const n = Number(meetup?.distanceKm ?? meetup?.distance_km ?? meetup?.distance);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Closest first; meetups without a distance sink to the end. */
export function sortMeetupsByDistance(meetups) {
  return [...meetups].sort((a, b) => {
    const da = getMeetupDistanceKm(a);
    const db = getMeetupDistanceKm(b);
    if (da == null && db == null) {
      return 0;
    }
    if (da == null) {
      return 1;
    }
    if (db == null) {
      return -1;
    }
    return da - db;
  });
}

/** Meetups strictly inside the radius, sorted closest-first. */
export function filterMeetupsWithinRadius(meetups, radiusKm = MEETUP_FEED_RADIUS_KM) {
  return sortMeetupsByDistance(meetups).filter((m) => {
    const d = getMeetupDistanceKm(m);
    return d != null && d <= radiusKm;
  });
}

/**
 * Top carousel (max `carouselSize`, default 3):
 * 0 = user's own meetup (nearest if they have several),
 * 1–2 = next nearest excluding own; or 3 nearest when no own meetup.
 */
export function buildCarouselMeetups(meetups, currentUserId, carouselSize = MEETUP_CAROUSEL_SIZE) {
  if (!meetups?.length) {
    return { slides: [], ids: [] };
  }

  const cap = Math.max(1, Number(carouselSize) || MEETUP_CAROUSEL_SIZE);
  const sorted = sortMeetupsByDistance(meetups);
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

/** Phase A queue: within radius, closest first, carousel meetups removed. */
export function buildPhaseAQueue(meetups, carouselIds, radiusKm = MEETUP_FEED_RADIUS_KM) {
  const carouselIdSet = new Set(carouselIds.map(String));
  return filterMeetupsWithinRadius(meetups, radiusKm).filter(
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

/** Build the strict 9 Moments → next-nearest Meetup vertical sequence. */
export function buildMeetupInjectionRows({
  moments = [],
  allMeetups = [],
  carouselIds = [],
  injectionInterval = DEFAULT_MEETUP_INJECTION_INTERVAL,
  recentWindowSize = MEETUP_RECENT_WINDOW,
}) {
  const carouselIdSet = new Set(carouselIds.map(String));
  const inlineMeetups = sortMeetupsByDistance(allMeetups).filter(
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
