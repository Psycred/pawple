export const PUBLIC_SHARE_ORIGIN = 'https://pawple.app';

const SHARE_DESTINATION_TYPES = new Set(['moment', 'meetup']);

function normalizeDestination(type, id) {
  const normalizedType = String(type ?? '').trim().toLowerCase();
  const normalizedId = String(id ?? '').trim();
  if (!SHARE_DESTINATION_TYPES.has(normalizedType) || !normalizedId) {
    return null;
  }
  return { type: normalizedType, id: normalizedId };
}

export function buildPublicShareUrl(type, id) {
  const destination = normalizeDestination(type, id);
  if (!destination) {
    return null;
  }
  return `${PUBLIC_SHARE_ORIGIN}/${destination.type}/${encodeURIComponent(destination.id)}`;
}

/**
 * Messenger share URL — edge function serves OG HTML with the uploaded moment card
 * as og:image so WhatsApp renders one clickable preview (Instagram-style).
 */
export function buildMomentShareOgUrl(momentId, previewOwnerId = null) {
  const id = String(momentId ?? '').trim();
  if (!id) {
    return null;
  }

  const previewId = String(previewOwnerId ?? '').trim();
  const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  if (supabaseUrl) {
    const params = new URLSearchParams({ id });
    if (previewId) {
      params.set('preview', previewId);
    }
    return `${supabaseUrl}/functions/v1/moment-share?${params.toString()}`;
  }

  return buildPublicShareUrl('moment', id);
}

/**
 * Messenger share URL — edge function serves OG HTML with the uploaded meetup card
 * as og:image so WhatsApp renders one clickable preview (Instagram-style).
 */
export function buildMeetupShareOgUrl(meetupId, previewOwnerId = null) {
  const id = String(meetupId ?? '').trim();
  if (!id) {
    return null;
  }

  const previewId = String(previewOwnerId ?? '').trim();
  const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  if (supabaseUrl) {
    const params = new URLSearchParams({ id });
    if (previewId) {
      params.set('preview', previewId);
    }
    return `${supabaseUrl}/functions/v1/meetup-share?${params.toString()}`;
  }

  return buildPublicShareUrl('meetup', id);
}

/**
 * Parse Pawple's public HTTPS URLs and retain legacy custom-scheme support.
 */
export function parseShareDestination(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const trimmed = url.trim();
    const customMatch = trimmed.match(
      /^pawple:\/\/(moment|meetup)\/([^/?#]+)/i,
    );
    if (customMatch) {
      return normalizeDestination(
        customMatch[1],
        decodeURIComponent(customMatch[2]),
      );
    }

    if (!/^https:\/\//i.test(trimmed)) {
      return null;
    }

    const parsed = new URL(trimmed);
    if (parsed.origin.toLowerCase() !== PUBLIC_SHARE_ORIGIN) {
      return null;
    }

    const pathMatch = parsed.pathname.match(/^\/(moment|meetup)\/([^/?#]+)\/?$/i);
    if (!pathMatch) {
      return null;
    }

    return normalizeDestination(
      pathMatch[1],
      decodeURIComponent(pathMatch[2]),
    );
  } catch {
    return null;
  }
}
