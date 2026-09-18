# PAW-199 — Backend Mating Match + Chat readiness report

**Authority:** PAW-199 (child of PAW-195)  
**Author:** Backend / Data Engineer  
**Date:** 2026-09-06  
**Scope:** Current repository + read-only live schema/RPC probes. No implementation. Feature remains hidden.  
**Live target:** project `pexurgcfkxkouthuhlnb` (`.env.production`, anon `limit=0` / RPC existence only). No writes. No migrations applied.

This document is **not** a go-ahead to re-expose Mating Match + Chat.  
`EXPOSE_MATING_SURFACES` remains `false`. No routes, toggles, or production-facing visibility were changed.

---

## Verdict (backend)

| Surface | Repo backend | Live objects | Rebuild? |
|---------|--------------|--------------|----------|
| **Mating Match** | Present and server-authoritative | Tables + write RPCs exist | **No** — recover and repair |
| **Introduction Chat** | Present; mutual-Paw only; no open DMs | Tables exist | **No** — recover and repair |

Backend can support a later re-expose **after** product/legal decisions and a short repair list. It cannot honestly claim “ready to flip the gate today.”

---

## 1. Existing database / schema / models

Canonical migrations (in apply order):

| File | Role |
|------|------|
| `20260101000000_base_schema.sql` | `pets.is_looking_for_companion` (later comment-corrected) |
| `20260605110000_profiles_last_location.sql` | `profiles.last_location_lat/lng`, `location_updated_at` |
| `20260714210000_pets_is_looking_for_companion.sql` | Idempotent companion flag |
| `20260715200000_pets_traits.sql` | `pets.traits jsonb` (descriptive only) |
| `20260830100000_honesty_safety_rls_visibility.sql` | `reports`, `pet_blocks`; companion flag must not gate pet visibility |
| `20260830200000_mating_paw_interest_chat.sql` | Mating tables, helpers, RPCs, chat RLS, export/delete coverage |
| `20260831100000_mating_fixed_100km_radius.sql` | Fixed 100 km in RPCs + column CHECK |
| `20260831110000_phase1a_city_location.sql` | Meetup city-only; **mating still uses `last_location_*`** |
| `20260831120000_phase1a_chat_link_block.sql` | Link-reject trigger on message INSERT |
| `20260831200000_phase1a_account_tier.sql` | Adult assert; message adult trigger; tighter INSERT RLS |
| `20260904120000` / `20260904140000` | `delete_user_account` still deletes mating rows |

### Pet / profile mating columns

| Object | Columns / constraints |
|--------|------------------------|
| `pets` | `is_looking_for_companion boolean NOT NULL DEFAULT false` — canonical opt-in (“Open to Companionship”). Does **not** gate community RLS visibility (Honesty G). |
| `pets` | `mating_description text` + `CHECK (NULL OR char_length <= 200)`. Descriptive only. Not an eligibility criterion. |
| `pets` | `traits jsonb NOT NULL DEFAULT '[]'`. Returned by discovery RPC. **Not** a matching criterion. |
| `pets` | `breed text`, `gender text`, `age text`. Age is returned; **not** used in eligibility. Gender eligibility is Male/Female only (`pets_are_opposite_sex`). |
| `profiles` | `mating_discovery_radius_km integer NOT NULL`. **Latest repo CHECK: `= 100` only.** Default 100. Earlier migration allowed `(5, 10, 25, 50)`. |
| `profiles` | `age_attested_adult boolean NOT NULL DEFAULT false`, `account_tier text CHECK ('adult','teen')`, `birth_date date`, `age_attested_at timestamptz`. Client UPDATE on attestation columns is revoked; `attest_adult_account` is the write path. |
| `profiles` | `last_location_lat/lng`, `location_updated_at`. Approximate, overwrite-only, no history. Client SELECT revoked in repo (Honesty B). Used only inside SECURITY DEFINER mating RPCs. |

### `paw_interests`

