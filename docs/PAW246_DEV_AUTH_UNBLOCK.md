# PAW-246 — Development auth unblock (AUTH-DEV)

**Date:** 2026-09-07  
**CTO:** 3ba8cc6c  
**Parent:** PAW-242 residual Pixel 6a cells (AUTH-DEV)  
**Authority:** `docs/PAWPLE_BETA_ARCHITECTURE_PRODUCT_CONTRACT.md` §3 / Local development — anonymous auth permitted only on development builds against a development project; forbidden in production.

## Verdict

**UNBLOCKED.** Anonymous sign-in enabled on development scratch project `uyhomshmzausgylxcwia` (`pawple-mating-chat-proof`). Device Welcome → **Continue with dev session** should succeed against Metro / debug APK using `.env.development`.

## Root cause

WelcomeScreen (`__DEV__`) correctly calls `supabase.auth.signInAnonymously()`. Hosted Auth on the scratch project had `external_anonymous_users_enabled=false`, so GoTrue returned `anonymous_provider_disabled` (422). UI copy was not lying about Dev Mode intent — the project config was out of sync with Product Contract local-dev allowance.

## Actions taken

| Project | Ref | Change | Proof |
|---------|-----|--------|-------|
| Scratch (dev Metro) | `uyhomshmzausgylxcwia` | `external_anonymous_users_enabled` → **true** | `POST /auth/v1/signup` with anon key → `user.is_anonymous=true` + access_token |
| Live (production) | `pexurgcfkxkouthuhlnb` | `external_anonymous_users_enabled` → **false** (was already **true** — contract violation) | Same signup → **422** |

Live was **not** modified to enable anonymous. It was found already enabled and was locked down to match Product Contract (“Development authentication must be impossible in staging and production”).

## Tester follow-up

**PAW-247** — Pixel 6a residual auth-gated cells (assigned Tester; parented under PAW-242 to avoid delegation_cycle).

## Tester instructions

1. Reuse installed APK `artifacts/debug/Pawple-debug-paw243-g2i4.apk` on Pixel_6a_New (no rebuild required for AUTH-DEV).
2. Confirm Metro / app env points at `https://uyhomshmzausgylxcwia.supabase.co` (scratch), not live.
3. On Welcome, tap **Continue with dev session** — must create a session (no 422).
4. Finish residual PAW-242 cells that needed auth:
   - Camera grant flows
   - Gallery picker UX (Choose from Library)
   - Notification OS prompt after pet submit
   - InviteCodeScreen visible prefill (after cold retain already PASS)

## Hard locks (unchanged)

No Mating/Chat product exercise beyond existing hide locks. No Logout/Delete, Location product, moderation. No production APK. Do not enable anonymous on live.

## Out of scope

No app code change. No APK rebuild. No OAuth provider setup. No Tester credentials created (anonymous path restored as the approved `__DEV__` path).
