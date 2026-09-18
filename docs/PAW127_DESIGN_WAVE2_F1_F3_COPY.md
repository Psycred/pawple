# PAW-127 — Design Wave 2 F1 & F3 Copy Deliverable

**Owner:** Copywriter  
**Parent:** PAW-126  
**Authority:** `docs/CURRENT.md` (F1, F2, F3)  
**Status:** Final — ready for Product Designer specs + Frontend implementation  
**Date:** 2026-09-03

This document is copy-only. It does not authorize product, legal, or engineering changes.

---

## Scope

| Finding | Deliverable |
|---------|-------------|
| **F1** | Adult-path age copy + under-18 terminal decline copy |
| **F3a** | Location permission primer (ship in Wave 2) |
| **F3b** | Notification permission primer (**spec only** — no UI this wave) |
| **F3c** | Camera / photo primer consistency check + aligned strings |

**F2 placement (CEO lock):** Birthday lives in the same About You step as name + city. Under-18 decline is a **terminal screen** after eligibility fails — not an onboarding step. Attestation stays mandatory before onboarding completes; it must never be the first screen.

---

## F1 — Age copy

### Adult path (About You — integrated birthday)

Shown on `OnboardingUserScreen` (or successor) **with** name and city. No standalone age wall at either end of onboarding.

| Element | Copy | Notes |
|---------|------|-------|
| Age context line | **Pawple is for adults.** | Plain ask only. No justification. |
| Field label | **Birthday** | |
| Date control a11y | **Choose your birthday** | |
| iOS picker done | **Done** | |
| Step primary CTA | **Continue** | Quiet confirm — **not** “I’m 18 or older”. |

**Adult path — prohibited on this step**

- No meetup mentions  
- No Terms / Privacy mentions  
- No footnotes or helper paragraphs justifying 18+  
- No inline under-18 error on this screen (navigate to decline instead)

**Validation (implementation — not copy)**

- On Continue: if birthday → under 18, navigate to **UnderAgeDecline** (terminal).  
- If 18+, continue onboarding and persist attestation as today.

---

### Under-18 path (terminal decline screen)

Full-screen terminal after eligibility fails. User cannot proceed into onboarding.

| Element | Copy |
|---------|------|
| Title | **Pawple is for adults.** |
| Body | **You need to be 18 or older to use Pawple. Meetups with strangers need an adult who can take responsibility. A version with proper parental consent is on our road.** |
| Primary CTA | **OK** |

**Under-18 path — prohibited**

- No “soon”, no timeline, no waitlist promise  
- No Terms links  
- No secondary CTA to continue onboarding  
- No exclamation marks

**Dismiss behaviour (Frontend):** OK returns user to entry (Welcome) or exits onboarding stack. Terminal — no retry loop on this screen.

---

### Legacy `AgeGateScreen` (until F2 migration removes it)

If the late AgeGate path remains briefly during implementation, apply the same voice:

| Current (remove / replace) | Final |
|----------------------------|-------|
| `Pawple is for adults 18 and older.` | **Pawple is for adults.** |
| `I'm 18 or older` (button) | **Continue** |
| `Meetups also require an 18+ account holder.` (footnote) | **Remove** |
| Inline `You need to be 18 or older to use Pawple.` on adult path | **Remove** — use terminal decline screen |

---

## F3 — Permission primers

**Pattern (all primers):** Pawple-voice sheet or calm full-screen **before** the native OS permission dialog. T&C consent never substitutes runtime permission.

**Shared primer chrome**

| Element | Copy |
|---------|------|
| Primary CTA | **Continue** |
| Secondary CTA | **Not now** |
| Settings deep-link (post-denial only) | **Open Settings** |

---

### F3a — Location primer (**ship now**)

**Trigger:** User taps an explicit city-detection affordance on About You (e.g. “Use my location”) — **not** on passive app open for returning users in this wave unless Designer specs otherwise.

| Element | Copy |
|---------|------|
| Title | **Your city** |
| Body | **Pawple uses your city for nearby meetups. Only your city — never your exact location.** |
| Primary CTA | **Continue** → native OS location prompt |
| Secondary CTA | **Not now** → manual city entry |

