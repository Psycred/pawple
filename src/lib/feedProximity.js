/**
 * Feed proximity modes.
 * Meetups (A.1): city match — current or base city, aliases, 100 km between centroids.
 * Moments: 200 km GPS local pool when granted; global shuffle with hearted-pet priority in fallback.
 */

import { getMeetupStartTimestamp, isMeetupPast } from './meetupPublicFilter.js';
import { normalizeCityForSave } from '../utils/cityUtils.js';
import {
  getCityCentroid,
  isMeetupCityRelevantToViewer,
  minMeetupCityDistanceKm,
} from '../utils/indianCityRegistry.js';
import { getMeetupVenueCoords } from './meetupVenueCoords.js';
import { calculateDistance } from '../utils/locationUtils.js';

export const MEETUP_FEED_RADIUS_KM = 100;
export const MOMENT_FEED_RADIUS_KM = 200;

export function hasViewerFeedGps(userLocation) {
  const lat = Number(userLocation?.latitude);
  const lng = Number(userLocation?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

/** Stable per-session seed — new shuffle on refresh or app open. */
export function createFeedSessionSeed() {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

export function hashSeed(...parts) {
  return String(parts.join('|'))
    .split('')
    .reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0);
}

/** Fisher–Yates shuffle with deterministic seed. */
export function seededShuffle(items = [], seed = 0) {
  const list = [...items];
  let state = (seed >>> 0) || 1;
  const nextUnit = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextUnit() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
  return list;
}

function getMeetupSortTimestamp(meetup) {
  return getMeetupStartTimestamp(meetup) ?? Number.MAX_SAFE_INTEGER;
}

function getViewerUpcomingMeetups(meetups = [], viewerUserId) {
  if (!viewerUserId) {
    return [];
  }
  const viewerKey = String(viewerUserId);
  return meetups.filter(
    (meetup) =>
      !isMeetupPast(meetup) && String(meetup?.user_id ?? '') === viewerKey,
  );
}

/** Soonest upcoming meetup hosted by the viewer — carousel pin target. */
export function pickViewerPinMeetup(meetups = [], viewerUserId) {
  const owned = getViewerUpcomingMeetups(meetups, viewerUserId);
  if (!owned.length) {
    return null;
  }
  return [...owned].sort(
    (a, b) => getMeetupSortTimestamp(a) - getMeetupSortTimestamp(b),
  )[0];
}

function mergeUniqueMeetups(primary = [], extras = []) {
  const seen = new Set(primary.map((meetup) => String(meetup?.id)));
  const merged = [...primary];
  for (const meetup of extras) {
    const id = String(meetup?.id ?? '');
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    merged.push(meetup);
  }
  return merged;
}

function pinMeetupFirst(meetups = [], pinnedMeetup) {
  if (!pinnedMeetup?.id) {
    return meetups;
  }
  const pinId = String(pinnedMeetup.id);
  return [
    pinnedMeetup,
    ...meetups.filter((meetup) => String(meetup?.id) !== pinId),
  ];
}

export function meetupDistanceKm(meetup, userLocation) {
  const venue = getMeetupVenueCoords(meetup);
  const uLat = Number(userLocation?.latitude);
  const uLng = Number(userLocation?.longitude);
  if (!venue || !Number.isFinite(uLat) || !Number.isFinite(uLng)) {
    return null;
  }
  return calculateDistance(uLat, uLng, venue.latitude, venue.longitude);
}

export function momentDistanceKm(moment, userLocation) {
  if (!hasViewerFeedGps(userLocation)) {
    return null;
  }
  const lat = moment?.latitude ?? moment?.lat;
  const lng = moment?.longitude ?? moment?.lng ?? moment?.lon;
  if (lat == null || lng == null) {
    return null;
  }
  return calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    Number(lat),
    Number(lng),
  );
}

export function partitionMeetupsByTime(meetups = []) {
  const upcoming = [];
  const completed = [];
  for (const meetup of meetups) {
    if (isMeetupPast(meetup)) {
      completed.push(meetup);
    } else {
      upcoming.push(meetup);
    }
  }
  return { upcoming, completed };
}

function getViewerCityContext(userLocation) {
  const profileCity = normalizeCityForSave(userLocation?.profileCity ?? null);
  const deviceCity = normalizeCityForSave(
    userLocation?.deviceCity ?? userLocation?.city ?? null,
  );
  return {
    profileCity,
    deviceCity,
    hasContext: Boolean(profileCity || deviceCity),
  };
}

/**
 * City-centroid distance from viewer GPS when a meetup has no venue pin.
 * @returns {number|null}
 */
export function meetupGpsToCityCentroidKm(meetup, userLocation) {
  if (!hasViewerFeedGps(userLocation)) {
    return null;
  }
  const centroid = getCityCentroid(meetup?.city);
  if (!centroid) {
    return null;
  }
  return calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    centroid.lat,
    centroid.lng,
  );
}

