# PAW-24 — Meetup RSVP / Capacity Contract Audit

**Issue:** PAW-24 D1  
**Date:** 2026-08-28  
**Contract:** `docs/PAWPLE_BETA_ARCHITECTURE_PRODUCT_CONTRACT.md` §7

## Summary

Audited `meetup_hosts`, `meetup_participants`, capacity triggers/RPCs, and client demo RSVP paths against the Product Contract. **Four backend gaps were fixed** in migration `20260828200000_meetup_rsvp_capacity_contract.sql`. Demo RSVP paths are **correctly gated** to local dev (`__DEV__`).

## Contract checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Host pets in `meetup_hosts` | ✅ | `20260714200000_meetup_pet_centric_schema.sql` |
| RSVP pets in `meetup_participants` | ✅ | Same migration; client upserts with `onConflict: meetup_id,pet_id` |
| Hosts inherently attending (no manual host RSVP) | ✅ | `auto_enroll_meetup_host_as_participant` trigger |
| Attendance = unique pets (hosts + joiners) | ✅ | Hosts auto-enrolled into `meetup_participants`; `participant_count` = exact `COUNT(*)` |
| Capacity limit = total attending pets | ✅ | `check_meetup_participation_capacity` counts `meetup_participants` (includes hosts) |
| Capacity enforcement atomic at DB | ✅ **fixed** | `FOR UPDATE` on `meetups` row in capacity trigger |
| Duplicate RSVP idempotent | ✅ | Client `upsert` + `UNIQUE(meetup_id, pet_id)` |
| Cancelled meetup blocks new RSVPs | ✅ **fixed** | Capacity trigger rejects when `status = 'cancelled'` |
| Last host removed → meetup cancelled | ✅ **fixed** | `cancel_meetup_if_no_hosts` trigger |
| `meetups.status` durable cancelled state | ✅ **fixed** | New column + check constraint |
| RLS: only own pets for RSVP | ✅ | `meetup_participants_insert_own` (pet owner check) |
| RLS: only creator assigns hosts | ✅ **fixed** | Restored creator+pet ownership INSERT policy |
| Pet delete cascades RSVP/host rows | ✅ | `ON DELETE CASCADE` on FKs |
| Account deletion removes meetup relationships | ✅ | `delete_user_account()` RPC |
| No demo RSVP in production builds | ✅ | See § Demo gating below |

## Implementation note — host auto-enroll

The contract states host pets are recorded in `meetup_hosts` and RSVP pets in `meetup_participants`. The backend **auto-enrolls** host pets into `meetup_participants` via a `SECURITY DEFINER` trigger so that:

- `participant_count` reflects total attendance without client-side union logic;
- capacity checks include host pets;
- RLS blocks manual duplicate host rows in `meetup_participants`.

This is an intentional denormalization. User-facing writes still go only to `meetup_hosts` (hosts) or `meetup_participants` (RSVPs). The frontend separates display via `extractMeetupJoinerPets()` (joiners only) vs `extractMeetupHostPetIds()` (hosts).

## Gaps found and fixed

### 1. Missing `meetups.status` column

Frontend `cancelMeetup()` and feed filters referenced `status`, but no migration existed. Added `status text NOT NULL DEFAULT 'upcoming'` with check `('upcoming', 'cancelled', 'completed')`.

### 2. Capacity race (non-atomic concurrent RSVPs)

`check_meetup_participation_capacity()` counted rows without locking, allowing two concurrent inserts to both pass when one slot remained. Fixed with `SELECT … FOR UPDATE` on the parent `meetups` row.

### 3. Cancelled meetups accepted RSVPs

Capacity trigger did not inspect lifecycle status. Fixed: raises `'This meetup has been cancelled.'` when `status = 'cancelled'`.

### 4. Last host removal did not cancel meetup

Contract §7: deleting the last host pet cancels the meetup. Added `cancel_meetup_if_no_hosts` `AFTER DELETE` trigger on `meetup_hosts`.

### 5. `meetup_hosts` INSERT RLS too permissive

Migration `20260714260000` allowed any authenticated user to insert their pet as host on **any** meetup (pet ownership only). Restored creator + pet ownership check.

## Existing RPCs / triggers (verified)

| Object | Role |
|--------|------|
| `get_meetup_participant_count(uuid)` | Stable count for reconciliation |
| `check_meetup_participation_capacity()` | BEFORE INSERT capacity + cancellation guard |
| `sync_meetup_participant_count()` | AFTER INSERT/DELETE exact COUNT sync |
| `auto_enroll_meetup_host_as_participant()` | Host → participant on host insert |
| `remove_meetup_host_participant()` | Participant row removed when host removed |

## Demo RSVP gating (production safety)

Verified with `node scripts/verify-demo-gating.js` (passes):

- `isDemoContentEnabled = __DEV__` in `src/config/environment.js`
- `demoMeetupRsvp.js` guards all mutating paths with `if (!__DEV__)`
- `meetups.js` `joinMeetupWithPets` / `leaveMeetupWithPets` reject demo IDs unless `__DEV__` + demo context
- `babel-preset-expo` compiles `__DEV__` to `false` in release builds

Release/staging builds cannot execute demo RSVP mutations or inject demo meetups.

## Out of scope (known, documented elsewhere)

- **Meetup read RLS** remains `USING (true)` for authenticated feed/details. Contract §7 says “authenticated beta members only”; tightening to `auth.uid() IS NOT NULL` is a separate RLS pass (PAW-20).
- **`completed` status** is schema-ready; automatic past-date transition is not implemented (client uses `isMeetupPast()`).

## Apply

```bash
supabase db push
# or apply 20260828200000_meetup_rsvp_capacity_contract.sql in Supabase SQL editor
```

## Frontend contract (unchanged)

- RSVP: `joinMeetupWithPets` → `meetup_participants` upsert
- Leave: `leaveMeetupWithPets` → delete owned pet rows
- Cancel: `cancelMeetup` → `meetups.status = 'cancelled'`
- Capacity errors surface as Supabase `check_violation` with message `This meetup is full.` or `This meetup has been cancelled.`
