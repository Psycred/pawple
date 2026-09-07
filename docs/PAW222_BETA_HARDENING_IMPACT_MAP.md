# PAW-222 — Beta Hardening Impact Map (Camera / Gallery / Notifications / Moderation / Invites)

**Authority:** Founder directive on PAW-222; Product Contract; `.cursorrules` Design Constitution (PAW-136)  
**Author:** CTO  
**Date:** 2026-09-07  
**Issue:** PAW-223 (map) → parent PAW-222 (wave)  
**Scope:** Architecture diagnosis + smallest isolated repair proposals only. **No product implementation in this ticket.**  
**Legal amendment (2026-09-07):** Incorporates PAW-225 CONDITIONAL-GO + PAW-226 disclosure advisory (comments on PAW-223). Does **not** reopen Mating/Chat.

---

## 0. Hard locks (binding)

| Lock | Status |
|------|--------|
| Mating / Matching / Chat — **no code changes** | **CONFIRMED intact; untouched by this map** |
| `EXPOSE_MATING_SURFACES = false` in `src/config/phase1aSurfaces.js` | **Must remain false** |
| Logout / Delete Account | **Do not touch** |
| Location / Microphone / Contacts / Bluetooth / Calendar permissions | **Do not touch** |
| Live Mating/Chat SQL | **Do not touch** |
| Unrelated refactor / nav redesign / dependency upgrades | **Out of scope** |
| APK build | **Not this wave** |
| Moderation model/API/deps install | **Founder approval required first** |

### Mating / Chat untouched confirmation (explicit)

Repo inspection for this map:

- `src/config/phase1aSurfaces.js` — `EXPOSE_MATING_SURFACES = false` still present; `areMatingSurfacesVisible()` fail-closed helper unchanged by this ticket.
- No proposed edits to mating services, screens, migrations, RPCs, or bottom-nav mating exposure.
- Implementation children of PAW-222 must treat Mating/Chat paths as **read-only / out of blast radius**.

---

## 1. Verdict (executive)

| Surface | Diagnosis | Wave action |
|---------|-----------|-------------|
| **Camera** | Real async lifecycle defect: **no shared in-flight guard**, divergent permission paths, Modal-over-camera race on onboarding | Smallest shared camera launch helper + screen abandon cancel |
| **Gallery** | Founder seeing **no** media prompt on Android is **likely correct** (System Photo Picker). Manifest still declares broad media permission unnecessarily | Prefer retain picker behaviour; strip/block unused Android media permission; do **not** add a prompt “because we expected one” |
| **Notifications** | Extra primer screen + Settings/AccountSheet control lies about disable; “morning-of” copy overpromises description | OS prompt after successful pet submit; Settings opens system settings when that is the only control; remove morning-of description copy |
| **Image moderation** | **Absent** for profile + Moments | Research only. Phase 1a path preference **(1) on-device → (2) Pawple ephemeral server → (3) external API**. **Founder tech approval** before install. **Do not enable** while `legalDocuments.js` still claims “no AI moderation” (PAW-226). Discard rejects by default |
| **Invites / deep links** | Share is code-only text; HTTPS invite URL + store fallbacks missing; prefill gaps; no App Links / Universal Links config | Legal **CONDITIONAL-GO**. CEO has lifted invite-file freeze in `CURRENT.md` for PAW-222 only. Coherent share + parse/retain/prefill; mock `pawple.com` fallbacks; no deferred deep link for Phase 1a |

Prefer the **smallest isolated repair**. Do not redesign Settings, onboarding chrome, or storage architecture unless required below.

---

## 2. Camera — P0

### 2.1 Shared path audit

| Surface | Entry UI | Permission API | Launch API | In-flight guard | Notes |
|---------|----------|----------------|------------|-----------------|-------|
| Pet onboarding | `PhotoPickerModal` → `OnboardingPetsScreen.pickPetPhoto('camera')` | `requestCameraPermissionJIT()` in `src/lib/permissions.js` (**always** `requestCameraPermissionsAsync`, no prior `get*`) | Direct `ImagePicker.launchCameraAsync` | **None** | Modal stays visible while permission/camera run |
| Create Moment | Inline buttons → `CreateMomentScreen.handlePickImage('camera')` | Inline `getCameraPermissionsAsync` + conditional `request*` | Direct `launchCameraAsync` | **None** | `denied` path alerts only — does **not** re-request when `canAskAgain` |
| Edit pet | `Alert` chooser → `EditPetScreen.pickPhoto('camera')` | `resolveCameraPermission()` in `createMomentPermissions.js` | Direct `launchCameraAsync` | **None** | Closest to desired permission semantics; still no in-flight lock |
| Dead code | `PhotoSourceSheet.js` | n/a | n/a | `setTimeout(120)` after close | **Unused import** — do not revive; delays forbidden as bug-masks |

Canonical helpers already exist (`resolveCameraPermission`, `pickFromGallery`) but **camera launch is not unified**. Symptoms (queued cameras, delayed open after navigation, fresh-account confusion) are consistent with **shared missing lifecycle**, not two unrelated UI bugs.

### 2.2 OS permission vs transient in-flight (binding distinction)

| Kind | Source of truth | May reset? |
|------|-----------------|------------|
| **OS camera permission** | Android/iOS via Expo ImagePicker `get/requestCameraPermissionsAsync` | **Never** via app flags. No `hasAskedCamera` persistence. Account delete does **not** reset OS permission for the same install. |
| **Transient in-flight** | Module/ref: `permissionRequestInFlight`, `cameraLaunchInFlight`, generation/token, mounted flag | Clear on success, cancel, deny, error, **unmount / blur abandon** |

