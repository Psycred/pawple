# PAW-216 — express_paw ambiguous `from_pet_id` fix (scratch)

**Date:** 2026-09-06  
**Owner:** Backend / Data Engineer  
**Parent proof:** PAW-215 FAIL (42702)  
**Scratch project:** `uyhomshmzausgylxcwia` (`pawple-mating-chat-proof`)  
**Live:** not migrated (CTO authorization required)  
**Product hide:** `EXPOSE_MATING_SURFACES` unchanged (`false`)

## Defect

Authenticated `express_paw` returned Postgres **42702**:

`column reference "from_pet_id" is ambiguous`

Discovery RPCs worked; mutual Paw → intro channel → chat could not complete.

## Root cause

`express_paw(from_pet_id uuid, to_pet_id uuid)` parameters share names with `paw_interests` columns. Unqualified `ON CONFLICT (from_pet_id, to_pet_id)` (and related unqualified param use) collided in plpgsql. `withdraw_paw` already function-qualified its params.

## Fix

New migration only (do not edit historical migrations):

`supabase/migrations/20260906140000_express_paw_qualify_pet_ids.sql`

- Qualify params as `express_paw.from_pet_id` / `express_paw.to_pet_id` (same pattern as `withdraw_paw`).
- Conflict target: `ON CONFLICT ON CONSTRAINT paw_interests_pair_unique`.
- Behaviour unchanged: auth, age assert, ownership, rate limit (40/hour), fixed 100 km eligibility, idempotent upsert.
- EXECUTE: `authenticated` + `service_role`; revoked from `PUBLIC` / `anon`.

## Apply

```text
npx supabase db push --project-ref uyhomshmzausgylxcwia
```

Not `--linked` (CLI remains linked to live `pexurgcfkxkouthuhlnb`).

## Scratch verification (2026-09-06)

Synthetic PAW-215 accounts on scratch (`mating-proof-a/b-d9493d@…`):

| Step | Result |
|------|--------|
| `express_paw` A→B | PASS |
| `express_paw` B→A | PASS |
| `list_my_introduction_channels` open channel | PASS |
| Plain introduction message | PASS |
| URL body rejected (`link_sharing_forbidden`) | PASS |

Live was not touched. No production expose flip.

## Remaining for Tester

Re-run controlled PAW-215 Discover → Paw → Chat path against scratch to close the parent FAIL.
