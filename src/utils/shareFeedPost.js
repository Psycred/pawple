import * as FileSystem from 'expo-file-system';
import { Alert, Platform, Share } from 'react-native';
import RNShare from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import { buildPublicShareUrl } from '../lib/publicShareLinks';
import { uploadMeetupSharePreview } from '../lib/meetupSharePreview';
import { uploadMomentSharePreview } from '../lib/momentSharePreview';
import { INSTAGRAM_MOMENT_JOURNAL_OUTPUT_SIZE } from '../components/InstagramMomentJournalCard';

/** Strict "DD MMM YYYY" for share payload (matches feed). */
export function formatFeedPostDate(iso) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function isUserCancelledShare(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('user did not share') ||
    message.includes('user cancelled') ||
    message.includes('user canceled') ||
    message.includes('cancel')
  );
}

/** Remote feed photos need a local file:// URI before Android can attach them. */
async function resolveShareableImageUri(imageUri) {
  const trimmed = String(imageUri ?? '').trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('file://') || trimmed.startsWith('content://')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const ext = trimmed.toLowerCase().includes('.png') ? 'png' : 'jpg';
    const dest = `${FileSystem.cacheDirectory}pawple-share-${Date.now()}.${ext}`;
    const { uri } = await FileSystem.downloadAsync(trimmed, dest);
    return uri;
  }
  return trimmed;
}

function imageMimeType(uri) {
  return String(uri).toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
}

/**
 * Minimal chooser — link sharing stays generic; Instagram uses a dedicated image export.
 */
export function presentMomentShareChooser({ onShareLink, onShareInstagram }) {
  Alert.alert(
    'Share',
    undefined,
    [
      { text: 'Share link', onPress: () => onShareLink?.() },
      { text: 'Instagram', onPress: () => onShareInstagram?.() },
      { text: 'Cancel', style: 'cancel' },
    ],
    { cancelable: true },
  );
}

/**
 * Capture the square journal card and open Instagram with the image only.
 * Does not upload OG previews or pass Pawple HTTPS links.
 */
export async function shareMomentInstagramImage({
  captureRefTarget,
  captureWidth = INSTAGRAM_MOMENT_JOURNAL_OUTPUT_SIZE,
  captureHeight = INSTAGRAM_MOMENT_JOURNAL_OUTPUT_SIZE,
}) {
  if (!captureRefTarget?.current) {
    throw new Error('Instagram journal card is not ready');
  }

  const capturedUri = await captureRef(captureRefTarget, {
    format: 'jpg',
    quality: 0.92,
    result: 'tmpfile',
    width: captureWidth,
    height: captureHeight,
  });

  const shareableUri = await resolveShareableImageUri(capturedUri);
  if (!shareableUri) {
    throw new Error('Could not prepare Instagram image');
  }

  await RNShare.shareSingle({
    social: RNShare.Social.INSTAGRAM,
    url: shareableUri,
    type: 'image/jpeg',
    useInternalStorage: true,
  });
}

/**
 * Upload the captured square card for OG previews, then share the Pawple HTTPS link.
 */
export async function shareMomentWithPreview({
  caption,
  momentId,
  captureRefTarget,
  userId,
  captureWidth,
  captureHeight,
}) {
  const id = String(momentId ?? '').trim();
  const ownerId = String(userId ?? '').trim();
  const text = String(caption ?? '').trim();

  if (!id) {
    return;
  }

  let capturedUri = null;

  if (captureRefTarget?.current && ownerId) {
    try {
      capturedUri = await captureRef(captureRefTarget, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        ...(captureWidth && captureHeight
          ? { width: captureWidth, height: captureHeight }
          : {}),
      });
      await uploadMomentSharePreview(ownerId, id, capturedUri);
    } catch (error) {
      console.warn('[Share] Moment preview upload failed:', error?.message ?? error);
    }
  }

  const displayUrl = buildPublicShareUrl('moment', id);

  if (!displayUrl) {
    return;
  }

  await sharePublicLink({
    caption: text,
    displayUrl,
    imageUri: capturedUri,
  });
}

/**
 * Instagram-style meetup share: upload the captured card, then share a link whose
 * OG image is that card so the whole preview is tappable in WhatsApp.
 */
