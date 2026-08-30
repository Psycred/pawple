# Pawple A2 — Environment Configuration Plan

**Workstream:** A2 (Platform & environments)  
**Owner:** CTO (architecture) → Backend + Frontend (implementation)  
**Parent:** PAW-7 / PAW-15  
**Date:** 28 Aug 2026  
**Status:** Approved for implementation (pending CEO credential provisioning)  
**Contract reference:** Product Contract §11 — Environment contract

---

## 1. Executive summary

Pawple currently uses a **single hardcoded Supabase project** in `src/config/supabase.js`. Demo/dev behaviour is partially gated via `src/config/environment.js` (`__DEV__`), but **environment isolation is not contract-compliant**.

This plan defines three isolated Supabase environments, build-time configuration for the Expo client, migration deployment discipline, and staging seed strategy — **without rewriting** the existing app architecture.

**Implementation gate:** PAW-4 (A1 audit) must confirm RLS posture, storage policies, and RPC grants before production project receives real users. This plan can proceed to **dev + staging** immediately after audit findings.

---

## 2. Current state (verified)

| Area | State | Contract gap |
|------|-------|--------------|
| Supabase client | Hardcoded URL + anon key in `src/config/supabase.js` | §11 — no env isolation |
| Runtime demo gates | `src/config/environment.js` → `isDemoContentEnabled = __DEV__` | Partially addressed by PAW-11 |
| Migrations | 24 SQL files under `supabase/migrations/` | Good foundation |
| Storage policies | Documented in `src/lib/supabase.js` comments; likely dashboard-managed | Must be verified in PAW-4 |
| Build profiles | No `eas.json`; no `.env*` files | Staging/prod builds undefined |
| Auth providers | Not configured for staging/prod redirect URIs | Blocks PAW-10 staging validation |

**Interim classification:** Existing project `pexurgcfkxkouthuhlnb` becomes **`pawple-dev`** until dedicated staging is provisioned. Do not add real beta users to dev.

---

## 3. Target architecture

### 3.1 Three Supabase projects

| Environment | Supabase project | Purpose | Real user data | Demo injection | Dev auth |
|-------------|------------------|---------|----------------|----------------|----------|
| **Development** | `pawple-dev` | Local Metro, debug builds, agent workspaces | Engineers only | Allowed via `__DEV__` | Anonymous allowed (Metro only) |
| **Staging** | `pawple-staging` | Release builds, QA, TestFlight/internal APK | Synthetic seeded accounts | **Forbidden** | **Forbidden** |
| **Production** | `pawple-prod` | Closed beta, App Store / Play | Real invite-only users | **Forbidden** | **Forbidden** |

Each project must have:
- Identical schema from the same migration chain
- Matching RLS policies
- Matching Storage buckets: `moments`, `pet-photos` (names confirmed by PAW-4)
- OAuth providers configured with environment-specific redirect URIs
- Separate anon/service keys stored outside the repo

### 3.2 Configuration layers

```
┌─────────────────────────────────────────────────────────────┐
│  Build time (EAS / local)                                    │
│  EXPO_PUBLIC_PAWPLE_ENV=development|staging|production       │
│  EXPO_PUBLIC_SUPABASE_URL                                    │
│  EXPO_PUBLIC_SUPABASE_ANON_KEY                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  src/config/supabase.js                                      │
│  createClient(url, anonKey) — throws if missing in non-dev   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  src/config/environment.js                                   │
│  isLocalDevRuntime = __DEV__                                 │
│  isDemoContentEnabled = __DEV__  (never env-var alone)       │
│  pawpleEnv = EXPO_PUBLIC_PAWPLE_ENV                          │
└─────────────────────────────────────────────────────────────┘
```

**Critical rule:** Demo and dev-auth gates use **`__DEV__` (compile-time)**, not a runtime env var. A mistaken `EXPO_PUBLIC_*` value must not re-enable demo content in a store build.

**Secondary rule:** `EXPO_PUBLIC_PAWPLE_ENV` is for logging, feature flags that are safe in release (e.g. staging banner), and backend URL selection — not for security gates.

---

