import { diagnosticLog } from './diagnosticLog';

/**
 * DEV-only trace for Add Photo → Camera/Gallery (modal handoff through native launcher).
 * Enable with EXPO_PUBLIC_PAWPLE_DIAGNOSTICS=flow or all in .env.development.
 * View: adb logcat *:S ReactNativeJS:V | findstr PawpleDiag
 */

let attemptSequence = 0;

/** @type {{ attemptId: string, source: 'camera' | 'gallery' } | null} */
let currentAttempt = null;

/**
 * @param {'camera' | 'gallery'} source
 * @returns {string}
 */
export function beginPhotoFlowAttempt(source) {
  attemptSequence += 1;
  const attemptId = `flow-${source}-${Date.now()}-${attemptSequence}`;
  currentAttempt = { attemptId, source };
  return attemptId;
}

export function getPhotoFlowAttempt() {
  return currentAttempt;
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [data]
 */
export function logPhotoFlow(event, data = {}) {
  const attempt = getPhotoFlowAttempt();
  diagnosticLog('flow', event, {
    attemptId: data.attemptId ?? attempt?.attemptId ?? null,
    source: data.source ?? attempt?.source ?? null,
    ...data,
  });
}