Directional Paw. Mutuality is derived. No reject/pass/hide status.

| Column | Notes |
|--------|--------|
| `id` | uuid PK |
| `from_pet_id`, `to_pet_id` | FK `pets` ON DELETE CASCADE; `UNIQUE (from_pet_id, to_pet_id)`; `CHECK` distinct pets |
| `from_owner_id`, `to_owner_id` | FK `auth.users` ON DELETE CASCADE; `CHECK` distinct owners |
| `created_at` | timestamptz |

Indexes: inbound `(to_pet_id, created_at DESC)`, outbound `from_pet_id`, owner indexes.

RLS: SELECT for sender, or inbound owner **only while target pet remains opted in**; INSERT denied (RPC only); DELETE own outbound; UPDATE denied.

### `mating_introduction_channels`

Consent-gated pair channel. Client cannot INSERT/UPDATE/DELETE.

| Column / CHECK | Notes |
|----------------|--------|
| Ordered pair | `pet_low_id < pet_high_id`, unique pair |
| Owners | `owner_low_id` / `owner_high_id`, distinct |
| `status` | `'open' \| 'frozen'` |
| `freeze_reason` | NULL or `'mutual_broken' \| 'block' \| 'opt_out' \| 'admin'` |
| `opened_at`, `frozen_at` | |

### `mating_introduction_messages`

Text only. No attachments. `CHECK char_length(trim(body)) BETWEEN 1 AND 2000`.

### Triggers (repo)

| Trigger | Event | Effect |
|---------|--------|--------|
| `trg_paw_interests_sync_channel_insert` | AFTER INSERT `paw_interests` | If mutual + not blocked → INSERT/re-open channel |
| `trg_paw_interests_freeze_channel_delete` | AFTER DELETE `paw_interests` | If mutuality broken → freeze `mutual_broken` |
| `trg_pets_mating_opt_out` | AFTER UPDATE OF `is_looking_for_companion` | Opt-out: delete **outbound** Paws; freeze open channels `opt_out`; inbound retained for report evidence |
| `trg_pets_mating_age_on_opt_in` | BEFORE INSERT/UPDATE OF opt-in | `assert_mating_age_ok(owner)` |
| `trg_pet_blocks_freeze_mating_channels` | AFTER INSERT `pet_blocks` | Freeze `block` |
| `trg_pet_blocks_reopen_mating_channels` | AFTER DELETE `pet_blocks` | Re-open only if still mutual and no remaining pair block |
| `trg_mating_introduction_messages_reject_links` | BEFORE INSERT messages | `link_sharing_forbidden` |
| `trg_mating_introduction_messages_assert_adult` | BEFORE INSERT messages | `assert_adult_account_ok(sender)` |

No admin-freeze RPC exists for `freeze_reason = 'admin'`. The CHECK allows it; nothing in repo writes it.

### Live column markers (anon, `limit=0`)

All of the following returned **HTTP 200** (object/column exists in live PostgREST schema):

`paw_interests.id`, `to_owner_id`, `from_pet_id`;  
`mating_introduction_channels.id/status/freeze_reason`;  
`mating_introduction_messages.id/body`;  
`pets.mating_description`, `is_looking_for_companion`, `traits`;  
`profiles.mating_discovery_radius_km`, `age_attested_adult`, `account_tier`, `age_attested_at`, `last_location_lat`;  
`reports.target_type`; `pet_blocks.blocked_pet_id`.

This is existence, not row visibility. Anon RLS still applies. It does **not** prove the live CHECK on `mating_discovery_radius_km` is `= 100` versus the older `(5,10,25,50)` set.

---

## 2. Existing Mating Match logic

### RPCs

