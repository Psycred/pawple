# Pawple Phase 1a — CTO Architecture Gate (18+ Bulletin Board)

**Issue:** PAW-95  
**Authority:** Founder `66e02a99` · `docs/CURRENT.md` (2026-08-31)  
**Status:** **ACCEPTED** — implementation may proceed per file ownership below  
**Inputs:** PAW-81 location audit · PAW-74/83 product guidance (18+ path) · Mating wave QA SIGN-OFF (`8649c5f`, `dd64e24`)

---

## 1. Executive summary

Phase 1a delivers an **18+ only** bulletin-board social layer:

| Surface | Phase 1a behaviour |
|---------|-------------------|
| **Moments / Feed** | Production-ready, pet-first, recency-sorted, no engagement metrics |
| **Meetups** | Public city-scoped events — create, discover by city, RSVP — **no group chat** |
| **Messaging** | **Only** consent-gated mating introduction chat after **mutual Paw** — no open DMs, no link sharing |
| **Age** | 18+ attestation enforced; `account_tier` schema added now; **no teen UI** |
| **Location (bulletin)** | **City-level coarse only** on feed/meetups/moments — no precise GPS stored or exposed on these surfaces |
| **Mating** | **Preserved exactly** — mutual Paw, 100 km server radius, intro chat, consent flow unchanged |

This document is the **implementation gate**. No Phase 1a code until specialists follow §6 sequencing and §7 file ownership. **No commits until PAW-103 QA SIGN-OFF.**

---

## 2. Architectural principles (Phase 1a)

1. **Pet-first bulletin board**, not engagement platform — no counts, popularity, or open messaging.
2. **Fail-closed security** — age, chat, and location rules enforced at DB/RPC layer; UI hiding is insufficient.
3. **Dual location domains** — bulletin surfaces are city-centric; mating retains existing server-side coordinate math (not exposed to clients). See §4.
4. **Mating non-regression** — zero UI/feature-flag/hide changes to mating files listed in §8.
5. **Schema now, teen product later** — `account_tier` + `birth_date` on `profiles`; teen tier unreachable in Phase 1a.
6. **Reversible Beta choices** — prefer additive migrations; avoid breaking mating RPC signatures.

---

## 3. Domain model changes

### 3.1 Profiles — age & tier (PAW-96)

**New / extended columns on `public.profiles`:**

| Column | Type | Phase 1a rule |
|--------|------|---------------|
| `account_tier` | `text` CHECK (`'adult'`, `'teen'`) NOT NULL DEFAULT `'adult'` | Set `'adult'` only via server path when 18+ attestation succeeds. `'teen'` reserved — no client write path in Phase 1a. |
| `birth_date` | `date` NULL | Set once when age gate passes (from device ISO date). Immutable after set except service_role correction. |
| `age_attested_adult` | `boolean` (exists) | Remains mating/meetup write gate. Harden: **revoke direct client UPDATE**; set only via `SECURITY DEFINER` RPC/trigger. |

**New server functions (extend PAW-53):**

```sql
-- Canonical adult check for ALL Phase 1a privileged writes (meetups, mating, chat)
assert_adult_account_ok(p_user_id uuid)  -- account_tier = 'adult' AND age_attested_adult IS TRUE

-- Idempotent attestation from verified birth_date (called by RPC, not client UPDATE)
sync_age_attestation_from_birth_date(p_user_id uuid, p_birth_date date)
  -- validates age >= 18, sets birth_date, age_attested_adult, account_tier = 'adult'
```

**Client changes (minimal):**

- `ageAttestationSync.js` → call new RPC instead of direct `profiles.update({ age_attested_adult: true })`.
- No new screens. Existing `AgeGateScreen` + `ageGate.js` (18+) unchanged in UX.

**Meetup/mating gates:**

- `assert_mating_age_ok` → delegate to `assert_adult_account_ok` (keep alias for mating RPC compatibility).
- Add `BEFORE INSERT/UPDATE` trigger on `meetups` calling `assert_adult_account_ok(auth.uid())`.

### 3.2 Location — dual domain (PAW-97)

**Bulletin domain (feed, meetups, moments — user-visible locality):**

