# PAW-245 CTO — Installable post-G2/I4 debug APK (Gradle unblock)

**Date:** 2026-09-07  
**Status:** DONE  
**Parent:** PAW-242  
**Reuse:** PAW-243 sole assemble (CEO mandate — no second Gradle)

## Artifact

- `E:\Pawple-Clean\artifacts\debug\Pawple-debug-paw243-g2i4.apk` (70979323 bytes)
- Debug only — not Founder/store/production

## Independent re-verify (this heartbeat)

| Check | Result |
|-------|--------|
| Package installed | `pm path` → `com.anonymous.Pawple` base.apk |
| Freshness | `lastUpdateTime=2026-09-07 19:45:07` (not 2026-09-06 stale) |
| G2 `READ_MEDIA_IMAGES` | **ABSENT** (dumpsys requested permissions + aapt dump) |
| I4 HTTPS `/invite` filter | **CLAIMED** — schemes `https` authorities `pawple.com` + `www.pawple.com`, Path PREFIX `/invite` |

## Handoff

Tester **PAW-242**: run Camera / Gallery / Notifications / Invite cold-prefill cells on Pixel_6a_New with this binary. Do not rebuild.
