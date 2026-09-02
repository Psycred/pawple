# PAWPLE — CURRENT FOUNDER AUTHORIZATION

STATUS: CURRENT  
AUTHORITY: FOUNDER  
CEO: Updated per Founder Phase 1a execution directive `4ac03812` (2026-09-02)  
LAST UPDATED: 2026-09-02  
WAVE: Phase 1a — 18+ Bulletin Board; mating/intro chat **hidden** (code preserved)

The contents of this file define the Founder-authorized scope for the
current execution wave. Recommendations, observations, or proposed
future work do not constitute authorization unless explicitly included
here or in a subsequent CURRENT.md.

Source: Founder authorization on PAW-7 (comment `4ac03812`, 2026-09-02),
which supersedes the 2026-08-31 “no hiding mating” launch-surface rule
while preserving mating/intro-chat **code**. Prior Bulletin Board
authorization remains `66e02a99` (2026-08-31). Phase 1b / Final Phase 1
are **held** — note only, no development.

Honesty & Safety wave residuals (staging smoke PAW-52) still **block store
submission** until staging smoke passes. The hide/copy/legal wave may
proceed in parallel. **No commit of that wave until PAW-115 QA SIGN-OFF.**
Bulletin Board implementation is already committed (`71b0d9a`, PAW-110).

============================================================
OVERARCHING PRINCIPLE
============================================================

Pawple ships a feature only when its data handling, authorization,
compliance, user flow, copy and overall experience are truthful,
appropriately secure, and coherent with the product philosophy.

============================================================
BINDING PRODUCT DECISION — PHASE 1a BULLETIN BOARD (2026-08-31)
============================================================

Founder AUTHORIZES **Phase 1a: 18+ Bulletin Board** implementation:

| Element | Binding rule |
|---------|--------------|
| **Launch age** | **18+ ONLY** — existing age attestation |
| **Location** | **City-level coarse only** — no precise GPS stored or exposed |
| **Surfaces** | Pet profiles, **Moments/Feed**, **public city meetup discovery + RSVP**. Mating/intro chat **hidden** (`4ac03812`) |
| **Meetups** | Public city-level events; **no group chat within meetups** |
| **Messaging** | No open DMs. Mutual-Paw intro chat **exists in code but is hidden** in Phase 1a. |
| **Model** | Facebook Events / bulletin-board pattern — city-scoped, pet-first |
| **Engagement** | No engagement metrics on Feed/Moments |

### Future infrastructure (schema only — NOT product UI)

- Implement server-authoritative `account_tier` field (`adult` / `teen`) in DB schema **now**
- **Do NOT** build teen UI, teen gating, DigiLocker VPC, or parental supervision in Phase 1a

### Officially deferred (Teen Accounts wave)

- 13+ onboarding
- DigiLocker VPC
- Parental supervision
- Invisible walls / mixed-age controls for minors

============================================================
MATING SYSTEM — CODE PRESERVED; HIDDEN IN PHASE 1a LAUNCH
============================================================

Founder `4ac03812` (2026-09-02) SUPERSEDES the 2026-08-31 rule
“No hiding, no removing, no feature-flagging, no UI changes to mating”
**for Phase 1a user-facing surfaces only.**

BINDING:
- Mating/matching and intro chat **code must remain** in the repo.
  Do not strip, delete, or rewrite matching criteria (breed, gender,
  user-selected distance only). Architecture stays intact for later phases
  (mutual Paw, discovery, intro chat, 100 km radius, consent-gated flow).
- Phase 1a **users must not see** mating, matching, or intro chat.
  Hide via UI gating / not presenting entry points. Do not remove
  screens, services, RPCs, or tables.
- Mating remains 18+ only when later re-exposed. Under-18 cannot access it.

============================================================
PHASE 1a IMPLEMENTATION WAVE (AUTHORIZED)
============================================================

CEO AUTHORIZES orchestration of Phase 1a implementation tickets
(PAW-95+). Sequencing per CEO dispatch on PAW-7.

1. **CTO architecture** (PAW-95) — before implementation code
2. **Backend:** account_tier schema + location downgrade
3. **Engineering:** Feed/Moments, city meetups, chat enforcement
4. **Legal:** T&C, Privacy, disclaimers, community guidelines
5. **Product Strategist:** Onboarding loop UX review
6. **QA full gate** (PAW-103) — SIGN-OFF or VETO required before any commit

No two specialists modify the same file concurrently. CEO sequences
file ownership per CTO architecture.

============================================================
LEGAL COPY REQUIREMENTS (AUTHORIZED)
============================================================

Legal must update:

- **Terms:** Bulletin Board model, 18+ launch, no open DMs, meetups as public events Pawple does not vet. Do **not** present mating or intro chat as a current Phase 1a user-facing feature.
- **Privacy:** Coarse city-level location only, no precise GPS, no behavioral profiling
- **In-app disclaimers:** RSVP modal (public event, Pawple does not verify attendees). Mating opt-in / intro-chat disclaimers stay in repo for later phases; they must not appear in Phase 1a UX.
- **Community Guidelines:** No harassment, pet-first identity, report/block tools

============================================================
NOT AUTHORIZED / FROZEN
============================================================

- Teen account UI / 13+ onboarding / VPC / parental supervision
- Phase 1b / Final Phase 1 work (family invites, child feed-only, city-wise mating launch) — **held**
- Removing or rewriting mating/intro-chat code; changing matching criteria
- Exposing mating or intro chat to Phase 1a users
- General open DMs / group meetup chats / link sharing in chat
- Swipe decks, match economy, compatibility scores, engagement metrics
- AI message scanning / automated chat moderation
- Push notifications as product for interest/chat
- Store submission (still blocked on PAW-52 staging smoke)
- Push to remote unless Founder authorizes
- **Commits** of the hide/legal-copy wave until QA SIGN-OFF on PAW-115
  (Phase 1a Bulletin Board wave already SIGN-OFF’d on PAW-110 / `71b0d9a`)

