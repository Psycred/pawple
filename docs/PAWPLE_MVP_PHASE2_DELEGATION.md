# Pawple MVP — Phase 2 Delegation (Non-Mating)

**Parent:** PAW-7  
**Founder authorization:** 28 Aug 2026 — execute approved MVP roadmap for **all non-mating work**  
**Plan:** `docs/PAWPLE_BETA_MVP_EXECUTION_PLAN.md`  
**Mating gate:** Workstream E (E3/E4/E5) remains **blocked** on PAW-18 Founder sign-off of canonical spec rev 3+

## Phase 1 complete (verified)

| Issue | Workstream | Status |
|-------|------------|--------|
| PAW-4 | A1 Backend audit | done |
| PAW-9, PAW-17 | A5 Delete account RPC | done |
| PAW-10 | B1 OAuth | done |
| PAW-11, PAW-16 | C1 Demo injection disabled | done |
| PAW-12 | B3–B5 Invite/onboarding | done |
| PAW-14 | F1 Notification copy | done |
| PAW-15 | CTO sequencing + A2 plan | done |

Evidence: `docs/PAWPLE_PHASE1_CEO_VERIFICATION.md`

## Phase 2 — immediate P0 (parallel)

| Issue | Workstream | Owner | Depends on | Objective |
|-------|------------|-------|------------|-----------|
| PAW-19 | A2 Environment config | CTO → FE/BE | PAW-4 | Implement `docs/PAWPLE_A2_ENVIRONMENT_CONFIG_PLAN.md` — env-based Supabase client, EAS profiles |
| PAW-20 | A3 + A4 Migrations + RLS tests | Backend | PAW-4 | Verify migrations apply cleanly; RLS role-based test suite |
| PAW-21 | C2 Pet photo Storage upload | Frontend | — | Durable `pet-photos` URLs on create/edit/onboarding |
| PAW-22 | A6 + C4 Export RPC + UI | Backend → Frontend | PAW-4 | Server export RPC; wire Settings to canonical export; honest copy |
| PAW-23 | C5 Delete account UI wiring | Frontend | PAW-9 | Wire `SettingsScreen` to `deleteAccount()` RPC helper |
| PAW-24 | D1 Meetup RSVP/capacity audit | Backend | PAW-4 | Verify atomicity vs Product Contract |
| PAW-25 | F2 Critical-path integration tests | Frontend + Backend | PAW-10,12,23 | Auth, onboarding, moment, meetup RSVP, delete smoke tests |

## Phase 2 — P1 (after P0 wave)

| Task | Owner | Notes |
|------|-------|-------|
| B6 Interrupted onboarding tests | Frontend | After PAW-12 stable |
| C3 Moments/memories migration plan | Backend + Frontend | |
| D3 Venue coordinates honesty | Frontend | |
| F3 Staging smoke iOS/Android | Engineering | After A2 + P0 fixes |
| F4 OAuth redirect + store metadata | CEO + Engineering | |
| C6 Legacy screen quarantine | Frontend | P2 |

## Explicitly out of scope (Founder gate)

- E3 / E3b / E4 / E5 / E6 — mating schema, supply UI, eligibility, discovery UI
- PAW-18 rev 3+ Founder approval required before any mating engineering

## Preservation principle

Extend existing implementation. No unnecessary rewrites of meetup, moment, pet, or navigation architecture.
