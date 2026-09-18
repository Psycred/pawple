import Toast from 'react-native-toast-message';
import { ensurePhotoValidationReady } from '../contexts/PhotoValidationContext';
import { REASON } from '../validation/reasonCodes';
import { isLocalPhotoUri } from './photoUri';

/** PAW-224 reject copy — calm, no AI/NSFW jargon in the UI. */
const REJECT_COPY = {
  [REASON.NSFW_DETECTED]: {
    title: "This photo can't be used.",
    message: 'Choose a photo without explicit content.',
  },
  [REASON.NO_ANIMAL]: {
    title: "That doesn't look like a pet.",
    message: 'Choose another photo',
  },
  [REASON.NSFW_CHECK_FAILED]: {
    title: "This photo can't be used.",
    message: 'Try again in a moment',
  },
  [REASON.ANIMAL_CHECK_FAILED]: {
    title: "That doesn't look like a pet.",
    message: 'Try again in a moment',
  },
  [REASON.MODELS_NOT_READY]: {
    title: "Couldn't check this photo",
    message: 'Try again in a moment',
  },
  [REASON.INVALID_IMAGE]: {
    title: 'Photo',
    message: 'Choose another photo',
  },
};

export function getPhotoRejectCopy(result) {
  return (
    REJECT_COPY[result?.reason] || {
      title: "This photo can't be used.",
      message: 'Choose another photo',
    }
  );
}

export function showPhotoRejectAlert(result) {
  const copy = getPhotoRejectCopy(result);
  Toast.show({
    type: 'error',
    text1: copy.title,
    text2: copy.message,
    position: 'bottom',
    visibilityTime: 2600,
  });
}

/**
 * Runs on-device NSFW + animal checks for a local picker URI.
 * Remote URLs are skipped — they were validated on upload.
 */
export async function gateLocalPhotoUri(uri, { ready, validatePhoto } = {}) {
  if (!uri || !isLocalPhotoUri(uri)) {
    return { accepted: true, skipped: true };
  }

  let prepared;
  try {
    prepared = await ensurePhotoValidationReady();
  } catch (error) {
    console.error('[PhotoValidationGate] prepare failed', error);
    return {
      accepted: false,
      reason: REASON.MODELS_NOT_READY,
      skipped: false,
    };
  }

  const validator = prepared?.validatePhoto ?? validatePhoto;
  const isReady = prepared?.ready ?? ready;

  if (!isReady || typeof validator !== 'function') {
    return {
      accepted: false,
      reason: REASON.MODELS_NOT_READY,
      skipped: false,
    };
  }
  const result = await validator(uri);
  return { ...result, skipped: false };
}

export async function assertLocalPhotoPassesGate(uri, { ready, validatePhoto }) {
  const result = await gateLocalPhotoUri(uri, { ready, validatePhoto });
  if (result.skipped || result.accepted) {
    return result;
  }
  const error = new Error(getPhotoRejectCopy(result).title);
  error.code = result.reason;
  error.validationResult = result;
  throw error;
}

/** Returns true when the picked local URI may be kept in UI state. */
export async function approvePickedPhotoUri(uri, { ready, validatePhoto }) {
  const result = await gateLocalPhotoUri(uri, { ready, validatePhoto });
  if (result.skipped || result.accepted) {
    return true;
  }
  if (__DEV__) {
    console.log('[PhotoValidationGate] rejected', { reason: result.reason, uri: uri ? 'present' : 'missing' });
  }
  showPhotoRejectAlert(result);
  return false;
}
