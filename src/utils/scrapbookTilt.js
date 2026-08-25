import { theme } from '../config/theme';

/** Consistent subtle tilt for all feed cards (same direction, calm rhythm). */
export function scrapbookTiltDegrees() {
  return theme.feed.memoryTiltDegrees;
}

export function scrapbookTiltTransform(degrees = theme.feed.memoryTiltDegrees) {
  return [{ rotate: `${degrees}deg` }];
}
