import { diagnosticCamera } from './diagnosticLog';

let traceSequence = 0;

/** @returns {string} */
export function nextCameraTraceId(screen = 'unknown') {
  traceSequence += 1;
  return `${screen}-${Date.now()}-${traceSequence}`;
}

/**
 * @param {string} traceId
 * @param {string} event
 * @param {Record<string, unknown>} [data]
 */
export function logCameraTrace(traceId, event, data) {
  diagnosticCamera(event, {
    traceId,
    ...data,
  });
}
