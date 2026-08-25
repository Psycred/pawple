import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

/** Strict "DD MMM YYYY" for share payload (matches feed). */
export function formatFeedPostDate(iso) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Native share: full text payload; uses expo-sharing when the image is already a local file URI.
 */
export async function shareFeedPost(post) {
  const dateLine = post.dateDisplay ?? formatFeedPostDate(post.createdAt);
  const message = [
    post.caption,
    '',
    post.identityLabel,
    post.location,
    dateLine,
    '',
    post.imageUri,
  ].join('\n');

  if (post.imageUri?.startsWith('file://')) {
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(post.imageUri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share this Pawple moment',
      });
      return;
    }
  }

  await Share.share({
    title: 'Pawple',
    message,
    ...(Platform.OS === 'ios' && post.imageUri?.startsWith('http') ? { url: post.imageUri } : {}),
  });
}