## 4. Client implementation plan

### 4.1 Refactor `src/config/supabase.js`

Replace hardcoded credentials with:

```javascript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  if (__DEV__) {
    throw new Error('[Supabase] Missing EXPO_PUBLIC_SUPABASE_* — copy .env.development.example');
  }
  throw new Error('[Supabase] Configuration error.');
}
```

Keep existing `AsyncStorage` auth options unchanged.

### 4.2 Extend `src/config/environment.js`

```javascript
export const pawpleEnv =
  process.env.EXPO_PUBLIC_PAWPLE_ENV ??
  (__DEV__ ? 'development' : 'production');

export const isStaging = pawpleEnv === 'staging';
export const isProduction = pawpleEnv === 'production';
```

Optional: export `assertContractEnvironment()` called once in `App.js` to log env at startup (dev/staging only).

### 4.3 Env files (not committed with secrets)

| File | Committed | Contents |
|------|-----------|----------|
| `.env.development.example` | ✅ Yes | Placeholder keys; documents dev project |
| `.env.staging.example` | ✅ Yes | Placeholder keys |
| `.env.production.example` | ✅ Yes | Placeholder keys |
| `.env.development` | ❌ No | Real dev anon key |
| `.env.staging` | ❌ No | Real staging anon key |
| `.env.production` | ❌ No | Real prod anon key |

Add to `.gitignore`:
```
.env.development
.env.staging
.env.production
```

Use `expo-constants` / Expo SDK 52 env loading (`EXPO_PUBLIC_*` injected at build time).

### 4.4 EAS build profiles (new `eas.json`)

| Profile | `EXPO_PUBLIC_PAWPLE_ENV` | Distribution | Supabase target |
|---------|--------------------------|--------------|-----------------|
| `development` | `development` | Internal / simulator | pawple-dev |
| `staging` | `staging` | Internal TestFlight / APK | pawple-staging |
| `production` | `production` | Store / closed beta | pawple-prod |

Store secrets in **EAS Secrets** (`eas secret:create`), not in `eas.json`.

### 4.5 OAuth redirect URIs (PAW-10 dependency)

Per environment, register in Supabase Auth → Providers:

| Environment | Redirect scheme | Notes |
|-------------|-----------------|-------|
| Dev | `pawple://` + Expo dev proxy if needed | Local testing |
| Staging | `pawple://` + EAS staging bundle ID | TestFlight |
| Production | `pawple://` + production bundle ID | Closed beta |

Frontend Engineer owns provider wiring; Backend verifies Supabase dashboard config matches.

---

## 5. Backend / Supabase operations

### 5.1 Migration deployment

**Source of truth:** `supabase/migrations/*.sql` only.

| Step | Environment | Owner |
|------|-------------|-------|
| 1. Apply locally / dev | pawple-dev | Backend |
| 2. PAW-4 verifies clean replay from empty DB | dev | Backend (A3) |
| 3. Apply to staging | pawple-staging | Backend |
| 4. Staging smoke (PAW-10, PAW-11, meetup RSVP) | staging | Frontend + QA |
| 5. Apply to production | pawple-prod | Backend + CEO approval |

**Never** edit staging/production schema via dashboard without a matching migration file.

### 5.2 Storage policy parity

PAW-4 must confirm whether policies exist only in dashboard. If so:

1. Export policies to SQL migration **or**
2. Maintain `docs/SUPABASE_STORAGE_RUNBOOK.md` with exact policy definitions applied per environment

Required buckets (from codebase):
- `moments` — path `{auth.uid()}/…`
- `pet-photos` — path `{auth.uid()}/…`

Apply identically to dev, staging, prod.

### 5.3 Staging seed data

Staging uses **synthetic data only** (Product Contract §11):

| Entity | Seed approach |
|--------|---------------|
| Users | 3–5 test accounts via Auth admin API |
| Pets | Varied breeds/sex for future mating tests |
| Moments | Real Storage URLs in staging bucket |
| Meetups | Pet-centric hosts + participants |
| Invites | Single-use codes for QA flows |
| Mating candidates | Synthetic opt-in pets (when E stream starts) |

