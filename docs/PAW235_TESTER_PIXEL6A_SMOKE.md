# PAW-235 Tester — Pixel 6a smoke (PAW-222 after PAW-227)

**Date:** 2026-09-07  
**Tester:** d8a633e7  
**Parent Frontend:** PAW-227 (`done`)  
**Environment:** Pixel_6a_New AVD · `emulator-5554` · API 36 (`sdk_gphone64_x86_64`)  
**Authority:** `docs/CURRENT.md` Beta Hardening wave  
**Not used:** Production APK / Founder Pixel 10 Pro

## Verdict

**FAIL — incomplete Pixel 6a device E2E + native packaging defects.**

JS/unit surfaces for PAW-227 look landed and green. Controlled camera/gallery/notification/invite **device** matrices could not be completed: debug rebuild failed (Gradle transform cache), Expo Go stuck on splash / SDK prompt, installed `com.anonymous.Pawple` binary is **stale vs `app.json`**.

Hard findings for CTO / Frontend (do not waive):

| ID | Severity | Finding |
|----|----------|---------|
| **G2** | **P0** | `app.json` lists `READ_MEDIA_IMAGES` in `blockedPermissions`, but committed `android/app/src/main/AndroidManifest.xml` still **declares** `android.permission.READ_MEDIA_IMAGES`. Installed package still **requests** it (`dumpsys package`). G2 is not effective on the native binary until `android/` is regenerated / patched. |
| **I4** | **P0** | `app.json` declares HTTPS `pawple.com/invite` intentFilters, but native `AndroidManifest.xml` only has `pawple://` + `com.anonymous.Pawple` schemes — **no** `https://pawple.com/invite` filter. HTTPS invite deep-link cannot be claimed by the debug app as packaged. |
| **Rebuild** | Blocker for device proof | `npx expo run:android` → `:app:checkDebugAarMetadata` FAILED (`Could not read workspace metadata … transforms\…\metadata.bin`). Retry after cache clear stalled at same task. |
| **Expo Go** | Env | Non-interactive `expo start --android` blocked on Expo Go 2.32.20 vs 2.32.19 prompt. Manual `exp://10.0.2.2:8082` left Expo Go on blank splash (no RN tree). |

## Gate checks

| Gate | Result | Evidence |
|------|--------|----------|
| CURRENT.md Pixel 6a Tester path | PASS | No APK in wave |
| PAW-227 Frontend done | PASS | Paperclip status `done`; checklist comment 2026-09-07 |
| Map files present (JS) | PASS | `cameraCapture.js`, `inviteLinks.js`, `PhotoSourceSheet.js`, callers migrated |
| `EXPOSE_MATING_SURFACES` | PASS | `false` in `phase1aSurfaces.js` |
| Native G2 / I4 match app.json | **FAIL** | See AndroidManifest vs app.json above |
| Emulator online | PASS | `Pixel_6a_New` / `emulator-5554` |

## Automated tests (this heartbeat)

```text
node --test tests/unit/paw222-beta-hardening-frontend.test.js \
  tests/unit/add-pet-camera.test.js \
  tests/unit/camera-capture.test.js \
  tests/unit/invite-links.test.js
→ 36/36 pass, 0 fail
```

Covers: C1–C5 static contracts, N1–N5 honesty, I2 share/parse, G1 System Picker short-circuit, mating hide lock.

## Static / code smoke (not a substitute for device)

