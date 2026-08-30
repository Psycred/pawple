# Pawple Beta MVP — Execution Plan

**Owner:** CEO / Executive Leadership  
**Status:** Approved — Phase 1 execution delegated (28 Aug 2026)  
**Date:** 28 Aug 2026  
**Source of truth:** `docs/PAWPLE_BETA_ARCHITECTURE_PRODUCT_CONTRACT.md` (Product Contract)

---

## 1. Executive summary

Pawple is **not** production-ready today. The repository has a credible foundation — Expo/React Native app shell, Supabase backend, meetups, moments, onboarding UI, and pet profiles — but several **contract-critical gaps** block a closed beta.

**Recommendation:** Execute a **sequenced 6-workstream plan** over ~8–10 weeks to reach the Product Contract definition of done. Do **not** start broad feature expansion until auth, invite, onboarding, account lifecycle, and environment isolation are contract-correct.

**Critical path:** Auth + invite + onboarding → account lifecycle + environments → mating product decision + implementation → meetup hardening → feed/journal truth → staging smoke + release.

**PAW-2 resolved (28 Aug 2026):** Founder approved **Option B+** — mating in Beta, supply-first, pet-centric mental model. **PAW-7 approved same day** — execution delegated via Phase 1 child issues (see `docs/PAWPLE_MVP_PHASE1_DELEGATION.md`).

---

## 2. Current state assessment

### 2.1 What exists and is usable

| Area | Status | Notes |
|------|--------|-------|
| App shell | ✅ Solid | `App.js`, `BottomTabNavigator`, `AuthContext`, `ActivePetContext` |
| Onboarding UI | ✅ Mostly built | 3-step flow: user → pets → final |
| Pet profiles | ✅ Built | Multi-pet, active pet, traits, companion toggle |
| Moments | ✅ Mostly built | `moments` service, create flow, feed cards, `pet_ids` attribution |
| Meetups | ✅ Substantial | Pet-centric schema, hosts/participants, RSVP, capacity RPCs |
| Location | ✅ Partial | Foreground coarse location, profile location refresh |
| Design system | ✅ Established | `theme.js`, `.cursorrules`, composition rules |
| Migrations | ✅ Present | 24 version-controlled Supabase migrations |

### 2.2 Contract gaps (verified independently)

#### P0 — Blocks production beta

1. **Authentication is mock-only** (`AuthScreen.js`)
   - Google/Apple buttons navigate to invite screen without OAuth.
   - No Supabase provider session establishment in production path.

2. **Invite flow violates contract** (`InviteCodeScreen.js`)
   - Permanent bypass codes (`PAWPLE-TY00`) forbidden in production.
   - Invite consumed on validation, not at onboarding completion.
   - Anonymous dev auth used before profile/pet creation.
   - Validation does not require authenticated user first.

3. **Onboarding completion is inferred, not explicit** (`AuthContext.js`)
   - `hasCompletedOnboarding = pet count > 0` — no explicit completion flag.
   - Interrupted onboarding edge cases not contract-safe.

4. **Account export is misleading and incorrect** (`SettingsScreen.js`)
   - Promises email delivery; exports legacy tables (`posts`, `photos`, `meetup_history`).
   - Does not export canonical `moments`, `likes`, meetup participation, invites.

5. **Account deletion is client-side and incomplete** (`SettingsScreen.js`)
   - Deletes from wrong tables; does not remove auth identity, storage, meetup relationships, or mating data.
   - Violates server-controlled atomic deletion requirement.

6. **Demo/fabricated data in production paths** (`demoFeed.js`, `demoMeetupRsvp.js`)
   - `USE_DEMO_FEED_WHEN_EMPTY = true` injects fake moments/meetups.
   - Demo RSVP mutations persist locally.
   - Contract forbids production demo injection.

7. **Mating/matching not implemented**
   - Only `is_looking_for_companion` toggle exists.
   - No breed/gender/distance eligibility query, no discovery UI, no Paw/interest persistence, no post-interest visibility.
   - `fetchDiscoverablePets` has no breed/sex/distance filtering.

8. **Notification UI over-promises** (`NotificationNudge.js`, `OnboardingFinalScreen.js`)
   - Promises likes, meetup invites, reminders — push is deferred per contract.

9. **No automated tests** — zero test files in repository.

10. **Environment isolation not implemented** — single hardcoded Supabase project in `config/supabase.js`.

#### P1 — Important for beta quality

11. **Legacy code still present** — `HomeScreen`, `CreateMemoryScreen`, `JournalPlaceholderScreen`, `firebase.js`, `memories` read fallback in `moments.js`.

12. **Pet photo upload** — `OnboardingPetsScreen` may persist device-local URIs (`photoUrlForInsert`) instead of durable Storage URLs.

13. **Meetup edit flow** — not implemented (`MeetupDetailsScreen` comment).

14. **Share/deep link** — moment deep links route to Feed, not a dedicated moment view.

