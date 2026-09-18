# PAW-229 Tester — Pixel 6a hardening matrices (PAW-222)

**Date:** 2026-09-07 (final re-run after PAW-244 debug-binary unblock)  
**Tester:** d8a633e7  
**Parent:** PAW-222 / CTO map PAW-223 / Frontend PAW-227 + PAW-236  
**Authority:** `docs/CURRENT.md` (Beta Hardening wave)  
**Environment target:** Pixel 6a Android emulator (`Pixel_6a_New` / API 36)  
**Not used:** Founder Pixel 10 Pro / production APK  

## Verdict this heartbeat

**PASS — Pixel 6a hardening matrix complete.**

PAW-244 supplied the PAW-243 debug artifact. Tester reused it without rebuilding:
`artifacts/debug/Pawple-debug-paw243-g2i4.apk` (70,979,323 bytes).

Installed on `Pixel_6a_New` / API 36 at `2026-09-07 22:54:22`. G2 and I4
package contracts pass. PAW-242 / PAW-247 device evidence covers onboarding,
gallery selection, notification prompt and invite prefill. This final run
adds device proof for rapid camera taps, camera abandonment, Settings handoff,
native share payload, and invite re-click retention.

Hard locks respected: no Mating/Chat changes; Logout/Delete not exercised or
modified by Tester; no moderation install; no other permission families.

## Wake acknowledgment

| Comment | Effect on this run |
|---------|-------------------|
| CEO PAW-241 (`3c909365`) — zombie cleared; continue after PAW-236 | Treat PAW-236 as landed; ignore dead run `b8794f57`; attempt device matrices |
| PAW-244 direct child summary | Debug artifact is available and verified → install exact artifact, do not rebuild, finish remaining device cells |

## Gate checks

| Gate | Result | Evidence |
|------|--------|----------|
| CURRENT.md Pixel 6a Tester path | PASS | No Founder APK in wave; Pixel 6a only |
| PAW-236 done | PASS | Units + prior Paperclip done state |
| PAW-244 debug artifact | **PASS / DONE** | PAW-243 artifact reused; no Tester rebuild |
| Installable fresh debug binary | **PASS** | `adb install -r` → Success; `lastUpdateTime=2026-09-07 22:54:22` |
| Emulator | **PASS** | `Pixel_6a_New` / `emulator-5554` / API 36 |
| `EXPOSE_MATING_SURFACES` | PASS (confirm-only) | `false` in `src/config/phase1aSurfaces.js` |
| Installed G2 | **PASS** | `dumpsys package`: `READ_MEDIA_IMAGES_COUNT=0` |
| Installed I4 | **PASS** | HTTPS scheme; `pawple.com` + `www.pawple.com`; `/invite` prefix; query resolves Pawple |

## Automated tests (this heartbeat)

```text
node --test tests/unit/paw222-beta-hardening-frontend.test.js \
  tests/unit/add-pet-camera.test.js \
  tests/unit/camera-capture.test.js \
  tests/unit/invite-links.test.js
→ 37/37 pass, 0 fail
```

Covers: C1–C5 static contracts (incl. PAW-236 status spelling), N1–N5 honesty, I2 share/parse, G1 System Picker short-circuit, mating hide lock.

## Install (this heartbeat)

| Step | Result |
|------|--------|
| Boot Pixel 6a | PASS — `Pixel_6a_New`, API 36 |
| Reuse PAW-243 artifact | PASS — no Gradle / no rebuild |
| `adb install -r` | PASS |
| Package freshness | PASS — `lastUpdateTime=2026-09-07 22:54:22` |

## Matrix cells

### Camera

| Cell | Result |
|------|--------|
| Fresh grant → OS prompt when required → one immediate camera | **PASS** — PAW-247 onboarding; final-run Moment grant launched CaptureActivity in 853 ms |
| Existing grant → no unnecessary prompt → immediate camera | **PASS** — PAW-247 + final-run Moment re-open |
| Rapid taps → exactly one instance | **PASS** — six Camera taps during fresh grant produced one permission prompt and one camera history record |
| Navigation abandon mid permission/launch → no later camera | **PASS** — dismissed request, left flow, waited 6 s; launcher remained resumed; camera resumed count 0 |
| Moment create camera | **PASS** — final-run `Frame a Moment` → Camera → CaptureActivity |
| Onboarding / pet photo camera | **PASS** — PAW-247 URI applied; Add photo changed to Change photo |

### Gallery

| Cell | Result |
|------|--------|
| API 33+ Choose from Library without broad media prompt | **PASS** — PAW-247 System Photo Picker; final installed package has no `READ_MEDIA_IMAGES` |
| Selection returns usable URI | **PASS** — PAW-247 picker → crop → Change pet photo |

### Notifications

| Cell | Result |
|------|--------|
| OS prompt after successful pet submit (no primer) | **PASS** — PAW-247; deny still landed in Feed |
| Settings → opens OS settings | **PASS** — final run opened Android App info (`SpaActivity`) with Notifications row |
| No morning-of description in Settings/Account | **PASS** — device Settings observation + unit/static |
| No fake notifications toggle | **PASS** — device Settings has row only; unit confirms no AccountSheet Switch |

### Invites

| Cell | Result |
|------|--------|
| Share contains URL + Android/iOS mock fallbacks | **PASS** — native chooser preview showed warm copy, `https://pawple.com/invite/PAW-YQHQ2A`, Android/iOS `https://pawple.com` |
| Deep link retain / prefill | **PASS** — PAW-247 InviteCodeScreen showed `PAW-3600` |
| Re-click after install recovers code | **PASS** — cold HTTPS start opened Pawple; RKStorage contains `onboarding_pending_invite:pre_auth = PAW-3600` and user-scoped `PAW-3600` |
| HTTPS invite opens Pawple | **PASS** — cold explicit HTTPS launch → Pawple `MainActivity`; installed I4 filter confirmed |

### Confirm-only / hard locks

| Cell | Result | Notes |
|------|--------|-------|
| Mating / Matching / Chat still hidden | **PASS** | `EXPOSE_MATING_SURFACES = false`; device tabs show Feed / Create / Pets only |
| Logout / Delete untouched | **CONFIRM (not device-run)** | Hard lock; Tester made no implementation changes |

## Findings for CTO

No blocking functional defect reproduced in the authorized PAW-229 matrices.

Informational: bare HTTPS VIEW can still present Android's Pawple/Chrome chooser
until the user establishes a default. The package correctly claims the link and
explicit/re-click launches recover the code.

## Handoff

CTO / QA: **Tester PASS** on Pixel 6a for PAW-222 Camera, Gallery,
Notifications and Invite matrices. Focused tests are **37/37 PASS**. QA
PAW-230 must independently verify material claims; this is not QA sign-off.
