/**
 * Client runtime environment gates.
 *
 * `__DEV__` is compiled by Metro/babel-preset-expo:
 * - `true` in local Metro dev (`expo start`, debug `expo run:ios` / `expo run:android`)
 * - `false` in release/staging binaries (iOS `--configuration Release`,
 *   Android `--variant release`, EAS production/staging profiles)
 *
 * Demo fixtures and dev-only auth must key off these flags — never a separate
 * runtime env var that could stay true in a store build.
 */

/** Local Metro / debug JS runtime (not staging or production store builds). */
export const isLocalDevRuntime = __DEV__;

/** Demo feed/meetup injection and local RSVP overlays — local dev only. */
export const isDemoContentEnabled = __DEV__;

/**
 * Build-time environment label (EAS profile / local .env).
 * Used for logging and safe release UI (e.g. staging banner) — not security gates.
 */
export const pawpleEnv =
  process.env.EXPO_PUBLIC_PAWPLE_ENV ?? (__DEV__ ? 'development' : 'production');

export const isStaging = pawpleEnv === 'staging';
export const isProduction = pawpleEnv === 'production';

/** Log environment contract at startup (dev/staging only). */
export function assertContractEnvironment() {
  if (!__DEV__ && isDemoContentEnabled) {
    console.error('[Pawple] Demo content gate must be off in release builds.');
  }

  if (__DEV__ || isStaging) {
    console.log('[Pawple] Environment:', {
      pawpleEnv,
      isLocalDevRuntime,
      isDemoContentEnabled,
      supabaseConfigured: Boolean(
        process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      ),
    });
  }
}
