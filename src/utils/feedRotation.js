import { Dimensions } from 'react-native';
import { theme } from '../config/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const POST_W = SCREEN_W - 32;

/** Apple-style feed rhythm: posts → periodic events with fair rotation & caps. */
export const FEED_CONFIG = {
  postsBetweenEvents: 8,
  maxEventsInRotation: 5,
  maxRepeatsPerEvent: 2,
  /** Total list rows (each post+actions or one event counts as one row). */
  feedTargetLength: 50,
};

/** Post card height from aspect ratio 4/5 (width / height = 4/5 → height = width × 5/4). */
export const POST_CARD_HEIGHT = POST_W * (5 / 4);
const POST_ACTIONS_HEIGHT = 70;
const FEED_ITEM_GAP = theme.feed.itemGap;
/** One FlatList row for a post (card + heart/share + bottom gap). */
export const POST_LIST_ROW_HEIGHT = POST_CARD_HEIGHT + POST_ACTIONS_HEIGHT + FEED_ITEM_GAP;

/** Event row: card content + outer margin (tune if design changes). */
export const EVENT_LIST_ROW_HEIGHT = 236;

/**
 * Haversine distance in km (beginner-friendly: great-circle distance on Earth).
 */
export function distanceKmBetween(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Nearby events for feed rotation. Returns [] until wired to Supabase (or another backend).
 */
export async function fetchNearbyEvents(_userLat, _userLng) {
  return [];
}

/**
 * Expand post templates into unique feed rows (enough for 50+ rows when templates exist).
 * `mapRow(template, index, refreshKey)` must return a post list item.
 */
export function expandPostTemplates(templates, mapRow, refreshKey, minCount) {
  if (!templates || templates.length === 0) {
    return [];
  }
  const out = [];
  for (let i = 0; i < minCount; i += 1) {
    const t = templates[i % templates.length];
    out.push(mapRow(t, i, refreshKey));
  }
  return out;
}

/**
 * Build up to `feedTargetLength` rows: after every `postsBetweenEvents`, insert one rotated event
 * (each event at most `maxRepeatsPerEvent` times). If no events, posts only.
 */
export function buildRotatedFeed(postTemplates, mapPostRow, rotationEvents, refreshKey) {
  const minPosts = FEED_CONFIG.feedTargetLength * 2;
  const postQueue = expandPostTemplates(postTemplates, mapPostRow, refreshKey, minPosts);

  if (rotationEvents.length === 0) {
    return postQueue.slice(0, FEED_CONFIG.feedTargetLength);
  }

  const showCounts = {};
  rotationEvents.forEach((e) => {
    showCounts[e.id] = 0;
  });

  let postIndex = 0;
  let postsSinceEvent = 0;
  let rotationCursor = 0;
  const out = [];

  while (out.length < FEED_CONFIG.feedTargetLength) {
    const shouldTryEvent = postsSinceEvent >= FEED_CONFIG.postsBetweenEvents;

    if (shouldTryEvent) {
      let inserted = false;
      for (let step = 0; step < rotationEvents.length; step += 1) {
        const idx = (rotationCursor + step) % rotationEvents.length;
        const ev = rotationEvents[idx];
        if (showCounts[ev.id] < FEED_CONFIG.maxRepeatsPerEvent) {
          showCounts[ev.id] += 1;
          out.push({
            type: 'event',
            id: `feed-${refreshKey}-ev-${ev.id}-${showCounts[ev.id]}`,
            sourceEventId: ev.id,
            title: ev.title,
            location: ev.location,
            when: ev.when,
            cta: 'Count Us In',
            distanceKm: ev.distanceKm,
            distanceLabel:
              ev.distanceKm != null ? `${ev.distanceKm.toFixed(1)} km away` : null,
          });
          rotationCursor = (idx + 1) % rotationEvents.length;
          postsSinceEvent = 0;
          inserted = true;
          break;
        }
      }
      if (inserted) {
        continue;
      }
      postsSinceEvent = 0;
    }

    if (postIndex >= postQueue.length) {
      break;
    }
    out.push(postQueue[postIndex]);
    postIndex += 1;
    postsSinceEvent += 1;
  }

  return out;
}

/**
 * Precompute FlatList getItemLayout. When using ListHeaderComponent, pass its measured height so
 * offsets match scroll content (see FlatList getItemLayout).
 */
export function buildFeedItemLayoutGetters(items, listHeaderHeight = 0) {
  if (!items || items.length === 0) {
    return {
      getItemLayout: (_data, _index) => ({ length: 0, offset: 0, index: 0 }),
      lengths: [],
      offsets: [],
      totalHeight: 0,
    };
  }
  const lengths = items.map((it) =>
    it.type === 'post' ? POST_LIST_ROW_HEIGHT : EVENT_LIST_ROW_HEIGHT,
  );
  const offsets = [];
  let y = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    offsets.push(y);
    y += lengths[i];
  }
  const totalHeight = y;

  const getItemLayout = (_data, index) => ({
    length: lengths[index],
    offset: listHeaderHeight + offsets[index],
    index,
  });

  return { getItemLayout, lengths, offsets, totalHeight };
}
