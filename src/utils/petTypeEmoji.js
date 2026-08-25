/**
 * Pet type emoji for meetup host selection UI.
 */
export function petTypeEmoji(petType) {
  const normalized = String(petType ?? '').trim().toLowerCase();
  if (normalized === 'dog') {
    return '🐶';
  }
  if (normalized === 'cat') {
    return '🐱';
  }
  return '🐾';
}
