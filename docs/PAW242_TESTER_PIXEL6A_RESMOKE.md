# PAW-242 Tester — Pixel 6a re-smoke after G2/I4 native sync

**Date:** 2026-09-07  
**Tester:** d8a633e7  
**Parent:** PAW-238 / PAW-237 · APK via PAW-243  
**Authority:** `docs/CURRENT.md` Beta Hardening (PAW-222)  
**Environment:** Pixel_6a_New · `emulator-5554` · API 36 · Metro `8081` (debug APK)  
**APK:** `artifacts/debug/Pawple-debug-paw243-g2i4.apk` (reuse; no Tester rebuild)  
**Not used:** Production / Founder APK

## Verdict

**PASS (updated 2026-09-07 via PAW-247).** G2/I4 packaging + HTTPS open + cold invite retain remain PROVEN. Residual auth-gated Camera / Gallery UX / Notification OS-prompt / InviteCode prefill cells completed after PAW-246 AUTH-DEV unblock — see `docs/PAW247_TESTER_PIXEL6A_AUTH_RESIDUAL.md`.

CTO comment `7ac060b5` unblocked install. Independent dumpsys confirms post-sync binary.

## Prerequisites (independent)

| Check | Result | Evidence |
|-------|--------|----------|
| Artifact present | **PASS** | `Pawple-debug-paw243-g2i4.apk` ~70.9 MB, 2026-09-07 19:41 |
| aapt: no `READ_MEDIA_IMAGES` | **PASS** | permissions dump |
| aapt: HTTPS `pawple.com` / `www` `/invite` | **PASS** | xmltree hosts + pathPrefix |
| Installed `lastUpdateTime` | **PASS** | `2026-09-07 19:45:07` |
| dumpsys `READ_MEDIA_IMAGES` | **PASS (absent)** | count **0** |
| HTTPS claim | **PASS** | dumpsys Scheme `https` + Authority `pawple.com` / `www.pawple.com` PREFIX `/invite` |
| `query-activities` HTTPS invite | **PASS** | includes `com.anonymous.Pawple/.MainActivity` (+ Chrome chooser) |
| `am start` HTTPS → Pawple | **PASS** | topResumedActivity = Pawple MainActivity |

## Automated tests

```text
node --test tests/unit/paw222-beta-hardening-frontend.test.js \
  tests/unit/add-pet-camera.test.js \
  tests/unit/camera-capture.test.js \
  tests/unit/invite-links.test.js
→ 37/37 pass, 0 fail
```

## Device matrix (PAW-235 re-run scope)

### Camera

| Cell | Result |
|------|--------|
| Fresh grant → one immediate camera | **PASS** (PAW-247) |
| Existing grant → immediate camera | **PASS** (PAW-247) |
| Rapid taps → one instance | **UNIT PASS** only |
| Leave mid-request → no later camera | **UNIT PASS** only |
| Create Moment / Onboarding / Edit Pet | **PASS** reachable (PAW-247; Edit Pet unit C5) |

### Gallery (G2)

| Cell | Result |
|------|--------|
| API 33+ packaging: no `READ_MEDIA_IMAGES` | **PASS** (dumpsys + aapt) |
| Choose from Library without READ_MEDIA prompt (UX) | **PASS** (PAW-247 — system Photo Picker) |
| Selection returns URI | **PASS** (PAW-247) |

### Notifications

| Cell | Result |
|------|--------|
| OS prompt after successful pet submit | **PASS** (PAW-247) |
| Deny still lands in app | **PASS** (PAW-247 → Feed) |
| Settings / AccountSheet → system settings | **UNIT/STATIC PASS** |
| No morning-of UI / no fake toggle | **UNIT PASS** |

### Invites (I4 + cold-prefill)

| Cell | Result |
|------|--------|
| Share URL + Android/iOS mocks | **UNIT PASS** |
| HTTPS `https://pawple.com/invite/…` opens Pawple | **PASS** (`am start` + query-activities) |
| Cold unauthenticated invite retain | **PASS** — RKStorage key `onboarding_pending_invite:pre_auth` = `COLD-PREFILL1` after cold HTTPS open |
| Prefill visible on InviteCodeScreen | **PASS** (PAW-247 — `PAW-3600` after cold HTTPS + dev session) |

## Defects for CTO

| ID | Severity | Finding |
|----|----------|---------|
| **AUTH-DEV** | — | **CLOSED** (PAW-246 + PAW-247 device proof) |
| **I4-CHOOSER** | Info | Unset default: `resolve-activity` shows system Resolver (Pawple + Chrome). Packaging claims Pawple correctly; user may see chooser until “Always”. |

## Hard locks observed

- No Mating/Chat product exercise beyond hide lock unit.  
- No Logout/Delete, Location product, moderation.  
- No production APK; reused CTO debug artifact only.

## Handoff

CTO / QA: **G2 + I4 native packaging on Pixel 6a is device-proven** on the PAW-243 APK. Invite HTTPS open + pre-auth retain proven. Residual auth-gated cells: **`docs/PAW247_TESTER_PIXEL6A_AUTH_RESIDUAL.md` (PASS)**.