**On decline / Not now**

- Dismiss primer; keep focus on the **City** text field.  
- Optional quiet hint below city field (only when location was declined): **You can type your city instead.**

**Product truth**

- City-level discovery only; no precise GPS shared with other users (per Phase 1a / legal).  
- Manual city entry is a valid, supported path — not a failure state.

---

### F3b — Notification primer (**spec only — do not ship UI in Wave 2**)

Push is **not** authorized in Wave 2. Store these strings for when push is authorized. Do **not** implement this primer UI in Wave 2.

| Element | Copy |
|---------|------|
| Title | **Gentle reminders** |
| Body | **When Pawple has reminders worth sending, we'll ask here first — not in Terms, and only when you choose.** |
| Primary CTA | **Continue** → native OS notification prompt (future) |
| Secondary CTA | **Not now** |

**Relationship to existing beta copy**

`NotificationNudge.js` (“Push notifications aren't part of beta…”) remains correct for beta surfaces. This primer is for the **future** OS prompt moment only.

---

### F3c — Camera & photo primers (consistency)

Apply the **same primer → OS prompt → calm decline** pattern as location.

#### Camera primer (before OS)

**Triggers:** Pet photo (onboarding / edit pet), moment capture (camera path).

| Element | Copy |
|---------|------|
| Title | **Camera** |
| Body | **For pet photos and moments with your pet.** |
| Primary CTA | **Continue** |
| Secondary CTA | **Not now** |

#### Photos primer (before OS)

**Triggers:** Pet photo gallery pick, moment gallery pick.

| Element | Copy |
|---------|------|
| Title | **Photos** |
| Body | **To choose a pet photo or moment from your library.** |
| Primary CTA | **Continue** |
| Secondary CTA | **Not now** |

#### Post-decline alerts (after OS denial — no primer repeat)

Replace inconsistent post-denial strings with:

| Context | Alert title | Alert body | Actions |
|---------|-------------|------------|---------|
| Camera (onboarding pet) | **Camera** | **You can skip the photo and continue.** | **Not now** · **Open Settings** |
| Camera (edit pet / moment) | **Camera** | **You can continue without the camera or enable access in Settings.** | **Not now** · **Open Settings** |
| Photos (any) | **Photos** | **You can continue without a photo or enable access in Settings.** | **Not now** · **Open Settings** |

**Files to align (Frontend):**

- `src/lib/createMomentPermissions.js` — update `MESSAGES` + ensure primer precedes `request*PermissionsAsync`  
- `src/lib/photoPicker.js` — primer before library request; align `showGalleryPermissionAlert` body  
- `src/screens/OnboardingPetsScreen.js` — primer before camera; align denial alert  
- `src/screens/EditPetScreen.js` — primer before camera; align denial alert  
- `src/screens/CreateMomentScreen.js` — primer before camera; align denial alerts  

**Remove / avoid**

- Generic `Permission needed to access camera.`  
- Primer body that promises features not in scope (no push, no mating, no DMs).

---

## Implementation checklist (for Designer + Frontend)

- [ ] F1 adult strings on About You with birthday (F2 placement)  
- [ ] F1 terminal under-18 decline screen  
- [ ] Remove meetup / Terms / justification copy from adult age path  
- [ ] F3a location primer + manual-city fallback on About You  
- [ ] F3c camera + photo primers before OS prompts; aligned post-decline alerts  
- [ ] F3b notification primer strings documented only — **no UI**  
- [ ] Retire or redirect legacy late `AgeGateScreen` adult path after migration  

---

## QA copy checks

1. Adult About You: only “Pawple is for adults.” + Birthday + Continue — nothing else about age.  
2. Under-18: terminal screen with road / parental-consent line — no “soon”.  
3. Location primer: exact city-only promise before OS dialog.  
4. Declined location → manual city still works.  
5. Camera / photo: primer appears before OS dialog in all three surfaces.  
6. No notification primer UI in Wave 2 build.  
7. No copy promises push, mating, or open DMs.

---

*Copywriter sign-off: PAW-127 complete. Recommendations only — implementation authorization remains with CEO / Founder scope in CURRENT.md.*