**Fresh account / no prompt:** After Delete Account on the same install, OS may still report `granted`. No second OS dialog is **correct**. If permission is granted and camera still fails to open, that is a **launch/lifecycle** bug — not “forgotten OS state.” If OS reports `undetermined`/`denied`+`canAskAgain` and no dialog appears, that is a **request path** bug (Create Moment early-exit on `denied` without `canAskAgain` check; onboarding always-request path under Modal).

**Do not** use `setTimeout` / artificial delays to “wait for Modal to dismiss” as the primary fix. Close/dismiss sequencing must be awaitable (exit animation callback or launch **after** modal `onClose` completes), not timer-masked.

### 2.3 Root causes (mapped to Founder observations)

1. **Queued cameras / multi-instance** — no single-flight mutex; rapid taps call `launchCameraAsync` repeatedly on both Moment and onboarding.
2. **Delayed launch after navigation** — async permission/camera continues after leave; no abandon/cancel token; result may present on a later screen.
3. **Modal + camera race (onboarding)** — `PhotoPickerModal` awaits `onTakePhoto` while Modal `visible` remains true; OS permission sheet + camera compete with RN Modal.
4. **Divergent permission logic** — Create Moment does not use `resolveCameraPermission`; onboarding uses `requestCameraPermissionJIT` which skips “already granted → launch immediately without re-request ceremony” clarity and can confuse diagnostics.
5. **Not** primarily “missing OS purpose strings” — `app.json` / `expo-image-picker` plugin already set camera usage copy.

### 2.4 Proposed file changes (camera)

#### C1 — `src/lib/cameraCapture.js` (**new**, small)

| Field | Content |
|-------|---------|
| **Existing behaviour** | n/a |
| **Defective section** | n/a — shared defect lives in callers |
| **Proposed change** | Export `captureFromCamera(options)` that: (1) if in-flight → return `{ status: 'busy' }` / no-op; (2) `getCameraPermissionsAsync`; (3) if not granted and askable → `requestCameraPermissionsAsync`; (4) if blocked → `{ status: 'blocked' }`; (5) if granted → single `launchCameraAsync`; (6) clear in-flight in `finally`; (7) accept `AbortSignal` / generation so abandon cancels applying results |
| **Why required** | One lifecycle for Moments + pet photos; stops queueing; distinguishes OS vs transient |
| **Must remain unchanged** | Gallery path; location permissions; mating; logout/delete |
| **Regression risk** | Medium — all camera entry points must migrate |
| **Required test** | Pixel 6a: fresh grant → one camera; rapid taps → one instance; leave screen mid-request → no later camera; Edit Pet still works |

#### C2 — `src/screens/CreateMomentScreen.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Inline camera permission + launch; gallery via `pickFromGallery` |
| **Defective section** | `handlePickImage` camera branch (~183–237): no in-flight guard; `status === 'denied'` alerts without `canAskAgain` re-request |
| **Proposed change** | Delegate camera to `captureFromCamera(MOMENT_PICKER_OPTIONS)`; clear generation on blur/unmount; keep gallery path as-is |
| **Why required** | Founder: same defect on Moment create |
| **Must remain unchanged** | Moment save/upload/framing/caption flow; no moderation install here without Founder gate |
| **Regression risk** | Medium |
| **Required test** | Create Moment camera matrix (§ Founder §8) |

#### C3 — `src/screens/OnboardingPetsScreen.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | `PhotoPickerModal` → `pickPetPhoto` → JIT request + launch |
| **Defective section** | `pickPetPhoto` camera branch (~360–376); modal handlers that keep Modal open during capture |
| **Proposed change** | Use `captureFromCamera`; **close modal first** via existing exit animation callback, then launch (awaitable, not `setTimeout`); stop importing `requestCameraPermissionJIT` for this path |
| **Why required** | Pet photo is primary Founder repro path |
| **Must remain unchanged** | Onboarding save / invite redeem / pet insert; photo optional skip |
| **Regression risk** | Medium–high (onboarding critical path) |
| **Required test** | Onboarding Take Photo matrix on Pixel 6a |

#### C4 — `src/components/PhotoPickerModal.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Awaits `onTakePhoto` / library while Modal remains visible; closes only after success |
| **Defective section** | `handleTakePhoto` / `handleChooseLibrary` (~107–127) |
| **Proposed change** | On Take Photo: run exit → `onClose` → then invoke capture **or** have parent close then capture; never stack OS camera under live Modal. Prefer: option press → exit animation → callback with `source` |
| **Why required** | Removes Modal/OS permission race without delay hacks |
| **Must remain unchanged** | Skip path; visual language (Copywriter may later soften emoji title — out of scope unless Frontend touches copy) |
| **Regression risk** | Medium |
| **Required test** | Grant permission with modal flow; cancel permission; skip |

#### C5 — `src/screens/EditPetScreen.js` (align only)

| Field | Content |
|-------|---------|
| **Existing behaviour** | `resolveCameraPermission` + launch; Alert chooser |
| **Defective section** | No in-flight guard |
| **Proposed change** | Switch camera branch to `captureFromCamera` for consistency |
| **Why required** | Prevent third divergent path recreating queue bug |
| **Must remain unchanged** | Library via `pickFromGallery`; save/update pet |
| **Regression risk** | Low–medium |
| **Required test** | Edit pet Take Photo once + rapid taps |

