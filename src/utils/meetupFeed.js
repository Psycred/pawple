/**
 * Carousel: meetups[0..2]. Inline: meetups.slice(3).
 * Feed rhythm: 7–9 moments, then one inline meetup; repeat; append leftover meetups.
 */
const DEFAULT_BATCH_SIZES = [7, 8, 9];

export function buildFeedData(moments, remainingMeetups, batchSizes = DEFAULT_BATCH_SIZES) {
  const rows = [];
  let mi = 0;
  let ui = 0;
  let segment = 0;

  while (mi < moments.length) {
    const batch = batchSizes[segment % batchSizes.length] ?? 8;
    let n = 0;
    while (n < batch && mi < moments.length) {
      rows.push({ type: 'moment', data: moments[mi] });
      mi += 1;
      n += 1;
    }
    if (ui < remainingMeetups.length) {
      rows.push({ type: 'meetup', data: remainingMeetups[ui] });
      ui += 1;
    }
    segment += 1;
  }

  while (ui < remainingMeetups.length) {
    rows.push({ type: 'meetup', data: remainingMeetups[ui] });
    ui += 1;
  }

  return rows;
}

/** @deprecated use buildFeedData */
export const buildInterleavedFeed = buildFeedData;
