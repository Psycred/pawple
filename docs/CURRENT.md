# PAWPLE — CURRENT FOUNDER AUTHORIZATION

STATUS: CURRENT  
AUTHORITY: FOUNDER  
CEO: READ ONLY (except this file was updated by CEO per Founder instruction)  
LAST UPDATED: 2026-08-30  
WAVE: Honesty & Safety wave  

The contents of this file define the Founder-authorized scope for the
current execution wave. Recommendations, observations, or proposed
future work do not constitute authorization unless explicitly included
here or in a subsequent CURRENT.md.

Source: Founder Decision Package v3 on PAW-7 (comment a16d6661),
superseded in part by Founder Age & Honesty Wave Unblock (comment
7b0d670d, 2026-08-30).

============================================================
OVERARCHING PRINCIPLE
============================================================

Pawple ships a feature only when its data handling, authorization,
compliance, user flow, copy and overall experience are truthful,
appropriately secure, and coherent with the product philosophy.

============================================================
FOUNDER DECISION PACKAGE v3 (BINDING)
============================================================

(A) LEGAL / PRIVACY HONESTY — FIX  
Rewrite Terms, Privacy Policy, and Pawple Community Guidelines v1 to
match the actual product:
- passwordless OAuth;
- no phone / password / DMs / push-as-product;
- approximate location;
- deletion timing aligned with RPC;
- content policy per (F).

Full legal safety — no compromise.

(B) DATA-VISIBILITY MODEL (BINDING)
- Non-users read nothing — anon/public SELECT of user, pet, or meetup
  data is forbidden.
- Other users see only what the owner explicitly placed on the public
  pet profile.
- Exact pet/user location is never readable by any user (admin-only).
- Meetup venue location is readable by any authenticated user
  (distance check before joining).
- Phase 1 stores no persistent user location beyond feed suggestions.
- Approximate profile area is user-controlled and protected.
- Location storage for services/marketplace is deferred.
- Remediation must remove/replace `profiles.last_location_*` exposure.

(C) AGE — PHASE 1 INDIA LAUNCH: 18+ ONLY (FOUNDER DECISION 2026-08-30)

**Binding for Phase 1 India launch:**
- **18+ only** for account ownership, Terms acceptance, and meetup
  attendance.
- No minors independently creating accounts, accepting Terms, or
  attending meetups.
- Implement the **18+ age gate immediately** as part of this wave.
- Terms, Privacy Policy, and Community Guidelines must reflect **18+
  account ownership** for India launch.

**Future research (NOT authorized for implementation):**
CEO + QA to research and propose a viable product/legal architecture for
tiered age access (13+/16+) in future phases. Evaluate whether Pawple
can legally allow 13+ users on pet social features (moments, profiles,
feed) while restricting meetups and mating to 18+. Report DPDP/store
requirements. Findings must be reported before any age-tiering
implementation is authorized.

(D) COMPANIONSHIP COPY / MATING  
"Open to Companionship" remains unchanged. Mating remains frozen until
PAW-18 sign-off. No mating engineering in this wave.

(E) PUBLIC PROFILE LIFE-RECORD  
Deferred until after this P0 / Honesty & Safety wave. Not authorized now.

(F) TRUST & SAFETY  
- Users can report posts/moments, meetups (before and after attending),
  and later 1-on-1 mating sessions.
- Reports are filed in the name of the pet(s) involved but flag the
  human account.
- Users can block other pet profiles.
- Community Guidelines v1 (part of legal rewrite): Pawple celebrates the
  bond between pets and humans — share your life together, but keep it
  pet-centric, respectful, and safe. Humans with pets, meetup group
  photos, incidental human presence all allowed.
- Never allowed: nudity/sexual content (humans or animals); hate
  speech / harassment / bullying; violence / gore / animal abuse;
  identifiable minors in compromising situations; spam / scams /
  commercial solicitation; harmful misinformation.
- Phase-1 enforcement: report-driven + human review by Pawple team +
  clear appeals; no AI moderation yet.

(G) COMPANION FLAG  
Display-only mating-intent signal until mating is authorized. It must
never gate visibility of profiles, meetups, or feed.

============================================================
AUTHORIZED — HONESTY & SAFETY WAVE
============================================================

Founder AUTHORIZES implementation of ONLY the following:

1. Frontend honesty — remove production distance fabrication; strip
   false privacy / notification promises; ensure companion flag does
   not gate client-side visibility.
2. Backend RLS per (B) + removal/replacement of coordinate exposure;
   companion flag must not gate pet/profile/meetup/feed visibility
   in RLS.
3. Storage policies codified in migrations.
4. Legal / privacy rewrite including Community Guidelines v1 per (F)
   and honesty per (A). Must reflect **18+ account ownership** for
   India launch.
5. **18+ age gate** — implement immediately per (C).
6. Report / block surfaces per (F).

QA Auditor gates the combined wave (SIGN-OFF / VETO) and produces
security/compliance recommendations before implementation where material.

CEO tickets only within this scope; sequences via CTO.

============================================================
NOT AUTHORIZED / FROZEN
============================================================

Do NOT implement:

- Mating engineering / E3 / E4 / E5 / matching engine
- Chat / DMs
- Push notifications as product
- Phone / password authentication
- Public pet-profile life-record implementation
- AI content moderation
- Age-tiering (13+/16+ split) until future research is complete and
  Founder authorizes implementation
- Unrelated UI polish or product expansion
- Commits / push until Founder decides

Do NOT modify Paw-T00y / development invite bypass unless required for
an authorized item above (prefer leave frozen).

============================================================
EXECUTION RULES
============================================================

- No two specialists modify the same file at the same time; CTO sequences
  overlapping files.
- Out-of-scope discoveries → record as recommendations only; do not
  expand scope.
- No commit or push until Founder authorizes.
- QA final gate required before wave completion report.

============================================================
VERIFICATION (WAVE COMPLETE WHEN)
============================================================

1. Files changed documented.
2. Each authorized item implemented per (A)–(G) where in scope.
3. Tests run; skipped tests explained.
4. Anon/public SELECT of user/pet/meetup data forbidden (verified).
5. `profiles.last_location_*` not exposed to users.
6. Production builds do not fabricate distances.
7. Legal/Privacy/Guidelines match actual product and **18+** eligibility.
8. Report + block surfaces present per (F) Phase-1 intent.
9. Companion flag does not gate visibility.
10. **18+ age gate** enforced before account creation / Terms acceptance.
11. Mating / chat / push / phone-password / life-record / AI moderation
    untouched.
12. No commit/push.
13. QA Auditor SIGN-OFF or VETO.

CEO returns one consolidated completion report after QA.
