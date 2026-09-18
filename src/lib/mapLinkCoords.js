/**
 * Extract venue coordinates from Google / Apple Maps URLs.
 * Used client-side as fallback; primary unwrap runs on Supabase Edge Function.
 */

const COORD_PAIR = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;

function isValidLatLng(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  return (
    Number.isFinite(la) &&
    Number.isFinite(lo) &&
    la >= -90 &&
    la <= 90 &&
    lo >= -180 &&
    lo <= 180
  );
}

function pickCoords(lat, lng) {
  if (!isValidLatLng(lat, lng)) {
    return null;
  }
  return { lat: Number(lat), lng: Number(lng) };
}

/**
 * @param {string} url
 * @returns {{ lat: number, lng: number } | null}
 */
export function parseMapLinkCoords(url = '') {
  const raw = String(url ?? '').trim();
  if (!raw) {
    return null;
  }

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  const atMatch = decoded.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch) {
    return pickCoords(atMatch[1], atMatch[2]);
  }

  const bangMatch = decoded.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/i);
  if (bangMatch) {
    return pickCoords(bangMatch[1], bangMatch[2]);
  }

  const llMatch = decoded.match(/[?&]ll=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/i);
  if (llMatch) {
    return pickCoords(llMatch[1], llMatch[2]);
  }

  const qMatch = decoded.match(/[?&]q=(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i);
  if (qMatch) {
    return pickCoords(qMatch[1], qMatch[2]);
  }

  const centerMatch = decoded.match(/[?&]center=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/i);
  if (centerMatch) {
    return pickCoords(centerMatch[1], centerMatch[2]);
  }

  const loose = decoded.match(COORD_PAIR);
  if (loose) {
    return pickCoords(loose[1], loose[2]);
  }

  return null;
}

const ALLOWED_MAP_HOSTS = [
  'maps.app.goo.gl',
  'goo.gl',
  'google.com',
  'www.google.com',
  'maps.google.com',
  'maps.apple.com',
  'apple.com',
];

/** @param {string} url */
export function isAllowedMapLinkHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const normalized = host.startsWith('www.') ? host.slice(4) : host;
    return ALLOWED_MAP_HOSTS.some(
      (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}