#### C6 — `src/lib/permissions.js` (`requestCameraPermissionJIT`)

| Field | Content |
|-------|---------|
| **Existing behaviour** | Always `requestCameraPermissionsAsync` |
| **Defective section** | Entire helper (~18–25) if unused after migration |
| **Proposed change** | Prefer deprecate callers → `resolveCameraPermission` / `captureFromCamera`. Do not expand JIT helper. Optional thin wrapper only if something else still imports it |
| **Why required** | Always-request obscures OS-already-granted vs need-prompt |
| **Must remain unchanged** | `openAppSettings`; location JIT |
| **Regression risk** | Low if call sites updated |
| **Required test** | Grep: no remaining camera callers of JIT |

#### C7 — `src/components/PhotoSourceSheet.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Unused; `setTimeout(120)` before camera/gallery |
| **Defective section** | Delay handlers (~16–24) |
| **Proposed change** | **Do not wire into product.** Optional delete only if Frontend wants dead-code cleanup **and** CEO/Founder accept tiny unrelated cleanup — otherwise leave untouched this wave |
| **Why required** | Delay pattern explicitly forbidden as a “fix” |
| **Must remain unchanged** | Active pickers (`PhotoPickerModal`, Alert chooser, Create Moment buttons) |
| **Regression risk** | None if left alone |
| **Required test** | n/a |

### 2.5 Camera — must not do

- Custom permission primer sheets  
- Persistent `hasAskedCamera` flags  
- Artificial delays to hide races  
- Touch Location / Microphone permissions  
- Change OS purpose-string product meaning beyond existing Pawple voice  

---

## 3. Gallery / Photos — P0

### 3.1 What is actually used

| Layer | Truth |
|-------|-------|
| **API** | `expo-image-picker` `~16.0.6` → `ImagePicker.launchImageLibraryAsync` via `src/lib/photoPicker.js` `pickFromGallery` |
| **Android 13+ (API 33+)** | Expo ImagePicker uses the **Android System Photo Picker**. Broad `READ_MEDIA_IMAGES` is **not required** for one-shot pick. `photoPicker.js` already short-circuits permission pre-request when `Platform.Version >= 33` |
| **Android ≤ 12** | Legacy storage/media permission may still be required — current `resolveGalleryPermission` path handles ask |
| **iOS** | Photo Library permission / limited access still applies; `accessPrivileges === 'limited'` treated as usable |
| **Expo vs OS** | Expo `getMediaLibraryPermissionsAsync` can report “not granted” while System Photo Picker still works — **do not** invent a prompt solely from Expo’s permission object on API 33+ |

### 3.2 Founder observation

“Gallery opens; no native gallery/media permission” on modern Android → **expected correct behaviour**, not a missing prompt defect.

### 3.3 Proposed file changes (gallery)

#### G1 — `src/lib/photoPicker.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Canonical gallery picker; Android 33+ skips media pre-request |
| **Defective section** | None for “missing prompt.” Keep logic |
| **Proposed change** | **Retain.** Optionally add a one-line comment citing Play Photo/Video policy + System Picker so implementers do not “fix” by adding prompts. No new permission UX |
| **Why required** | Prevent regression to broad-permission prompting |
| **Must remain unchanged** | `presentPhotoSourceChooser` Alert API; return-null on cancel |
| **Regression risk** | Low |
| **Required test** | Pixel 6a: Choose from Library opens picker **without** READ_MEDIA prompt; selection returns URI |

#### G2 — `app.json` Android permissions

| Field | Content |
|-------|---------|
| **Existing behaviour** | `android.permissions` includes `android.permission.READ_MEDIA_IMAGES` (and CAMERA, location, RECORD_AUDIO) |
| **Defective section** | Declaring `READ_MEDIA_IMAGES` while product only needs System Photo Picker → Play policy / over-permission risk |
| **Proposed change** | Move `READ_MEDIA_IMAGES` into `android.blockedPermissions` (alongside existing fine-location block) **if** QA confirms picker still works on Pixel 6a API 33+ emulator **and** a pre-33 sanity path is acceptable for Beta. Do **not** touch Location / Microphone entries beyond what is required to avoid breaking blockedPermissions merge — if RECORD_AUDIO is unused by gallery/camera crop, flag to Founder before removing (out of this surface unless confirmed unused) |
| **Why required** | Align manifest with real picker model; reduce Play rejection risk |
| **Must remain unchanged** | Camera permission; location coarse; iOS Info.plist photo/camera strings |
| **Regression risk** | Medium on older Android if Beta supports ≤12 |
| **Required test** | Emulator API 33+ gallery; document API ≤32 behaviour if still in Beta matrix |

#### G3 — Call sites (`OnboardingPetsScreen`, `CreateMomentScreen`, `EditPetScreen`)

| Field | Content |
|-------|---------|
| **Existing behaviour** | Already use `pickFromGallery` for library |
| **Defective section** | None for gallery permission |
| **Proposed change** | **No gallery permission changes.** Keep shared picker |
| **Why required** | Avoid dual gallery implementations |
| **Must remain unchanged** | Crop/aspect options per surface |
| **Regression risk** | n/a |
| **Required test** | Smoke only |

### 3.4 Gallery — must not do

- Add a media permission prompt “because Founder expected one”  
- Switch to a custom gallery that needs broad media access  
- Change Location / Microphone / Contacts / Bluetooth / Calendar  

