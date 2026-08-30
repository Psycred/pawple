# Account deletion RPC — Frontend contract (PAW-9 / C5)

Server-controlled account deletion per **Product Contract §10**. The client must **not** delete canonical tables directly (`profiles`, `pets`, `moments`, `likes`, `invites`, `meetups`, etc.) or call legacy tables (`posts`, `photos`, `meetup_history`).

## RPC

| Property | Value |
|----------|-------|
| Name | `delete_user_account` |
| Args | none (uses `auth.uid()`) |
| Grant | `authenticated` only |
| Returns | `jsonb` |

## Response shape

```json
{
  "ok": true,
  "already_deleted": false,
  "user_id": "uuid",
  "deleted_at": "2026-08-28T12:00:00.000Z",
  "counts": {
    "storage_objects": 12,
    "likes": 4,
    "moments": 8,
    "meetups_created": 2,
    "pets": 3,
    "invites_unused_deleted": 5,
    "profiles": 1,
    "auth_users": 1
  }
}
```

- `already_deleted: true` — prior run completed; safe to treat as success.
- `counts` — observability only; omit from user-facing UI.

## Client wiring (C5)

Use `src/lib/deleteAccount.js`:

```javascript
import { deleteAccount } from '../lib/deleteAccount';

// After destructive confirmation in Settings:
const result = await deleteAccount();
// Reset navigation to Auth (same as sign-out).
```

### UX notes

1. Confirm destructively before calling the RPC.
2. Show a blocking loader; deletion is one round-trip but may take a few seconds with media.
3. On success, reset navigation to `Auth` (same as sign-out).
4. On failure, show a retryable error; the RPC is transactional — a failed call leaves data intact.
5. Do **not** delete `posts`, `photos`, or other legacy tables from the client.

## Server behaviour (summary)

Executed in one transaction for the authenticated caller:

| Domain | Action |
|--------|--------|
| Storage | Deletes `moments` and `pet-photos` objects under `{user_id}/` |
| Likes | Deletes all rows where `user_id` = caller |
| Moments | Deletes owned moments; cleans `moment_pets` when table exists |
| Memories | Deletes legacy rows when table exists |
| Legacy `posts` / `photos` / `meetup_history` | Deleted when transitional tables exist |
| Legacy `meetup_participants.user_id` | Deleted when pre-pet-centric column exists |
| Meetups | Deletes meetups where `user_id` = caller |
| Pets | Deletes owned pets (cascades host/participant rows on other meetups) |
| Invites | Deletes unused issued invites; nulls `user_id` / `used_by_user_id` on consumed rows |
| Paw/interest | No-op until mating schema (E3) exists; hooks ready for `paw_interests` / `pet_paw_interests` |
| Profile | Deletes `profiles` row |
| Auth | Deletes `auth.users` row |

## Errors

| Condition | Behaviour |
|-----------|-----------|
| Not signed in | `not_authenticated` (SQLSTATE `28000`) |
| Missing table (pre-migration DB) | Migration apply required |
| Storage permission failure | Whole transaction rolls back |

## Migration

`supabase/migrations/20260828120000_delete_user_account_rpc.sql`

Apply with your usual Supabase migration workflow before wiring C5 in staging/production.

## PAW-4 audit notes (schema gaps)

Escalate to CEO/CTO if blocking:

1. **Base schema not in repo migrations** — `profiles`, `pets`, `moments`, `likes` predate versioned migrations; deletion RPC assumes their current production shape (`pets.owner_id`, `moments.user_id`, etc.).
2. **`meetups.status`** — not yet migrated; account deletion deletes creator meetups outright (contract-allowed). Cancel-vs-delete semantics for UI remain in `cancelMeetup`.
3. **Mating interest tables** — not present in Beta schema yet; RPC includes conditional hooks for E3 without changing product scope.
