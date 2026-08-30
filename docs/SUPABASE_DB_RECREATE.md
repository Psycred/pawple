# Supabase database recreate procedure (PAW-20 / A3)

This runbook makes Pawple's PostgreSQL schema **fully reproducible** from version-controlled migrations — a Beta Definition of Done requirement ([Product Contract §13](PAWPLE_BETA_ARCHITECTURE_PRODUCT_CONTRACT.md)).

## Source of truth

| Path | Purpose |
|------|---------|
| `supabase/migrations/*.sql` | Canonical schema, RLS, functions, triggers |
| `scripts/bootstrap-empty-db.sql` | Test/CI bootstrap only (auth + storage stubs) |
| `scripts/verify-migrations.js` | Empty-database replay verifier |
| `scripts/rls-security-tests.js` | Role-based security tests (A4) |

**Never** edit staging/production schema via the Supabase Dashboard without a matching migration file.

## Migration inventory (29 files)

The chain starts with `20260101000000_base_schema.sql`, which codifies the pre-migration tables (`profiles`, `pets`, `moments`, `likes`, `invites`, `moment_pets`) and their core RLS policies. All subsequent files are incremental.

## Option A — Local Supabase (recommended for developers)

**Requirements:** Docker Desktop, [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase --version`)

```bash
# From repo root
npx supabase start          # first run downloads images (~2–5 min)
npx supabase db reset       # drops local DB, replays all migrations
npm run verify:migrations   # inventory check (DATABASE_URL optional locally)
```

Local DB URL after `supabase start`:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run verify:migrations
```

Stop local stack:

```bash
npx supabase stop
```

## Option B — Remote staging scratch project

Use a **dedicated empty** Supabase project (or freshly reset staging branch). **Do not** run against production or any project with real user data.

1. Link the project (once):

   ```bash
   npx supabase link --project-ref <staging-project-ref>
   ```

2. Push migrations:

   ```bash
   npx supabase db push
   ```

3. Verify replay from empty DB (optional double-check on a throwaway DB):

   ```bash
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres" \
     npm run verify:migrations
   ```

   Use the **direct** connection string from Supabase Dashboard → Project Settings → Database. Prefer a scratch database or reset staging before replay.

## Option C — Inventory-only CI check (no Postgres)

When `DATABASE_URL` is unset, the verifier still checks:

- migration files exist and sort correctly
- `20260101000000_base_schema.sql` is first
- no duplicate timestamps

```bash
npm run verify:migrations
```

## RLS security tests (A4)

Run after migrations are applied to a **staging scratch** project:

```bash
export SUPABASE_URL=https://<project>.supabase.co
export SUPABASE_ANON_KEY=<anon-key>
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # setup/teardown only

npm run test:rls
```

### What the suite validates (Product Contract)

| Area | Assertion |
|------|-----------|
| Profiles | Cross-user update denied |
| Pets | Private pets hidden; discoverable pets readable; cross-user update denied |
| Moments | Community read allowed; cross-user update denied |
| Likes | Cannot insert as another user |
| Meetups | Cannot host/RSVP another user's pet; participant list readable |
| RPCs | `delete_user_account` / `export_user_data` blocked for anon; export scoped to caller |
| Invites | Unused code validation works; cannot list another user's issued invites |

### Storage policies

Storage bucket policies (`moments`, `pet-photos`) remain dashboard-managed per `src/lib/supabase.js`. Codify in a future migration when PAW-4 storage inventory is finalized. RLS tests do not cover Storage in this pass.

## Production recreate (CEO-gated)

Production schema changes are **forward-only**:

1. Review migration in PR
2. Apply via `supabase db push` to production project (CEO/CTO approval)
3. Run `npm run test:rls` against staging before prod push
4. Never `db reset` production

## Troubleshooting

| Symptom | Action |
|---------|--------|
| `relation "profiles" does not exist` on first migration | Ensure `20260101000000_base_schema.sql` is present and first |
| `schema "auth" does not exist` in verify script | Use `bootstrap-empty-db.sql` (automatic in `verify-migrations.js`) or real Supabase project |
| `function storage.foldername does not exist` | Bootstrap not applied before RPC migrations; run full verify script |
| Meetup host insert fails in RLS tests | Confirm `20260714260000_meetup_hosts_rls_fix.sql` applied |
| Docker not available | Use Option B (remote staging) or Option C (inventory only) |

## Beta gate checklist

- [ ] All 29 migrations apply cleanly from empty DB
- [ ] `npm run test:rls` passes on staging scratch
- [ ] Storage policies documented/applied on staging (separate A2 task)
- [ ] No external beta users until both checks pass