| Area | Result | Notes |
|------|--------|-------|
| Camera shared helper | PASS | `captureFromCamera` returns `captured`/`canceled`; single-flight + `abandonCameraCapture` |
| Call sites | PASS | CreateMoment / OnboardingPets / EditPet check `captured` |
| Gallery G1 JS | PASS | API 33+ short-circuit in `photoPicker.js` |
| Gallery G2 native | **FAIL** | Manifest still declares READ_MEDIA_IMAGES |
| Notifications N1 code | PASS | `requestNotificationPermission` after pet submit in OnboardingPets |
| N3/N4 Settings + AccountSheet | PASS | `openAppSettings`; no Switch; no morning-of UI copy in those files |
| N5 NotificationNudge | PASS | no morning-of body |
| Invites share builder | PASS | `https://pawple.com/invite/{CODE}` + mock Android/iOS `pawple.com` |
| Invite HTTPS parse (JS) | PASS | unit + `App.js` uses `parseInviteCodeFromUrl` |
| Invite I4 native HTTPS | **FAIL** | missing from AndroidManifest |
| Mating / Logout / Delete | CONFIRM (static) | hide lock false; not device-exercised (hard lock) |

## Device matrix cells

### Camera

| Cell | Result |
|------|--------|
| Fresh grant → one immediate camera | **NOT RUN** (no Metro-fresh binary) |
| Existing grant → immediate camera | **NOT RUN** |
| Rapid taps → one instance | **NOT RUN** |
| Leave mid-request → no later camera | **NOT RUN** |
| Create Moment / Onboarding / Edit Pet | **NOT RUN** |

CAMERA revoked on installed package for a future re-run (`pm revoke … CAMERA`).

### Gallery

| Cell | Result |
|------|--------|
| API 33+ Choose from Library without READ_MEDIA prompt | **NOT RUN** (G2 native FAIL; binary still declares permission) |
| Selection returns URI | **NOT RUN** |

### Notifications

| Cell | Result |
|------|--------|
| OS prompt after successful pet submit | **NOT RUN** |
| Deny still lands in app | **NOT RUN** |
| Settings / AccountSheet → system settings | **STATIC PASS** only |
| No morning-of UI / no fake toggle | **STATIC + UNIT PASS** |

POST_NOTIFICATIONS revoked on installed package for a future re-run.

### Invites

| Cell | Result |
|------|--------|
| Share text URL + Android/iOS mocks | **UNIT PASS** (`buildInviteShareMessage`) — share sheet not opened on device |
| Deep link retain/prefill (InviteCodeScreen) | **PARTIAL** — JS path present; **logged-in** `pawple://invite/PAW-TEST1` delivered to running Feed session with **no visible InviteCodeScreen** (expected: retain only via `rememberPendingInvite`, no nav). Cold unauthenticated prefill **NOT RUN**. |
| HTTPS `https://pawple.com/invite/…` opens Pawple | **FAIL expected** — no native HTTPS intent-filter; focus left null / not Pawple |

## Hard locks observed

- Did not touch Mating/Chat, Logout/Delete, Location product code, or moderation.
- Did not produce a production APK.
- Attempted **debug** `expo run:android` only (failed).

## Unblock / next owners

1. **Frontend** — regenerate or patch `android/` so `blockedPermissions` + HTTPS invite filters from `app.json` land in `AndroidManifest.xml` (tools:node remove for READ_MEDIA_IMAGES / ACCESS_FINE_LOCATION as Expo intends). Re-comment file checklist.
2. **CTO / env** — stabilize Gradle transforms cache on this workstation **or** provide a prebuilt debug APK for Pixel 6a (still not production store APK).
3. **Tester (re-wake)** — after native land + installable debug binary: fill Camera / Gallery / Notifications / Invite cold-prefill device cells; re-verify G2 via `dumpsys package` showing READ_MEDIA_IMAGES **absent**.

## Scratch evidence (run dir)

- Unit: 36/36 pass (inline above)
- Screenshots attempted: `paw235-installed-01.png`, `paw235-deeplink-scheme.png`, `paw235-deeplink-https.png`, `paw235-expo-go.png` under Paperclip run scratch (ephemeral)

## Handoff

CTO: PAW-235 smoke **FAIL**. Do not treat PAW-227 as device-proven. QA should not SIGN-OFF device matrices until G2/I4 native sync + Tester re-proof.
