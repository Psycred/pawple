# PAW-163 — Live delete compatibility audit (read-only)

**Project:** `pexurgcfkxkouthuhlnb` (`https://pexurgcfkxkouthuhlnb.supabase.co`)  
**Audited:** 2026-09-04 (CEO heartbeat, PAW-163)  
**Method:** Read-only PostgREST column probes + RPC existence/permission probes. No `delete_user_account` call. No Founder Google account. No production SQL applied.

---

## Executive summary

**Historical (pre-apply, 2026-09-04 morning):** Live authenticated delete **FAIL** — pre-`140000` RPC referenced `posts.user_id` (missing on live → `42703` rollback).

**Current (post-apply, 2026-09-04 afternoon):** Founder applied `140000`; Backend applied follow-up `150000` (`auth.refresh_tokens.user_id` varchar cast). **PAW-165 disposable delete proof PASS** on live (`ok: true`, `counts.auth_users` / `counts.profiles` / storage remnant checks, `getUser` → `user_not_found`).

Canonical repo migrations:

- `supabase/migrations/20260904140000_delete_user_account_legacy_owner_columns.sql` — **applied** on live
- `supabase/migrations/20260904150000_delete_user_account_refresh_tokens_varchar.sql` — **applied** on live (required after first 140000 proof attempt)

**CEO status (PAW-163):** **Done** (2026-09-04). Audit, consolidation, CTO sign-off, Backend live proof, post-apply QA (PAW-174) and Tester (PAW-175) evidence collected. **PAW-141** remains blocked on logout device proof (PAW-151 / PAW-155) and Founder Google re-onboarding gate.

---

## 1. Live RPC / helper inventory

| Function | Live status | Client callable? | Evidence |
|----------|-------------|------------------|----------|
| `delete_user_account()` | **Present** | `authenticated` only | Anon → HTTP 401, `42501` permission denied |
| `_delete_caller_storage_objects(uuid)` | **Present** | **No** | Auth probe → HTTP 403 `permission denied` |
| `_delete_caller_auth_user(uuid)` | **Present** | **No** | Auth probe → HTTP 403 `permission denied` |
| `_delete_owned_rows(text, uuid, text[])` | **Present** | **No** | Authenticated probe → HTTP 403/42501 (PAW-165) |
| `_owned_meetup_ids(uuid)` | **Present** | **No** | Anon probe → HTTP 401/42501 |

Applied on live: `20260904120000`, `20260904130000`, **`20260904140000`**, **`20260904150000`**.

---

## 2. Live column compatibility (owner / legacy tables)

Probes used authenticated throwaway session + `GET /rest/v1/{table}?select={column}&limit=0`.

| Table | Column | Live | Repo `140000` handling |
|-------|--------|------|------------------------|
| `posts` | `user_id` | **Missing** (42703) | `_delete_owned_rows(..., ['user_id','created_by','owner_id'])` — skips missing cols |
| `posts` | `created_by` | **Present** | Deleted via `_delete_owned_rows` |
| `invites` | `used_by_user_id` | **Missing** (42703) | Conditional `information_schema` guard; anonymize skipped |
| `meetups` | `organizer_id` | **Present** | `_owned_meetup_ids` |
| `meetups` | `created_by` | **Present** | `_owned_meetup_ids` |
| `meetups` | `user_id` | Expected (base schema) | `_owned_meetup_ids` |
| `paw_interests` | `to_owner_id` | **Present** | Explicit inbound delete when column exists |
| `notifications` | `user_id` / `recipient_id` | Column-safe | `_delete_owned_rows` |
| `messages` | `sender_id` / `sender_user_id` | Column-safe | `_delete_owned_rows` |
| `reports` | `reported_user_id` | Conditional | `information_schema` guard in `140000` |

**Root cause of current live failure:** Live `delete_user_account` still executes `DELETE FROM public.posts WHERE user_id = …` (pre-`140000` body). That raises `42703` after Storage GUC succeeds → full rollback.

---

## 3. Deletion transaction — tables touched