---

## 4. Notifications — P0

### 4.1 Current architecture (repo truth)

| Piece | Role today |
|-------|------------|
| OS permission | `expo-notifications` via `src/lib/notifications.js` |
| After pets submit | Navigate to **`OnboardingFinalScreen`** — full custom primer (“Help Pawple feel local” + morning-of body) then optional `requestNotificationPermission` |
| Settings | Row “Notifications” + subtitle morning-of; tap → `requestNotificationPermission`; if denied → `openAppSettings`; if granted → clears nudge AsyncStorage key and **returns with no useful control** |
| AccountSheet | Switch bound to OS grant; when granted, switch disabled (`notificationsManagedByOS`); cannot turn off → **fake/trapped control** |
| Pawple preference column | Product Contract mentions `profiles.notification_enabled` for future push — **not used** in current client notification UI |
| Local scheduling | `meetupLocalNotifications.js` morning-of local reminders (capability exists; copy must not over-describe in Settings) |

**Conclusion:** Effective control is **OS-level only** today. There is **no** honest Pawple-level notification preference wired in Settings/AccountSheet. Do not invent a fake in-app toggle.

### 4.2 Required behaviour (Founder)

1. After **successful** pet-profile onboarding submit → trigger **native OS** notification permission (no custom primer required).  
2. Pet save succeeds regardless of allow/deny.  
3. If already granted → do not ask again.  
4. Settings: if the only real control is OS → **open system settings** (not a dead tap / fake switch).  
5. Remove morning-of **description** copy from Settings (and aligned surfaces). No replacement paragraph.

### 4.3 Proposed file changes (notifications)

#### N1 — `src/screens/OnboardingPetsScreen.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | After `completeOnboarding` → `navigation.replace('OnboardingFinal')` |
| **Defective section** | Post-save navigation (~635–642) defers OS prompt to primer screen |
| **Proposed change** | After successful save + `completeOnboarding`: if `!(await checkNotificationStatus())` → `await requestNotificationPermission()` (catch/ignore failures); then navigate to app entry (`MainTabs` / existing post-onboarding route). **Do not** block save on permission result |
| **Why required** | Founder §10 — OS prompt after successful pet submit |
| **Must remain unchanged** | Invite redeem atomicity; pet insert; active pet set; logout/delete |
| **Regression risk** | Medium (onboarding routing) |
| **Required test** | Fresh onboarding: pets save → OS notification dialog (when undetermined); Deny still lands in app; second run with grant → no re-prompt |

#### N2 — `src/screens/OnboardingFinalScreen.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Standalone primer + Enable / Not now |
| **Defective section** | Entire screen as required interstitial; morning-of body copy |
| **Proposed change** | **Remove from required onboarding path** (stop navigating here). Prefer delete registration only if unused; keep file temporarily only if other deep links reference it — default: unhook route from happy path. Aligns with Design Constitution: default is no screen |
| **Why required** | No custom notification primer |
| **Must remain unchanged** | `NOTIFICATION_NUDGE_SKIPPED_KEY` consumers until cleaned; avoid breaking imports — update Settings import if key moves |
| **Regression risk** | Medium |
| **Required test** | Onboarding no longer shows Final primer; app reachable |

#### N3 — `src/screens/SettingsScreen.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Notifications row with morning-of subtitle; tap requests permission or opens settings only when request fails |
| **Defective section** | Subtitle (~155); `handleManageNotifications` (~67–78) when already granted does nothing useful |
| **Proposed change** | Remove subtitle/description entirely. On press: **always** `openAppSettings()` (or: if undetermined → request once, else open settings). No fake toggle. No replacement helper paragraph |
| **Why required** | Founder §§11–12; honesty of control |
| **Must remain unchanged** | Settings group structure; Location / Photo rows already open settings; Invite / export / logout/delete |
| **Regression risk** | Low |
| **Required test** | Tap Notifications → system settings; no morning-of string in UI |

#### N4 — `src/components/AccountSheet.jsx`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Switch + morning-of subtitle; disable when OS granted |
| **Defective section** | Toggle UX (~177–198, ~268–287) |
| **Proposed change** | Replace Switch with pressable row that opens `openAppSettings` (same honesty as Settings). Remove morning-of subtitle. Do not write persistent `hasAskedNotifications` |
| **Why required** | Fake toggle / cannot disable |
| **Must remain unchanged** | Logout / Delete Account entry points and lifecycle modals |
| **Regression risk** | Medium (AccountSheet widely used) |
| **Required test** | Open AccountSheet → Notifications opens OS settings; no trapped On switch |

#### N5 — `src/components/NotificationNudge.js` (+ root re-export)

| Field | Content |
|-------|---------|
| **Existing behaviour** | Card with morning-of body |
| **Defective section** | Body copy (~12–14) |
| **Proposed change** | If still mounted anywhere: remove morning-of description or stop rendering component. Prefer remove call sites over rewrite |
| **Why required** | Founder copy lock |
| **Must remain unchanged** | Feed layout if nudge already unused — verify with grep |
| **Regression risk** | Low |
| **Required test** | Grep: no “morning-of” user-visible strings in Settings/Account/Onboarding |

