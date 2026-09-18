# PAW-195 — CEO Mating Match + Chat readiness audit

**Authority:** Founder instruction on PAW-195  
**Author:** CEO  
**Date:** 2026-09-06  
**Scope:** Repository truth only. No implementation. Feature remains hidden.  
**Team-readiness layer:** pending individual reports from Legal, Copy, Frontend, Backend, CTO, QA, Tester.

This document is **not** a go-ahead to re-expose or rebuild Mating Match + Chat.

---

## Two levels of truth

| Layer | Meaning | Status |
|-------|---------|--------|
| **Repository truth** | What code, schema, and gates actually exist | This document |
| **Team readiness** | What each function says they have and need | Pending child issues |

A high coded percentage can still be **blocked by Legal + moderation + QA**. Do not treat “hidden” as “missing.”

---

## Executive snapshot

| Surface | Coded (repo) | User-visible | Functional if gate flipped | Rebuild? |
|---------|--------------|--------------|----------------------------|----------|
| **Mating Match** | **~85%** | **0%** (`EXPOSE_MATING_SURFACES = false`) | Largely yes, with known drift | **No** — recover and repair |
| **Introduction Chat** | **~80%** | **0%** (same gate) | Core path yes; realtime/push no | **No** — recover and repair |

**CEO verdict on rebuild:** Do not rebuild. The previous Mating System wave (PAW-57–69) shipped and QA-signed-off. Founder later hid the surfaces (`4ac03812` / PAW-112). Code was preserved on purpose.

**CEO verdict on implementation go-ahead:** **NO-GO until team reports land.** Repository truth is strong. Release readiness is a different question.

---

## 1. Mating Match — repository truth

### Estimated completion
**~85% coded. 0% exposed.** Hidden, not deleted.

### Already preserved
- Discovery screen: `src/screens/MatingDiscoveryScreen.js` (list-only; no swipe deck).
- Owner controls: `src/components/MatingSection.js` (opt-in, description, inbound interest, explore entry).
- Candidate row: `src/components/MatingExploreRow.js` (navigate only; no row Paw).
- Paw on viewed profile: `src/components/MatingPawButton.js` + `src/screens/ViewPetProfileScreen.js`.
- Client service: `src/services/mating.js` — opportunities, express/withdraw Paw, inbound interest, mutual check, radius helpers, description update.
- Server: `get_mating_opportunities`, `express_paw`, `withdraw_paw`, `pets_have_mutual_paw`, `mating_eligible_pair`.
- Criteria in RPC: same breed, opposite sex, both opted in (`is_looking_for_companion`), distance, 18+ attestation, 24h location freshness.
- Opt-in column: `pets.is_looking_for_companion` (“Open to Companionship”).
- Short text: `pets.mating_description` (max 200; evaluation context, not a criterion).
- Report/block on inbound interest (`targetType: mating_interest`).

### What is functional (in code)
- Server-authoritative eligibility and Paw writes.
- Client SELECT-only for introduction channels (no client channel create).
- Age fail-closed: `assert_mating_age_ok` + client `assertClientMatingAgeOk`.
- Block pairing helper exists in mating migration (`mating_pair_blocked_for_viewer`).
- Account delete migrations include `paw_interests` / mating tables.

### What is hidden / disabled
Single UI visibility gate: `src/config/phase1aSurfaces.js` → `EXPOSE_MATING_SURFACES = false`.

Applied at:
- `App.js` — `MatingDiscoveryScreen` and `MatingIntroductionChatScreen` not registered.
- `PetProfileScreen.js` — owner Mating section + viewer mating description + companion badge.
- `ViewPetProfileScreen.js` — Paw, intro-chat CTA, mating copy; skips Paw/channel fetches when hidden.
- `EditPetScreen.js` — companion toggle `showToggle={false}`.

This is **not** a security control. RLS/RPCs remain the source of truth. Comment in file is explicit: do not delete screens, services, RPCs, or tables.

### What is incomplete or drifted
1. **Radius client/server split (material).**  
   - Server (PAW-73 / `20260831100000_mating_fixed_100km_radius.sql`): fixed **100 km**, closest-first. Column CHECK = 100 only.  
   - Client still exposes 5/10/25/50 picker (`MATING_RADIUS_KM_OPTIONS`, `MatingSection` radius sheet, `updateMatingRadiusKm`).  
   - Discovery empty copy still interpolates `radiusKm` from the client helper (default 25).  
   - Product sources conflict: Product Contract + CEO mandate say **user-selected distance**; CURRENT.md / PAW-73 say **fixed 100 km, no radius UI**. **Do not silently pick one.** Founder must resolve before implementation.
2. Discovery returns empty if viewer location is stale (>24h) or missing — easy to read as “no matches.”
3. No mating-specific push or in-app notification when someone Paws you.
4. No deep link into discovery.
5. Live runtime of hidden screens has not been re-proven since hide wave.

### What is missing (not present to recover)
- User-facing Phase 1a entry points (intentional).
- Mating push notifications.
- Confirmed live-staging proof that original mating migrations + 100 km RPC are applied on the current project (probe script checks `mating_introduction_channels`; full RPC smoke is a Backend/CTO item).

---

## 2. Chat — repository truth

### Estimated completion
**~80% coded. 0% exposed.** Mutual-Paw introduction chat only. Not open DMs. Not meetup group chat.