Canonical path in `140000` (single transaction, `SECURITY DEFINER`, `auth.uid()` only):

| Order | Domain | Tables / objects | Notes |
|-------|--------|------------------|-------|
| 1 | Storage | `storage.objects` (`moments`, `pet-photos`, `{user_id}/` prefix) | GUC `storage.allow_delete_query=true`; remnant check raises `storage_objects_not_deleted` |
| 2 | Moments | `likes`, `moment_pets`, `moments` | Likes on owned moments included |
| 3 | Legacy | `memories`, `posts`, `photos`, `meetup_history` | Column-safe via `_delete_owned_rows` |
| 4 | Comms | `notifications`, `messages` | Column-safe |
| 5 | Mating | `mating_introduction_messages`, `mating_introduction_channels`, `paw_interests` | Channels/messages by owner; paw inbound `to_owner_id` |
| 6 | Safety | `reports`, `pet_blocks` | Reporter + reported user when column exists |
| 7 | Meetups | `meetup_participants` (legacy `user_id` + pet/meetup), `meetup_hosts`, `meetups` | **Children before parent** — avoids `meetup_hosts_cancel_if_empty` UPDATE on rows being deleted |
| 8 | Pets | `pets` | `owner_id` cascade on junction FKs |
| 9 | Invites | `invites` | Delete unused issued; null `user_id` on used; conditional `used_by_user_id` |
| 10 | Profile | `profiles` | Before auth |
| 11 | Auth | `auth.one_time_tokens`, MFA, `refresh_tokens`, `sessions`, `identities`, `users` | `_delete_caller_auth_user`; final `auth_user_not_deleted` guard |

**Not referenced:** `matches` (no user column in repo migrations). Leftover tables without owner columns are intentionally not dropped.

---

## 4. Meetup triggers during deletion

Triggers that can fire when deleting meetup graph rows:

| Trigger | Table | Risk | Mitigation in `140000` |
|---------|-------|------|------------------------|
| `meetup_participants_count_delete` | `meetup_participants` | COUNT sync | Safe — UPDATE on meetup still exists until meetup row deleted |
| `meetup_hosts_count_delete` | `meetup_hosts` | COUNT sync | Same |
| `meetup_hosts_cancel_if_empty` | `meetup_hosts` | **UPDATE meetups** on host delete | Delete participants/hosts **before** `DELETE FROM meetups WHERE id = ANY(owned_meetup_ids)` |
| `meetup_hosts_remove_participant` | `meetup_hosts` | DELETE participant | Safe during host cleanup |
| `meetup_participants_capacity_check` | `meetup_participants` | INSERT guard | Not on DELETE path |
| `trg_meetups_assert_adult` etc. | meetup writes | Adult tier | Not on DELETE path for owned teardown |

Deletion order in `140000` matches PAW-149 Tester review: children first, owned meetups last.

---

## 5. FK / dependency posture

Base schema uses `ON DELETE CASCADE` from `auth.users` → `profiles`, `pets`, `moments`, `likes`, mating tables, `reports`, `pet_blocks`. The RPC still deletes explicitly for:

- truthful `counts` in JSON response
- legacy tables with non-`user_id` owner columns
- Storage and Auth (not FK-managed)
- invite anonymization (`ON DELETE SET NULL` semantics without losing invite audit row)
- meetup graph ordering

No additional live-only FK blockers identified in read-only probes.

---

## 6. Storage deletion

| Item | Live / contract |
|------|-----------------|
| Buckets | `moments`, `pet-photos` |
| Prefix | `name = {user_id}` OR `name LIKE '{user_id}/%'` |
| Hosted GUC | `storage.allow_delete_query` required (`20260904130000` on live) |
| Client pre-purge | `src/lib/deleteAccount.js` best-effort list/remove before RPC |
| Service role in app | **Forbidden** — client uses anon/authenticated JWT only |

---

## 7. Auth deletion

