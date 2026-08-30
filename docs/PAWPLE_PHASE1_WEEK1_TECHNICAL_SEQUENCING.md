# Pawple Phase 1 — Week 1 Technical Sequencing

**Owner:** CTO  
**Parent:** PAW-7 / PAW-15  
**Date:** 28 Aug 2026  
**Status:** Active coordination document  
**Sources:** `docs/PAWPLE_BETA_MVP_EXECUTION_PLAN.md`, `docs/PAWPLE_MVP_PHASE1_DELEGATION.md`, Product Contract §11

---

## 1. Purpose

This document is the CTO-owned **Week 1 execution order** for Phase 1 critical-path issues:

| Issue | Workstream | Owner | Current status (28 Aug) |
|-------|------------|-------|-------------------------|
| PAW-4 | A1 Backend/data audit | Backend / Data Engineer | in_progress |
| PAW-9 | A5 Account deletion RPC | Backend / Data Engineer | in_progress (blocked on PAW-4 findings) |
| PAW-10 | B1 Google + Apple OAuth | Frontend Engineer | in_progress |
| PAW-11 | C1 Disable demo injection | Frontend Engineer | in_progress |
| PAW-12 | B3–B5 Invite + onboarding | Frontend + Backend | blocked (PAW-10) |
| PAW-14 | F1 Notification copy honesty | Frontend Engineer | in_progress |

**Preservation principle:** Extend and correct the current codebase. Do not replace working meetup, moment, pet, or navigation architecture unless PAW-4 proves contract violation.

---

## 2. Week 1 critical path (Days 1–5)

```
                    ┌─────────────────────────────────────┐
                    │  PAW-4  A1 Backend audit (Backend) │
                    └──────────────┬──────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
   PAW-9 A5 delete RPC      A2 env implementation      A3/A4 follow-ups
   (after PAW-4 P0 list)   (after PAW-4 + A2 plan)      (RLS tests, migrations)

   PARALLEL (no PAW-4 dependency):
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ PAW-10  B1   │  │ PAW-11  C1   │  │ PAW-14  F1   │
   │ OAuth        │  │ Demo gates   │  │ Notif copy   │
   └──────┬───────┘  └──────────────┘  └──────────────┘
          │
          ▼
   ┌──────────────┐
   │ PAW-12 B3-5  │  ← starts when PAW-10 establishes real Supabase sessions
   └──────────────┘
```

### Day 1 — Unblock audit + start parallel frontends

| Priority | Issue | Action | Owner | Done when |
|----------|-------|--------|-------|-----------|
| P0 | PAW-4 | Complete read-only audit: schema inventory, RLS posture, RPC grants, migration replay from empty DB | Backend | Findings posted; P0/P1 gap list for A4–A6, D1 |
| P0 | PAW-10 | Wire Google + Apple OAuth via `expo-auth-session` → Supabase Auth; session restore on cold start | Frontend | Real provider session in dev Supabase project |
| P0 | PAW-11 | Confirm all demo paths gated by `src/config/environment.js` (`isDemoContentEnabled` / `__DEV__`); audit remaining `demoFeed.js` / `demoMeetupRsvp.js` call sites | Frontend | Release build cannot inject demo content |
| P1 | PAW-14 | Remove notification over-promises in `NotificationNudge.js`, `OnboardingFinalScreen.js` | Frontend | Copy matches deferred push capability |

**CTO coordination:** Do not start PAW-9 implementation until PAW-4 publishes the canonical table list and deletion scope. Do not start PAW-12 until PAW-10 proves OAuth session → invite screen routing.

### Day 2 — Audit completion + OAuth hardening

| Priority | Issue | Action | Owner | Done when |
|----------|-------|--------|-------|-----------|
| P0 | PAW-4 | Finish gap analysis; confirm `onboarding_completed_at` migration (already in repo) aligns with B4 | Backend | Issue marked done with audit doc in comments |
| P0 | PAW-10 | Staging OAuth redirect URIs documented; sign-out clears session + active pet | Frontend | B2 session lifecycle verified |
| P0 | PAW-11 | Remove any remaining direct `__DEV__` demo checks that bypass `environment.js` | Frontend | Single gate module for demo content |

**Backend → Frontend handoff (PAW-4):**
- Canonical tables and FK delete order for account deletion RPC
- RLS policies that must hold in all three Supabase projects
- Storage bucket names and folder conventions (`{userId}/…`)
- RPC inventory (`get_meetup_participant_count`, etc.)

### Day 3 — Account lifecycle spec + invite prep

| Priority | Issue | Action | Owner | Done when |
|----------|-------|--------|-------|-----------|
| P0 | PAW-9 | Draft `delete_user_account` RPC spec from PAW-4 findings; no implementation without audit sign-off | Backend | Spec posted; child migration issue if needed |
| P0 | PAW-12 | Backend: invite validation RPC contract (validate without consume) | Backend | API contract documented |
| P0 | PAW-12 | Frontend: flow skeleton — auth → validate invite → profile → pets → consume → complete | Frontend | Blocked on PAW-10 session only |

