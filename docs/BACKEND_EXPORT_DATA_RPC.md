# Data export RPC — Frontend contract (PAW-22 / A6 + C4)

Server-controlled data export per **Product Contract §10 Export**. The client must **not** assemble export payloads from direct table queries on legacy tables (`posts`, `photos`, `meetup_history`).

## RPC

| Property | Value |
|----------|-------|
| Name | `export_user_data` |
| Args | none (uses `auth.uid()`) |
| Grant | `authenticated` only |
| Returns | `jsonb` |

## Response shape

```json
{
  "ok": true,
  "exported_at": "2026-08-28T12:00:00.000Z",
  "user_id": "uuid",
  "format": "pawple-data-export-v1",
  "schema_version": 1,
  "profile": { },
  "pets": [],
  "moments": [],
  "likes": [],
  "invites": [],
  "meetups_created": [],
  "meetup_hosts": [],
  "meetup_participations": [],
  "mating_interest": [],
  "storage_media": []
}
```

### Included data (caller-owned only)

| Key | Source |
|-----|--------|
| `profile` | `profiles` row for caller |
| `pets` | `pets.owner_id` = caller |
| `moments` | `moments.user_id` = caller |
| `likes` | `likes.user_id` = caller |
| `invites` | issued (`user_id`) or redeemed (`used_by_user_id`) by caller |
| `meetups_created` | `meetups.user_id` = caller |
| `meetup_hosts` | host rows for caller's pets |
| `meetup_participations` | RSVP rows for caller's pets |
| `mating_interest` | `paw_interests` / `pet_paw_interests` when E3 schema exists |
| `storage_media` | owner-scoped paths in `moments` and `pet-photos` buckets |

Media URLs on moment/pet rows (`image_url`, `photo_url`) are included on those records. `storage_media` lists durable Storage paths for completeness.

Other users' private data is excluded.

## Client wiring (C4)

Use `src/lib/exportAccount.js`:

```javascript
import { exportUserData, shareUserDataExport } from '../lib/exportAccount';

const payload = await exportUserData();
await shareUserDataExport(payload);
```

### UX notes

1. Describe the actual mechanism: JSON file saved/shared from this device.
2. Do **not** promise email delivery.
3. Show a blocking loader while the RPC runs.
4. On success, open the system share sheet so the user can save to Files/Drive/etc.
5. On failure, show a retryable error.

## Errors

| Condition | Behaviour |
|-----------|-----------|
| Not signed in | `not_authenticated` (SQLSTATE `28000`) |
| Missing function (pre-migration DB) | Apply migration before wiring C4 |

## Migration

`supabase/migrations/20260828130000_export_user_data_rpc.sql`

Apply with your usual Supabase migration workflow before enabling export in staging/production.
