import { Platform } from 'react-native';
import { isLocalDevRuntime } from '../config/environment';

const LOG_PREFIX = '[PawpleDiag';

/**
 * Dev-only structured logs for reproducing device bugs (camera, auth, etc.).
 *
 * Metro / debug builds (`expo start`, `expo run:android`):
 *   - `camera` namespace is ON by default
 *   - Set EXPO_PUBLIC_PAWPLE_DIAGNOSTICS in .env.development:
 *       camera          — camera path only (default)
 *       all             — every namespace
 *       camera,auth     — comma-separated list
 *       off             — disable all diagnostic logs
 *
 * Release APKs: diagnostics are always off (__DEV__ is false).
 *
 * View logs:
 *   - Metro terminal while `npx expo start`
 *   - Android: `adb logcat *:S ReactNativeJS:V` (filter PawpleDiag)
 */

function parseDiagnosticNamespaces() {
  const raw = String(process.env.EXPO_PUBLIC_PAWPLE_DIAGNOSTICS ?? 'camera')
    .trim()
    .toLowerCase();

  if (!raw || raw === 'off' || raw === 'false' || raw === '0') {
    return new Set();
  }
  if (raw === 'all' || raw === 'true' || raw === '1') {
    return new Set(['all']);
  }
  return new Set(
    raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

const enabledNamespaces = parseDiagnosticNamespaces();

export function isDiagnosticEnabled(namespace) {
  if (!isLocalDevRuntime) {
    return false;
  }
  if (enabledNamespaces.has('all')) {
    return true;
  }
  return enabledNamespaces.has(String(namespace ?? '').trim());
}

function formatPayload(payload) {
  if (payload == null) {
    return '';
  }
  try {
    return ` ${JSON.stringify(payload)}`;
  } catch {
    return ` ${String(payload)}`;
  }
}

/**
 * @param {string} namespace e.g. camera, auth, navigation
 * @param {string} event short snake_case event name
 * @param {Record<string, unknown>} [data]
 */
export function diagnosticLog(namespace, event, data) {
  if (!isDiagnosticEnabled(namespace)) {
    return;
  }
  const tag = `${LOG_PREFIX}:${namespace}]`;
  const line = `${tag} ${event}${formatPayload(data)}`;
  console.log(line);
}

/** Camera-specific helper — keeps call sites terse. */
export function diagnosticCamera(event, data) {
  diagnosticLog('camera', event, {
    platform: Platform.OS,
    apiLevel: Platform.OS === 'android' ? Platform.Version : undefined,
    ...data,
  });
}