| Function | Grant (repo) | Behaviour |
|----------|--------------|-----------|
| `get_mating_opportunities(viewer_pet_id)` | `authenticated` | Auth + adult + owned pet + opted in. Fixed **100 km** (latest body). Fresh viewer location required or **empty return** (no error). Closest-first. Returns approximate `distance_km` only. Never raw coordinates. |
| `express_paw(from, to)` | `authenticated` | Auth + adult + owned from-pet + eligibility + **40 Paws / owner / hour**. Idempotent upsert. |
| `withdraw_paw(from, to)` | `authenticated` | Auth required. Deletes own directional row. Channel freeze is trigger-driven. |
| `mating_eligible_pair(...)` | **Revoked from PUBLIC; not granted to clients** (intended internal) | Criteria below. |
| `pets_have_mutual_paw(x, y)` | `authenticated` | Derived boolean. SECURITY DEFINER. **No caller-ownership check.** |
| `assert_mating_age_ok` | Internal alias | Delegates to `assert_adult_account_ok` (`account_tier = adult` AND `age_attested_adult`). |
| `attest_adult_account(birth_date)` | `authenticated` | Server-authoritative 18+ write. |

### Eligibility criteria (server)

Enforced in `mating_eligible_pair`:

1. Both pets exist, distinct, **different owners**
2. Both `is_looking_for_companion IS TRUE`
3. Same breed (trimmed, case-insensitive, empty breed ineligible)
4. Opposite sex (male/female only; other/unknown ineligible)
5. Not blocked (`mating_pair_blocked_for_viewer`)
6. Viewer location present + `profile_location_is_fresh` (**24 hours**)
7. Candidate owner location present + fresh
8. Haversine distance `<=` radius (latest RPCs hardcode **100**)

**Not** criteria: pet age, traits, bio, vaccination, appearance, scores, AI, swipe/hide.

Honesty: `haversine_km` returns NULL on missing/invalid coords — never fabricates.

### Radius (material product/contract split)

| Layer | Truth |
|-------|--------|
| Latest server RPCs | Constant `100` |
| Latest column CHECK | `mating_discovery_radius_km = 100` |
| Client `src/services/mating.js` | `MATING_RADIUS_KM_OPTIONS = [5,10,25,50]`, default **25**; `updateMatingRadiusKm` writes those values |
| Product Contract | User-selected distance/radius |
| CURRENT.md | Simultaneously “user-selected distance only” and “100 km radius” |

If the 100 km CHECK is live, a client radius save of 5/10/25/50 **fails**. Discovery empty copy on the client can still interpolate 25 km. **Backend must not silently pick a rule.** Founder/Product decision required.

### Age

Fail-closed on the **owner**, not the pet:

- Opt-in trigger → `assert_mating_age_ok`
- Discovery / `express_paw` → same
- Message INSERT RLS + adult trigger
- Client also calls `assertClientMatingAgeOk` (local age-gate helper)

Teen tier exists in schema only. No client write path.

### Location freshness

`location_updated_at > now() - 24 hours`. Stale/missing viewer location → discovery returns **[]** (looks like “no matches”). Stale candidate → excluded. Meetup surfaces no longer store device coords; mating still depends on `profiles.last_location_*`.

### Live RPC markers (anon)

| RPC | Live result | Meaning |
|-----|-------------|---------|
| `get_mating_opportunities` | HTTP 403 `28000 not_authenticated` | Exists; auth-gated |
| `express_paw` | HTTP 403 `28000 not_authenticated` | Exists; auth-gated |
| `withdraw_paw` | HTTP 403 `28000 not_authenticated` | Exists; auth-gated |
| `attest_adult_account` | HTTP 403 `28000 not_authenticated` | Exists; auth-gated |
| `export_user_data` | HTTP 403 `28000 not_authenticated` | Exists; auth-gated |
| `pets_have_mutual_paw` | HTTP **200** | Exists; **anon EXECUTE succeeded** |
| `mating_eligible_pair` | HTTP **200** | Exists; **anon EXECUTE succeeded** |
| `assert_mating_age_ok` | HTTP 401 `age_attestation_required` | Exists; **anon EXECUTE reached the function body** |
| `introduction_message_body_contains_link` | HTTP 200 | Exists (harmless immutable helper) |

