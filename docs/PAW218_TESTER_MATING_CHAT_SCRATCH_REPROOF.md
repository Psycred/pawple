# PAW-218 Tester transcript — Scratch re-proof after PAW-216

Date: 2026-09-06  
Tester: d8a633e7  
Device: Android emulator Pixel_6a_New (emulator-5554)  
Platform: Windows 11 host / Android API (Pixel 6a AVD)

## Backend under test
- Project: pawple-mating-chat-proof / `uyhomshmzausgylxcwia`
- URL host confirmed: `uyhomshmzausgylxcwia.supabase.co`
- Live `pexurgcfkxkouthuhlnb`: **NOT** used for seed / Metro / authenticated mating RPCs
- Live used only as **read-only negative control** (anon RPC presence probe → still missing)
- `EXPOSE_MATING_SURFACES` remains `false` in `src/config/phase1aSurfaces.js`
- `EXPO_PUBLIC_MATING_TEST_SURFACES=1` only in gitignored `.env.development` (not committed)

## Env gate checks
| Check | Result |
|-------|--------|
| `.env.development` host = scratch | PASS |
| `EXPOSE_MATING_SURFACES = false` | PASS |
| Production fail-closed in source (`pawpleEnv === 'production'` → false) | PASS |
| Test flag gated to local/staging + flag | PASS |
| Release APK Welcome = Apple/Google only (no Dev Mode) | PASS |
| Release APK mating tabs (Discover/Match/Chat) | absent (PASS hide) |

## Synthetic seed (scratch only)
- Account A: `mating-proof-a-a2ce7f@pawple-test.invalid` / pet Proof A (Labrador male, opted in)
- Account B: `mating-proof-b-a2ce7f@pawple-test.invalid` / pet Proof B (Labrador female, opted in)
- Both adult-attested; Bengaluru-area coarse locations (~0.2 km apart)

## Discover → Paw → mutual → Chat (authenticated API against scratch)

| Step | Result | Evidence |
|------|--------|----------|
| Scratch host only | PASS | `uyhomshmzausgylxcwia.supabase.co` |
| Seed two synthetic adults | PASS | stamps `a2ce7f` |
| `get_mating_discovery_context` | PASS | opted_in=true, location_fresh=true |
| `get_mating_opportunities` | PASS | A discovers B ~0.2 km |
| `express_paw` A→B | **PASS** | no 42702 / no ambiguous `from_pet_id` |
| `express_paw` B→A (mutual) | **PASS** | no 42702 |
| Introduction channel opened | PASS | status=`open` |
| `list_my_introduction_channels` | PASS | count=1 |
| URL body rejected | PASS | `link_sharing_forbidden` |
| Plain text message accepted | PASS | |
| Counterpart can read message | PASS | Chat path |
| Discovery excludes matched B | PASS | remaining unrelated pets only |
| Live `list_my_introduction_channels` still missing | PASS | PGRST / not found (negative control) |
| Live `get_mating_discovery_context` still missing | PASS | PGRST / not found (negative control) |

## Device UI notes
1. Working-tree `OnboardingPetsScreen.js` **PARSE_OK** this run — no HEAD restore needed.
2. Debug APK + Metro: still **Unable to load script** after `adb reverse tcp:8081` (same tooling friction as PAW-215). Full in-app Discover/Chat UI walk **not** completed.
3. Release APK on emulator: Welcome shows Apple/Google only; no Dev Mode; no mating entry points — **production hide observed**.

## Verdict
**PASS** for controlled Mating Discover → Paw → mutual match → Chat **API path** on scratch after PAW-216.

Primary PAW-215 blocker (`express_paw` 42702) is **cleared** on scratch.

Residual (non-blocking for this ticket’s API acceptance): debug device Metro connect for full UI walk; QA PAW-219 owns independent controlled Beta audit.

## Explicit confirmations
- Live was **not** used for proof seed/authenticated mating writes.
- Production hide lock `EXPOSE_MATING_SURFACES=false` observed in source.
- Production-shaped / release binary does not surface mating test Dev path.
- Test flag remains gitignored `.env.development` only.
