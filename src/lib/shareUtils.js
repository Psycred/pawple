import { Alert, Share as RNShareSheet } from 'react-native';
import { formatMomentDate } from '../services/moments';

// Smart link config.
// - deepLink (pawple://) opens the exact moment when the app is installed.
// - webUrl (https://pawple.app/m/{id}) is the social-friendly link: it unfurls into a
//   rich preview on most platforms and can host a smart redirect to app/store later.
const APP_SCHEME = 'pawple';
const WEB_BASE_URL = 'https://pawple.app';

/** pawple://moment/{id} — opens the exact moment when the app is installed. */
export function buildMomentDeepLink(momentId) {
  return momentId ? `${APP_SCHEME}://moment/${momentId}` : '';
}

/** https://pawple.app/m/{id} — social-friendly link (unfurls + redirect-ready). */
export function buildMomentWebUrl(momentId) {
  return momentId ? `${WEB_BASE_URL}/m/${momentId}` : WEB_BASE_URL;
}

// react-native-view-shot + react-native-share are native modules (dev/standalone build only).
// Required lazily + guarded so the JS bundle never hard-crashes if a module is unavailable.
let captureRef = null;
try {
  // eslint-disable-next-line global-require
  captureRef = require('react-native-view-shot').captureRef;
} catch (e) {
  captureRef = null;
}

let Share = null;
try {
  // eslint-disable-next-line global-require
  Share = require('react-native-share').default;
} catch (e) {
  Share = null;
}

/** Card-style date for share text — same timezone-safe formatter as Feed cards. */
export function formatShareDate(value) {
  return formatMomentDate(value);
}

/** "— Tyson" or "— Tyson & Peter" (Phase 1 cap: 2). */
export function buildPetAttribution(petNames = []) {
  const list = petNames.filter(Boolean);
  if (list.length === 1) {
    return `— ${list[0]}`;
  }
  if (list.length >= 2) {
    return `— ${list[0]} & ${list[1]}`;
  }
  return '';
}

/** Date • Location (location optional). */
export function buildShareMetaLine(moment) {
  const date = formatShareDate(moment?.memory_date ?? moment?.moment_date);
  return [date, moment?.location].filter((p) => String(p ?? '').trim()).join(' • ');
}

/** Social-optimized share text: caption → attribution → date • location → web link. */
function buildShareMessage(moment, petNames = []) {
  const caption = String(moment?.caption ?? '').trim();
  const attribution = buildPetAttribution(petNames);
  const metaLine = buildShareMetaLine(moment);
  const webUrl = buildMomentWebUrl(moment?.id);
  return [caption, attribution, metaLine]
    .filter((p) => String(p ?? '').trim())
    .join('\n')
    .concat(`\n\nView on Pawple: ${webUrl}`);
}

/** Fallback: share text + link only (no image) via the OS share sheet. */
async function shareTextOnly(moment, petNames = []) {
  try {
    await RNShareSheet.share({ message: buildShareMessage(moment, petNames) });
    console.log('[Share] Text fallback success', moment?.id);
  } catch (err) {
    console.log('[Share] Fallback failed:', err?.message);
    Alert.alert('Share Failed', 'Could not share this moment.');
  }
}

/**
 * Share a moment as a beautiful, NON-EDITABLE Pawple social asset.
 * Captures the off-screen ShareCard to a base64 PNG and posts it via react-native-share
 * (image + rich text/link in a single native sheet — Instagram/Facebook/WhatsApp style).
 * Falls back to text-only sharing if capture is null/empty (prevents the Android
 * "Uri.getScheme() on a null object reference" crash when url is invalid).
 *
 * @param {object} moment  { id, caption, location, memory_date|moment_date|created_at }
 * @param {string[]} petNames
 * @param {React.RefObject} shareCardRef  ref to the hidden view wrapping <ShareCard/>
 */
export async function shareMoment(moment, petNames = [], shareCardRef) {
  try {
    console.log('[Share] Starting share for moment:', moment?.id);

    // 1. No native react-native-share or no capturable view → text-only.
    if (!Share || !captureRef || !shareCardRef?.current) {
      console.log('[Share] Native image share unavailable, using text fallback.');
      return shareTextOnly(moment, petNames);
    }

    // 2. Capture card as base64, guarded.
    console.log('[Share] Capturing image...');
    let base64;
    try {
      base64 = await captureRef(shareCardRef, {
        format: 'png',
        quality: 0.9,
        result: 'base64',
        snapshotContentContainer: false,
      });
    } catch (captureErr) {
      console.log('[Share] Capture failed:', captureErr?.message);
      return shareTextOnly(moment, petNames);
    }

    // 3. Validate capture result — an empty/invalid base64 is what triggers the
    //    Android null-Uri crash inside react-native-share.
    if (!base64 || base64.length < 100) {
      console.warn('[Share] Captured image is empty/too small, using text fallback.');
      return shareTextOnly(moment, petNames);
    }

    // 4. Share as SOCIAL ASSET (non-editable), not a file attachment.
    console.log('[Share] Opening native share...');
    await Share.open({
      title: 'Pawple',
      message: buildShareMessage(moment, petNames),
      url: `data:image/png;base64,${base64}`,
      type: 'image/png',
      subject: String(moment?.caption ?? '').trim() || 'Pawple Moment',
      failOnCancel: false,
      showAppsToView: true,
    });

    console.log('[Share] Success', moment?.id);
  } catch (error) {
    // User cancel is not an error.
    if (
      error?.code === 'ERR_ACTIVITY_RESULT_EMPTY' ||
      error?.code === 'ERR_SHARE_FAILED' ||
      error?.message?.includes('User did not share') ||
      error?.message?.includes('User cancelled')
    ) {
      console.log('[Share] User cancelled');
      return;
    }
    console.log('[Share] Native share failed:', error?.message);
    return shareTextOnly(moment, petNames);
  }
}

/** Invite line for meetup sharing — "Join me at … on …! 🐾" */
export function buildMeetupShareMessage(title, dateLabel) {
  const safeTitle = String(title ?? '').trim() || 'this meetup';
  const safeDate = String(dateLabel ?? '').trim() || 'soon';
  return `Join me at ${safeTitle} on ${safeDate}! 🐾`;
}

/**
 * Opens the native OS share sheet for meetup text.
 * Uses react-native-share when available; falls back to React Native Share.
 */
export async function shareMeetupText(message, title = 'Pawple Meetup') {
  try {
    if (Share?.open) {
      await Share.open({
        title,
        message,
        failOnCancel: false,
      });
      return;
    }

    await RNShareSheet.share({ message, title });
  } catch (error) {
    if (
      error?.code === 'ERR_ACTIVITY_RESULT_EMPTY' ||
      error?.message?.includes('User did not share') ||
      error?.message?.includes('User cancelled')
    ) {
      return;
    }
    console.warn('[Share] Meetup share failed:', error?.message);
    throw error;
  }
}