#### N6 — `src/lib/notifications.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Safe dynamic import; get/request helpers |
| **Defective section** | None critical |
| **Proposed change** | Keep as canonical helpers. Optionally export `getNotificationPermissionSnapshot()` returning `{ status, canAskAgain, granted }` for Settings branching — **no** persistent app flags |
| **Why required** | Single permission module |
| **Must remain unchanged** | Guarded import crash safety |
| **Regression risk** | Low |
| **Required test** | Unit/smoke: module missing → false, no throw |

#### N7 — `src/lib/meetupLocalNotifications.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Schedules morning-of local notifications |
| **Defective section** | Out of copy scope; behaviour may remain |
| **Proposed change** | **No functional change in this wave** unless Frontend discovers scheduling without OS permission. Copy removal only elsewhere |
| **Why required** | Scope discipline |
| **Must remain unchanged** | Join/leave meetup flows |
| **Regression risk** | n/a |
| **Required test** | Optional: schedule skipped when OS denied |

### 4.4 Notifications — product note for CEO (not a silent change)

Removing `OnboardingFinalScreen` from the path is a **product/UX simplification already directed by Founder PAW-222 §10 + Design Constitution**. Implementation must not reintroduce a primer “for clarity.”

---

## 5. Image moderation — research only (Founder approval gate)

### 5.1 Current state

- Pet photos: local URI → `resolvePetPhotoUrl` → `uploadToSupabase` (`pet-photos`)  
- Moments: `processImageForPawple` → `uploadToSupabase` (`moments`) → DB insert  
- **No** pet-vs-human check, **no** NSFW/sexual check, **no** pre-storage gate  
- Legal copy in `src/content/legalDocuments.js` still asserts this launch does **not** use AI moderation / AI message scanning (Terms / Privacy / Guidelines)

Applies to **profile and Moments** (Founder §§13–14).

### 5.2 Two distinct problems

| Problem | Generic NSFW alone? | Need |
|---------|---------------------|------|
| Pet vs human / non-pet | **No** | Person/animal (or pet) signal |
| Nudity / sexual / obscene / bikini-style human | Partially | Dedicated NSFW / sexual classes |

### 5.3 Legal preference order (binding for path language) — PAW-225 / PAW-226

Ascending risk / disclosure burden. **State Phase 1a path in this order** so Legal can lock Privacy sentences after Founder tech approval:

| Rank | Path | Legal posture |
|------|------|---------------|
| **(1)** | **On-device** screening | Lowest disclosure / cross-border / processor risk. Prefer if Founder-approved tech can meet dual detection + Expo packaging |
| **(2)** | **Pawple-operated ephemeral server** | Image briefly processed on Pawple systems; no durable reject store; disclose transmission to Pawple servers |
| **(3)** | **External moderation API** | Highest risk. Requires **Founder material-tech approval** + Privacy processor disclosure + processor/cross-border diligence as **release conditions** |

**Release rule (PAW-226):** Do **not** enable any automated image gate while `legalDocuments.js` still says “no AI moderation.” Any Founder-approved path must ship in the **same release** as Honesty amendments to Privacy / Terms / Guidelines (quiet UI reject copy from PAW-224 stays non-technical). CURRENT.md “AI message scanning / automated **chat** moderation” freeze remains — image upload screening is separate and Founder-authorized.

**Rejected images (Legal / CEO default):** **Discard** — no durable reject storage unless Founder later authorizes retention (and then disclose retention).

### 5.4 Options evaluated (summary)

| Approach | Pros | Cons | Phase 1a fit |
|----------|------|------|--------------|
| **(1) On-device** dual classifiers (NSFW + person/pet) | Privacy; aligns Legal preference #1; offline possible | Expo/dev-client friction; APK size; dual iOS/Android; pet-vs-human incomplete on many NSFW-only SDKs; **client-only is bypassable** (UI ≠ security) | Prefer **if** Founder accepts packaging + residual bypass risk for invite-only Beta, **or** pairs with thin server assert |
| **(2) Pawple ephemeral server** (Edge Function + short-lived staging; self-hosted model **or** server-side call with keys never on client) | Server-enforced; gate before permanent Storage; staging TTL; Legal preference #2; Expo-friendly client | Ops/latency; if underlying classifier is still a vendor, disclose carefully (may become path #3 for Legal) | **CTO default recommendation for minimum credible + Legal-aligned** when on-device cannot meet dual detection under Expo constraints |
| **(3) External API** (Sightengine / Hive / similar) invoked from Edge Function | Accurate classes; fast to stand up; policy tunable | Cost; vendor dependency; processor + possible cross-border; highest Legal bar | **Only if** Founder material-tech approval + Privacy/processor diligence + same-release honesty copy |
| Client-only open-source TFLite alone | Cheap | Packaging hell; weak dual coverage; easy bypass | Reject as **sole** control |
| Human-only moderation | Simple | Not preventive | Insufficient vs Founder P0 |

### 5.5 CTO recommendation (minimum credible Phase 1a) — amended for Legal

**Do not install any moderation package/model in-repo until Founder approves a material technical path.**

**Phase 1a path for Founder decision (ordered — Legal can draft Privacy from this list):**

1. **On-device** — evaluate first for Beta if a credible Expo-compatible pair covers (a) person/pet for profile and (b) NSFW/sexual/bikini-style human for profile + Moments. If chosen: still prefer a **server allow-assert** on permanent upload for Moments/pet-photos so UI hide is not the only control.  
2. **Pawple-operated ephemeral server** — if on-device fails Expo/dual-detection bar: Edge Function `moderate-image` with short-lived **staging** prefix; classify; **discard rejects**; allow → existing permanent upload pipeline. Prefer Pawple-operated inference; if the function must call a vendor classifier, treat disclosure as **path (3)** conditions.  
3. **External API** — last resort; Founder material-tech approval + Privacy disclosure + processor/cross-border diligence + same-release `legalDocuments.js` honesty update are **hard release conditions**.

