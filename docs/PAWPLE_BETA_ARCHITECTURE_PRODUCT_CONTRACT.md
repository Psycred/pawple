# Pawple Beta Architecture & Product Contract

This contract defines canonical beta behavior. Future work must preserve the existing Pawple direction unless behavior conflicts with this contract.

## 1. Product core

### Essential beta loop

1. A user authenticates with Google or Apple.
2. The user presents a valid invite.
3. The user creates a profile and at least one pet.
4. The user selects an active pet.
5. The user records photo moments attributed to pets.
6. Moments appear in pet journals and the community feed.
7. Pets discover eligible mating candidates and express interest.
8. Pets host or join nearby meetups.
9. The user manages pets, settings, export, sign-out, and account deletion.

### Core Phase 1 product pillars

- User identity and invite-gated onboarding.
- Pet identity and profiles.
- Pet moments and journals.
- Community feed.
- Pet mating/matching discovery.
- Pet-centric meetups.
- Approximate location and proximity.
- Account and settings lifecycle.

Pet mating/matching is required for Phase 1 beta even if the initial population is small. Actual beta usage should begin producing the real-world behavior and usage dataset needed to guide later product decisions.

### Supporting beta functionality

- Multiple pets and active-pet switching.
- Moment likes without counts or social metrics.
- Moment sharing only when links resolve correctly.
- User-adjustable mating discovery distance/radius.
- Approximate location and honest meetup and mating-candidate distance eligibility.
- Pet traits and short mating descriptions as owner-evaluated profile information.
- Paw/interest expression and visibility.
- Legal consent, invite generation, and basic privacy controls.
- Empty, loading, error, and offline-retry states.

### Deliberately deferred or undecided

- The exact post-interest interaction model.
- Whether communication requires mutual Paw, acceptance of a one-way request, or another consent model.
- Chat implementation, infrastructure, and exact gating.
- The location of matching within app navigation.
- The final discovery presentation and information hierarchy.
- Push notifications and meetup reminders.
- Direct messaging outside the eventual approved mating/connection flow.
- Comments, followers, reposts, or popularity systems.
- Global journal beyond existing pet journals.
- Advanced meetup discovery or recommendations.
- Moment proximity ranking.
- Precise/background location.
- Advanced offline synchronization.
- Advanced matching criteria, compatibility scoring, or AI matching.
- Privacy controls beyond the opt-in and normal safety requirements needed for Phase 1.

## 2. Canonical domain model

### Identity

- `auth.users` is the authentication identity.
- `profiles` is a one-to-one Pawple profile keyed by the Auth user ID.
- A profile owns zero or more pets and user-created content.
- Human identity is used for authorization but is not emphasized on meetup cards.

### Pets

- `pets.owner_id → auth.users.id`.
- Pets are the visible identity for journals, mating discovery, companion discovery, and meetups.
- Only the owner may create, edit, delete, or opt a pet into mating discovery.

### Moments

- `moments.user_id` identifies the owner.
- A moment contains one uploaded image, optional caption/location text, date, timestamps, and attribution to one or two pets.
- `moments.pet_ids` is the canonical beta attribution field.
- `pet_names` is a display snapshot, not an identity relationship.
- `moment_pets` is transitional and must not receive new functionality.

### Likes

- One `likes` row represents one user liking one moment.
- Uniqueness is `(user_id, moment_id)`.
- Deleting a moment or user removes associated likes.
- Likes have no public count in the beta UI.

### Invites

- An invite has an issuer, unique code, status, and optional redeemer/timestamp.
- Validation does not consume an invite.
- Consumption is authenticated, atomic, and single-use.
- Permanent bypass codes must not exist in production clients.

### Meetups

- `meetups.user_id` is the creator account and authorization owner.
- `meetup_hosts` relates meetups to host pets.
- `meetup_participants` relates meetups to RSVP pets.
- Human names are not displayed as meetup hosts or attendees.
- Hosts and participants are distinct roles; a host is inherently attending.
- Displayed attendance is the number of unique pets across both sets.

### Pet mating/matching

Pet mating/matching is canonical Phase 1 product behavior, but this contract does not define its engineering entities, persistence model, navigation, or communication architecture.

A potential candidate is eligible only when all of the following are true:

- The pets are the same breed.
- The pets are of opposite sex.
- The owner opts their pet into mating discovery.
- The candidate is within the distance/radius selected by the viewing user.

No additional eligibility or ranking criteria are part of Phase 1.

Traits, personality, appearance, vaccination status, health attributes, age, size, compatibility scores, and AI compatibility must not determine eligibility. Traits remain descriptive profile information for human evaluation.

The experience must allow the viewing owner to:

- See an eligible candidate.
- See the candidate’s relevant short mating description.
- Visit the candidate pet’s profile.
- Decide independently whether to express interest.