Repo intent: `mating_eligible_pair` and `assert_mating_age_ok` are not client APIs. Live anon EXECUTE is a **grant/apply drift** to escalate to CTO before any re-expose. This probe did not read real user rows.

Full authenticated smoke of discovery + 100 km CHECK was **not** run (would require a controlled test account path).

---

## 3. Existing Chat logic

Model: **mutual-Paw introduction only**. Not open DMs. Not meetup group chat. No attachments.

### Channel create / freeze

- **Create / re-open:** trigger on Paw INSERT when both directions exist and pair is not blocked. `ON CONFLICT` re-opens and clears freeze. Client INSERT policy is `WITH CHECK (false)`.
- **Freeze `mutual_broken`:** Paw DELETE when mutuality ends.
- **Freeze `opt_out`:** pet leaves companionship; outbound Paws deleted.
- **Freeze `block`:** `pet_blocks` INSERT involving a channel pet/owner.
- **Re-open after unblock:** only if mutual Paw still exists and no remaining pair block. Quiet — no celebration entity.

### Message INSERT RLS (current, after account-tier migration)

`WITH CHECK` requires all of:

- `sender_user_id = auth.uid()`
- caller `account_tier = adult` AND `age_attested_adult`
- caller is a channel owner
- `status = 'open'`
- live `pets_have_mutual_paw`
- no reciprocal `pet_blocks` on the pair

SELECT: channel participants only. UPDATE/DELETE denied.

### Link trigger

`introduction_message_body_contains_link`: `https?://`, `www.`, or bare `domain.tld` with a fixed TLD list. Phones are not matched. BEFORE INSERT raises `link_sharing_forbidden`. Client mirror: `src/lib/introChatLinkGuard.js`.

### Adult trigger

`mating_assert_adult_on_message` → `assert_adult_account_ok(sender)` on every INSERT.

No Realtime publication, no `supabase.channel` usage, no chat inbox table, no message edit/delete, no pagination RPC.

---

## 4. Existing APIs / services

There is **no separate chat/mating server**. Contract is Supabase JS + RPCs + RLS.

`src/services/mating.js`:

- `fetchMatingOpportunities` → `get_mating_opportunities`
- `expressPaw` / `withdrawPaw` → RPCs
- `fetchOutboundPaw` / `fetchInboundInterest` / `fetchPawInterestForPair` → SELECT `paw_interests`
- `petsHaveMutualPaw` → RPC
- `fetchIntroductionChannelForPair` / `ById` → SELECT only
- `fetchIntroductionMessages` / `sendIntroductionMessage` → SELECT / INSERT messages
- `fetchMatingRadiusKm` / `updateMatingRadiusKm` → **client radius path drifted from server 100 km**
- `updateMatingDescription` → owner UPDATE `pets`

Related:

- `src/services/reports.js` — `mating_interest` \| `introduction_chat`
- `src/services/blocks.js` — `pet_blocks`
- `src/services/pets.js` — selects `mating_description`, `is_looking_for_companion`, `traits`

UI gate: `src/config/phase1aSurfaces.js` `EXPOSE_MATING_SURFACES = false`. This is **not** authorization.

Export: `export_user_data` includes caller `paw_interests` (outbound **and** inbound on owned pets), channels, and **all messages in those channels** (including counterpart bodies). Flag for Legal: participant archive vs “exclude other users’ private data.”

Delete: latest `delete_user_account` deletes messages/channels, then `paw_interests` including `to_owner_id` inbound, plus reports/blocks.

---

## 5. Existing authentication / authorization

