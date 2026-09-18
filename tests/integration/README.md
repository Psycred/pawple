# Critical-path integration smoke tests (PAW-25 / F2)

Node-based smoke tests against a **staging/dev Supabase project**. They validate the same client contracts as production code without running React Native UI.

## Covered paths

| Test file | Client source | Backend / RLS coordination |
|-----------|---------------|----------------------------|
| `oauth-session.test.js` | `src/lib/oauth.js`, `AuthContext` | Session grants via Supabase Auth; provider OAuth deferred to F3 device smoke |
| `onboarding-happy-path.test.js` | `src/lib/onboardingInvite.js` | `invites` select/update + `profiles.onboarding_completed_at` under authenticated RLS |
| `moment-create.test.js` | `src/services/moments.js` | `moments` insert scoped to `auth.uid()` |
| `meetup-rsvp.test.js` | `src/services/meetups.js` | `meetup_participants` upsert; pet ownership enforced client-side + RLS |
| `account-delete.test.js` | `src/lib/deleteAccount.js` | `delete_user_account` RPC (`authenticated` grant only) |
| `account-notifications.test.js` | `src/services/accountNotifications.js` | Account-owned inbox SELECT/read UPDATE RLS; client INSERT denied |

Helper functions in `helpers/fixtures.js` mirror client Supabase calls so tests stay aligned with app behaviour without importing React Native modules.

## Running locally

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"  # setup/teardown only

npm run test:integration
```

Without `SUPABASE_SERVICE_ROLE_KEY`, tests **skip** with a clear message. Static demo-gating audit still runs via `npm run test:static`.

**PAW-170 live ban:** helpers never default to `pexurgcfkxkouthuhlnb`. Tests skip (and clients throw) if `SUPABASE_URL` points at live. Provision users with `admin.createUser({ email_confirm: true })` only — never client `signUp` / OTP / password-reset against production.

## CI recommendation

1. Store keys in CI secrets (staging project only).
2. Run migrations before smoke tests (`supabase db push` or equivalent).
3. Ensure `delete_user_account` migration is applied (PAW-9).
4. Backend A4 RLS suite remains authoritative for policy coverage; F2 proves **client invocation paths** succeed under those policies.

## Backend coordination notes

- **Service role** is used only in `helpers/fixtures.js` for provisioning and emergency cleanup — never ship to the mobile app.
- RLS-sensitive assertions include cross-user moment insert rejection and foreign-pet RSVP rejection.
- Account deletion tests create disposable users and invoke the same RPC as Settings → Delete account.
- Coordinate with Backend when new RLS policies block these paths; update fixtures, not production client guards, when contracts change.

## OAuth scope

F2 validates **session lifecycle** (sign-in, `getSession`, implicit token `setSession`, sign-out). Full Google/Apple provider redirects are covered by **F3 staging smoke** on device builds.