A Paw represents interest. It is not a Tinder-style dismissal and must not permanently hide either pet or create a permanently hidden candidate relationship.

When interest is visible to the relevant owner, that owner must be able to see the interested pet’s short mating description and visit its profile, subject to normal privacy and safety rules.

The exact post-interest consent, connection, and communication model remains intentionally undecided.

The CEO/Architect/UX process must determine the appropriate product presentation and location according to Pawple’s existing Apple-inspired, calm, premium, and emotionally soft design principles. The architecture/product team must likewise determine any post-interest or chat behavior while preserving the product behavior defined by this contract.

### Location

- `profiles` stores only the latest approximate user location and its timestamp.
- `meetups` stores venue coordinates corresponding to the displayed venue.
- `moments` may retain coordinates when explicitly captured, but proximity ranking is not part of beta.
- Mating discovery uses the user-selected distance/radius without this contract prescribing its representation or geographic implementation.

### Notifications/devices

- Real push delivery is deferred.
- No push-token/device record is required for beta.
- If later enabled, one profile may own multiple installation/device records; tokens must not live directly on `profiles`.

### Legacy concepts

No new functionality may use:

- `memories`
- `posts`
- `photos`
- `meetup_history`
- `moment_pets`
- Firebase
- Duplicate legacy storage helpers
- `HomeScreen`
- Legacy onboarding screens
- Deprecated navigation, location, or meetup-feed helpers

They remain untouched until migration and verification are complete.

## 3. Authentication contract

- Production entry supports Google and Apple through Supabase Auth.
- Authentication happens before invite redemption so every operation has a stable user ID.
- A successful provider callback establishes a persisted Supabase session.
- Session restoration occurs on cold start before routing.
- Sign-out clears the Supabase session and user-scoped local state, including active pet.
- Account switching must never reuse the previous user’s active pet or cached private data.
- Cancelled authentication returns safely to the auth screen without creating profile data.
- Failed authentication shows a retryable, non-destructive error.
- Revoked or expired sessions return the user to authentication; they must not be treated as completed onboarding.
- Developer anonymous authentication is permitted only in explicitly marked local/Cursor Cloud development builds.
- Development authentication must be impossible in staging and production.

## 4. Onboarding contract

Canonical sequence:

1. Authenticate.
2. Validate the invite without consuming it.
3. Create or resume the user profile.
4. Create at least one valid pet.
5. Atomically consume the invite and mark onboarding complete.
6. Set the first pet as active.
7. Enter the main app.

An invite becomes consumed only when profile and initial pet creation have succeeded and onboarding completion is committed. Validation alone never consumes it.

If onboarding is interrupted:

- The authenticated session and completed steps persist.
- Restart resumes the earliest incomplete step.
- The invite remains usable until final completion.
- Existing profile or pet rows are reused rather than duplicated.
- Completion is represented explicitly, not inferred only from pet count.
- Add/edit pet flows after onboarding never alter onboarding completion.

Legal consent timestamps must be recorded before completion.

The owner may opt their pet into mating discovery after pet creation. It is not required to complete onboarding unless the later product/UX layer deliberately places the existing opt-in choice there. A pet is eligible for mating discovery only when its owner has opted that pet into mating discovery.

## 5. Pet contract

- Every authenticated user may own multiple pets.
- Exactly one owned pet may be active in normal app use.
- Active-pet state is owned exclusively by `ActivePetContext` and persisted per user.
- Restored active-pet IDs must be checked for ownership.
- Adding a pet does not automatically replace the active pet unless it is the first pet.
- Editing preserves identity and existing relationships.
- Deleting a non-active pet leaves active state unchanged.
- Deleting the active pet selects another owned pet deterministically.
- Deleting the final pet clears active state and routes to an appropriate pet-creation state.
- New pet photos must be uploaded to the owner-scoped `pet-photos` Storage path.
- Device-local URIs must never be persisted as durable profile URLs.
- Owners may mutate their pets. Other authenticated users may view only fields approved for community/profile display.
- Mating discovery opt-in is owner-controlled and reversible.
- A pet is eligible for mating discovery only when its owner has opted that pet into mating discovery.
- Pet profiles may show traits and a short mating description to support human evaluation.
- Traits must never become matching eligibility or ranking criteria.

## 6. Moment contract

- `moments` is the only canonical journal entity.
- Each moment belongs to one user and is attributed through `pet_ids` to one or two owned pets.
- Attribution must contain only pets owned by the moment owner.
- `pet_names` is a historical display snapshot and may survive pet renaming or deletion.
- Pet journals query `moments.pet_ids`.
- The community feed reads `moments` and applies approved pet visibility rules.
- Moment images use durable Supabase Storage URLs.
- Deleting a moment deletes its likes and owned media.