| Asset | Phase 1a canonical field | Stop doing |
|-------|--------------------------|------------|
| Feed context | `profiles.city` | Distance sort on moments |
| Meetup discovery | `meetups.city` (new, denormalized at create) | JIT GPS on publish; km distance labels |
| Moment caption location | `moments.location` text (optional) | Writing `location_lat` / `location_lng` |
| Meetup venue | `location_name` + optional `google_maps_link` (user-provided venue text) | Relying on `location_lat/lng` for discovery |

**Mating domain (server-only — preserved exactly):**

| Asset | Unchanged | Notes |
|-------|-----------|-------|
| `profiles.last_location_lat/lng` | Keep for `get_mating_opportunities` haversine | Client SELECT already revoked |
| `refreshProfileLocationOnAppOpen` | **No change** (mating preservation) | Coords used only server-side |
| Mating RPCs | 100 km fixed radius | Do not alter signatures or eligibility |

**Migration actions (PAW-97):**

1. `ALTER TABLE meetups ADD COLUMN city text NOT NULL DEFAULT ''` — backfill from creator `profiles.city` where possible; enforce NOT NULL on new writes via trigger defaulting to creator city.
2. `REVOKE SELECT` on `moments.location_lat`, `moments.location_lng`, `meetups.location_lat`, `meetups.location_lng` from `authenticated` (mirror `profiles.last_location_*` pattern).
3. Optional: `UPDATE` trigger nulling coord columns on moments/meetups INSERT/UPDATE from client (belt-and-suspenders).
4. Do **not** drop coord columns — mating-adjacent tooling and legacy rows may reference them; null on new bulletin writes.

**Client actions (PAW-97 + PAW-99):**

| File | Change |
|------|--------|
| `CreateMomentScreen.js` | Remove `getValidLocation` on save; do not send lat/lng |
| `CreateMeetupScreen.js` | Remove JIT GPS; set `city` from active user's `profiles.city` |
| `FeedScreen.js` | Remove `getCachedLocation` / `withHonestMeetupDistance`; filter meetups by city |
| `MeetupCard.js`, `MeetupDetailsScreen.js` | Remove km distance labels; show city badge |
| `App.js` | **No change** to `refreshProfileLocationOnAppOpen` (mating preservation) |

**City matching rule:**

- Normalize: `lower(trim(city))` equality between viewer `profiles.city` and `meetups.city`.
- Feed meetup carousel + injected meetup cards: **same city only**.
- Empty city → show calm empty state prompting profile city setup (reuse onboarding pattern).

### 3.3 Meetups bulletin board (PAW-99)

**Discovery contract:**

```
viewer.city = profiles.city (authenticated user)
visible_meetups = meetups WHERE lower(trim(city)) = lower(trim(viewer.city))
                  AND isShowablePublicMeetup(meetup)  -- existing time/status filter
                  AND NOT blocked(host_pets...)
```

**Create contract:**

- Host must have `profiles.city` set (non-empty).
- `meetups.city` := creator's `profiles.city` at insert (server trigger — not client-supplied arbitrary city).
- RSVP via existing `meetup_participants` junction — unchanged.
- **No** meetup-scoped chat tables, channels, or UI.

**RSVP disclaimer (Legal hook):**

- Frontend: modal/bottom sheet before first RSVP per device (AsyncStorage ack key).
- Copy owned by Legal (PAW-101); Engineering provides `@pawple/meetup_rsvp_disclaimer_ack_v1` hook only.

### 3.4 Messaging — mutual Paw only (PAW-100)

**Current state (adequate foundation):**

- Only message store: `mating_introduction_messages` + `mating_introduction_channels`.
- Channel created server-side on mutual Paw only.
- RLS requires open channel + live mutual Paw + `age_attested_adult`.

**Phase 1a additions:**

1. **Link sharing block** — DB `BEFORE INSERT` trigger on `mating_introduction_messages`:
   - Reject bodies matching URL patterns (`http://`, `https://`, `www.`, common TLDs).
   - `RAISE EXCEPTION 'link_sharing_forbidden'`.
2. **Client mirror** — `sendIntroductionMessage` + compose UI: soft inline rejection before send (calm copy, not alarmist).
3. **Audit** — confirm no other message INSERT paths; grep for `.from('messages')`, open DM routes, meetup chat.
4. **Phone numbers** — allowed (Founder: organic exchange); do not regex-block phone patterns.

**Explicit non-goals:** No general DM table, no meetup group chat, no link preview, no AI moderation.

### 3.5 Feed / Moments (PAW-98)

**Production-ready checklist (no product scope change):**