/**
 * Ranking distance when GPS is unavailable — device city before profile city.
 * @returns {number}
 */
function minMeetupCityDistanceKmForRanking(meetupCity, viewerCities = {}) {
  if (viewerCities.deviceCity) {
    return minMeetupCityDistanceKm(meetupCity, {
      deviceCity: viewerCities.deviceCity,
      profileCity: null,
    });
  }
  return minMeetupCityDistanceKm(meetupCity, {
    deviceCity: null,
    profileCity: viewerCities.profileCity,
  });
}

/**
 * Single comparator distance for Meetup Feed ordering.
 * GPS present: venue distance, else GPS → meetup city centroid.
 * GPS absent: device city centroid distance, else profile city.
 * @returns {number}
 */
export function meetupEffectiveSortKm(meetup, userLocation, viewerCities = {}) {
  if (hasViewerFeedGps(userLocation)) {
    const venueKm = meetupDistanceKm(meetup, userLocation);
    if (venueKm != null) {
      return venueKm;
    }
    const cityKm = meetupGpsToCityCentroidKm(meetup, userLocation);
    if (cityKm != null) {
      return cityKm;
    }
  }
  return minMeetupCityDistanceKmForRanking(meetup?.city, viewerCities);
}

function sortUpcomingMeetupsByRelevance(meetups, viewerCities, userLocation) {
  return [...meetups].sort((a, b) => {
    const da = meetupEffectiveSortKm(a, userLocation, viewerCities);
    const db = meetupEffectiveSortKm(b, userLocation, viewerCities);
    if (da !== db) {
      return da - db;
    }
    return getMeetupSortTimestamp(a) - getMeetupSortTimestamp(b);
  });
}

/** Exported for unit tests — same ordering used by carousel and inline injection pools. */
export function sortMeetupsByFeedRelevance(meetups, viewerCities, userLocation) {
  return sortUpcomingMeetupsByRelevance(meetups, viewerCities, userLocation);
}

/**
 * Upcoming meetups for proximity mode; completed pool for occasional injection.
 */
