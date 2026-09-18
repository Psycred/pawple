# PAW-214 — Non-live Mating/Chat proof backend

**Authority:** PAW-214 / PAW-211 runbook / PAW-203 §2  
**Owner:** CTO  
**Date:** 2026-09-06  
**Production hide:** `EXPOSE_MATING_SURFACES = false` (unchanged)

This is the named backend for controlled Tester/QA Mating/Chat proof.
It is **not** live. It is **not** production expose.

---

## Named backend

| Field | Value |
|-------|--------|
| Name | `pawple-mating-chat-proof` |
| Project ref | `uyhomshmzausgylxcwia` |
| URL | `https://uyhomshmzausgylxcwia.supabase.co` |
| Region | `ap-northeast-1` |
| Purpose | Scratch proof only — synthetic accounts, no real users |
| Live project (do not use) | `pexurgcfkxkouthuhlnb` |

## Apply method

`npx supabase db push --project-ref uyhomshmzausgylxcwia` from this repo.

Includes `20260906120000_mating_chat_repair_wave.sql`.

Scratch-only preflights (not run on live, not committed):

1. Drop legacy `meetup_participants_*` policies so historical `20260714200000` can drop `user_id`.
2. Pre-create `public.paw_interests` so historical `20260830200000` can create `pets_have_mutual_paw` on an empty project.

Local CLI remains **linked to live**. Do **not** `db push --linked`. Docker / `supabase start` is **not** available on this workstation (no Docker, no WSL).

## Live was not migrated

Read-only probes after scratch apply. Live: anon only, no writes. Scratch auth: throwaway admin-created synthetic user (not a live user).

| RPC | Live `pexurgcfkxkouthuhlnb` | Scratch `uyhomshmzausgylxcwia` |
|-----|------------------------------|--------------------------------|
| `list_my_introduction_channels` | **404 PGRST202** | anon **401 42501**; authenticated **200** `[]` |
| `get_mating_discovery_context` (`viewer_pet_id`) | **404 PGRST202** | anon **401 42501**; authenticated **403 42501** `forbidden_pet` (dummy unowned pet — function present, not 404) |

Anon 401/403 is expected. Authenticated 404 would mean the repair RPCs are missing.

**CEO re-verification (2026-09-06, PAW-214 close):** both scratch RPCs still present; live still missing both.

---

## Tester env steps (gitignored `.env.development` only)

Do **not** flip `EXPOSE_MATING_SURFACES`.  
Do **not** commit `EXPO_PUBLIC_MATING_TEST_SURFACES=1`.  
Do **not** point Metro at live.

1. Edit **gitignored** `.env.development` (copy from `.env.development.example` if needed).
2. Use **exactly** this shape — replace the anon key from the PAW-214 issue comment or from a CTO-provided local file, never from `.env.production`:

```
EXPO_PUBLIC_PAWPLE_ENV=development
EXPO_PUBLIC_SUPABASE_URL=https://uyhomshmzausgylxcwia.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<scratch anon key>
EXPO_PUBLIC_MATING_TEST_SURFACES=1
```

3. Confirm the URL host is `uyhomshmzausgylxcwia`. If you see `pexurgcfkxkouthuhlnb`, stop.
4. Restart Metro after saving. `EXPO_PUBLIC_*` is not picked up without a restart.
5. Local Metro (`__DEV__`) + this flag shows Discover/Match and Chat per `areMatingSurfacesVisible()`. Production builds stay hidden.
6. Create **two new synthetic adult accounts** on this scratch backend (PAW-211 seed). Do not reuse live parents/pets. Local Metro may use the existing development bootstrap invite path; do not change frozen invite files.
7. Service role / DB password are **not** for the app and are not in this document.

### Fail-closed reminder

`areMatingSurfacesVisible()` returns false when `EXPO_PUBLIC_PAWPLE_ENV=production`, even if the test flag leaks.

---

## What this does not do

- No product UI changes
- No production hide flip
- No live SQL
- No PAW-55 company-secret wiring (still board-owned)
- No Docker local stack on this machine (Tester may still install Docker later; it is not required now)

## Residual

- `get_mating_discovery_context` returns 403 for a pet the caller does not own — correct fail-closed, not a missing RPC.
- Historical empty-replay friction on meetup `user_id` drop and `paw_interests` create-order remains in old migration files. Do not edit those files. Scratch preflight is operational only.
- Staging smoke (PAW-52/55/56) is a separate store gate.
