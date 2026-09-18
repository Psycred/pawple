# PAWPLE — CURRENT FOUNDER AUTHORIZATION

STATUS: CURRENT  
AUTHORITY: FOUNDER  
CEO: Updated per Founder Beta Hardening / Pre-APK Wave on PAW-222 (2026-09-07)  
LAST UPDATED: 2026-09-07  
WAVE: **PAW-222 Beta Hardening / Pre-APK (Camera · Gallery · Notifications · Image Safety · Invites) is the active execution wave.** Mating Match + Chat repair (PAW-195) remains CLOSED for controlled Beta — confirm intact only; **no Mating/Matching/Chat changes** in PAW-222. **Production expose NOT authorized** — `EXPOSE_MATING_SURFACES` stays false. No APK build inside PAW-222 (Founder builds after Tester + QA PASS). Design Wave 3 feel-pass and Phase 1a Bulletin Board remain.

Kickoff doc: `docs/PAW222_BETA_HARDENING_WAVE.md`. CTO impact map first (PAW-223) before Frontend/Backend product code. Copy finals: `docs/PAW224_BETA_HARDENING_COPY.md`. Legal PAW-225: CONDITIONAL-GO (memo on issue).

The contents of this file define the Founder-authorized scope for the
current execution wave. Recommendations, observations, or proposed
future work do not constitute authorization unless explicitly included
here or in a subsequent CURRENT.md.

============================================================
FOUNDER AUTHORIZATION — BETA HARDENING / PRE-APK (PAW-222, 2026-09-07)
============================================================

Founder AUTHORIZES a **separate** Beta Hardening / Pre-APK wave on PAW-222
for Camera · Gallery · Notifications · Image Safety · Invites.

BINDING:
- Hard scope lock: no unrelated refactor, nav redesign, dependency upgrades,
  Mating/Matching/Chat product changes, or opportunistic bug fixing.
- Logout and Delete Account remain protected / untouched.
- Mating/Matching/Chat: **confirm intact only**. `EXPOSE_MATING_SURFACES`
  stays false. No live Mating/Chat SQL. Bottom-nav Match/Chat placement
  is a **separate** later decision.
- Permissions in scope: Camera, Gallery/Photos/Media, Notifications only.
  Do not change Location / Microphone / Contacts / Bluetooth / Calendar
  unless Founder approves an unavoidable dependency.
- Native OS permission state is source of truth. No persistent app-level
  “hasAsked*” flags. No custom permission primers (PAW-136 stands).
- Image safety applies to **pet profile photos and Moment photos**.
  Moderation model/API/dependency install requires **Founder approval**
  of CTO’s Phase 1a recommendation (PAW-222 §15).
- Invites: warm intro + code-bearing invite URL + Android/iOS mock
  `pawple.com` download fallbacks; deep-link retain/prefill; re-click
  after install is enough (no deferred deep-link vendor required).
- Tester path: **Pixel 6a Android emulator**. No APK build in this wave.
  Founder builds fresh APK for Pixel 10 Pro after Tester + QA PASS.

**Invite-file freeze — SUPERSEDED FOR THIS WAVE ONLY:**
Prior Wave 1/2/3 freezes on `src/lib/onboardingInvite.js`,
`src/screens/InviteCodeScreen.js`, and `src/components/InviteSheet.js`
are **lifted solely for PAW-222 invite/deep-link work** mapped by CTO.
Do not expand those edits beyond the Founder invite requirements.
Beta caps / `@PAW-3600` prefill behaviour stay unless the impact map
proves a minimal change is required for code retain/prefill — then
stop for Founder if it alters invite economics.

**CEO operating locks (within mandate, 2026-09-07):**
- Rejected images: **discard by default** (no durable reject store) unless
  Founder later authorizes retention.
- Pet-vs-human strictness: where a **pet profile photo is expected**.
  Moments: reject nudity/sexual/obscene/bikini-style human imagery;
  do **not** ban ordinary humans-with-pets content that Guidelines allow.