export async function shareMeetupWithPreview({
  caption,
  meetupId,
  captureRefTarget,
  userId,
}) {
  const id = String(meetupId ?? '').trim();
  const ownerId = String(userId ?? '').trim();
  const text = String(caption ?? '').trim();

  if (!id) {
    return;
  }

  let capturedUri = null;

  if (captureRefTarget?.current && ownerId) {
    try {
      capturedUri = await captureRef(captureRefTarget, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await uploadMeetupSharePreview(ownerId, id, capturedUri);
    } catch (error) {
      console.warn('[Share] Meetup preview upload failed:', error?.message ?? error);
    }
  }

  const displayUrl = buildPublicShareUrl('meetup', id);

  if (!displayUrl) {
    return;
  }

  await sharePublicLink({
    caption: text,
    displayUrl,
    imageUri: capturedUri,
  });
}

/**
 * Share a pawple.app HTTPS link with optional captured preview artwork.
 * OG uploads happen before this call; the canonical HTTPS URL stays in message text.
 *
 * @param {string} displayUrl Canonical pawple.app moment/meetup link.
 * @param {string|null|undefined} imageUri Local file URI from an existing card capture.
 */
export async function sharePublicLink({ caption, displayUrl, imageUri }) {
  const link = String(displayUrl ?? '').trim();
  const text = String(caption ?? '').trim();

  if (!link) {
    return;
  }

  const message = text ? `${text}\n\n${link}` : link;

  try {
    const shareableImageUri = imageUri ? await resolveShareableImageUri(imageUri) : null;

    if (shareableImageUri) {
      if (Platform.OS === 'ios') {
        await Share.share({
          message,
          url: shareableImageUri,
        });
        return;
      }

      await RNShare.open({
        title: text || 'Pawple',
        message,
        url: shareableImageUri,
        type: imageMimeType(shareableImageUri),
        useInternalStorage: true,
        failOnCancel: false,
      });
      return;
    }

    if (Platform.OS === 'ios') {
      await Share.share({
        message,
        url: link,
      });
      return;
    }

    await RNShare.open({
      title: text || 'Pawple',
      message,
      url: link,
      failOnCancel: false,
    });
  } catch (error) {
    if (isUserCancelledShare(error)) {
      return;
    }

    console.error('[Share] Public link share failed:', error);
    await Share.share({ message });
  }
}

/**
 * Native share sheet with optional captured artwork and a text-only fallback.
 */
export async function shareFeedPost(post) {
  const caption = String(post.caption ?? '').trim();
  const shareUrl = String(post.shareUrl ?? '').trim();
  const imageUri = post.imageUri ? String(post.imageUri).trim() : null;
  const captureTarget = post.captureRefTarget ?? null;
  const captureWidth = Number(post.captureWidth) || undefined;
  const captureHeight = Number(post.captureHeight) || undefined;

  const message = [caption, shareUrl].filter(Boolean).join('\n');

  if (!message && !imageUri && !captureTarget?.current) {
    return;
  }

  try {
    let capturedUri = null;

    if (captureTarget?.current) {
      try {
        capturedUri = await captureRef(captureTarget, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          ...(captureWidth && captureHeight
            ? { width: captureWidth, height: captureHeight }
            : {}),
        });
      } catch (captureError) {
        console.warn('[Share] Card capture failed:', captureError?.message);
      }
    }

    const finalImageUri = capturedUri || imageUri;

    if (!finalImageUri) {
      await Share.share({ message });
      return;
    }

    const shareableUri = await resolveShareableImageUri(finalImageUri);

    if (Platform.OS === 'ios') {
      await Share.share({
        ...(message ? { message } : {}),
        url: shareableUri,
      });
      return;
    }

    await RNShare.open({
      ...(message ? { message } : {}),
      url: shareableUri,
      type: imageMimeType(shareableUri),
      useInternalStorage: true,
      failOnCancel: false,
    });
  } catch (error) {
    if (isUserCancelledShare(error)) {
      return;
    }

    console.error('[Share] Feed post share failed:', error);

    if (message) {
      await Share.share({ message });
    }
  }
}