15. **Backend audit incomplete** — PAW-4 blocked; RLS/security posture unverified at CEO level.

### 2.3 Frontend Engineer audit (PAW-5)

PAW-5 was cancelled before durable findings were posted to the issue thread. The Frontend Engineer completed PAW-6 (runtime smoke test) confirming repository access at `E:\Pawple-Clean`. **This plan supersedes the missing PAW-5 audit** with independent CEO verification above.

---

## 3. Definition of done

Beta is ready when every item in **Product Contract §13** is satisfied, plus:

- Staging environment with synthetic data only
- Production build with all demo/dev paths disabled
- Critical-path smoke tests on iOS and Android
- No open P0 issues

---

## 4. Execution workstreams

### Workstream A — Platform & environments (Architecture / Backend)
**Goal:** Reproducible, isolated dev/staging/production.

| # | Task | Owner | Priority |
|---|------|-------|----------|
| A1 | Complete PAW-4 backend/data audit (schema, RLS, RPC grants, gaps vs contract) | Backend / Data Engineer | P0 |
| A2 | Environment config: dev/staging/prod Supabase projects, env-based client config | Architecture | P0 |
| A3 | Verify all migrations apply cleanly; document recreate-from-migrations procedure | Backend | P0 |
| A4 | RLS role-based security test suite | Backend | P0 |
| A5 | Server-side account deletion RPC (atomic: profile, pets, moments, likes, invites, meetups, storage, auth) | Backend | P0 |
| A6 | Server-side data export RPC (canonical JSON archive) | Backend | P1 |

**Exit criteria:** Staging DB recreatable from migrations; RLS tests pass; delete/export RPCs callable from client.

---

### Workstream B — Auth, invite & onboarding (Engineering)
**Goal:** Contract-correct identity and gated onboarding loop.

| # | Task | Owner | Priority |
|---|------|-------|----------|
| B1 | Implement Google + Apple OAuth via Supabase Auth (expo-auth-session) | Frontend Engineer | P0 |
| B2 | Session restore on cold start; safe sign-out and account switch | Frontend Engineer | P0 |
| B3 | Reorder flow: authenticate → validate invite (no consume) → profile → pets → consume invite → complete | Frontend Engineer | P0 |
| B4 | Add explicit `onboarding_completed_at` (or equivalent) to profiles; migrate AuthContext | Backend + Frontend | P0 |
| B5 | Remove permanent bypass codes; gate anonymous auth to `__DEV__` only | Frontend Engineer | P0 |
| B6 | Interrupted onboarding resume tests | Frontend Engineer | P1 |

**Exit criteria:** Production build cannot use dev auth or bypass codes; invite consumed only after pet creation succeeds.

---

### Workstream C — Core product truth (Engineering)
**Goal:** Feed, journal, pets, and media use real canonical data only.

| # | Task | Owner | Priority |
|---|------|-------|----------|
| C1 | Disable demo feed/meetup injection in staging/production builds | Frontend Engineer | P0 |
| C2 | Pet photo upload to owner-scoped `pet-photos` Storage on create/edit/onboarding | Frontend Engineer | P0 |
| C3 | Verify moments use `pet_ids` canonically; plan `memories` migration | Backend + Frontend | P1 |
| C4 | Wire export UI to canonical export RPC; honest copy (no email promise) | Frontend Engineer | P0 |
| C5 | Wire delete account to server RPC; clear local state | Frontend Engineer | P0 |
| C6 | Remove or quarantine legacy screens (`HomeScreen`, placeholders, firebase) | Frontend Engineer | P2 |

**Exit criteria:** Production feed shows real data only; photos are durable Storage URLs; export/delete match contract.

---

### Workstream D — Meetups (Engineering)
**Goal:** Transactionally correct pet-centric meetups.

| # | Task | Owner | Priority |
|---|------|-------|----------|
| D1 | Verify RSVP/capacity/cancellation atomicity against contract | Backend | P0 |
| D2 | Remove demo meetup RSVP from production paths | Frontend Engineer | P0 |
| D3 | Venue coordinates correspond to user-provided venue (no silent substitution) | Frontend Engineer | P1 |
| D4 | Meetup edit flow (or explicit deferral with UX honest about limitation) | Product + Frontend | P2 |

**Exit criteria:** Host/participant roles correct; capacity enforced at DB level; no demo meetups in prod.

---

### Workstream E — Mating / matching (Product decision → Architecture → Engineering)
**Goal:** Phase 1 mating per contract — **pending PAW-2 Founder decision**.

**If included in Beta (CEO preliminary lean: yes, in minimal form):**

| # | Task | Owner | Priority |
|---|------|-------|----------|
| E1 | Founder decision on Beta inclusion + post-interest consent model (PAW-2) | Founder + CEO | P0 gate |
| E2 | UX: discovery presentation, distance control, empty/scarcity states | Design / UX | P0 |
| E3 | Schema: Paw/interest records, mating description field if missing | Architecture | P0 |
| E4 | Eligibility query: same breed, opposite sex, opt-in, within user radius | Backend | P0 |
| E5 | Discovery UI + express interest (Paw) + interested-pet visibility | Frontend Engineer | P0 |
| E6 | Honest empty states for low match density | Design + Frontend | P0 |