`_delete_caller_auth_user` on live: present, postgres-only execute. Clears tokens/sessions/identities then `auth.users`. RPC refuses `ok: true` if `auth.users` row remains (`auth_user_not_deleted`).

Client validates `counts.auth_users >= 1` and `counts.profiles >= 1` on first delete (`src/lib/deleteAccount.js`).

---

## 8. RLS / grants

| Surface | Expected | Live probe |
|---------|----------|------------|
| `delete_user_account` | `GRANT EXECUTE TO authenticated`; anon denied | Anon → 401/42501 |
| Internal helpers | `REVOKE ALL FROM anon, authenticated`; `GRANT TO postgres` | Auth caller → 403 |
| Direct table DELETE from client | Not used | Product Contract §10 |

---

## 9. Repo vs live delta

| Artifact | Live | Repo canonical |
|----------|------|----------------|
| `20260904120000_delete_user_account_auth_storage.sql` | Applied | Superseded by `140000` body |
| `20260904130000_delete_user_account_storage_allow_delete_query.sql` | Applied | Merged into `140000` storage helper |
| `20260904140000_delete_user_account_legacy_owner_columns.sql` | **Not applied** | **Single Production paste** |
| Client `deleteAccount.js` | Matches contract | No service-role; storage pre-purge + RPC + `signOutUser` |
| `BACKEND_DELETE_ACCOUNT_RPC.md` | Partially stale (pre-paw/mating) | Update after live PASS |

---

## 10. Consolidated production-safe implementation

**One file to apply on Production (after CTO review):**

```
supabase/migrations/20260904140000_delete_user_account_legacy_owner_columns.sql
```

Expect: **"Success. No rows returned."**  
Do **not** apply `120000`/`130000` again; do **not** use older `20260828120000` body.

Prior QA (PAW-148) and Tester (PAW-150) approved this file against the deletion contract. This audit **re-confirms** live column findings independently; no new contract gap found.

---

## 11. Acceptance gates (PAW-141 / Founder directive)

| Gate | Owner | Status |
|------|-------|--------|
| Read-only live audit | CEO | **Done** (this document) |
| CTO design review | CTO (PAW-164) | **Approved** — `140000` single Production paste |
| Production SQL apply | Founder (manual) | **Done** — `140000` + `150000` on live |
| Disposable authenticated delete proof | Backend (PAW-165) | **PASS** — throwaway account, 2026-09-04 |
| Post-apply QA contract re-gate | QA (PAW-174) | **SIGN-OFF** — live helpers present, PAW-165 counts cross-checked |
| Post-apply Tester adversarial proof | Tester (PAW-175) | **PASS** — throwaway delete on live; supersedes PAW-168 |
| Logout cold-start persistence | Frontend + QA + Tester | **PAW-151** — PAW-155 device FAIL (Settings unreachable from Feed) |
| Google same-account fresh onboarding | Tester + Founder | **Not started** — separate PAW-141 gate, never Founder first |
| No service-role in mobile app | Engineering | **Static PASS** — `deleteAccount.js` uses RPC only |

---

## 12. What would change this recommendation

- Live schema gains new user-owned tables/columns not covered by `_delete_owned_rows` guards
- Production apply succeeds but remnant checks fail (Storage or auth guard)
- New triggers on DELETE that UPDATE parent rows after parent DELETE (meetup order regression)

---

## Appendix — raw probe transcript (2026-09-04)

```
posts.user_id select → 400 column posts.user_id does not exist (42703)
posts.created_by select → 200 []
invites.used_by_user_id select → 400 column invites.used_by_user_id does not exist (42703)
meetups.organizer_id select → 200 []
meetups.created_by select → 200 []
paw_interests.to_owner_id select → 200 []
_delete_owned_rows → 404 PGRST202 (not on live)
_owned_meetup_ids → 404 PGRST202 (not on live)
_delete_caller_storage_objects → 403 permission denied (exists, not client-callable)
_delete_caller_auth_user → 403 permission denied (exists, not client-callable)
delete_user_account (anon) → 401/42501 permission denied (exists, authenticated-only)
```