### Day 4 — Environment implementation kickoff

| Priority | Issue | Action | Owner | Done when |
|----------|-------|--------|-------|-----------|
| P0 | A2 | Implement env-based Supabase client per `docs/PAWPLE_A2_ENVIRONMENT_CONFIG_PLAN.md` | Backend + Frontend | `src/config/supabase.js` reads `EXPO_PUBLIC_*`; no hardcoded prod URL |
| P0 | A3 | Verify all 24 migrations apply cleanly to fresh staging project | Backend | Documented recreate procedure |
| P1 | PAW-14 | QA pass on settings/legal screens for notification language | Frontend | F1 complete |

**Gate:** A2 Supabase project provisioning requires CEO approval for staging + production project creation (credentials in secret store, not repo).

### Day 5 — Integration checkpoint

| Checkpoint | Criteria |
|------------|----------|
| Auth | OAuth session persists; dev anonymous auth only in Metro/debug |
| Demo | Staging release build shows empty states, not fabricated feed |
| Backend | PAW-4 done; PAW-9 spec approved; staging DB matches migrations |
| Onboarding | PAW-12 unblocked if PAW-10 done; invite flow uses authenticated user |
| Notifications | PAW-14 copy honest |

---

## 3. Dependency matrix

| Issue | Blocks | Blocked by | Notes |
|-------|--------|------------|-------|
| PAW-4 | PAW-9, A2 impl, A4, A6 | — | Week 1 gate for backend confidence |
| PAW-9 | C5 (delete UI wiring) | PAW-4 | Spec can start Day 3; impl after audit |
| PAW-10 | PAW-12 | — | Critical path for all user testing |
| PAW-11 | F3 smoke (partial) | — | Independent; aligns with A2 demo policy |
| PAW-12 | Beta onboarding loop | PAW-10 | Backend invite RPC can proceed in parallel |
| PAW-14 | F3 smoke (partial) | — | Independent copy fix |
| A2 (PAW-15 plan) | Staging smoke, prod isolation | PAW-4 storage/RLS confirmation | Plan delivered; impl Day 4+ |

---

## 4. Cross-team coordination rules

### Backend / Data Engineer

1. PAW-4 is read-only until findings posted — no silent schema changes.
2. Publish deletion scope before PAW-9 writes migrations.
3. Own Supabase project provisioning checklist (staging first, production last).
4. Apply migrations to staging before Frontend points staging builds at it.

### Frontend Engineer

1. PAW-10 and PAW-11 can proceed without waiting for PAW-4.
2. All demo/dev gates must use `src/config/environment.js` — not ad hoc env vars that could leak into release builds.
3. PAW-12 must not consume invites before pet creation succeeds (Product Contract).
4. Do not wire delete/export UI until Backend RPCs exist (PAW-9 / A6).

### CTO

1. Resolve sequencing conflicts between streams.
2. Escalate product ambiguity (invite policy, OAuth provider delays) to CEO.
3. Block external beta users until A4 RLS tests pass — even if OAuth works.

---

## 5. Known risks (Week 1)

| Risk | Mitigation |
|------|------------|
| PAW-4 delayed | Frontend continues PAW-10/11/14; Backend starts PAW-9 spec from execution-plan gaps only |
| OAuth provider setup slow | Use dev Supabase + anonymous auth in Metro only; staging OAuth URIs prepared early |
| Single Supabase project today | A2 plan provisions isolated projects; current `pexurgcfkxkouthuhlnb` becomes **dev** until staging ready |
| Demo code in release | PAW-11 + `__DEV__` compile-time gate; staging smoke on Day 5 |
| Storage policies manual | PAW-4 must inventory dashboard-only policies; codify in migration or runbook |

---

## 6. Week 1 exit criteria

- [ ] PAW-4 audit complete with P0/P1 gap list
- [ ] PAW-10 OAuth establishes real Supabase sessions
- [ ] PAW-11 demo injection impossible in release builds
- [ ] PAW-14 notification copy contract-correct
- [ ] PAW-9 deletion RPC spec approved (implementation may spill to Week 2)
- [ ] PAW-12 unblocked and flow reorder in progress
- [ ] A2 environment plan approved; staging Supabase project provisioned or scheduled
- [ ] No production credentials in repository

---

## 7. Week 2 preview (not Week 1 scope)

- A4 RLS security test suite
- PAW-9 implementation + C5 client wiring
- PAW-12 completion (B4 `onboarding_completed_at` + AuthContext)
- A6 export RPC
- E stream gated on PAW-13 / Founder-approved mating spec
