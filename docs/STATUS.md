# PAWPLE — CEO STATUS

This file is a working status record maintained by the CEO.
It does NOT supersede Founder authorization in CURRENT.md.

## Current State

**Active execution wave:** **PAW-222 Beta Hardening / Pre-APK** (Camera · Gallery · Notifications · Image Safety · Invites). Kickoff: `docs/PAW222_BETA_HARDENING_WAVE.md`.  
**Gate status:** Units **37/37** after PAW-236. Tester device matrices **FAIL/NOT RUN**. Debug binary blocked by **host Gradle contention** — CEO serialized: **CTO PAW-243** sole `assembleDebug`; Frontend **PAW-244** stand down / accept CTO APK if it meets acceptance; **PAW-245** stood down. Tester blocked on PAW-244; QA on Tester. Founder moderation ask pending. **No Founder APK.**  
**Design Wave 3** (PAW-136): Constitution recorded; Founder feel-pass still pending; not the active engineering queue.  
**Mating:** Code preserved. Confirm intact only in PAW-222 — **no Mating/Matching/Chat changes**. `EXPOSE_MATING_SURFACES = false`.  
**PAW-195:** Repair/test wave **complete**. Controlled Beta ready (scratch + local test flag only). **NO-GO production expose**.  
**Store:** Still blocked on **PAW-52** staging smoke (secrets **PAW-55**, RLS apply **PAW-56**).  
**APK:** Not part of PAW-222. Founder builds after Tester + QA PASS. **Do not authorize APK while QA VETO stands.**

Phase 1b / Final Phase 1 remain held.

## Org-wide Definition of Done (PAW-116, immediate)

No user-facing wave closes without:

1. Product Designer emulator walkthrough as a first-time user
2. Founder feel-pass

QA SIGN-OFF requires the designer feel-checklist green.

## Design Wave 3 — PAW-136 (active)

Founder binding Design Constitution. Supersedes Wave 2 F1 copy and F3 primers. F4, invite freeze, mating/chat hide, Community toggle, and details-card alignment stay.

| Issue | Owner | Work | Status |
|-------|--------|------|--------|
| PAW-136 | CEO | Constitution lock; wave coordination; Founder feel-pass | **in_review** — confirmation card posted; awaiting Founder |
| PAW-137 | Copywriter | Under-18 decline (≤2 sentences) + OS permission strings | **done** |
| PAW-138 | Frontend | Remove primers / Use my city / adult headline; quiet Birthday | **done** |
| PAW-139 | Product Designer | Feel-walk vs pre-Wave-2 baseline; VETO friction | **done — GREEN** |
| PAW-140 | QA | Device-verify each removal; SIGN-OFF | **done — SIGN-OFF** |

**Wave 3 report (Founder item 5; PAW-138):** Use my city + type-your-city helper → typed city + optional one-liner. Camera/photos/location primers → OS prompt at moment of need. Adult-path About You copy → Birthday. + Continue. Under-18 Wave 2 copy → PAW-137 (≤2 sentences). OS strings in `app.json`.

**Birthday:** quiet field on About You. Label “Birthday.” Normal Continue. Attestation = DOB + server timestamp.  
**Decline:** under-18 terminal screen only. No stranger/adult-responsibility/meetup justification.  
**Permissions:** no primer sheets. OS prompt at moment of need. Optional city helper: “Only your city — never your exact location.”  
**Frozen:** `onboardingInvite.js`, `InviteCodeScreen.js`, `InviteSheet.js`. Mating/chat hidden. No EAS.  
**Residual (not a wave unblock):** unused `AgeGate` route still holds adult-product copy. Designer/QA confirm it is off the first-time journey.

## Design Wave 2 — PAW-126 (superseded in part)

F1 copy and F3 primers **superseded by PAW-136**. F4 remains. Founder feel-pass moved to Wave 3.

Founder binding feel-pass findings. CEO placement lock: birthday in the same About You step as name + city.

| Issue | Owner | Work | Status |
|-------|--------|------|--------|
| PAW-126 | CEO | Wave coordination; F2 lock; Founder feel-pass | **in_review** — confirmation card posted |
| PAW-127 | Copywriter | F1 adult/under-18 copy + F3 primer copy | **done** |
| PAW-128 | Product Designer | F1/F2/F3 specs + feel-checklist | **done** |
| PAW-129 | Product Strategist | F2 consult — agrees with CEO lock | **done** |
| PAW-130 | Frontend | F4 delete hardening | **done** |
| PAW-131 | Frontend | F1–F3 implement | **done** |
| PAW-132 | Product Designer | Emulator feel walk | **done — VETO** (under-18 OK exit; Photos primer) |
| PAW-134 | Frontend | Feel VETO remediations | **done** |
| PAW-135 | Product Designer | Re-walk after remediations | **done — GREEN** |
| PAW-133 | QA | Wave gate; code-path F4 | **done — SIGN-OFF** |

**F1/F2** birthday on About You with name + city; under-18 terminal decline; AgeGate retired as a journey destination.  
**F3** location/camera/photos primers before OS; notification primer spec-only (not shipped).  
**F4** client Storage cleanup before delete RPC; signOut + Welcome reset; boot guard for stale session.