- If an automated image gate ships, Privacy/Terms/Guidelines must be
  amended in the **same release** so they no longer claim “no AI
  moderation” (Legal PAW-225 / PAW-226). Quiet UI reject copy stays
  non-technical (Copywriter PAW-224). Do not enable the gate while
  `legalDocuments.js` still asserts blanket “no AI moderation.”
- Mock Android/iOS invite destinations stay honest placeholders
  (no fake Play/App Store chrome).

Source: Founder authorization on PAW-7 (comment `4ac03812`, 2026-09-02),
which supersedes the 2026-08-31 “no hiding mating” launch-surface rule
while preserving mating/intro-chat **code**. Prior Bulletin Board
authorization remains `66e02a99` (2026-08-31). Design Wave 1 and the
Product Designer seat are authorized on **PAW-116** (2026-09-03).
Design Wave 2 (feel-pass findings) is authorized on **PAW-126** (2026-09-03);
**F1 copy and F3 permission primers are superseded by PAW-136.** F4 stands.
Design Wave 3 (Design Constitution + rectification) is authorized on
**PAW-136** (2026-09-03). Phase 1b / Final Phase 1 are **held** — note only,
no development.

Honesty & Safety wave residuals (staging smoke PAW-52) still **block store
submission** until staging smoke passes. Hide/legal wave is on origin/main
(`70f503d`, PAW-115 SIGN-OFF). Bulletin Board implementation is committed
(`71b0d9a`, PAW-110).

============================================================
FOUNDER AUTHORIZATION — MATING MATCH + CHAT REPAIR WAVE (PAW-195, 2026-09-06)
============================================================

Founder AUTHORIZES a Mating Match + Chat **repair / complete / test** wave
on PAW-195 (comment `f67e783b`). This is **not** production expose.

BINDING:
- Recover and repair existing mating/chat code. Do not rebuild what exists.
- Wave is **only** Mating Match + Chat. No opportunistic cleanup.
- **Development: authorized. Controlled Tester/QA path: authorized.
  Normal production exposure: NOT authorized.** Keep
  `EXPOSE_MATING_SURFACES = false` for ordinary users.
- Phase 1a distance: **fixed 100 km**. Preserve 5/10/25/50 selector code
  for later phases; it must not be an active product choice now.
- Location: keep existing coarse/approximate model. Honest ~km wording.
  Do not redesign location architecture. Do not expose exact GPS.
- Matching criteria remain breed, gender, and this fixed 100 km window only.
- Open to Companionship is the eligibility switch. OFF → not matchable,
  Chat inaccessible, that pet’s chats **removed from the product**.
  Phase 1a retention is **freeze-and-hide** (CEO lock, 2026-09-06):
  messages are not physically wiped. Do not claim chats are never saved.
  Other pets’ chats stay. A physical wipe needs a new Founder decision.
- Chat is pet-pair only (Pet A ↔ Pet B). No human names. Dedicated Chat
  page aggregates the logged-in parent’s active pet-pair conversations.
- Discover/Match is potential matches only. Mutual Paw → leave discovery,
  live in Chat. Unmatch / companionship OFF may return a pet to discovery
  if still eligible. No duplicate chats.
- Bottom nav is conditional (companionship / first chat). Founder
  pre-authorizes the tab-bar integration required for that.
- Text-only chat. Keep link block, report/block. No media. No push /
  Realtime unless already present.
- No 18+ banner in the Phase 1a mating/chat UI. Under-18 remain ineligible.
- Before product code: Change Impact Map (exact files). Protected working
  files stay untouched unless genuinely required. Other cross-module
  changes STOP for Founder approval (tab bar is already authorized).
- Do not weaken RLS/auth.

CEO operating interpretation (visibility): implement the Founder product
(toggle, Discover/Match, Chat, nav) behind the existing production hide
gate plus a **controlled non-production test path**. Do not flip the
production gate.