### Already preserved
- Screen: `src/screens/MatingIntroductionChatScreen.js`.
- Channel + message tables, RLS, deny client INSERT on channels.
- Mutual Paw trigger opens a channel; freeze on withdraw/block.
- Send path: client insert into `mating_introduction_messages` (RLS fail-closed).
- Link block: DB trigger + client guard (`src/lib/introChatLinkGuard.js`). Phones allowed.
- First-open disclaimer modal (AsyncStorage ack per channel).
- Report (`targetType: introduction_chat`) + `BlockConfirmSheet`.
- Adult-account trigger on message insert (`20260831200000_phase1a_account_tier.sql`).
- Delete-account cascade for channels/messages.

### What is functional (in code)
- Compose + history load.
- 8-second poll refresh while focused (not Supabase Realtime).
- Link rejection at client and INSERT trigger.
- Frozen channel: UI copy exists; insert denied by RLS.

### What is hidden / disabled
Same `EXPOSE_MATING_SURFACES` gate. Chat route is unregistered. View-profile “open introduction” CTA is not shown. Dormant legal/chat disclaimers are **not** attached to live Terms/Privacy/Guidelines.

### What is incomplete
- No Realtime subscription (poll only).
- No push on new message.
- No dedicated inbox / chat list surface found (entry is profile/mutual unlock only).
- No AI scanning (intentional; Legal copy states this).
- Disclaimer copy exists in two places (`mating.js` vs `legalDocuments.js`) and should be reconciled by Copy/Legal, not invented.

### What is missing
- Production-facing chat entry (intentional).
- Notifications / badge.
- Deep links to a channel.
- Moderated human-review ops path beyond existing report sheet (Legal/Product to confirm sufficiency).

---

## 3. Shared infrastructure

| Area | Repository truth |
|------|------------------|
| **Database / schema** | `paw_interests`, `mating_introduction_channels`, `mating_introduction_messages`; pet/profile mating columns; helpers (`haversine_km`, opposite-sex, same-breed, age assert). Migrations present under `supabase/migrations/`. Delete RPC aware of mating tables. |
| **Backend / API** | Supabase RPCs + RLS. No separate chat server. Client never creates channels. |
| **Auth / permissions** | Authenticated only. Owner-scoped Paw. 18+ via `age_attested_adult` / `attest_adult_account` / `account_tier`. Interim attestation is not KYC (PAW-53 still open). |
| **Notifications** | `src/lib/notifications.js` has **no** mating/chat hooks. Meetup local notifications are unrelated. |
| **Frontend / navigation** | Routes exist in source; **not mounted** when gate is false. |
| **Deep links** | None found for mating or intro chat. |
| **Safety** | Report + block on interest and chat. Link block. No open DMs. No group meetup chat. |

---

## 4. What has been removed or broken since the earlier implementation

**Removed from users (not from repo):** all entry points, via the hide wave (PAW-112 / `70f503d` on origin/main).

**Not stripped:** screens, services, RPCs, tables — matches Founder `4ac03812`.

**Broken or drifted if the gate were flipped today:**
- Radius picker vs 100 km CHECK / RPC (client save of 5/10/25/50 would fail).
- Empty-state km copy can disagree with server (25 vs 100).
- Location freshness can produce a silent empty list.
- Chat feels delayed (8s poll); no push.

**Intentionally not built:** open inbox, group chat, like counts, extra matching criteria, AI moderation.

---

## 5. Reuse / modify / rebuild

| Recover as-is | Modify before any re-expose | Rebuild |
|---------------|----------------------------|---------|
| Screens, Paw button, explore row, service module, RPCs, RLS, link guard, report/block wiring, opt-in column, hide flag | Radius product rule (Founder), empty-state copy, location-freshness UX, legal re-attach, notification decision, chat poll vs realtime | Nothing identified that must be rebuilt from zero |

---

## 6. Source conflicts (escalate; do not invent a rule)

1. **Distance model.** Product Contract + CEO mandate: user-selected geographic distance. CURRENT.md + PAW-73: automatic 100 km, no radius UI. Client still implements the old picker. **Founder decision required before implementation.**
2. **Phase placement.** Product Contract still lists mating as Phase 1 beta. CURRENT.md holds Phase 1b / Final Phase 1 and hides mating for Phase 1a Bulletin Board. This audit does **not** re-open Phase 1a scope.
3. **CURRENT.md wording** both preserves “user-selected distance only” and cites “100 km radius.” Treat as unresolved, not as license to pick.

---

## 7. Safety constraint for all follow-up work

**Do not set `EXPOSE_MATING_SURFACES = true` for normal users.**  
Do not register mating routes, restore toggles, or change production-facing copy to offer mating.

If a function needs a controlled inspection path, they report that need on their issue. CEO coordinates separately. No one flips the gate in this audit wave.

---

## 8. What CEO still needs (team-readiness layer)

Individual reports, from the repo, not from memory:

| Function | Child issue | Need |
|----------|-------------|------|
| Legal | PAW-196 | Consent, privacy, report/block, retention, 18+, Terms gaps vs live |
| Copywriter | PAW-197 | Existing vs missing/rewrite copy; what they need from Legal/Product |
| Frontend | PAW-198 | Screen/nav/state inventory; what is wired vs dead |
| Backend | PAW-199 | Schema/RPC/RLS/live-apply status; what must be repaired |
| CTO | PAW-200 | Architecture, security, realtime, go-ahead conditions |
| QA | PAW-201 | Tests, coverage, acceptance criteria |
| Tester | PAW-202 | What can be physically tested without exposing users |

Final CEO synthesis (A–J on PAW-195) happens **after** those reports, not before.