export function prepareMeetupFeedPools(
  meetups = [],
  userLocation = null,
  _locationGranted = false,
  sessionSeed = 0,
  viewerUserId = null,
) {
  const { upcoming, completed } = partitionMeetupsByTime(meetups);
  const viewerUpcoming = getViewerUpcomingMeetups(meetups, viewerUserId);
  const pinnedMeetup = pickViewerPinMeetup(meetups, viewerUserId);
  const { profileCity, deviceCity, hasContext } = getViewerCityContext(userLocation);
  const viewerCities = { profileCity, deviceCity };

  if (!hasContext) {
    const shuffledAll = seededShuffle(meetups, sessionSeed);
    const carouselMeetups = pinMeetupFirst(
      shuffledAll.slice(0, Math.min(3, shuffledAll.length)),
      pinnedMeetup,
    ).slice(0, Math.min(3, shuffledAll.length));
    return {
      mode: 'global',
      carouselMeetups,
      injectionMeetups: shuffledAll,
      completedPool: seededShuffle(completed, sessionSeed + 1),
      pinnedMeetup,
    };
  }

  const isRelevant = (meetup) =>
    isMeetupCityRelevantToViewer(meetup?.city, viewerCities, MEETUP_FEED_RADIUS_KM);

  const upcomingRelevant = upcoming.filter(isRelevant);
  const upcomingForFeed = mergeUniqueMeetups(upcomingRelevant, viewerUpcoming);
  const upcomingOrdered = sortUpcomingMeetupsByRelevance(
    upcomingForFeed,
    viewerCities,
    userLocation,
  );
  const completedRelevant = completed.filter(isRelevant);
  const completedPool = seededShuffle(
    completedRelevant.length ? completedRelevant : completed,
    sessionSeed + 2,
  );

  if (upcomingOrdered.length === 0) {
    if (viewerUpcoming.length) {
      const ownOnly = sortUpcomingMeetupsByRelevance(
        viewerUpcoming,
        viewerCities,
        userLocation,
      );
      const carouselMeetups = pinMeetupFirst(
        ownOnly.slice(0, Math.min(3, ownOnly.length)),
        pinnedMeetup,
      ).slice(0, Math.min(3, ownOnly.length));
      return {
        mode: 'city-own-only',
        carouselMeetups,
        injectionMeetups: ownOnly,
        completedPool,
        pinnedMeetup,
      };
    }

    const shuffledAll = seededShuffle(meetups, sessionSeed);
    const carouselMeetups = pinMeetupFirst(
      shuffledAll.slice(0, Math.min(3, shuffledAll.length)),
      pinnedMeetup,
    ).slice(0, Math.min(3, shuffledAll.length));
    return {
      mode: 'global-fallback',
      carouselMeetups,
      injectionMeetups: shuffledAll,
      completedPool,
      pinnedMeetup,
    };
  }

  const carouselMeetups = pinMeetupFirst(
    upcomingOrdered.slice(0, 3),
    pinnedMeetup,
  ).slice(0, 3);

  return {
    mode: 'city',
    carouselMeetups,
    injectionMeetups: upcomingOrdered,
    completedPool,
    pinnedMeetup,
  };
}

function momentCreatedAtMs(moment) {
  const raw = moment?.created_at ?? moment?.createdAt ?? '';
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function momentTouchesHeartedPet(moment, heartedPetIds) {
  if (!heartedPetIds?.size) {
    return false;
  }
  const ids = moment?.pet_ids ?? [];
  return ids.some((id) => heartedPetIds.has(String(id)));
}

/**
 * Local 200 km pool first; then global fallback with hearted-pet priority.
 */
export function sortMomentsForFeed(
  moments = [],
  userLocation = null,
  {
    locationGranted = false,
    heartedPetIds = new Set(),
    sessionSeed = 0,
  } = {},
) {
  const list = [...moments];
  if (!list.length) {
    return list;
  }

  if (!locationGranted || !hasViewerFeedGps(userLocation)) {
    return seededShuffle(list, sessionSeed);
  }

  const local = [];
  const fallback = [];

  for (const moment of list) {
    const km = momentDistanceKm(moment, userLocation);
    if (km != null && km <= MOMENT_FEED_RADIUS_KM) {
      local.push(moment);
    } else {
      fallback.push(moment);
    }
  }

  local.sort((a, b) => {
    const da = momentDistanceKm(a, userLocation) ?? Number.POSITIVE_INFINITY;
    const db = momentDistanceKm(b, userLocation) ?? Number.POSITIVE_INFINITY;
    if (da !== db) {
      return da - db;
    }
    return momentCreatedAtMs(b) - momentCreatedAtMs(a);
  });

  const priority = fallback.filter((moment) => momentTouchesHeartedPet(moment, heartedPetIds));
  const remainder = fallback.filter((moment) => !momentTouchesHeartedPet(moment, heartedPetIds));

  return [
    ...local,
    ...seededShuffle(priority, sessionSeed + 3),
    ...seededShuffle(remainder, sessionSeed + 4),
  ];
}

export function pickSeededItem(pool, seed, index = 0) {
  if (!pool?.length) {
    return null;
  }
  const shuffled = seededShuffle(pool, seed);
  return shuffled[index % shuffled.length];
}