============================================================
FOUNDER AUTHORIZATION — DESIGN CONSTITUTION + WAVE 3 (PAW-136, 2026-09-03)
============================================================

Founder AUTHORIZES the Design Constitution as binding on Designer,
Frontend, and QA. It supersedes all conflicting prior directives,
including Wave 2 F1/F3 copy and permission-screen items.

**Design Constitution**
- Default is no screen. Every interstitial, primer, or pre-screen must
  justify its existence or be removed. System-standard flows win.
- Permissions: OS system prompt only, requested at the moment of need.
  The “why” lives in the OS permission string (Info.plist /
  AndroidManifest / Expo plugin), written in Pawple voice. No custom
  primer sheets for camera, photos, location, or notifications.
- Microcopy over screens: where context is needed, one quiet line under
  the relevant field. Never a standalone screen.
- No copy anywhere may position Pawple as an adult product, a
  stranger-danger product, or a dating product. Pawple is pet parents,
  pet meetups, and UGC events.

**Birthday** (supersedes F1 / F2 / N4)
- Quiet field inside the same About You step as name and city.
- Label: “Birthday.” Standard picker. No headline, no disclaimer, no
  “Pawple is for adults,” no “I am 18 or older” button. Continue stays
  the normal continue.
- Attestation = the DOB value plus server timestamp (already recorded;
  keep).
- If computed age is under 18: calm decline screen only. Maximum two
  sentences; no “strangers,” no “adult who can take responsibility,” no
  meetup justification; warm Pawple voice; may state Pawple is 18+ for
  now and a parental-consent version is on our road (no timeline, no
  “soon”).

**Removals (Wave 3; QA verifies each on device)**
- “Use my city” button and “You can type your city instead” helper.
  Restore the pre-Wave-2 city behavior exactly (typed city field).
- Camera primer sheet. Photos primer sheet. Any other permission primer
  or interstitial added in Waves 2–3 that is not legally required.
- Camera/gallery: OS prompt at first add-photo tap, standard.
- Location: OS prompt only when needed for feed locality. Optional
  one-line helper under the city field, maximum: “Only your city —
  never your exact location.” No screen.

**Keep (do not touch):** F4 delete-account hardening; beta config freeze
(`onboardingInvite.js`, `InviteCodeScreen.js`, InviteSheet hidden);
mating/chat hidden; Community single-page Hosted/Joined toggle; details
card alignment.

**Gates:** Designer feel-walk vs pre-Wave-2 baseline; VETO any added
friction. QA verifies each removal on device. Then Founder feel-pass.
**No EAS build until pass.**

Org-wide DoD unchanged: Product Designer emulator walkthrough as a
first-time user, then Founder feel-pass. QA SIGN-OFF requires the
designer feel-checklist green.

============================================================
FOUNDER AUTHORIZATION — DESIGN WAVE 2 / FEEL-PASS FINDINGS (PAW-126, 2026-09-03)
SUPERSEDED IN PART BY PAW-136: F1 copy and F3 primers. F4 remains in force.
============================================================

Founder AUTHORIZES Design Wave 2 as binding remediation of the Wave 1
feel-pass. Wave 1 D1–D3 remain in force except where F1–F4 explicitly
supersede placement or copy.

**F1 — Age gate copy** (supersedes Wave 1 N2 / adult-path justification):
- Adult path: plain ask, no justification. “Pawple is for adults.” +
  birthday + quiet confirm. No meetup or Terms mentions anywhere on
  the adult path.
- Under-18 path only: calm decline screen. Pawple is currently
  adults-only because real-world meetups with strangers require adult
  accountability; a version with proper parental consent is on our
  road. **No timeline. No “soon.”**
- Copywriter finalizes in Pawple voice.