**Shared product behaviour (any approved path):**

- Gate **before** permanent Storage public URLs (profile + Moments).  
- Client shows Copywriter calm lines only (PAW-224) — never “AI,” model names, scores, or reason codes.  
- Moments policy: reject nudity/sexual/obscene/bikini-style human; do **not** ban ordinary humans-with-pets. Profile: reject obvious human/non-pet where pet photo expected.  
- Feature flag / kill-switch.  
- **Disclosure dependency:** Backend/Frontend must not flip the gate on until Legal/Copywriter honesty amendments land in the same release.

**Supersedes** the earlier draft that listed cloud vendor API as the unqualified “recommended minimum.” Legal risk order now binds path language; CTO still flags that **path (1) alone** is often incomplete on Expo for dual detection — Founder chooses among (1)/(2)/(3) with that technical constraint explicit.

### 5.6 Proposed file changes (moderation) — **gated; do not implement until Founder accepts a path**

#### M0 — `src/content/legalDocuments.js` (+ related legal surfaces) — **same-release dependency**

| Field | Content |
|-------|---------|
| **Existing behaviour** | Blanket “no AI moderation” / report-driven-only claims |
| **Defective section** | Terms / Privacy / Guidelines honesty lines (see PAW-226) |
| **Proposed change** | **Legal/Copywriter ownership.** Narrow claims: no AI **chat**/message scanning; disclose upload-time image screening for pet profile + Moments with path-specific wording matching Founder-approved (1)/(2)/(3). Must land **before or with** gate enablement — not after |
| **Why required** | PAW-226 release rule; misleading-claim risk |
| **Must remain unchanged** | Mating/Chat product freeze; no marketing “AI-powered safety” claims |
| **Regression risk** | Low technical; high compliance if skipped |
| **Required test** | Grep legal surfaces: no blanket “no AI moderation” while gate is on |

#### M1 — Backend: Edge Function + staging (paths **2** or **3** only)

| Field | Content |
|-------|---------|
| **Existing behaviour** | Direct client upload to public buckets |
| **Defective section** | Missing pre-storage safety gate |
| **Proposed change** | Add `moderate-image` + secrets as needed; staging prefix with TTL; **discard rejects** (no durable reject bucket). Path (3) adds vendor secret + diligence artifacts |
| **Why required** | Server-side enforcement for profile + Moments |
| **Must remain unchanged** | Bucket path convention `{userId}/…`; owner-scoped write RLS; Mating/Chat SQL |
| **Regression risk** | High if rushed; medium if flagged |
| **Required test** | NSFW fixture reject; clear pet accept; reject never persisted; unauthorized call rejected |

#### M1b — On-device modules (path **1** only, if Founder selects)

| Field | Content |
|-------|---------|
| **Existing behaviour** | n/a |
| **Defective section** | n/a |
| **Proposed change** | Install only Founder-approved on-device deps; run after pick/capture, before permanent upload; document Expo/dev-client implications. Prefer pairing with thin server assert |
| **Why required** | Legal preference #1 when technically credible |
| **Must remain unchanged** | No custom permission primers; no Mating; no unrelated upgrades |
| **Regression risk** | High (native packaging / APK size) |
| **Required test** | Pixel 6a fixtures; cancel/deny paths; no durable reject store |

#### M2 — `src/lib/supabase.js` `uploadToSupabase` / `src/lib/petPhotoUpload.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Upload then public URL |
| **Defective section** | No moderation hook |
| **Proposed change** | Call shared `assertImageAllowed(localUri | processed)` before permanent upload (both Moments + pet photos). Kill-switch off until legal honesty + Founder path approval |
| **Why required** | Single gate both surfaces |
| **Must remain unchanged** | Image processor resize/compress behaviour |
| **Regression risk** | Medium (upload latency) |
| **Required test** | Reject path never inserts moment / pet photo_url |

#### M3 — `src/screens/CreateMomentScreen.js` + onboarding/edit pet save paths

| Field | Content |
|-------|---------|
| **Existing behaviour** | Save assumes picked image OK |
| **Defective section** | Pre-upload UX |
| **Proposed change** | Surface calm rejection copy only; no technical codes |
| **Why required** | Founder §17 |
| **Must remain unchanged** | Framing UX; caption rules |
| **Regression risk** | Low–medium |
| **Required test** | User-visible copy review with Copywriter |

### 5.7 Founder approval gate (explicit)

> **STOP:** No npm packages, native modules, Edge Functions, vendor accounts, or Storage policy changes for moderation until Founder approves a material technical path among **(1) on-device / (2) Pawple ephemeral / (3) external API**.

> **STOP (release):** Do not enable the automated gate in Beta/production while `legalDocuments.js` still asserts blanket “no AI moderation.” Same-release Privacy/Terms/Guidelines honesty update is mandatory (PAW-226).

> **STOP (path 3):** External API additionally requires Founder material-tech approval + Privacy processor disclosure + processor/cross-border diligence.

> **Rejects:** Discard by default — no durable reject store without Founder authorization.

---

## 6. Invites / deep links — P0

### 6.0 Legal / freeze status (PAW-225)