============================================================
EXECUTION RULES
============================================================

- Full team: CTO, Backend, Frontend, Legal, QA, Product Strategist
- CTO architecture before implementation code
- QA full gate required before **any commit**
- Out-of-scope discoveries → recommendations only

============================================================
VERIFICATION (WAVE COMPLETE WHEN)
============================================================

1. Phase 1a architecture accepted and followed
2. 18+ age gate enforced; account_tier schema in place (teen UI deferred)
3. City-only location stack honest in code and legal copy
4. Bulletin board meetups (create, discover by city, RSVP) — no group chat
5. Moments/Feed production-ready, pet-first, no engagement metrics
6. Mating/intro-chat **code preserved**; **hidden** from Phase 1a users (Founder `4ac03812`)
7. Legal copy honest for the hidden-mating Bulletin Board launch
8. Product Strategist UX review complete (PAW-102/109)
9. QA Auditor SIGN-OFF on the hide wave (PAW-115) before commit of that wave

CEO returns one consolidated completion report after QA.

============================================================
PHASE 1b / FINAL PHASE 1 — HELD (NOTE ONLY)
============================================================

Founder recorded future intent. **No scoping, design, or development.**

- Phase 1b: family invites, 13–17 journal/feed-only via parent invite (product DOB-match question pending)
- Final Phase 1: city-wise mating for adults, not accessible to children

============================================================
NEW ORGANIZATIONAL HIRING — THREE PERMANENT ROLES
============================================================

CEO is authorized to create/hire these three permanent agents and
establish the reporting structure below. No separate Founder approval is
required for these hires.

1. TESTER
Reports to CTO: 3ba8cc6c-b81e-403f-8958-262b6a04d9a3

Purpose:
Hands-on application testing and defect discovery.

Responsibilities:
- Test real Pawple user journeys and edge cases.
- Test onboarding, authentication, pets, Moments, Meetups, RSVP,
  cancellation, public profiles, notifications, permissions, loading,
  error, empty and recovery states.
- Test destructive actions, navigation, stale state and account
  lifecycle.
- Test future authorized mating flows.
- Test development, staging and release builds where available.
- Re-test fixes and check for regressions.
- Reproduce defects with exact steps, expected versus actual behavior,
  severity, environment and evidence.
- Run relevant automated tests and report actual results.
- Identify usability, reliability and functional defects.

The Tester does not implement fixes, commit, push, or act as the final
quality gate. Findings go to the CTO.

2. PAWPLE PRODUCT & BRAND COPYWRITER
Reports to Marketing Head.

Purpose:
Own Pawple's product and brand copy while preserving technical, legal,
privacy, security and product truth.

Responsibilities:
- Onboarding and instructional copy.
- Labels, buttons and confirmations.
- Empty, loading, error and retry states.
- Permission explanations.
- Location and notification explanations.
- Invitations and Meetup copy.
- Paw and authorized mating copy.
- Chat copy.
- Privacy, account and deletion explanations.
- Emails, notifications and announcements.
- App Store and Google Play descriptions.
- FAQs and community-facing copy.
- Maintain calm, concise, human, restrained and Pawple-specific language.
- Never invent functionality or make unsupported technical, legal,
  privacy or security claims.
- Recommend improved wording and flows but do not authorize product,
  legal, security or engineering changes.

3. MARKETING HEAD
Reports to CEO.

Purpose:
Own Pawple marketing, positioning, brand, product communication and
growth strategy.

Responsibilities:
- Protect Pawple's brand voice and positioning.
- Direct and manage the Copywriter.
- Closed-beta communication and launch strategy.
- Invite, referral and community-growth strategy.
- Audience and messaging strategy.
- Product communication across onboarding, invitations, notifications,
  email, web and store listings.
- Ensure marketing claims match the actual product.
- Coordinate with CTO and QA on technical, privacy, security and
  compliance facts.
- Identify opportunities to make Pawple clearer, more desirable,
  differentiated and emotionally coherent.
- Review App Store and Play Store presentation and messaging.
- Recommend growth or product improvements without independently
  authorizing engineering or scope changes.

ORGANIZATIONAL STRUCTURE

Founder
  |
  CEO
  |-----------------------|
  CTO                 Marketing Head
  |                       |
  |                       Copywriter
  |
  |-- Frontend Engineer
  |-- Backend Engineer
  |-- QA Auditor
  |-- Tester

ROLE SEPARATION

Tester:
Finds and reproduces defects through hands-on testing.

QA Auditor:
Independently audits completed work and acts as the read-only quality
gate. QA issues SIGN-OFF or VETO.

CTO:
Owns technical execution and engineering/testing coordination.

Marketing Head:
Owns marketing and directs the Copywriter.

CEO:
Coordinates the organization and remains the primary executive interface
with Founder.

Founder:
Retains final authority over material product, security, compliance,
architecture and scope decisions.

QA remains independent from implementation despite reporting
organizationally to CTO.

No specialist may expand Founder-authorized scope.

Recommendations are not authorization.

HIRING REQUIREMENT

CEO must create all three as permanent Paperclip agents, not temporary
project agents, with the reporting relationships and standing
responsibilities above.

After hiring, CEO must report:
- agent name
- agent ID
- role
- reporting manager
- confirmation that standing instructions were installed

No application code changes, commits or pushes are authorized by this
directive.
