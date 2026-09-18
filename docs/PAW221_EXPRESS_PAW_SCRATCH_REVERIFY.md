# PAW-221 — express_paw 42702 on scratch (reverify / close)

**Date:** 2026-09-06  
**Owner:** Backend / Data Engineer  
**Scratch:** `uyhomshmzausgylxcwia` (`pawple-mating-chat-proof`)  
**Live:** not migrated (CTO/Founder authorization required)  
**Product hide:** `EXPOSE_MATING_SURFACES` unchanged (`false`)

## Relationship to PAW-216

PAW-221 restates the same PAW-215 FAIL (`express_paw` Postgres **42702** ambiguous `from_pet_id`).

The fix already shipped under **PAW-216**:

- Migration: `supabase/migrations/20260906140000_express_paw_qualify_pet_ids.sql`
- Approach: function-qualify params (`express_paw.from_pet_id` / `express_paw.to_pet_id`) + `ON CONFLICT ON CONSTRAINT paw_interests_pair_unique`
- Applied on scratch only via `npx supabase db push --project-ref uyhomshmzausgylxcwia`
- Doc: `docs/PAW216_EXPRESS_PAW_AMBIGUOUS_FIX.md`

No additional migration was required for PAW-221. Param rename to `p_from_pet_id` / `p_to_pet_id` would change the PostgREST named-arg contract used by `src/services/mating.js`; qualify preserves the existing client contract and clears 42702 on PG 17.

## Before (PAW-215 FAIL)

Authenticated `express_paw(from_pet_id, to_pet_id)` on scratch:

| Field | Value |
|-------|--------|
| code | **42702** |
| message | `column reference "from_pet_id" is ambiguous` |
| details | *It could refer to either a PL/pgSQL variable or a table column.* |

Discovery RPCs on the same seeded pair passed; mutual Paw / intro channel could not run.

## After (this heartbeat, scratch only)

Synthetic PAW-215 accounts (`mating-proof-*-d9493d@pawple-test.invalid`):

| Step | Result | Evidence |
|------|--------|----------|
| get_mating_opportunities | PASS | A discovers B (`hasB=true`) |
| express_paw A→B | PASS | interest id `1bbe8e35-…` (no 42702) |
| express_paw B→A | PASS | interest id `e0e88f83-…` (no 42702) |
| list_my_introduction_channels | PASS | open channel `bf61ee2e-…` |
| plain introduction message | PASS | accepted |
| URL body | PASS | rejected `link_sharing_forbidden` |

Live `pexurgcfkxkouthuhlnb` was not touched. `EXPOSE_MATING_SURFACES` remains `false`.

## Tester wake

Re-proof ownership: **PAW-218** (Tester, Mating/Chat scratch re-proof after express_paw fix). PAW-220 already recorded an independent PASS; PAW-218 remains the open Tester gate on the CEO chain.