- [ ] Remove demo-feed fallback in production builds (`isDemoContentEnabled` / `USE_DEMO_FEED_WHEN_EMPTY` audit).
- [ ] Confirm no public like counts anywhere in feed path.
- [ ] `sortFeedMoments` — recency only (already Phase 1 fallback when no viewer coords).
- [ ] Block/report on moments functional.
- [ ] Loading, empty, error, offline-retry states calm and complete.
- [ ] Composition per `.cursorrules` + `pawple-ui-composition.mdc`.

**No new feed ranking, proximity, or engagement mechanics.**

---

## 4. Location dual-domain diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        profiles                                  │
│  city ──────────────► Feed context, meetup discovery (public)   │
│  last_location_* ───► Mating RPCs only (server-side, REVOKED    │
│                       from client SELECT)                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐
│ moments          │     │ meetups           │
│ location (text)  │     │ city (canonical)  │
│ NO lat/lng write │     │ location_name     │
│                  │     │ NO lat/lng write  │
└──────────────────┘     └──────────────────┘
         │                         │
         └──────── Feed / Bulletin board ────────► City-scoped, no km labels
```

**Legal alignment:** Privacy copy states coarse city for bulletin surfaces; mating companion discovery may reference approximate server-side proximity without exposing coordinates (existing legal framing).

---

## 5. Mating preservation boundary (NON-NEGOTIABLE)

**Frozen — no edits in Phase 1a wave:**

| Area | Files |
|------|-------|
| Discovery UI | `MatingDiscoveryScreen.js`, `MatingExploreRow.js`, `MatingSection.js`, `MatingPawButton.js` |
| Intro chat UX | `MatingIntroductionChatScreen.js` (except link-validation compose guard — additive only) |
| Profile mating | `ViewPetProfileScreen.js` mating sections |
| Service | `mating.js` — RPC names, radius constant, Paw flow (link check additive only) |
| Migrations | `20260830200000_mating_paw_interest_chat.sql`, `20260831100000_mating_fixed_100km_radius.sql` — **no modifications**; new migrations only additive |
| Navigation / visibility | No feature flags, no hiding, no routing changes |

**Allowed adjacent touches:**

- `assert_adult_account_ok` may wrap existing `assert_mating_age_ok` internally.
- `ageAttestationSync.js` RPC migration (server attestation hardening).
- Link rejection in `sendIntroductionMessage` + DB trigger (additive safety).

---

## 6. Implementation sequencing

**Goal:** No two specialists modify the same file concurrently.

### Wave A — Backend foundation (parallel)

| Order | Issue | Work | Blocks |
|-------|-------|------|--------|
| A1 | **PAW-96** | Migration: `account_tier`, `birth_date`, attestation RPC, revoke client age UPDATE, meetup age trigger | PAW-98 RSVP, PAW-99 create |
| A2 | **PAW-97** | Migration: `meetups.city`, revoke coord SELECT, coord-null trigger; client location downgrade files | PAW-99 |

*A1 and A2 touch disjoint migration files and mostly disjoint client files — **may run in parallel**.*

### Wave B — Feature engineering (after A completes)

| Order | Issue | Depends | Work |
|-------|-------|---------|------|
| B1 | **PAW-100** | PAW-96 (age RPC stable) | Link-sharing trigger + client guard |
| B2 | **PAW-98** | PAW-97 (no moment GPS) | Feed production pass |
| B3 | **PAW-99** | PAW-97 + PAW-96 | City meetup discovery, RSVP disclaimer hook, remove km UI |

*B2 and B3 share `FeedScreen.js` — **sequence B2 → B3** (Frontend single owner) OR one engineer owns both sequentially.*

### Wave C — Parallel advisory (started anytime)

| Issue | Owner | Notes |
|-------|-------|-------|
| PAW-101 | Legal | Align copy to §3.3 disclaimer + §4 location |
| PAW-102 | Product Strategist | 18+ onboarding path only |

### Wave D — Gate

| Issue | Depends | Verdict |
|-------|---------|---------|
| **PAW-103** | PAW-96–102 | SIGN-OFF or VETO — only then commits authorized |

---

## 7. File ownership map

### PAW-96 — Backend (account_tier + age asserts)

| Owner | Path |
|-------|------|
| Backend | `supabase/migrations/20260831*_phase1a_account_tier.sql` (new) |
| Backend | `src/lib/ageAttestationSync.js` |
| Backend | `scripts/rls-security-tests.js` (age assert cases) |

**Do not touch:** mating migration files, mating UI files.

### PAW-97 — Backend + Frontend (location downgrade)

| Owner | Path |
|-------|------|
| Backend | `supabase/migrations/20260831*_phase1a_city_location.sql` (new) |
| Backend | `scripts/rls-security-tests.js` (coord revoke cases) |
| Frontend | `src/screens/CreateMomentScreen.js` |
| Frontend | `src/screens/CreateMeetupScreen.js` |
| Frontend | `src/services/meetups.js` (city field, fetch filter) |
| Frontend | `src/services/moments.js` (remove coord writes in create) |
| Frontend | `src/utils/distanceUtils.js` (deprecate meetup km for bulletin) |
| Frontend | `src/components/MeetupCard.js` |
| Frontend | `src/screens/MeetupDetailsScreen.js` |

**Do not touch:** `App.js` (profile location refresh), `profileLocation.js`, mating RPCs.

### PAW-98 — Frontend (Feed production-ready)

| Owner | Path |
|-------|------|
| Frontend | `src/screens/FeedScreen.js` |
| Frontend | `src/components/MomentCard.js` |
| Frontend | `src/components/PostCard.js` |
| Frontend | `src/data/demoFeed.js` (production gating audit) |
| Frontend | `src/config/environment.js` |

### PAW-99 — Frontend (city meetups bulletin)

| Owner | Path |
|-------|------|
| Frontend | `src/screens/FeedScreen.js` *(after PAW-98)* |
| Frontend | `src/screens/CreateMeetupScreen.js` *(coordinate with PAW-97)* |
| Frontend | `src/screens/MeetupDetailsScreen.js` |
| Frontend | `src/components/EventCarousel.js` |
| Frontend | `src/hooks/useMeetupFeedLogic.js` |
| Frontend | `src/services/meetups.js` *(city filter — single merge with PAW-97)* |

### PAW-100 — Backend + Frontend (chat enforcement)

| Owner | Path |
|-------|------|
| Backend | `supabase/migrations/20260831*_phase1a_chat_link_block.sql` (new trigger) |
| Backend | `scripts/rls-security-tests.js` (link rejection cases) |
| Frontend | `src/services/mating.js` (`sendIntroductionMessage` client guard) |
| Frontend | `src/screens/MatingIntroductionChatScreen.js` (compose validation UX only) |

---

## 8. QA verification scope (for PAW-103)

Mirror Founder checklist from `docs/CURRENT.md` § Verification:

1. Under-18 cannot access mating surfaces (client + server).
2. `account_tier` schema present; all Phase 1a users `'adult'`; no teen UI.
3. Moments/meetups: no new lat/lng writes; client cannot SELECT coord columns.
4. Meetups discoverable by city only; no km labels on bulletin cards.
5. RSVP works; disclaimer hook present; no meetup group chat.
6. Chat opens only after mutual Paw; link send rejected; phone text allowed.
7. Feed production-ready; no engagement metrics.
8. **Mating regression suite** — full PAW-69 scenarios pass unchanged.

---

## 9. Risk register

| Risk | Mitigation |
|------|------------|
| Legal/product mismatch on location | Dual-domain §4; Legal updates PAW-101 before SIGN-OFF |
| Accidental mating regression | §5 frozen file list; QA mating regression mandatory |
| Concurrent FeedScreen edits | Sequence PAW-98 → PAW-99 (§6) |
| Client still writes coords | DB trigger nulling + REVOKE SELECT |
| Attestation bypass via direct UPDATE | PAW-96 RPC-only path + RLS |
| Empty city → empty meetup board | Product Strategist advisory (PAW-102); calm empty state |

---

## 10. Explicitly deferred (not Phase 1a)

- Teen UI, VPC, parental supervision, mixed-age controls
- IP geolocation city suggestion (PAW-81 optional — future)
- Push notifications for chat/interest
- AI chat moderation
- Meetup group chat
- Open DMs / general messaging
- Mating UI or radius changes
- Store submission (PAW-52 still blocks)

---

## 11. CTO disposition

**Architecture ACCEPTED** for Phase 1a implementation.

Specialists should cite this document in their issue comments when starting work. Escalate to CEO if product behaviour conflicts with §5 mating preservation or Founder `66e02a99` scope.

**Document revision:** 1.0 — PAW-95 initial gate (2026-08-31)