| Control | Repo truth |
|---------|------------|
| Auth | `auth.uid()` on write RPCs. Unauthenticated write RPCs fail closed (confirmed live). |
| Ownership | Discovery and Paw only for pets the caller owns. |
| Channel writes | SECURITY DEFINER triggers only. |
| Message writes | Participant + open + mutual + adult + no block. |
| Age | Server residual; client cannot UPDATE attestation columns (RLS test exists). |
| Location | Exact coords not selectable by clients in repo; distance only via RPC. |
| Rate limit | 40 outbound Paws / owner / hour. |
| Pets SELECT | Authenticated `USING (true)` — companion flag is display-only. Mating description is readable community profile text. |
| Profiles UPDATE | Owner can still UPDATE `mating_discovery_radius_km` (CHECK is the real limiter). |

### Authorization gaps (do not treat as product features)

1. **Live anon EXECUTE** on `mating_eligible_pair`, `pets_have_mutual_paw`, `assert_mating_age_ok` — repo intended these locked down (especially `mating_eligible_pair`).
2. `pets_have_mutual_paw` has no “caller is a participant” predicate. Any role that can EXECUTE can test arbitrary pet pairs.
3. UI hide is not RLS. Hidden screens do not prevent a crafted client from calling RPCs if the user is authenticated, adult, opted in, and in range.

---

## 6. Notifications / realtime

**Absent for mating and introduction chat.**

- `src/lib/notifications.js` — permission helpers only. No mating/chat hooks.
- Meetup local notifications are unrelated.
- No `notifications` / generic `messages` tables in versioned migrations.
- No `CREATE PUBLICATION` / `supabase.channel` usage in repo.
- Chat UI polls every **8 seconds** while focused (`MatingIntroductionChatScreen.js`). Fail-closed still depends on RLS.

Push on Paw or new message does **not** exist. Inbox / unread / badge do **not** exist.

---

## 7. Moderation / block / report

| Mechanism | What exists | What does not |
|-----------|-------------|----------------|
| **Block** | `pet_blocks` (user blocks a **pet**). Own SELECT/INSERT/DELETE. Mating helper + channel freeze/reopen. | No user-to-user block table. No hide/reject deck. |
| **Report** | `reports` with `target_type IN ('moment','meetup','mating_interest','introduction_chat')`. Reporter pet + `reported_user_id`. User INSERT/own SELECT. Status `open\|reviewed\|actioned\|dismissed`. | No user UPDATE/DELETE. No in-repo review queue, SLA, or service_role workflow. Team review is implied, not implemented. |
| **Link block** | DB trigger + client guard. | Not AI scanning (intentional). |
| **Opt-out quieting** | Inbound Interest SELECT requires target still opted in. | Inbound rows remain for evidence. |
| **Admin freeze** | CHECK allows `admin`. | No RPC, no role, no audit trail writer. |

RLS suite (`scripts/rls-security-tests.js`) covers: mutual Paw opens channel; URL and bare-domain rejected; phone and plain text allowed. It does **not** cover: discovery RPC, 100 km CHECK, stale-location empty set, withdraw freeze, block freeze, opt-out, age-denied opt-in, or unauthorized message INSERT.

---

## 8. What is functional

If an authenticated, 18+ attested owner of an opted-in pet has a fresh approximate location, and a counterpart meets the same conditions:

- Server can list in-range opposite-sex same-breed opted-in pets with honest `distance_km`.
- Server can accept/withdraw directional Paw (RPC, not client INSERT).
- Mutual Paw can open an introduction channel; participants can SELECT it.
- Participants can INSERT text messages while open + mutual + adult + unblocked.
- Links are rejected at INSERT; phones are allowed (repo + RLS test).
- Freeze on withdraw / opt-out / block; quiet reopen after unblock when still mutual.
- Export and delete RPCs include mating tables (delete later hardened for `to_owner_id`).
- Live project has the mating tables and auth-gated write RPCs.

---

## 9. What is incomplete