**Forbidden in staging:** runtime demo injection (`demoFeed.js`), bypass invite codes, fabricated locations in production paths.

Seed scripts live in `supabase/seed/staging.sql` or a documented Node script — not executed against production.

### 5.4 Service role key handling

| Key | Where stored | Used by |
|-----|--------------|---------|
| Anon key | Client env / EAS secrets | React Native app |
| Service role | Backend-only secret store | Account deletion RPC, admin seed, migrations CI |

**Never** embed service role in the mobile app.

---

## 6. PAW-4 audit inputs required before prod

Before pointing production builds at `pawple-prod`:

| PAW-4 deliverable | A2 dependency |
|-------------------|---------------|
| Canonical table list + FK graph | Deletion RPC + seed scripts |
| RLS policy inventory | Apply to all three projects |
| RPC grant matrix | Staging smoke tests |
| Storage policy status | Codify or runbook |
| Migration replay log | A3 sign-off |
| P0 security gaps | Block prod until resolved |

If PAW-4 finds P0 RLS gaps, **staging can still proceed** for OAuth/demo testing, but **no external beta users** until A4 passes.

---

## 7. Implementation tasks (delegation)

| # | Task | Owner | Depends on |
|---|------|-------|------------|
| A2-1 | Create `pawple-staging` Supabase project | CEO + Backend | CEO approval |
| A2-2 | Create `pawple-prod` Supabase project | CEO + Backend | CEO approval |
| A2-3 | Add `.env.*.example`, `.gitignore`, refactor `supabase.js` | Frontend | — |
| A2-4 | Add `eas.json` + EAS secrets | Frontend + CEO | A2-1 |
| A2-5 | Apply migrations to staging | Backend | A2-1, PAW-4 |
| A2-6 | Storage policies on staging | Backend | PAW-4 |
| A2-7 | Staging seed script | Backend | A2-5 |
| A2-8 | Staging release smoke | Frontend | PAW-10, PAW-11, A2-5 |
| A2-9 | Production project + migration | Backend | A4 RLS tests, CEO |

**Suggested child issue:** `A2: Implement environment isolation (Supabase + EAS)` assigned to Backend + Frontend after CEO approves this plan.

---

## 8. Verification checklist

### Development
- [ ] Metro loads with `.env.development`
- [ ] Demo content works when `__DEV__` true
- [ ] Anonymous dev auth works in Metro only

### Staging
- [ ] Release build connects to `pawple-staging`
- [ ] No demo feed/meetup injection
- [ ] OAuth sign-in works with staging providers
- [ ] Migrations match dev schema version
- [ ] Synthetic seed data present

### Production
- [ ] Release build connects to `pawple-prod` only
- [ ] No dev auth, no bypass codes, no demo injection
- [ ] RLS tests pass (A4)
- [ ] Account deletion RPC deployed (PAW-9)
- [ ] No secrets in git history

---

## 9. What we are not doing (Beta scope)

- Multi-region Supabase
- Separate read replicas
- Custom API gateway in front of Supabase
- Feature-flag SaaS for environment control
- Local Supabase CLI/docker as required path (optional for engineers)

---

## 10. Rollback strategy

| Change | Rollback |
|--------|----------|
| Wrong env var in EAS | Redeploy previous build profile secrets |
| Bad migration on staging | Restore staging project from Supabase backup; fix migration |
| Client misconfigured | Revert `supabase.js` to previous commit; hotfix release |

Production migrations are **forward-only** with reviewed rollback scripts for destructive changes only.

---

## 11. Recommendation

1. **Approve** this plan for implementation starting Week 1 Day 4.
2. **CEO action:** Provision `pawple-staging` and `pawple-prod` Supabase projects; store keys in EAS/secret store.
3. **Backend:** Complete PAW-4 before production migration; apply migrations to staging immediately after staging project exists.
4. **Frontend:** Refactor client config (A2-3) in parallel with PAW-10/PAW-11 — no architecture rewrite.

This preserves Pawple's existing React Native + Supabase architecture while satisfying Product Contract §11 isolation requirements.
