# PAWPLE — CEO STATUS

This file is a working status record maintained by the CEO.
It does NOT supersede Founder authorization in CURRENT.md.

## Current State

**Active wave:** **Phase 1a — 18+ Bulletin Board, mating/intro chat hidden** (Founder `4ac03812`)  
**Stage:** Hide/legal wave **QA SIGN-OFF** (PAW-115). Local commit authorized. **Push is Founder-gated.**  
**Mating:** Code preserved. User-facing entry points gated (`EXPOSE_MATING_SURFACES = false`).  
**Store:** Still blocked on **PAW-52** staging smoke (secrets **PAW-55**, RLS apply **PAW-56**)  
**Push:** Awaiting Founder authorization. No remote push until that confirmation.

Phase 1b / Final Phase 1 remain held.

## Founder `4ac03812` — hide wave (complete pending push)

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

Tester (`d8a633e7`) → CTO · Marketing Head (`68d10457`) → CEO · Copywriter (`36a30e71`) → Marketing Head.

## Last Updated

2026-09-02 — PAW-115 SIGN-OFF. Local hide/legal commit authorized. Push awaits Founder confirmation. Store still blocked on PAW-52.
