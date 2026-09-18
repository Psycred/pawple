# PAW-220 Tester transcript — Re-proof after PAW-216 express_paw fix

Date: 2026-09-06  
Tester: d8a633e7  
Parent: PAW-216 (`express_paw` 42702 fix applied on scratch)  
Prior FAIL: PAW-215

## Backend under test
- Project: pawple-mating-chat-proof / `uyhomshmzausgylxcwia`
- URL host confirmed: `uyhomshmzausgylxcwia.supabase.co`
- Live `pexurgcfkxkouthuhlnb`: **not used** for seed/API writes
- Live anon probe (read-only): `list_my_introduction_channels` still **404 PGRST202** (repair RPCs absent on live — expected)
- `EXPOSE_MATING_SURFACES` remains `false` in `src/config/phase1aSurfaces.js`

## Synthetic seed (scratch only)
- Account A: `mating-proof-a-564bbe@pawple-test.invalid` / pet Proof A (Labrador male, opted in)
- Account B: `mating-proof-b-564bbe@pawple-test.invalid` / pet Proof B (Labrador female, opted in)
- Both adult-attested; fresh Bengaluru-area coarse locations

## Discover → Paw → Chat results (authenticated API against scratch)

| Step | Result | Evidence |
|------|--------|----------|
| get_mating_discovery_context | PASS | opted_in=true, location_fresh=true |
| get_mating_opportunities | PASS | A discovers B ~0.2 km |
| express_paw (A→B) | **PASS** | no 42702 |
| express_paw (B→A mutual) | **PASS** | no 42702 |
| list_my_introduction_channels | PASS | count=1 open channel `a9c72de3-…` |
| URL / link body | PASS | rejected `link_sharing_forbidden` |
| Plain text message | PASS | accepted; B can read |

## Verdict
**PASS** for controlled Mating Discover → Paw → Chat proof on scratch after PAW-216.

Primary PAW-215 blocker (`express_paw` ambiguous `from_pet_id` / 42702) is cleared on scratch.

## Explicit confirmations
- Live was not used for this proof seed/API run.
- Production hide lock `EXPOSE_MATING_SURFACES=false` observed in source.
- Scope: authenticated API path only (same controlled proof as PAW-215); full in-app UI walk not required to close the express_paw regression.

## Handoff
CTO / CEO: PAW-215 FAIL is re-proven fixed on scratch. Next gate: QA independent audit (PAW-219 / controlled Beta readiness remains CEO NOT READY until QA).
