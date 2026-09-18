# PAW-247 Tester — Pixel 6a residual auth-gated cells

**Date:** 2026-09-07  
**Tester:** d8a633e7  
**Parent:** PAW-242 (AUTH-DEV residual) · CTO unblock PAW-246  
**Authority:** `docs/CURRENT.md` Beta Hardening (PAW-222)  
**Environment:** Pixel_6a_New · `emulator-5554` · API 36 · Metro `8081`  
**APK:** `artifacts/debug/Pawple-debug-paw243-g2i4.apk` (reuse; no rebuild)  
**Supabase:** scratch `https://uyhomshmzausgylxcwia.supabase.co` via `.env.development`  
**Not used:** Production / Founder APK · live auth config

## Verdict

**PASS — AUTH-DEV CLOSED.** Residual PAW-242 auth-gated device cells completed on Pixel 6a after PAW-246 anonymous enable on scratch.

| Area | Result |
|------|--------|
| Welcome → Continue with dev session | **PASS** (no `anonymous_provider_disabled` 422) |
| Camera fresh grant → one immediate camera | **PASS** (Onboarding) |
| Camera existing grant → immediate | **PASS** |
| Create Moment / Onboarding / Edit Pet reachable | **PASS** (Onboarding device; Create Moment Camera/Gallery UI; Edit Pet unit C5) |
| Gallery G2 UX — Choose from Library w/o READ_MEDIA | **PASS** |
| Gallery selection returns URI | **PASS** |
| Notifications OS prompt after pet submit | **PASS** |
| Notifications Deny still lands in app | **PASS** (Feed) |
| InviteCodeScreen visible prefill after cold HTTPS | **PASS** (`PAW-3600`) |

## Prerequisites

| Check | Result | Evidence |
|-------|--------|----------|
| PAW-246 anon enable | **PASS** | `docs/PAW246_DEV_AUTH_UNBLOCK.md` |
| Hosted anon signup | **PASS** | `POST /auth/v1/signup` → `user.is_anonymous=true` + token |
| `.env.development` URL | **PASS** | `uyhomshmzausgylxcwia.supabase.co` |
| APK installed | **PASS** | `lastUpdateTime=2026-09-07 19:45:07` |
| `READ_MEDIA_IMAGES` absent | **PASS** | dumpsys count **0** before/after gallery |

## Automated tests (this heartbeat)

```text
node --test tests/unit/paw222-beta-hardening-frontend.test.js \
  tests/unit/add-pet-camera.test.js \
  tests/unit/camera-capture.test.js \
  tests/unit/invite-links.test.js
→ 37/37 pass, 0 fail
```

## Device matrix — residual cells

### AUTH-DEV

| Step | Result |
|------|--------|
| Welcome shows Dev Mode + Continue with dev session | **PASS** |
| Tap → session created; lands past Welcome | **PASS** (About you / InviteCode depending on retain) |
| No 422 `anonymous_provider_disabled` | **PASS** |

### Camera

| Cell | Result | Evidence |
|------|--------|----------|
| Fresh grant → OS prompt then one CaptureActivity | **PASS** | CAMERA `granted=false` → OS “take pictures…” → `com.android.camera2/...CaptureActivity`; then CAMERA `granted=true` |
| Existing grant → immediate camera, no OS prompt | **PASS** | Second Take Photo → CaptureActivity; `permission_prompt_shown=False` |
| URI applied on Onboarding | **PASS** | a11y `Add pet photo` → `Change pet photo` after Done/Crop |
| Create Moment reachable | **PASS** | Create menu → “Frame a Moment” with Camera / Gallery |
| Edit Pet camera path | **UNIT PASS** | C5 `captureFromCamera` |

### Gallery (G2 UX)

| Cell | Result | Evidence |
|------|--------|----------|
| Choose from Library opens system picker | **PASS** | `com.google.android.photopicker/...MainActivity` |
| No READ_MEDIA / GrantPermissions for media | **PASS** | No media permission dialog; `READ_MEDIA_IMAGES` still 0; `READ_EXTERNAL_STORAGE` remains `granted=false` |
| Selection returns URI | **PASS** | Picker → CropImageActivity → `Change pet photo` |

### Notifications

| Cell | Result | Evidence |
|------|--------|----------|
| OS prompt after successful pet submit | **PASS** | After Complete Setup: `GrantPermissionsActivity` “Allow Pawple to send you notifications?” |
| Deny still lands in app | **PASS** | Don’t allow → Feed (Tyson active); `POST_NOTIFICATIONS: granted=false` + `USER_SET` |
| Note | Info | First submit attempt (invalid retained `COLD-PREFILL1`) blocked save with invite toast — not a notification defect. Cleared/replaced with `PAW-3600` for N1/N-Deny. |

### Invites — InviteCodeScreen visible prefill

| Cell | Result | Evidence |
|------|--------|----------|
| Cold HTTPS open into Pawple | **PASS** | `am start … -n com.anonymous.Pawple/.MainActivity` with `https://pawple.com/invite/PAW-3600` |
| After Continue with dev session, InviteCodeScreen shows code | **PASS** | EditText value **`PAW-3600`** under “Enter your invite code” |
| I4-CHOOSER (info) | Still true | Bare `am start` VIEW without package opened Chrome once; packaging claim unchanged from PAW-242 |

## Defects for CTO

| ID | Severity | Finding |
|----|----------|---------|
| **AUTH-DEV** | — | **CLOSED** (scratch anonymous enabled; device session OK) |
| **I4-CHOOSER** | Info | Unchanged: unset default may show Chrome/Resolver for HTTPS invite until “Always” Pawple |
| **N1-RACE** | Info | On one earlier submit, Feed JS logged before the OS notif sheet was captured in UI dump; re-run with 1s poll caught the prompt stably. Not a product fail for this matrix. |

## Hard locks observed

- No Mating/Chat product exercise beyond hide lock unit.  
- No Logout/Delete, Location product exercise (location OS denied to continue), moderation.  
- No production APK; live Supabase auth config not touched.

## Handoff

CTO / QA: AUTH-DEV residual Pixel 6a cells are device-proven on the PAW-243 debug APK against scratch. Parent PAW-242 packaging PASS (G2/I4) plus this residual PASS closes the Pixel 6a auth-gated gap for PAW-222 Tester matrices. QA should independently verify material claims before wave SIGN-OFF.
