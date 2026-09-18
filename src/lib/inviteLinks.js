/**
 * Invite URL + share message builders (PAW-222 / PAW-224).
 * Store destinations are honest placeholders — swap constants when listings go live.
 */

export const INVITE_WEB_ORIGIN = 'https://pawple.com';

/**
 * Temporary platform-specific landing placeholders — not store listing URLs.
 * Replace these two constants when the real Play Store and App Store listings exist.
 */
export const STORE_FALLBACK_ANDROID_URL = `${INVITE_WEB_ORIGIN}/download/android`;
export const STORE_FALLBACK_IOS_URL = `${INVITE_WEB_ORIGIN}/download/ios`;

export const INVITE_SHARE_EMAIL_SUBJECT = "You're invited to Pawple";
/** Alias used by InviteSheet share handlers. */
export const INVITE_EMAIL_SUBJECT = INVITE_SHARE_EMAIL_SUBJECT;

function normalizeInviteCode(code) {
  return String(code ?? '')
    .trim()
    .replace(/^@/, '')
    .toUpperCase();
}

/**
 * @param {string} code
 * @returns {string}
 */
export function buildInviteUrl(code) {
  const normalized = normalizeInviteCode(code);
  if (!normalized) {
    return `${INVITE_WEB_ORIGIN}/invite`;
  }
  return `${INVITE_WEB_ORIGIN}/invite/${encodeURIComponent(normalized)}`;
}

/**
 * @returns {{ android: string, ios: string }}
 */
export function buildStoreFallbackUrls() {
  return {
    android: STORE_FALLBACK_ANDROID_URL,
    ios: STORE_FALLBACK_IOS_URL,
  };
}

/**
 * Plain-text invitation body shared consistently across WhatsApp, email, and
 * the native OS share sheet.
 * @param {{ code: string }} params
 * @returns {string}
 */
export function buildInviteShareMessage({ code }) {
  const inviteUrl = buildInviteUrl(code);
  return [
    'Welcome to Pawple — an invite-only app for journaling the life of your furry companion, discovering pet meetups nearby, and finding potential mating partners.',
    '',
    "We're still growing, one pet at a time. Show some love to the furries around you and join Pawple.",
    '',
    inviteUrl,
    '',
    "Don't have the app yet?",
    'Android · iOS',
  ].join('\n');
}

/**
 * Parse invite codes from custom-scheme and HTTPS invite URLs.
 * Supports: pawple://invite/CODE, https://pawple.com/invite/CODE, www variant.
 * @param {string} url
 * @returns {string|null} uppercase code or null
 */
export function parseInviteCodeFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const trimmed = url.trim();

    // Prefer URL parsing for https/http so host + path are reliable.
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
      if (host !== 'pawple.com') {
        return null;
      }
      const match = parsed.pathname.match(/\/invite\/([^/?#]+)/i);
      if (!match?.[1]) {
        return null;
      }
      return normalizeInviteCode(decodeURIComponent(match[1])) || null;
    }

    // Custom scheme: pawple://invite/CODE (and Linking-style host/path forms)
    const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    const inviteMatch =
      withoutScheme.match(/^invite\/([^/?#]+)/i) ||
      withoutScheme.match(/\/invite\/([^/?#]+)/i);
    if (inviteMatch?.[1]) {
      return normalizeInviteCode(decodeURIComponent(inviteMatch[1])) || null;
    }

    return null;
  } catch (_error) {
    return null;
  }
}