1. **Radius contract unresolved** — server 100 km vs client 5/10/25/50 vs Product Contract user-selected.
2. **Live helper EXECUTE drift** — anon could invoke `mating_eligible_pair` / `pets_have_mutual_paw` / `assert_mating_age_ok` in this probe.
3. **No authenticated live smoke** of discovery, 100 km CHECK, stale-location behaviour, or freeze paths on this project.
4. **Silent empty discovery** when location is stale/missing.
5. **No mating/chat notifications or Realtime.**
6. **No chat inbox / list / unread.**
7. **No report-review operations path.**
8. **No admin freeze writer** despite CHECK value.
9. **Discovery query** is `pets` × eligibility (no pagination, no mating-specific index). Acceptable for a small Beta; not a scale design.
10. **Export** includes counterpart chat bodies and inbound Paw rows — Legal must confirm.
11. **RLS tests** do not lock radius, freshness, freeze, or deny-message cases.
12. **UI remains hidden** (intentional). Hidden ≠ unauthorized.

---

## 10. What must be added or repaired

**Do not implement until Founder/Product/Legal/CTO settle the items in §11.** Repair list when authorized:

1. **Radius:** implement the **decided** rule only. If 100 km stays: stop client writes of 5/10/25/50 (Frontend) and keep CHECK/RPC aligned. If user-selected returns: new migration to restore allowed values and stop hardcoding 100. Do not ship both.
2. **Grants:** revoke client/anon EXECUTE on `mating_eligible_pair` and `assert_mating_age_ok`. Tighten `pets_have_mutual_paw` (participant-only or RLS-only use). Verify live matches repo.
3. **Controlled verification path** (not a user-facing gate flip): authenticated pairing test for discovery, Paw, mutual channel, link deny, freeze, export, delete. See §11.
4. **Location freshness:** server behaviour is honest; Frontend/Product must not present empty as “nobody nearby” without a stale-location state. Backend should not fabricate rows.
5. **Notifications / Realtime:** only if Product/CTO approve. Today there is nothing to “turn on.” Do not add speculative queues.
6. **Moderation ops:** if Legal requires human review of `mating_interest` / `introduction_chat`, that is a new service_role workflow — not present.
7. **Export redaction:** only if Legal says counterpart messages / inbound Paw owners must be stripped or anonymized.

---

## 11. What Backend needs before proceeding

| From | Need |
|------|------|
| **Founder / Product** | Binding **distance model** (fixed 100 km vs user-selected). Do not ask Backend to invent this. |
| **Founder / Product** | Confirm Phase 1b / later re-expose is authorized at all. Phase 1a stay-hidden remains binding. |
| **Founder / Product** | Notifications, inbox, and Realtime: required for launch, or poll-only is acceptable. |
| **Legal** | Export of counterpart messages and inbound Paw identifiers. Retention of inbound Paw after opt-out. Sufficiency of report+block without a review console. 18+ attestation vs KYC wording. |
| **Legal / Copy** | Chat disclaimer lives in `mating.js` and legal docs; Backend will not invent copy. |
| **Frontend** | After radius decision: remove or realign the 5/10/25/50 writer. Keep `EXPOSE_MATING_SURFACES = false` until CEO/Founder say otherwise. |
| **CTO** | Live GRANT drift on helper RPCs; whether a **controlled** authenticated test path (dev/staging only, or a service-role QA script) is authorized. Architecture for Realtime if Product wants it. |
| **QA / Tester** | A path that does **not** set `EXPOSE_MATING_SURFACES = true` for normal users. Backend recommendation: extend `scripts/rls-security-tests.js` (or a staging-only sibling) to cover discovery, radius CHECK, stale location, freeze, and deny-INSERT. |

**Controlled test path (requested, not built):** Backend needs an explicit CTO/QA-approved authenticated probe against staging (or local Supabase), using synthetic accounts, with the UI gate still false. Do not use production user data. Do not expose the feature.

---

## Backend recommendation to CEO / CTO

- **Reuse, do not rebuild** the mating schema, RPCs, RLS, and chat triggers.
- **No-GO to re-expose** until: radius rule is decided; live helper GRANTs are reconciled; Legal signs export/moderation; a controlled authenticated smoke exists.
- **Do not** treat this report as permission to flip `EXPOSE_MATING_SURFACES`.
