# PAW-215 Tester transcript — Controlled Mating/Chat on PAW-214 scratch

Date: 2026-09-06
Tester: d8a633e7
Device: Android emulator Pixel_6a_New (emulator-5554)
Platform: Windows 11 host / Android API (Pixel 6a AVD)

## Backend under test
- Project: pawple-mating-chat-proof / uyhomshmzausgylxcwia
- URL host confirmed: uyhomshmzausgylxcwia.supabase.co
- Live pexurgcfkxkouthuhlnb: NOT used for app Metro env or seed/API proof
- EXPOSE_MATING_SURFACES remains false in src/config/phase1aSurfaces.js
- EXPO_PUBLIC_MATING_TEST_SURFACES=1 only in gitignored .env.development (not committed)

## Env gate checks
- Metro loaded .env.development including scratch URL + MATING_TEST_SURFACES
- Production-shaped fail-closed: pawpleEnv=production => areMatingSurfacesVisible false even if test flag=1 (code-path check)
- Release APK on device: Welcome shows Apple/Google only — no Dev Mode (__DEV__ false). Mating test path not available in release binary (expected hide)

## Synthetic seed (scratch only)
- Account A: mating-proof-a-d9493d@pawple-test.invalid / pet Proof A (Labrador male, opted in)
- Account B: mating-proof-b-d9493d@pawple-test.invalid / pet Proof B (Labrador female, opted in)
- Both adult-attested; fresh Bengaluru-area coarse locations

## Discover ? Paw ? Chat results (authenticated API against scratch)

| Step | Result | Evidence |
|------|--------|----------|
| get_mating_discovery_context | PASS | opted_in=true, location_fresh=true |
| get_mating_opportunities | PASS | A discovers B ~0.2 km |
| express_paw (A?B) | FAIL | Postgres 42702: column reference "from_pet_id" is ambiguous |
| Mutual Paw / intro channel via RPC | FAIL | blocked by express_paw |
| list_my_introduction_channels (pre-match) | PASS | empty list HTTP path OK (auth) |
| Anon repair RPC presence | PASS | list_my_introduction_channels + get_mating_discovery_context return 401/42501 (present, not 404). Live still 404 per PAW-214. |

Forced service-role mutual paw_interests insert (bypass only): discovery correctly excludes matched B (PASS). Channel trigger did not open under service_role (auth.uid() null fail-closed in pets_have_mutual_paw) — expected; authentic express_paw is required.

## Device UI notes
1. Working-tree OnboardingPetsScreen.js PARSE_FAIL: Expected corresponding JSX closing tag for <> (1135:12) — same class of defect as PAW-212. Temporarily swapped to HEAD for Metro parse only; restored after.
2. Release APK: launches embedded bundle; Welcome/Feed reachable; mating tabs not shown (release / __DEV__ false).
3. Existing debug APK: Unable to load script from Metro (adb reverse + expo start). expo run:android rebuild FAILED (Gradle metadata.bin cache corruption). Full in-app Discover/Chat UI walk not completed.

## Verdict
**FAIL** for controlled Mating Discover ? Paw ? Chat proof on scratch.

Primary blocker for product path: **express_paw RPC broken on scratch** (ambiguous from_pet_id). Discovery works; Paw/Chat path cannot complete.

Secondary: working-tree OnboardingPetsScreen JSX break; debug device Metro/Gradle tooling friction.

## Continuation heartbeat (2026-09-06, run 2ba88fce)
Re-probe on scratch only (fresh synthetic pair `mating-proof-*-253b1a@pawple-test.invalid`):

| Step | Result |
|------|--------|
| Host uyhomshmzausgylxcwia | PASS |
| Live pexurgcfkxkouthuhlnb | not used |
| Seed two adults | PASS |
| Discovery context + opportunities | PASS (A sees B ~0.2 km) |
| express_paw | **FAIL** still — `column reference "from_pet_id" is ambiguous` |

CEO chain: fix **PAW-216** ? Tester re-proof **PAW-220** ? QA **PAW-219**. This ticket (PAW-215) closed FAIL; re-proof on PAW-220.

## Re-proof after PAW-216 (2026-09-06, PAW-220)
Fresh synthetic pair `mating-proof-*-564bbe@pawple-test.invalid` on scratch only:

| Step | Result |
|------|--------|
| Host uyhomshmzausgylxcwia | PASS |
| Live pexurgcfkxkouthuhlnb | not used (anon list RPC still 404 PGRST202) |
| Seed two adults | PASS |
| Discovery context + opportunities | PASS (A sees B ~0.2 km) |
| express_paw A?B and B?A | **PASS** (no 42702) |
| list_my_introduction_channels open | PASS |
| Plain message OK; URL rejected | PASS (`link_sharing_forbidden`) |
| EXPOSE_MATING_SURFACES=false | confirmed |

**Verdict: PASS.** Full transcript: `docs/PAW220_TESTER_MATING_CHAT_REPROOF.md`.

## Explicit confirmations
- Live was not used for this proof seed/API run.
- Production hide lock EXPOSE_MATING_SURFACES=false observed in source.
- Production-shaped / release binary does not surface mating test Dev path.