| Item | Status |
|------|--------|
| Legal verdict | **CONDITIONAL-GO** (not STOP) |
| Invite-file freeze | **Lifted by CEO in `docs/CURRENT.md` for PAW-222 invite/deep-link work only** — Engineering may edit mapped invite files within Founder invite scope |
| Deferred deep-link vendor | **Not required** for Phase 1a |
| Mock store destinations | Honest `pawple.com` placeholders only — no fake Play/App Store chrome |

If Legal’s earlier “CEO must unfreeze” note still appears on tickets: **already satisfied** in CURRENT (2026-09-07). Do not wait on a second unfreeze.

### 6.1 Current behaviour

| Piece | Repo truth |
|-------|------------|
| Share payload (`InviteSheet`) | Plain text: `Join me on Pawple! Use code: {CODE}` — **no URL**, no Android/iOS fallbacks |
| Channels | WhatsApp + Email only (not full native share sheet) |
| Custom scheme | `app.json` `"scheme": "pawple"` |
| Parse | `App.js` `parseInviteCode` handles `hostname === 'invite'` / path `invite/` via `expo-linking` — suitable for `pawple://invite/CODE` |
| HTTPS / App Links | **No** `intentFilters` / `associatedDomains` for `pawple.com` |
| Retain | `storePendingInvite` / `getPendingInvite` (user + pre-auth AsyncStorage) — solid |
| Prefill gap | `InviteCodeScreen` initializes to `@PAW-3600` and does **not** hydrate from `getPendingInvite` / deep link on mount |
| Deferred deep link | **Not required** for Phase 1a (Founder §24) — re-click after install is enough |

### 6.2 Target coherent flow

One code-bearing URL (e.g. `https://pawple.com/invite/<CODE>`) in share text + warm intro + clickable **Android** / **iOS** mock links to `https://pawple.com` placeholders.

- Installed: open app → parse code → `storePendingInvite` → onboarding with code pre-applied (no manual entry).  
- Not installed: HTTPS page/fallback (can be minimal hosted page later) showing Android/iOS mocks.  
- After install: user clicks **same** invite link again → code recovered. **No** Branch/deferred SDK requirement.

### 6.3 Proposed file changes (invites)

#### I1 — `src/components/InviteSheet.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Code display + WhatsApp/Email with code-only text |
| **Defective section** | `sharePayload` (~179); share handlers (~181–210) |
| **Proposed change** | Build one message: Copywriter intro (1–2 lines, inclusive of adopted pets) + `https://pawple.com/invite/{CODE}` + Android/iOS lines linking mock `https://pawple.com`. Add native `Share.share` path for Messages/Messenger/share sheet; keep WhatsApp/Email if desired as thin wrappers over same body. Centralize URL builders in small helper |
| **Why required** | Founder §§18–25 |
| **Must remain unchanged** | Invite generation/RPC `ensure_user_invites`; TOTAL_INVITES; Mating |
| **Regression risk** | Low–medium |
| **Required test** | Shared text contains URL + code; WhatsApp opens; Share sheet works |

#### I2 — `src/lib/inviteLinks.js` (**new**, tiny)

| Field | Content |
|-------|---------|
| **Existing behaviour** | n/a |
| **Defective section** | n/a |
| **Proposed change** | `buildInviteUrl(code)`, `buildStoreFallbackUrls()` returning mock `pawple.com` Android/iOS placeholders, `buildInviteShareMessage({ code, copy })` so store URLs are one-constant swap later |
| **Why required** | Avoid redesign when real Play/App Store URLs arrive |
| **Must remain unchanged** | Redeem/validate logic in `onboardingInvite.js` |
| **Regression risk** | Low |
| **Required test** | Unit: code encoded in path; placeholders stable |

#### I3 — `App.js` (`parseInviteCode` + handler)

| Field | Content |
|-------|---------|
| **Existing behaviour** | Stores pending invite for `pawple://invite/...`-shaped URLs; does not navigate/prefill InviteCodeScreen |
| **Defective section** | `parseInviteCode` (~101–123) may miss `https://pawple.com/invite/CODE` depending on Linking parse; handler returns without routing refresh |
| **Proposed change** | Explicitly parse `https`/`http` hosts `pawple.com` / `www.pawple.com` path `/invite/:code` **and** custom scheme. On code: `storePendingInvite`; if unauthenticated stay; if in onboarding refresh pending code into AuthContext / navigate with param. Keep moment/meetup parsers untouched |
| **Why required** | Code-bearing HTTPS link is primary invite action |
| **Must remain unchanged** | Auth callback URLs; mating routes |
| **Regression risk** | Medium |
| **Required test** | Cold start + warm `pawple://invite/PAW-TEST`; HTTPS parse unit tests |

#### I4 — `app.json` (Android App Links / iOS Universal Links — minimal)

| Field | Content |
|-------|---------|
| **Existing behaviour** | Custom scheme only |
| **Defective section** | No intent filters / associated domains |
| **Proposed change** | Add Android `intentFilters` for `https://pawple.com/invite/*` and iOS associated domain **when** DNS/app-site-association can be hosted. For Pre-APK wave: at minimum ensure **custom scheme** link `pawple://invite/CODE` works in share fallback footnote if HTTPS not yet live; document hosting dependency for real `pawple.com` |
| **Why required** | Installed-app click opens Pawple |
| **Must remain unchanged** | Existing permission strings; mating flags |
| **Regression risk** | Medium (native config) |
| **Required test** | `adb` / Linking open invite URL on Pixel 6a |