### Legacy transition

- Existing `memories` records may be read temporarily through a compatibility adapter.
- They must be migrated into `moments` before fallback removal.
- No new record may be written to `memories`.
- `memories` must not gain new columns, UI, or service behavior.
- `moment_pets` may be used only as a migration source while `pet_ids` is verified.

## 7. Meetup contract

- A meetup is created by an authenticated user on behalf of one or more pets they own.
- Host pets are recorded only in `meetup_hosts`.
- RSVP pets are recorded only in `meetup_participants`.
- One pet may appear at most once per meetup role.
- Host pets are inherently attending and must not require duplicate participant rows.
- The participation limit applies to total unique attending pets: hosts plus participants.
- RSVP and capacity enforcement must be atomic at the database level.
- A user may RSVP multiple owned pets when capacity and compatibility allow.
- Leaving removes only the selected owned pets.
- Duplicate RSVP requests are idempotent.
- Cancellation sets a durable cancelled state, prevents new RSVPs, and removes the meetup from upcoming feeds.
- Deleting a participant pet removes its RSVP.
- Deleting a host pet removes that host relationship; if no host pets remain, the meetup is cancelled.
- Deleting the creator account removes or cancels its meetups according to account-deletion rules.
- Venue coordinates must describe the meetup venue, not silently substitute the creator’s current location.
- Meetup details, host pets, and participant pets are visible to authenticated beta members only.
- RLS must prevent users from hosting or RSVPing pets they do not own.

## 8. Location contract

- Pawple requests foreground approximate location only.
- It does not request precise, continuous, or background tracking.
- The persisted profile location is the latest approximate coordinate pair plus `location_updated_at`; location history is not stored.
- Persisted coordinates should be reduced to neighborhood/city-level precision.
- On app open, Pawple may refresh location when permission is already granted.
- A stored location older than 24 hours is stale; Pawple may attempt a foreground refresh before using it for distance.
- If permission is denied, Pawple continues without location.
- If location is unavailable or stale and cannot be refreshed, distance is displayed as unavailable or omitted.
- Pawple must never fabricate coordinates or distances in production.
- Meetup venue coordinates must correspond to user-provided venue information.
- Moment coordinates may be saved when available, but moment proximity ranking is deliberately deferred for beta.
- Location settings should report actual permission and location state, not hardcoded values.
- Mating discovery distance/radius is adjustable by the user.
- This contract does not prescribe the radius control, defaults, storage representation, or geographic calculation.
- A mating candidate is eligible only when the selected radius requirement can be satisfied.
- If location or distance is unavailable, Pawple must not claim that the candidate is within range.

## 9. Notification contract

Real push notifications are optional and deferred for beta.

Therefore:

- Pawple must not claim that meetup, mating, connection, or other reminders are active.
- It must not ask users to enable notifications unless a functional push-delivery path exists.
- The onboarding completion screen may retain a simple continue action, but not a misleading permission prompt.
- No token registration or `notification_enabled` promise is required for the initial beta.
- If push is introduced later, permission, Pawple preference, device registration, and delivery must all be implemented together.

## 10. Account lifecycle contract

### Delete Account

Deletion means:

- Delete the `profiles` row.
- Delete all owned pets.
- Delete owned moments, likes, and moment media.
- Delete unused invites issued by the user.
- Preserve already-consumed invite status only as anonymized integrity data if required.
- Remove the user’s likes on other moments.
- Remove all meetup participant relationships for owned pets.
- Remove host relationships for owned pets.
- Delete or cancel meetups created by the user so no active meetup remains without an owner.
- Remove or anonymize all mating discovery, Paw/interest, connection, or communication records associated with the user or owned pets, according to the eventual approved interaction model.
- Delete user-owned pet and moment Storage objects.
- Delete the Supabase Auth identity.
- Clear the local session and user-scoped persisted state.

Deletion must be authenticated, server-controlled, atomic where possible, retryable, and observable. Signing out is not deletion.

### Export

- Export contains the user’s profile, pets, moments, likes, invite records, created meetups, participation records, and the user’s own mating/interest records once those records exist.
- It excludes other users’ private data.
- Output is a machine-readable JSON archive, with owned media included or represented by secure references.
- UI must describe the actual export mechanism.
- Pawple must not promise email delivery unless email delivery exists.

## 11. Environment contract

### Local development

- Uses a local or dedicated development Supabase project.
- Demo fixtures and development authentication are allowed only behind explicit flags.
- Mating/matching fixtures may be used for testing only when explicitly enabled.
- Production credentials are forbidden.

### Cursor Cloud development

- Uses dedicated development/staging resources.
- Demo fixtures are allowed only when explicitly enabled for testing.
- Production mutation credentials and production user data are forbidden.

