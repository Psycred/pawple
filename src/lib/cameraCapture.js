import * as ImagePicker from 'expo-image-picker';
import { logCameraTrace } from './cameraCaptureDiagnostics';
import { logPhotoFlow } from './photoFlowDiagnostics';

/**
 * Shared camera launch lifecycle for Moments + pet photos.
 * Distinguishes OS permission (never reset by the app) from transient in-flight guards.
 */

let permissionRequestInFlight = false;
let cameraLaunchInFlight = false;
/** Bumped on abandon so in-flight results are discarded. */
let captureGeneration = 0;
/** Set for the duration of one captureFromCamera invocation — distinguishes real overlap from stale mutex. */
let activeCaptureInvocationId = null;

function isLegitimateCameraCaptureMutexHeld() {
  return activeCaptureInvocationId != null;
}

function clearStaleCameraCaptureMutex(traceId, screen) {
  if (!permissionRequestInFlight && !cameraLaunchInFlight) {
    return false;
  }
  if (isLegitimateCameraCaptureMutexHeld()) {
    return false;
  }
  permissionRequestInFlight = false;
  cameraLaunchInFlight = false;
  logCameraTrace(traceId, 'capture_stale_mutex_cleared', {
    screen,
    captureGeneration,
  });
  return true;
}

function traceIdFromLifecycle(lifecycle) {
  return lifecycle?.traceId ?? 'camera-unknown';
}

function isCaptureAbandoned(generation, signal) {
  return generation !== captureGeneration || Boolean(signal?.aborted);
}

/** Persistent "while using the app" grant — launch camera without re-prompting. */
function hasPersistentCameraAccess(permission) {
  return permission?.granted === true;
}

function summarizePermission(permission) {
  if (!permission) {
    return null;
  }
  return {
    granted: permission.granted,
    status: permission.status,
    canAskAgain: permission.canAskAgain,
  };
}

/**
 * Cancel applying any in-flight permission request / camera result.
 * Call on blur, unmount, or navigation away — does not change OS permission.
 */
export function abandonCameraCapture(reason = 'unspecified', meta = {}) {
  // Permission overlay can blur the screen without the user leaving — keep capture alive.
  if (reason === 'screen_blur' && (permissionRequestInFlight || cameraLaunchInFlight)) {
    logCameraTrace(meta.traceId ?? 'camera-abandon', 'abandon_skipped_permission_in_flight', {
      reason,
      screen: meta.screen,
      captureGeneration,
    });
    return;
  }

  const previousGeneration = captureGeneration;
  captureGeneration += 1;
  activeCaptureInvocationId = null;
  permissionRequestInFlight = false;
  cameraLaunchInFlight = false;
  logCameraTrace(meta.traceId ?? 'camera-abandon', 'abandon_called', {
    reason,
    screen: meta.screen,
    previousGeneration,
    nextGeneration: captureGeneration,
  });
}

/**
 * Single-flight camera capture.
 * Shared status contract (PAW-236 / call sites):
 *   busy | blocked | denied | canceled | abandoned | error | captured
 * Do not return success / cancelled — callers key off captured / canceled (US spelling).
 * @param {import('expo-image-picker').ImagePickerOptions} [options]
 * @param {{ signal?: AbortSignal, traceId?: string, screen?: string }} [lifecycle]
 */