**F2 — Age placement** (CEO lock, 2026-09-03): Birthday lives in the
same About You step as name + city. Never a standalone wall at either
end of onboarding. Under-18 decline is a terminal screen after
eligibility fails — not an onboarding step. Attestation stays
mandatory before onboarding completes; it must never be the first
screen. This supersedes Wave 1’s separate late AgeGate moment.

**F3 — Permission moments:** Every sensitive permission gets a
Pawple-voice primer **before** the native OS prompt.
- (a) Location primer **NOW**, with the city-only promise (“Only your
  city — never your exact location”) and a calm manual-city fallback
  on decline.
- (b) Notification primer **specced now**; ship when push is
  authorized. Do not implement notification primer UI in this wave.
- (c) Verify camera/photo primer consistency with the same pattern.
- Legal: T&C consent never substitutes native runtime permission.
  Copy must stay honest.

**F4 — Delete hardening** (consolidates N1 + N3):
- Client-side Storage API cleanup (list + remove under user prefix in
  `moments` / `pet-photos`) before the delete RPC. Keep RPC storage
  delete exception-guarded. Do not change schema or RLS.
- On RPC ok: `signOut()` + clear per-user local state + reset
  navigation to entry (Welcome).
- Boot guard: session exists but profile fetch is null / `42501` /
  `42703` → treat as signed out.
- QA verifies on-device: delete → signup; no zombie screens.

**Frozen (unchanged):** `src/lib/onboardingInvite.js`,
`src/screens/InviteCodeScreen.js`, `src/components/InviteSheet.js`
(hidden). Mating + chat stay hidden. Wave 2 Founder feel-pass is
**superseded** by PAW-136. **No EAS preview** until Founder feel-pass
on Wave 3.

Org-wide DoD unchanged: Product Designer emulator walkthrough as a
first-time user, then Founder feel-pass. QA SIGN-OFF requires the
designer feel-checklist green.

============================================================
FOUNDER AUTHORIZATION — ORG HIRE + DESIGN WAVE 1 (PAW-116, 2026-09-03)
============================================================

Founder AUTHORIZES:

1. **Named seat:** Product Designer (UI/UX) owns UI and UX as one role.
   Reports to CEO for wave coordination. Peer of CTO and Engineering.
   Protected founder escalation on pet-first philosophy. Feel-based VETOs
   may be overridden only by the Founder.

2. **Org-wide Definition of Done (immediate):** No user-facing wave closes
   without (a) Product Designer emulator walkthrough as a first-time user,
   (b) Founder feel-pass. QA SIGN-OFF requires the designer feel-checklist
   green.

3. **Design Wave 1** (designer specs → Frontend implements → QA + designer
   gate). Copy via Copywriter.

   - **D1 — Pet-first onboarding reorder:** warm welcome (pet-first,
     "One Heart Is Enough") → invite code → about you → your pet → quiet
     18+ attestation folded in immediately before account creation.
     Attestation stays mandatory before account creation; it must never
     be the first screen again.
   - **D2 — Pet details card:** aligned label/value rows, consistent
     vertical rhythm, dead whitespace removed; Age/Gender may share a row.
   - **D3 — Community single page:** remove "My Meetups" as a destination;
     segmented **Hosted / Joined** toggle (same pattern as Journal/About)
     with the corresponding list scrolling beneath, same page.

4. **Frozen:** do not touch `src/lib/onboardingInvite.js` (`@PAW-3600`
   prefill, `BETA_BASELINE` 85, `BETA_USER_CAP` 100),
   `src/screens/InviteCodeScreen.js`, `src/components/InviteSheet.js`
   (hidden). Mating + chat stay hidden (`EXPOSE_MATING_SURFACES=false`).
   Do **not** run the EAS preview build until the Founder feel-pass passes.

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

- Full team: CTO, Backend, Frontend, Legal, QA, Product Strategist, Product Designer (UI/UX), Copywriter
- CTO architecture before implementation code
- QA full gate required before **any commit**
- User-facing waves also require Product Designer feel-checklist green and Founder feel-pass
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