#### I5 — `src/screens/InviteCodeScreen.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Defaults input to `@PAW-3600` |
| **Defective section** | Initial state (~26); no `useEffect` hydrate from pending invite |
| **Proposed change** | On mount: `getPendingInvite(user.id)` / AuthContext `pendingInviteCode` → prefill (no `@` noise); if valid pending exists, prefer auto-continue **or** show pre-filled field without forcing beta bootstrap default when a deep-link code is present. Keep bootstrap code only as empty-field Beta helper if product still requires it — do not overwrite a retained invite |
| **Why required** | “User should not manually enter the code” |
| **Must remain unchanged** | Validate-without-consume; own-invite error |
| **Regression risk** | Medium |
| **Required test** | Deep link → InviteCode shows retained code; re-click after install |

#### I6 — `src/contexts/AuthContext.js` / `src/lib/onboardingInvite.js`

| Field | Content |
|-------|---------|
| **Existing behaviour** | Pending invite storage + profile routing uses `pendingInviteCode` |
| **Defective section** | Mostly OK; ensure pre-auth → post-auth migrate remains |
| **Proposed change** | Only if gaps found: refresh `pendingInviteCode` state immediately after `storePendingInvite` from Linking. No schema change |
| **Why required** | Survive Welcome → Auth → InviteCode navigation |
| **Must remain unchanged** | Logout/delete session clearing behaviour (do not break); completeOnboarding consume rules |
| **Regression risk** | Medium if session clear mishandled |
| **Required test** | Pre-auth link → sign-in → code still present |

#### I7 — Backend

| Field | Content |
|-------|---------|
| **Existing behaviour** | `invites` table + redeem on onboarding complete |
| **Defective section** | None blocking share/deep-link retain |
| **Proposed change** | **No invite SQL required** for Phase 1a deep-link retain (AsyncStorage + existing columns). Hosting `pawple.com` fallback page is infra/content — not Supabase. Backend only if Edge Function later serves invite landing (optional; out of minimum) |
| **Why required** | Scope discipline |
| **Must remain unchanged** | Invite RLS; ensure_user_invites; Mating |
| **Regression risk** | n/a |
| **Required test** | Existing invite redeem integration tests still pass |

### 6.4 Invites — must not do

- Deferred deep-link vendor SDK for Phase 1a  
- Represent mock `pawple.com` store links as real listings  
- Mating/Chat invite coupling  

---

## 7. Cross-cutting constraints

1. **OS permission is source of truth** for Camera / Notifications / (legacy) Photos.  
2. **Transient guards only** for in-flight work — clear on abandon.  
3. **No custom permission primers** (camera/photos/notifications).  
4. **No delays to hide bugs.**  
5. **Logout / Delete Account / Mating / Location family** — blast-radius zero.  
6. **Copywriter** owns final invite + moderation user strings; Frontend uses placeholders only if blocked on copy.  
7. **Legal** — moderation CONDITIONAL-GO under path order (1)/(2)/(3) + same-release honesty; invite CONDITIONAL-GO with CURRENT freeze lift.  
8. **Disclosure lock:** automated image gate must not ship while `legalDocuments.js` still claims blanket “no AI moderation.”  
9. **Rejects:** discard by default.  
10. **Tester environment:** Pixel 6a Android emulator (not Founder Pixel 10 Pro).  

---

## 8. Implementation sequencing (after this map)

| Order | Owner | Work |
|-------|-------|------|
| 0 | **Founder** | Approve Phase 1a moderation **path (1)/(2)/(3)** before Backend/Frontend install anything for M* |
| 0b | **Legal + Copywriter** | Same-release Privacy/Terms/Guidelines honesty amendment (PAW-226) — **required before gate enablement** |
| 1 | **Frontend** | Camera lifecycle (C1–C5), Gallery manifest verify (G1–G2), Notifications (N1–N5), Invites UI/share/parse/prefill (I1–I6) — skip M* until Founder path + legal honesty ready |
| 2 | **Backend** | Only after Founder path approval: M1/M1b as applicable; invite backend **only if** hosting/API truly required (default: none) |
| 3 | **Copywriter** | Invite intro + moderation rejection lines; confirm notification rows have **no** description |
| 4 | **Legal** | Confirm honesty wording matches chosen path; path (3) processor diligence |
| 5 | **Tester** | Founder camera/gallery/notification/invite matrices on Pixel 6a |
| 6 | **QA** | Independent regression + hard-lock audit (Mating untouched, logout/delete untouched, no extra permissions) |

---

## 9. Explicit non-goals

- APK production build  
- Mating/Match/Chat exposure or SQL  
- Push notification pipeline / `device_tokens` productization  
- True deferred deep linking  
- Dependency upgrades unrelated to approved moderation  
- Settings redesign beyond Notifications honesty + copy removal  
- Enabling automated image gate without Founder path + legal honesty update  

---

## 10. Acceptance for PAW-223 (this ticket)

- [x] Impact map written at `docs/PAW222_BETA_HARDENING_IMPACT_MAP.md`  
- [x] Mating/Chat untouched confirmation  
- [x] Moderation recommendation with **Founder approval gate** called out  
- [x] Legal amendment: Phase 1a path stated as **(1) on-device → (2) Pawple ephemeral → (3) external API**; disclosure dependency + discard-rejects + invite CONDITIONAL-GO / freeze lift recorded  
- [x] No product implementation in PAW-223  

---

*End of CTO impact map.*