**Residuals (QA, not wave blockers):** on-device delete → signup not executed in QA env; leftover `AgeGate` route unused; frozen invite files still differ from origin/main (Wave 1 uncommitted beta prefill, not a Wave 2 edit).

**Frozen:** `onboardingInvite.js`, `InviteCodeScreen.js`, `InviteSheet.js`. Mating/chat hidden. No EAS.

## Design Wave 1 — PAW-116

| Issue | Owner | Work | Status |
|-------|--------|------|--------|
| PAW-116 | CEO | Hire + DoD + wave coordination; Founder feel-pass | **in_review** — confirmation card posted |
| — | CEO | Seat `de5862b0` — Product Designer (UI/UX) | **done** |
| PAW-117 | Product Designer | Onboard + D1/D2/D3 specs + feel-checklist | **done** |
| PAW-118 | Copywriter | D1 welcome / quiet 18+ / D3 Hosted·Joined | **done** |
| PAW-119 | Frontend | Implement D1–D3; frozen invite files | **done** |
| PAW-120 | Product Designer | Emulator feel walk | **done — GREEN** |
| PAW-121 | QA | Gate; SIGN-OFF invalid without feel-checklist green | **done — SIGN-OFF** |
| PAW-122–125 | Frontend | D1 remediation (AgeGate copy, crash, pet persist, Complete) | **done** |

**D1** pet-first onboarding reorder (attestation never first; still mandatory before account creation).  
**D2** pet details card rhythm.  
**D3** Community Hosted/Joined on the same page; no My Meetups destination.

**Frozen:** `onboardingInvite.js`, `InviteCodeScreen.js`, `InviteSheet.js`. Mating/chat hidden.

## Founder `4ac03812` — hide wave (**pushed**)

| Issue | Owner | Work | Status |
|-------|--------|------|--------|
| PAW-112 | CTO | Audit + hide mating/intro-chat UI; keep code | **done** |
| PAW-113 | Copywriter | Phase 1a user-facing copy document | **done** (document only; not in app commit) |
| PAW-114 | Legal | Align legal/consent copy with hidden mating | **done** |
| PAW-115 | QA | Re-gate after hide | **done — SIGN-OFF** |

Commit includes: `src/config/phase1aSurfaces.js`, App.js stack gates, pet profile/edit/view gates, `legalDocuments.js`, `docs/CURRENT.md`, this STATUS. Excludes `opencode.json`.

## Phase 1a — Bulletin Board on `71b0d9a` (2026-09-01)

QA **SIGN-OFF** on PAW-110. Hide wave is the subsequent local commit after PAW-115.

| Area | In repo |
|------|---------|
| Age / tier | `account_tier` + `attest_adult_account` RPC; client sync via `src/lib/ageAttestationSync.js` |
| Location | City-only bulletin; Moments create path has no GPS payload |
| Meetups | City discovery + RSVP disclaimer; no group chat |
| Chat | Mutual-Paw intro **in code**; Phase 1a **hidden** via `EXPOSE_MATING_SURFACES` |
| Legal | User-facing Terms/Privacy/Guidelines do not offer mating; dormant mating legal exports preserved |
| Feed | Pet-first; no engagement metrics |

### Wave tickets (Bulletin Board — **done**)

PAW-95 (CTO architecture) → PAW-96–100 (engineering) → PAW-101/107 (legal) → PAW-102/108/109 (onboarding) → PAW-103 VETO → PAW-104–106 remediation → **PAW-110 SIGN-OFF**.

Cancelled: PAW-85–94 (13+ teen scope superseded by `66e02a99`).

## Residual risk (QA, not wave blockers)

- Live RLS / staging apply not run in the QA environment (`test:rls` needs staging secrets).
- Runtime UI (Expo) not exercised in that gate.
- Unit: 40/41; one pre-existing `age-gate.test.js` date flake.

## Store / pre-store (still open)

| Issue | Work | Status |
|-------|------|--------|
| PAW-52 | Staging smoke | **blocked** (CTO) |
| PAW-55 | Wire staging Supabase secrets | **blocked** (CTO) — unblocks PAW-52 |
| PAW-56 | Apply Honesty migrations + `test:rls` on staging | **blocked** (Backend) |
| PAW-53 | Pre-store: server-side age attestation | **blocked** (Backend) — Phase 1a shipped `attest_adult_account`; issue not closed |

## Org (authorized hires in place)

Product Designer (UI/UX) (`de5862b0`) → CEO (peer of CTO/Engineering).  
Tester (`d8a633e7`) → CTO · Marketing Head (`68d10457`) → CEO · Copywriter (`36a30e71`) → Marketing Head.

## Last Updated

2026-09-03 — PAW-126 children complete. Designer GREEN (PAW-135), QA SIGN-OFF (PAW-133). Founder feel-pass confirmation posted. No EAS preview until feel-pass. Hide wave remains on origin/main (`70f503d`). Remaining production gate is PAW-52 staging smoke.