export async function captureFromCamera(options = {}, lifecycle = {}) {
  const { signal } = lifecycle;
  const traceId = traceIdFromLifecycle(lifecycle);
  const screen = lifecycle?.screen ?? 'unknown';

  logCameraTrace(traceId, 'capture_start', {
    screen,
    permissionRequestInFlight,
    cameraLaunchInFlight,
    captureGeneration,
  });
  logPhotoFlow('capture_from_camera_start', { traceId, screen });

  if (permissionRequestInFlight || cameraLaunchInFlight) {
    if (!clearStaleCameraCaptureMutex(traceId, screen)) {
      logCameraTrace(traceId, 'capture_rejected_busy', {
        screen,
        permissionRequestInFlight,
        cameraLaunchInFlight,
        overlap: true,
      });
      return { status: 'busy', traceId, overlap: true };
    }
  }

  const generation = captureGeneration;
  activeCaptureInvocationId = traceId;
  permissionRequestInFlight = true;

  try {
    const current = await ImagePicker.getCameraPermissionsAsync();
    logCameraTrace(traceId, 'permission_current', {
      screen,
      generation,
      permission: summarizePermission(current),
    });
    logPhotoFlow('permission_resolve_return', {
      traceId,
      screen,
      phase: 'camera_read',
      permission: summarizePermission(current),
    });

    if (isCaptureAbandoned(generation, signal)) {
      logCameraTrace(traceId, 'capture_abandoned_after_permission_read', {
        screen,
        generation,
        currentCaptureGeneration: captureGeneration,
      });
      return { status: 'abandoned', traceId };
    }

    let granted = hasPersistentCameraAccess(current);

    if (!granted) {
      logCameraTrace(traceId, 'permission_request_start', { screen, generation });
      const requested = await ImagePicker.requestCameraPermissionsAsync();
      logCameraTrace(traceId, 'permission_request_result', {
        screen,
        generation,
        permission: summarizePermission(requested),
      });
      logPhotoFlow('permission_resolve_return', {
        traceId,
        screen,
        phase: 'camera_request',
        permission: summarizePermission(requested),
      });

      if (isCaptureAbandoned(generation, signal)) {
        logCameraTrace(traceId, 'capture_abandoned_after_permission_request', {
          screen,
          generation,
          currentCaptureGeneration: captureGeneration,
        });
        return { status: 'abandoned', traceId };
      }

      granted = hasPersistentCameraAccess(requested);
      if (!granted) {
        const status = requested?.canAskAgain === false ? 'blocked' : 'denied';
        logCameraTrace(traceId, 'permission_not_granted', { screen, status });
        return { status, traceId };
      }
    }

    permissionRequestInFlight = false;
    cameraLaunchInFlight = true;

    logCameraTrace(traceId, 'launch_camera_start', {
      screen,
      generation,
      mediaTypes: options.mediaTypes ?? ['images'],
    });
    logPhotoFlow('native_launch_start', {
      traceId,
      screen,
      launcher: 'launchCameraAsync',
      mediaTypes: options.mediaTypes ?? ['images'],
    });

    const launchStartedAt = Date.now();
    const result = await ImagePicker.launchCameraAsync({
      ...options,
      mediaTypes: options.mediaTypes ?? ['images'],
    });
    const launchElapsedMs = Date.now() - launchStartedAt;

    logCameraTrace(traceId, 'launch_camera_returned', {
      screen,
      generation,
      launchElapsedMs,
      canceled: Boolean(result?.canceled),
      assetCount: result?.assets?.length ?? 0,
      firstAssetUri: result?.assets?.[0]?.uri ? 'present' : 'missing',
    });
    logPhotoFlow('native_launch_return', {
      traceId,
      screen,
      launcher: 'launchCameraAsync',
      launchElapsedMs,
      canceled: Boolean(result?.canceled),
      assetCount: result?.assets?.length ?? 0,
    });

    if (isCaptureAbandoned(generation, signal)) {
      logCameraTrace(traceId, 'capture_abandoned_after_launch', {
        screen,
        generation,
        currentCaptureGeneration: captureGeneration,
        launchElapsedMs,
      });
      return { status: 'abandoned', traceId };
    }

    if (result?.canceled) {
      return { status: 'canceled', result, traceId };
    }

    return { status: 'captured', result, traceId };
  } catch (error) {
    logCameraTrace(traceId, 'capture_error', {
      screen,
      message: error?.message ?? String(error),
    });
    console.error('[CameraCapture]', error);
    return { status: 'error', error, message: error?.message, traceId };
  } finally {
    if (activeCaptureInvocationId === traceId) {
      activeCaptureInvocationId = null;
    }
    permissionRequestInFlight = false;
    cameraLaunchInFlight = false;
    logCameraTrace(traceId, 'capture_finally', {
      screen,
      permissionRequestInFlight,
      cameraLaunchInFlight,
    });
  }
}

/**
 * Camera capture after chooser UI closes — use from Alert / Modal callbacks.
 * @param {import('expo-image-picker').ImagePickerOptions} [options]
 * @param {{ signal?: AbortSignal, traceId?: string, screen?: string }} [lifecycle]
 */
export async function captureFromCameraAfterUiDismissed(options = {}, lifecycle = {}) {
  const traceId = traceIdFromLifecycle(lifecycle);
  const screen = lifecycle?.screen ?? 'unknown';

  logCameraTrace(traceId, 'deferred_capture_start', { screen });

  if (isCaptureAbandoned(captureGeneration, lifecycle?.signal)) {
    logCameraTrace(traceId, 'deferred_capture_abandoned_before_launch', {
      screen,
      captureGeneration,
    });
    return { status: 'abandoned', traceId };
  }

  return captureFromCamera(options, lifecycle);
}