**If deferred:** Remove mating from Beta DoD checklist; keep opt-in toggle but hide discovery until Phase 1 launch.

**Exit criteria:** Eligible candidates shown with mating description; Paw does not permanently hide; no extra matching criteria.

---

### Workstream F — Quality, notifications & release (Engineering + CEO)
**Goal:** Shippable closed beta.

| # | Task | Owner | Priority |
|---|------|-------|----------|
| F1 | Fix notification copy — no promises beyond implemented capability | Frontend Engineer | P0 |
| F2 | Critical-path integration tests (auth, onboarding, moment, meetup RSVP, delete) | Engineering | P0 |
| F3 | Staging smoke tests iOS + Android release builds | Engineering | P0 |
| F4 | App Store / Play closed-beta metadata and OAuth redirect configuration | CEO + Engineering | P1 |
| F5 | Beta invite seeding strategy (synthetic staging, real production pets only) | CEO | P1 |

**Exit criteria:** Release builds pass staging smoke; notification UI contract-correct.

---

## 5. Sequencing and dependencies

```
Week 1-2:  A1-A3, B1-B3, C1 (parallel)
Week 2-3:  A4-A5, B4-B5, C2, C4-C5, D1-D2, F1
Week 3-4:  PAW-2 decision → E2-E6 (if approved)
Week 4-6:  C3, D3, F2
Week 6-8:  F3-F5, legacy cleanup, final contract audit
```

**Hard dependencies:**
- B1 blocks B3 (auth before invite validation)
- A5 blocks C5 (server delete before client wiring)
- A6 blocks C4 (server export before client wiring)
- PAW-2 blocks E3-E6
- A4 should complete before beta user data

---

## 6. Organizational actions

| Action | Owner | Notes |
|--------|-------|-------|
| Unblock PAW-4 backend audit | CEO → Backend Engineer | Prerequisite for A4-A6 confidence |
| Resolve PAW-2 mating decision | CEO → Founder | Gates Workstream E |
| Create child issues per workstream | CEO | After plan approval |
| Cancel or supersede stale PAW-1 hiring issue | CEO | Org already has Frontend + Backend agents |

### Proposed agent assignments

- **Backend / Data Engineer** (`1de055a7`): A1, A3-A6, D1, E3-E4
- **Frontend Engineer** (`030f62a9`): B1-B6, C1-C6, D2-D3, E5-E6, F1-F3
- **CEO** (`324e7c9e`): Plan, prioritization, PAW-2 advisory, F4-F5, cross-stream unblock
- **Design / UX**: E2, E6 (once PAW-2 resolved) — hire or delegate when E starts

---

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mating scarcity disappoints early users | Trust, retention | Honest empty states; optional deferral (PAW-2); seed staging with synthetic candidates |
| OAuth provider setup delays | Blocks all user testing | Prioritize B1 in week 1; use staging providers early |
| RLS gaps expose data | Privacy, trust | A4 before any external beta users |
| Scope creep on mating/chat | Timeline, identity drift | Contract limits criteria; post-interest model is separate decision |
| Legacy/demo code ships to prod | Contract violation, trust | C1 + build-time flags; staging smoke checklist |

---

## 8. What we are explicitly not doing in this plan

- Comments, followers, public like counts, engagement metrics
- Push notifications (deferred per contract)
- Chat architecture (post-interest model undecided)
- Advanced matching criteria (breed/sex/distance only)
- Marketplace, grooming, or non-beta product expansion
- Visual redesign beyond contract-consistent polish

---

## 9. Recommendation

**Approve this plan and authorize Workstreams A–D and F immediately.** Hold Workstream E until PAW-2 is resolved.

**First concrete actions after approval:**
1. Unblock and complete PAW-4 backend audit
2. Create child issues for A1, B1, C1, A5 (critical path starters)
3. Frontend Engineer: disable demo injection behind environment flag
4. Backend Engineer: draft account deletion RPC spec

**What would change this recommendation:**
- Founder decides to defer mating entirely → remove E from Beta scope, accelerate C/D/F
- Backend audit reveals major schema rework → extend timeline 2-3 weeks
- OAuth provider approval blocked → interim TestFlight with dev auth in staging only (never production)

---

## 10. Contract compliance checklist (summary)

See Product Contract §13 for full list. Highest-risk open items:

- [ ] Google and Apple auth in production
- [ ] Invite validation atomic and single-use at correct step
- [ ] Explicit onboarding completion
- [ ] No production demo/fabricated data
- [ ] Mating eligibility (breed, sex, opt-in, distance) — **if in Beta**
- [ ] Server-controlled delete account
- [ ] Honest export
- [ ] RLS tests pass
- [ ] Staging/production isolated
