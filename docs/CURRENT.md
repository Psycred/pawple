# PAWPLE — CURRENT FOUNDER AUTHORIZATION

STATUS: CURRENT  
AUTHORITY: FOUNDER  
CEO: Updated per Founder Mating System authorization (2026-08-30)  
LAST UPDATED: 2026-08-30  
WAVE: Mating System wave (pet-centric, consent-gated)

The contents of this file define the Founder-authorized scope for the
current execution wave. Recommendations, observations, or proposed
future work do not constitute authorization unless explicitly included
here or in a subsequent CURRENT.md.

Source: Founder authorization on PAW-7 (comment `00d919c3`, 2026-08-30),
signing off PAW-18 direction **with amendments**, superseding the mating
freeze. Spec authority: `docs/PAWPLE_MATING_DISCOVERY_SPEC.md` **rev 4**.

Honesty & Safety wave remains **QA-closed and locally committed**; its
residuals (staging smoke, server age attestation, cleanup) stay on the
backlog and still **block store submission** until staging smoke passes.
They are not the active product-build wave unless Founder re-prioritizes.

============================================================
OVERARCHING PRINCIPLE
============================================================

Pawple ships a feature only when its data handling, authorization,
compliance, user flow, copy and overall experience are truthful,
appropriately secure, and coherent with the product philosophy.

Do NOT build a Tinder/Bumble-style app. Build Pawple mating:
calm, pet-profile-first, supply-first (internal), consent-gated.

============================================================
BINDING PRODUCT DECISIONS (REV 4)
============================================================

(1) DISCOVERY  
Calm and pet-profile-first per rev 3/4. No swipe, no card deck, no
browse-Paw-browse loop. Supply-first remains internal sequencing only.

(2) PAW  
A user Paws a pet to express mating interest (after full-profile
evaluation). Paw on profile only — not list-row.

(3) TRANSPARENT PAW  
The requested pet’s owner sees who Pawed and can open the requesting
pet’s FULL profile to evaluate before deciding. Paw is not hidden.

(4) RECIPROCAL CONSENT  
Requested owner either Paws back (informed reciprocal consent) or
simply does not respond. Calm no-response pattern — NOT harsh
rejection UI.

(5) MUTUAL PAW → INTRODUCTION CHAT  
Mutual Paw unlocks an introduction chat between the two pet parents.

(6) CHAT SCOPE (BINDING)  
Mating-introduction channel ONLY, unlocked after mutual Paw.
NOT general open DMs.

(7) CHAT SAFETY (PHASE 1)  
Guidance + report/block only; no AI message scanning.
At chat open: Pawple-voice disclaimer — sharing personal details
(address, phone, exact meeting spot) is at users’ discretion; Pawple
encourages public pet-friendly first meetups; Pawple is not
responsible for chat exchanges.

(8) COPY  
“Open to Companionship” remains unchanged.

(9) AGE  
Phase 1 India remains **18+ only**. Mating for 18+ account holders.

(10) COMMITS  
No commits / push until Founder decides.

============================================================
AUTHORIZED — MATING SYSTEM WAVE
============================================================

Founder AUTHORIZES:

1. Spec — `PAWPLE_MATING_DISCOVERY_SPEC.md` amended to **rev 4** (CEO;
   must complete before engineering).
2. CTO — architecture proposal for reciprocal-Paw state, consent-gated
   chat unlock, and report/block wiring (before implementation).
3. QA — security / privacy / safety recommendations **before**
   implementation; final wave SIGN-OFF / VETO after implementation.
4. Legal — update Terms, Privacy Policy, and Community Guidelines to
   reflect scoped introduction chat (honest; replace “no DMs” claims).
5. Backend / Frontend — implement E3/E4/E5 + reciprocal Paw +
   introduction chat per rev 4 + CTO architecture, after gates (2)(3).

Matching criteria remain only: **breed, gender, user-selected
geographical distance**. Do not invent extra criteria.

============================================================
NOT AUTHORIZED / FROZEN
============================================================

- General open DMs / non-mating messaging
- Swipe decks, match economy, compatibility scores, AI matching UI
- Harsh reject / pass UI for incoming Paws
- AI message scanning / automated chat moderation
- Push notifications as product for interest/chat
- Age-tiering implementation
- Store submission (still blocked on staging smoke — PAW-52)
- Commits / push until Founder decides
- Unrelated product expansion

============================================================
EXECUTION RULES
============================================================

- Full team: CTO, Backend, Frontend, QA Auditor — sequenced by CEO/CTO.
- Rev 4 + CTO architecture + QA pre-recs before implementation code.
- No two specialists modify the same file at the same time.
- Out-of-scope discoveries → recommendations only.
- No commit or push until Founder authorizes.
- QA final gate required before wave completion report.

============================================================
VERIFICATION (WAVE COMPLETE WHEN)
============================================================

1. Spec rev 4 recorded and followed.
2. CTO architecture accepted for reciprocal Paw + chat unlock + safety.
3. QA pre-implementation recommendations posted and addressed where
   material.
4. Discovery / Paw / transparent interest / reciprocal / mutual unlock
   match rev 4.
5. Introduction chat only after mutual Paw; disclaimer present;
   report/block wired; no AI scanning.
6. Legal copy honest about scoped introduction chat.
7. No Tinder/Bumble patterns; “Open to Companionship” unchanged.
8. No commits/push until Founder decides.
9. QA Auditor SIGN-OFF or VETO.

CEO returns one consolidated completion report after QA.