### Staging

- Mirrors production schema, migrations, RLS, Auth providers, and Storage policies.
- Uses synthetic seeded test accounts/data, including synthetic mating candidates where needed.
- Runtime demo injection and developer authentication are forbidden.

### Production

- Uses production-only configuration.
- Demo moments, demo meetups, demo mating candidates, fabricated locations, bypass invite codes, and anonymous developer authentication are forbidden.
- Only version-controlled migrations and policies define backend behavior.
- Mating discovery must operate on real pets whose owners have opted them into mating discovery and actual user behavior.

## 12. Legacy transition rules

### Canonical

- Current `App.js` stack and `BottomTabNavigator`
- `FeedScreen`
- Current three-step onboarding flow
- `AuthContext` and `ActivePetContext`
- `profiles`, `pets`, `moments`, `likes`, `invites`
- Pet-centric `meetups`, `meetup_hosts`, and `meetup_participants`
- Supabase Auth, Database, and Storage
- Current service modules under `src/services`
- Phase 1 pet mating/matching behavior defined by this contract, without prescribing its engineering or navigation architecture

### Transitional

- `memories` read fallback
- `moment_pets`
- Legacy meetup columns retained for migration compatibility
- Compatibility parameter/key readers
- Existing local pet-photo URIs
- Existing companion-discovery naming or presentation that may later be aligned with the approved mating product language
- Schema-fallback code required during migration

### Legacy

- `HomeScreen`
- Old combined onboarding
- Placeholder journal/profile/create-memory screens
- Firebase scaffold
- Duplicate storage modules
- Deprecated navigation, location, and meetup-feed helpers
- Ghost `posts`, `photos`, and `meetup_history` references

### Forbidden for new development

- New writes to legacy tables
- New imports of legacy helpers/screens
- New Firebase integration
- New schema fallbacks without an explicit removal plan
- Production demo or fabricated data
- Client-side privileged account lifecycle operations
- Matching criteria beyond same breed, opposite sex, owner opt-in for each pet, and selected distance/radius
- Trait-based, age-based, health-based, vaccination-based, appearance-based, score-based, or AI-based matching
- A Tinder-style Paw action that permanently hides a candidate
- Premature commitment to a post-interest, chat, navigation, or matching architecture not yet approved

The transition rule is always:

**Preserve → migrate → verify → remove.**

Nothing is removed until canonical behavior and migrated data are verified.

## 13. Beta definition of done

Pawple is ready for a production closed beta only when:

- [ ] Google and Apple authentication work in production builds.
- [ ] Sessions restore, expire, switch, and sign out safely.
- [ ] Invite validation is authenticated, atomic, and single-use.
- [ ] Interrupted onboarding resumes without duplicate data or consumed invites.
- [ ] Onboarding completion is explicit.
- [ ] Multiple pets and active-pet deletion work reliably.
- [ ] Pet and moment photos use durable owner-scoped Storage.
- [ ] The database can be recreated entirely from version-controlled migrations.
- [ ] RLS and RPC grants pass role-based security tests.
- [ ] Moments use `moments.pet_ids` canonically and legacy data is readable during migration.
- [ ] Feed and pet journals contain real data only.
- [ ] Eligible mating candidates are determined only by same breed, opposite sex, owner opt-in for each pet, and selected distance/radius.
- [ ] Users can see an eligible candidate’s short mating description and visit its pet profile.
- [ ] Traits are visible as descriptive profile information but do not affect eligibility.
- [ ] Paw/interest does not permanently hide the candidate or interested pet.
- [ ] The relevant owner can see an interested pet’s short mating description and profile, subject to normal privacy and safety rules.
- [ ] The approved post-interest consent model is implemented without adding unauthorized eligibility criteria.
- [ ] Any Phase 1 communication behavior follows the separately approved consent model; chat is not assumed by this contract.
- [ ] Real production usage can begin producing the mating/matching behavior dataset.
- [ ] Meetup hosting, RSVP, capacity, cancellation, and deletion are transactionally correct.
- [ ] Production never fabricates content, mating candidates, venues, or distance.
- [ ] Location denial/unavailability produces an honest degraded experience.
- [ ] Notification UI makes no promise beyond implemented capability.
- [ ] Export returns the user’s actual canonical data.
- [ ] Delete Account removes the Auth identity, database data, relationships, mating/interest data, and media.
- [ ] Development, staging, and production are isolated.
- [ ] Critical auth, onboarding, pet, moment, mating discovery, meetup, RLS, export, and deletion paths are tested.
- [ ] Release builds pass staging smoke tests on iOS and Android.
- [ ] Legacy components receive no new functionality.
- [ ] No P0 issue remains open.
