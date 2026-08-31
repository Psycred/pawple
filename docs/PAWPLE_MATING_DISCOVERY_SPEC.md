# Pawple Mating Discovery — Mental Model & Presentation Spec

**Issue:** PAW-18 (Workstream E2) — canonical E2 spec (consolidates PAW-13)  
**Status:** Rev 4 — **Founder AUTHORIZED** (PAW-7, 2026-08-30) with reciprocal-Paw + introduction-chat amendments  
**Author:** CTO (architecture-aligned product/UX spec); Rev 4 amendments by CEO per Founder authorization  
**CEO assessments:** `docs/PAWPLE_MATING_DISCOVERY_CEO_ASSESSMENT.md`, `docs/PAWPLE_MATING_DISCOVERY_FOUNDER_REASSESSMENT.md`  
**Date:** 28 Aug 2026 (rev 3); **30 Aug 2026 (rev 4)**

**Authoritative inputs:**

- PAW-7 Founder authorization — **Mating System (pet-centric, consent-gated)** (comment `00d919c3`, 2026-08-30) — **binding for rev 4**
- PAW-7 issue document `mating-founder-principles` — **Founder Mating Product Principles** (rev 1)
- PAW-2 Founder decision — **Option B+** (supply-first **internal** sequencing; not user-facing mental model)
- `docs/PAW2_MATING_PRODUCT_PRINCIPLE.md` (rev 1)
- `docs/PAWPLE_BETA_ARCHITECTURE_PRODUCT_CONTRACT.md` — mating eligibility and Paw rules
- `docs/PAWPLE_OPERATING_AND_DECISION_GOVERNANCE.md` §11 — Phase 1 mating boundary
- `docs/CURRENT.md` — Mating wave authorization

This document defines presentation, navigation, interaction, consent, and introduction-chat scope within Founder authorization. Product Contract mating sections should be aligned in a future contract update; **CURRENT.md Mating wave is the execution authority now.**

---

## 1. Purpose

Define how Pawple presents **mating discovery for a specific pet** so that:

1. The experience is unmistakably Pawple — calm, pet-first, trustworthy — and **not** a dating-app pattern adapted for pets.
2. Engineering (E3 schema, E4 eligibility, E5 discovery UI, reciprocal Paw, introduction chat) can implement without inventing product behaviour.
3. Design/UX can execute visual treatment within Pawple’s established systems when a Design/UX agent is available.

**Pre-engineering gate:** Engineering begins only after (a) this **rev 4** is recorded, (b) CTO architecture proposal, and (c) QA pre-implementation security/privacy/safety recommendations. Final QA SIGN-OFF/VETO gates the wave. **No commits until Founder decides.**

### Rev 4 amendments (Founder Mating System authorization — 30 Aug 2026)

| # | Amendment | Section |
|---|-----------|---------|
| 1 | **Transparent Paw** — requested owner sees who Pawed and may open the requesting pet’s **full profile** before deciding | §7.5 |
| 2 | **Reciprocal consent** — owner Paws back (informed) or calm **no-response** (not harsh rejection UI) | §7.6 |
| 3 | **Mutual Paw → introduction chat** between the two pet parents | §7.7 |
| 4 | **Chat scope** — mating-introduction channel **only**; unlocked after mutual Paw; **not** general open DMs | §7.7 |
| 5 | **Chat safety (Phase 1)** — guidance + report/block only; no AI message scanning; Pawple-voice disclaimer at chat open | §7.7 |
| 6 | **Legal honesty** — Terms, Privacy, Community Guidelines must reflect scoped introduction chat (replace “no DMs” claims) | §7.8, CURRENT.md |
| 7 | **Copy** — “Open to Companionship” remains unchanged | §5 |
| 8 | Discovery remains calm, pet-profile-first, supply-first internal, **no swipe / card deck / browse-Paw-browse loop** | §2, §6, §10 |

### Rev 3 amendments (Founder principles — 28 Aug 2026)

| # | Amendment | Section |
|---|-----------|---------|
| 1 | **Founder mental model gate** — explore opportunities *for my pet*; never a catalogue of available pets | §2.0 |
| 2 | **Supply-first is internal only** — user-facing language is mating intent / exploration for [Pet Name] | §2.3, §5, §8 |
| 3 | **Orientation hero** on discovery screen — active pet as protagonist before any other pet | §6.1 |
| 4 | Rename discovery list — **To explore** (not “Eligible nearby” / catalogue language) | §3.1, §6 |
| 5 | **Remove mating description from list rows** — understanding on full profile only | §6.2 |
| 6 | **Paw below evaluation context** on profile — post-understanding interest, not hero-adjacent like | §7 |
| 7 | **Interest in [Pet Name]** on About tab — not “Interested” inbox tone | §9.4 |
| 8 | Explicit rejection of browse → Paw → browse shallow loop | §2.6, §10 |
| 9 | Rev 2 CEO amendments retained (profile-only Paw, no discovery-screen inbox) | §7, §9 |

### Rev 2 amendments (CEO — retained)

| # | Amendment | Section |
|---|-----------|---------|
| 1 | **Paw only on full pet profile** — no list-row Paw in Beta | §7 |
| 2 | **Incoming interest** on owner About tab only — not on discovery screen | §9 |
| 3 | Discovery screen shows exploration + scarcity only — no browse/inbox dual layout | §6, §9 |
| 4 | Single canonical doc — `PAW13_MATING_DISCOVERY_MENTAL_MODEL_SPEC.md` superseded | §15 |

---

## 2. Product mental model

### 2.0 Founder mental model gate (non-negotiable)

**Required user mental model:**

> *I am exploring appropriate mating opportunities for my pet.*

**Forbidden user mental model:**

> *Here are nearby pets available for mating.*

Every screen, label, and empty state must reinforce the first — never the second. Pawple helps a responsible pet parent find a **suitable opportunity for [Pet Name]**; it does not present a directory, marketplace, catalogue, or dating pool.

**Persistent evaluation question (implicit in hierarchy):**

> *Could this be a suitable mating opportunity for [Pet Name]?*

### 2.1 Core frame

**Internal name:** *Mating discovery for [Pet Name]*

**Never centre:** “matching,” “dates,” “swipes,” “compatibility scores,” “your matches,” “available pets,” “eligible nearby,” or catalogue/browse language.

**Centre:** The **active pet** — protagonist of the experience — whose owner is thoughtfully exploring whether a **responsible, suitable mating opportunity** exists.

The human is the **responsible facilitator** — not the person being “matched.” Another pet is an **opportunity to understand in context**, not inventory to browse or a card to accept/reject.

### 2.2 User story (Beta)

As a responsible pet parent, I want to discover whether suitable mating opportunities exist near **[Pet Name]** — and evaluate them through each pet’s full identity (profile, Moments, traits, mating description) — without Pawple feeling like a marketplace or dating product.

### 2.3 Experience arc (Option B+ — internal sequencing)

**Internal note:** Option B+ supply-first sequencing governs **engineering rollout** (intent controls before discovery UI). It must **never** appear in user-facing copy as “building supply” or “waiting for candidates.”

| Phase (internal) | User-facing name | When | Owner experience |
|------------------|------------------|------|------------------|
| Intent | **Mating intent** | Always per pet | Deliberate opt-in, About mating, distance — private, reversible |
| Waiting | **Exploring** | Opted in, zero opportunities | Calm state — no suitable opportunity yet for [Pet Name]; not broken matching |
| Evaluation | **Understanding** | ≥1 opportunity | Orient around [Pet Name] → explore opportunities → open full profile |
| Interest | **Expressing interest** | After evaluation | **Paw** — genuine interest after understanding; no dismiss/hide loop |
| Visibility | **Interest in [Pet Name]** | Interest recorded | Other owner sees **who** Pawed (transparent); may open full requesting pet profile before deciding |
| Reciprocal | **Informed consent** | Receiver decides | **Paw back** (mutual) **or** calm no-response — never harsh reject UI |
| Introduction | **Introduction chat** | After **mutual Paw** only | Mating-introduction channel between the two pet parents — **not** open DMs |

### 2.5 Thoughtful journey (Founder — required sequence)

Every mating flow must support this pet-centric sequence:

1. **Orient** — around the user’s pet and its mating intent  
2. **Discover** — an appropriate opportunity (not a pool to skim)  
3. **Understand** — the other pet’s identity, life, Moments, temperament, breeding intent  
4. **Evaluate** — suitability for [Pet Name]  
5. **Express interest** — only where appropriate, via Paw after evaluation  

Implementation must not optimise for volume, rapid browsing, or shallow like loops.

### 2.6 Anti-pattern: browse → Paw → browse

Users must not be able to reduce mating to:

> *See pet → Paw pet → check who Pawed back*

Forbidden optimisations: row-level interest actions, hero-adjacent Paw, inbox-style inbound interest, match-adjacent celebration, or any UX that rewards scanning volume over understanding.

### 2.4 Why this is not Tinder/Hinge for pets

| Dating-app default (reject) | Pawple mating (require) |
|-----------------------------|---------------------------|
| Swipe stack / card deck | Scrollable list → full pet profile |
| Match as product centre | Discovery + suitability evaluation |
| Dismiss hides forever | Paw does not permanently hide candidates |
| Human-as-dater | Pet as visible identity; human as facilitator |
| Engagement maximisation | Responsible intent, trust, calm scarcity |
| Superficial compatibility UI | Breed/sex/radius eligibility only; traits for human reading |

Pawple adds: private invite-only trust layer, pet life archive (Moments/journal), meetup context, and ecosystem intent beyond a standalone “pet matching” utility.

---

## 3. Language & terminology

### 3.1 Approved product language

| Context | Label / copy direction |
|---------|------------------------|
| Feature (owner settings) | **Mating** or **Mating discovery** — not “companion,” “matching,” or “dating” |
| Opt-in toggle | **Open to mating** (toggle label) |
| Opt-in badge on profile (public) | **Open to mating** — calm pill; no emoji, no exclamation |
| Discovery screen title | **For [Pet Name]** — pet name always present |
| Exploration section header | **To explore** — not “Nearby,” “Eligible nearby,” “Available,” “Candidates,” or “Matches” |
| Inbound interest (owner About) | **Interest in [Pet Name]** — not “Interested,” “Likes you,” or inbox language |
| Interest action | **Paw** (verb: “Paw” / state: “Interest expressed”) — not “Like,” “Heart,” “Match” |
| Forbidden user-facing terms | “Supply,” “eligible pets,” “candidate pool,” “available for mating,” “find matches” |
| Radius control | **Distance** or **Within** — e.g. “Within 25 km” |
| Mating description field | **About mating** (label) — placeholder-driven, example not essay |

### 3.2 Legacy codebase alignment

The repository currently uses **companion** naming (`is_looking_for_companion`, “Looking for a Companion”). **E3/E5 must migrate** user-facing language and schema naming to mating terminology per this spec. Preserve data continuity; do not fork parallel discovery flags.

### 3.3 Copy tone

- Short, human, obvious — per `.cursorrules` UX writing.
- Placeholders over helper paragraphs.
- No gamification (“You’re on fire!”, streaks, counts).
- No exclamation marks on primary CTAs.

---

## 4. Eligibility (contract — not UX criteria)

Eligible candidates are determined **only** by:

1. Same **breed** as the viewing pet  
2. **Opposite sex**  
3. Both pets **opted in** to mating discovery  
4. Within the **viewing user’s selected radius**

Traits, age, health, vaccination, personality, and AI scores are **descriptive only** — never eligibility or ranking inputs.

**Presentation rule:** Do not surface a “compatibility” or “match score.” Distance may be shown as approximate proximity (e.g. “~12 km”) when honestly available; omit or show unavailable when location is stale/denied — never fabricate.

---

## 5. Mating intent UX (always in Beta)

**User-facing name:** **Mating** / **Mating intent for [Pet Name]** — never “supply layer” in UI or copy.

**Internal note:** This is the Option B+ supply layer — ships regardless of opportunity density. It must feel complete even when exploration is empty, without implying a broken catalogue.

### 5.1 Where supply lives

**Primary surface:** Pet profile → **About** tab (owner view).

**Secondary surface:** Edit Pet screen — same controls, not duplicated logic with conflicting labels.

**Not on:** Feed tab, bottom-tab root, or onboarding required path (opt-in remains optional post-pet-creation per contract).

### 5.2 Supply controls (owner-only)

#### A. Opt-in toggle

- **Control:** Standard calm switch — **Open to mating**
- **Default:** Off  
- **Behaviour:** Reversible anytime; turning off removes pet from others’ eligible candidate pools immediately (server-enforced).  
- **No** onboarding gate unless product later deliberately places it there.

#### B. Mating description

- **Field:** Single short text area — **About mating**  
- **Purpose:** Responsible breeding intent and context for human evaluation (contract: “short mating description”).  
- **Constraints:** Max ~200 characters (engineering may enforce; UX treats as ~2 calm lines).  
- **Placeholder example:** `Calm temperament. First litter planned. Health checks up to date.`  
- **Visibility:** Shown on pet profile when opted in; shown to viewers evaluating the pet as a candidate or viewing interest.  
- **Not required** to opt in, but encouraged via placeholder — no blocking modal.

#### C. Discovery radius

- **Control:** User-level preference (not per-pet) — adjustable **distance** for mating discovery.  
- **Presentation:** Bottom sheet or inline stepped control — calm, not a map configuration screen.  
- **Suggested presets:** 10 / 25 / 50 / 100 km (engineering may adjust; UX keeps few discrete choices).  
- **Label pattern:** `Within 25 km`  
- **Persistence:** Stored on profile or dedicated preference field (E3 architecture).  
- **Honesty:** Changing radius re-evaluates eligibility; UI may note when wider distance reveals candidates (no fake urgency).

#### D. Traits & existing profile fields

Traits, bio, breed, sex, age, photo, Moments — remain on pet profile as **evaluation context**. No new trait UI in discovery list beyond what profile already shows.

### 5.3 Public profile signals (non-owner view)

When a pet is opted in and discoverable:

- **Badge:** `Open to mating` pill on profile hero (replace current “Open to Companionship” pattern).  
- **Mating description:** Visible in About section when present.  
- **No** owner/human name emphasis.

---

## 6. Discovery layer UX (when supply exists)

Discovery is shown **only when** the active pet is opted in **and** the eligibility query returns ≥1 opportunity (Option B+). Otherwise show scarcity state (§8) — never an empty swipe deck or empty catalogue grid.

### 6.1 Presentation pattern — orient, then explore

**Required structure (top → bottom):**

1. **Orientation panel** — active pet photo, name, breed • sex • age, and owner’s **About mating** summary (if present). Reinforces: *exploring for [Pet Name]*.  
2. **To explore** — vertical scrollable list of opportunity rows (below orientation).

**Required pattern:** Scrollable **exploration list** — not a swipe stack, not a marketplace grid, not a directory of “available pets.”

**Forbidden patterns:**

- Swipe cards (left/right)  
- Full-screen card stack  
- “X/N” progress indicators  
- Dismiss / pass / skip actions  
- Match celebration animations  
- Compatibility badges or percentage scores  

Each row is an **explore affordance** — invitation to understand another pet in full context — not a dating card or catalogue listing.

### 6.2 Exploration row content (discovery list)

Order and hierarchy (top → bottom within row):

1. **Pet photo** — circular or soft rounded square; real photo or calm fallback  
2. **Pet name** — primary line (Inter SemiBold ~18px class)  
3. **Breed • sex • age** — secondary metadata line  
4. **Approximate distance** — when available (`~12 km`); omit if unavailable  
5. **Quiet affordance** — tap row opens **full pet profile** (primary and sole path to understanding)

**Do not show** mating description on list rows (rev 3) — reduces catalogue scanning; understanding happens on profile.

**No** Paw control on list rows (Beta). **No** fake initial avatars. **No** system emoji in location/distance lines.

### 6.3 Full profile evaluation path

Tapping a candidate opens the existing **Pet Profile** screen (read-only for non-owner):

- Hero, traits, bio, **About mating** section, journal preview or link to journal tab  
- Owner can scroll Moments via journal tab  
- **Paw** action available **only on profile**, **below** About mating / evaluation context (see §7) — not hero-adjacent  
- List row is navigation-only  

Evaluation question in the owner’s mind: *“Could this be a suitable mating opportunity for [Pet Name]?”*

### 6.4 List ordering (Beta)

**Default:** Stable, non-gamified ordering — e.g. nearest-first when distance is available, otherwise recent opt-in.  

**No** “recommended for you,” promoted candidates, or popularity signals.

### 6.5 Active pet context

Discovery is always scoped to **one pet** — the **active pet** in `ActivePetContext`.

- Screen title: **For [Active Pet Name]**  
- If active pet is not opted in: show supply prompt (§8.3), not an empty candidate list.  
- Switching active pet (pet switcher) changes discovery scope; no multi-pet combined discovery in Beta.

---

## 7. Paw interest interaction

### 7.1 Meaning

**Paw** = expression of **genuine mating interest after evaluation** — from the viewing owner toward another pet, on behalf of the active pet.

Paw is **not** a like, heart, or match action. It must not be placed where users can express interest without first understanding the other pet’s context.

Contract: Paw is **not** a Tinder-style dismissal. It must **not** permanently hide either pet or create a permanently hidden candidate relationship.

### 7.2 Visual distinction from Moment heart

| Surface | Icon | Colour | Meaning |
|---------|------|--------|---------|
| Feed moments | Heart | Heart purple `#7B61FF` when liked | Appreciation of a memory |
| Mating discovery | **Paw** (paw icon) | Sage family when Pawed | Mating interest |

Do not reuse the purple heart for mating interest.

### 7.3 Interaction behaviour

- **Tap Paw:** Toggle interest (idempotent persistence — E3).  
- **Animation:** Single soft scale pulse on first Paw — 180–260ms, ease-out; remain filled/coloured until un-Pawed. No double-pulse (that is feed-heart first-like behaviour).  
- **No** count, no public metric, no “N pets Pawed you.”  
- **Re-Paw:** Allowed; un-Paw removes interest record.  
- **After Paw:** Candidate remains in list and profile remains visitable.

### 7.4 Placement

- **On candidate profile only** — below About mating / traits / journal context (not beside hero). Label: `Paw` / state: `Interest expressed`.  
- **List row:** No Paw control — exploration rows navigate to profile only.  
- **Rationale (rev 3):** Prevents browse → Paw → browse shallow loop; reinforces understand → evaluate → express interest.

### 7.5 Receiver visibility — transparent Paw (rev 4 — binding)

When pet B’s owner has opted in, and pet A (active pet) Paws B:

- The Paw is **transparent, not hidden**. B’s owner sees **who** Pawed B.  
- Surface: calm **Interest in [Pet Name]** on the owner **About** tab (§9.4) — not discovery-screen inbox.  
- Receiver sees: requesting pet’s name, photo, mating description, and can open the requesting pet’s **full profile** to evaluate before deciding.  
- **No** automatic “match” celebration, no phone reveal, no forced response.  
- **No** harsh reject / decline / “pass” button as primary UX.

### 7.6 Reciprocal consent — Paw back or calm silence (rev 4 — binding)

After seeing who Pawed and reviewing the full profile, the requested owner may:

1. **Paw back** — informed reciprocal consent (same Paw semantics, on the requesting pet’s profile after understanding).  
2. **Simply not respond** — calm no-response pattern. Interest may remain quietly visible or age without urgency; **do not** invent a loud rejection, “declined,” or ghosting-shame UI.

**Mutual Paw** = both directions of interest exist for the pet pair (A→B and B→A). Only then unlock introduction chat (§7.7).

Un-Paw remains allowed; if mutual state breaks, chat access must revoke or freeze per CTO architecture (defense in depth).

### 7.7 Introduction chat (rev 4 — binding)

**Unlock:** Mutual Paw only.

**Scope:** A **mating-introduction channel** between the two pet parents for that consented pet pair — **only**.  
**Not authorized:** general open DMs, meetup group chat as mating chat, broadcast messaging, or chat with non-mutual pairs.

**Phase-1 chat safety (Founder):**

- Guidance + existing **report/block** wiring — **no AI message scanning**  
- At chat open, show a **Pawple-voice disclaimer** stating, in calm compressed language:  
  - Sharing personal details (address, phone, exact meeting spot) is at users’ discretion  
  - Pawple encourages **public, pet-friendly** first meetups  
  - Pawple is **not responsible** for chat exchanges  
- Do not overload with legal essays; keep Pawple calm and honest

**Copy tone:** Introduction, not dating inbox. No “It’s a Match!” fireworks. Prefer quiet unlock: e.g. `Introduction` / `With [Pet Name]’s parent`.

### 7.8 Legal honesty (rev 4 — required before ship)

Honesty & Safety legal copy currently states **no DMs**. Mating introduction chat **must** be reflected in:

- Terms of Service  
- Privacy Policy  
- Community Guidelines v1  

Scope the language tightly: consent-gated introduction after mutual Paw; not open messaging. Full legal safety — no compromise. Coordinate with legal ticket in the Mating wave.

---

## 8. Empty, scarcity, and error states

Honest scarcity is **first-class product**, not an engineering afterthought (PAW-2, Option B+).

### 8.1 No eligible candidates (opted in, supply ready)

**Context:** Active pet opted in; eligibility query returns zero.

**Tone:** Calm exploration — no suitable opportunity yet for [Pet Name]; not a broken catalogue or failed match.

**Example copy (adapt, do not over-explain):**

- Title: `Nothing to explore yet`  
- Body: `No suitable opportunities for [Pet Name] within [radius] yet.`  
- **No** supply-building language (“building supply,” “candidates will appear”). Optional quiet link: adjust **Distance** in About.  
- **No** illustration of empty card decks, broken hearts, or marketplace empty states.

### 8.2 Not opted in (active pet)

**Context:** Owner opens discovery entry but pet is not open to mating.

**Pattern:** Supply prompt — not a dead screen.

- Title: `For [Pet Name]`  
- Body: `Open to mating to discover eligible pets nearby.`  
- Primary: navigate to About / toggle **Open to mating** (inline toggle acceptable).  
- Do not show fake locked candidates.

### 8.3 Location unavailable / stale

Distance omitted on rows; eligibility may still apply if backend can compute. Copy never fabricates distance. Optional footnote on discovery screen: `Distance unavailable` only if needed — prefer omission.

### 8.4 Loading & errors

- Loading: calm skeleton or spinner — no “finding matches” or “searching for pets” language.  
- Error: `Couldn't load candidates. Try again.` — retryable, non-destructive.

### 8.5 Push / notifications

Beta: **no** push promises for new candidates (align F1 notification honesty). In-app discovery only.

---

## 9. Navigation & progressive disclosure

Mating must not hijack the main tab bar or Feed. **Progressive disclosure** — discoverable when relevant, invisible when not.

### 9.1 No new bottom tab

Bottom tabs remain: **Feed | + | Pets** (per current `BottomTabNavigator`).

Do **not** add a “Discover” or “Mating” tab for Beta.

### 9.2 Entry points (progressive)

| Priority | Entry | When visible |
|----------|-------|--------------|
| **Primary** | Pet profile → About → **Mating** section | Owner always on own pet About tab |
| **Secondary** | Pets tab header / active pet area → `For [Pet Name]` link or row | When owner has ≥1 pet; opens discovery or supply/scarcity state |
| **Tertiary** | Candidate / interested pet profile | Deep link from list or interest inbox |

**Not** on Feed home as a primary carousel or banner.

### 9.3 Mating section on About (owner)

Collapsed **section** on About tab (not a separate settings app):

1. **Open to mating** toggle  
2. **About mating** field (when on or always visible for owner)  
3. **Distance** preference (user-level)  
4. **For [Pet Name]** — navigates to discovery surface (eligible list or scarcity only)  
5. **Interest in [Pet Name]** — incoming Paws (§9.4), below mating intent controls and exploration link

Section title: **Mating** — one word, no helper paragraph above.

### 9.3b Discovery screen layout (For [Pet Name])

Wireframe-level intent — discovery stack screen contains **only**:

- Title: **For [Pet Name]**  
- **Orientation panel** (active pet + mating intent)  
- **To explore** list (or scarcity / not-opted-in state)  
- Loading and error states  

**Does not contain:** inbound interest section, inbox, dual tabs, or browse+inbox split. One purpose: orient around [Pet Name] and explore opportunities.

### 9.4 Interest in [Pet Name] (receiver) — About tab only

**Founder + CEO:** Incoming interest does **not** appear on the discovery screen. It lives on the owner’s pet **About** tab only — secondary to mating intent controls, not peer navigation with exploration.

Calm subsection within **Mating** section on About (below toggle, description, distance):

- Title: **Interest in [Pet Name]** — factual, pet-scoped (no “Interested,” “Likes you,” or “Someone Pawed [Pet Name]!”)  
- List same exploration row pattern (pet identity preview) → tap opens interested pet profile for understanding  
- Empty: `No interest yet` — quiet, no CTA spam  
- **No** badge counts, red dots, match-adjacent celebration, or “new interest” urgency patterns  

**Forbidden:** Combining exploration and inbound interest as equal sections on the **For [Pet Name]** discovery screen; dual-tab browse/inbox layouts; inbox-style navigation peer to exploration; any UX reducible to *see pet → Paw → get match*.

### 9.5 Deep navigation

- Candidate row → `PetProfileScreen` (existing stack)  
- Back returns to discovery list  
- Paw state syncs across list and profile  

---

## 10. Explicit rejections (PAW-18 / PAW-2)

Do **not** implement in Beta discovery UX:

- Tinder / Hinge / Bumble swipe mechanics  
- “Match” as primary noun or screen centre  
- Gamification (streaks, badges, levels, leaderboards)  
- Compatibility scores or AI matching UI  
- Dismiss / pass / hide candidate forever  
- Fabricated candidates or implied hidden supply  
- Match counts or “X likes you” engagement patterns  
- Chat or open DM **inside discovery** or without mutual Paw  
- General-purpose DMs / open messaging (introduction chat after mutual Paw is authorized — §7.7)  
- Harsh reject / decline / pass UI for incoming Paws (use calm no-response)  
- Hidden / non-transparent Paw (receiver must see who Pawed)  
- AI message scanning / automated chat moderation  
- Human names on discovery rows  
- Double paw emojis or loud emoji decoration  
- Paw on list rows (Beta)  
- Interested / inbox section on discovery screen  
- Browse/inbox dual layout on discovery screen  
- User-facing “supply,” “eligible pets,” “candidate pool,” or catalogue language  
- Mating description on exploration list rows  
- Hero-adjacent Paw (quick-like placement)  
- Browse → Paw → browse as optimised primary loop  
- “It’s a Match!” / fireworks / match-economy celebration  

---

## 10b. Why this is genuinely Pawple-native (Founder requirement)

This experience cannot live inside Tinder/Hinge or as a generic pet-matching app because:

1. **Pet protagonist** — every flow orients around one named pet’s mating journey, not a human dater or anonymous pet pool.  
2. **Archive-backed evaluation** — suitability is judged through Moments, journal, traits, and breeding intent — not a photo card.  
3. **Thoughtful sequence** — orient → explore → understand → evaluate → express interest; not volume-maximising browse.  
4. **Invite-only trust** — private ecosystem context, not open marketplace discovery.  
5. **No match economy** — no matches, likes-you gamification, or engagement-maximising loops.  
6. **Responsible intent** — mating description and calm scarcity replace transactional marketplace framing.

---

## 11. Technical architecture notes (for E3–E5 — not implementation spec)

These are **constraints** for engineering; schema and API design are E3/E4 deliverables.

1. **Opt-in flag:** Migrate from `is_looking_for_companion` to mating-specific column or rename with migration — single canonical opt-in.  
2. **Mating description:** Persist on `pets` (or approved normalized field) — max length aligned with §5.2.B.  
3. **Radius preference:** User/profile-level field; used by eligibility query only — not meetup radius.  
4. **Interest records:** Separate table — viewer pet, candidate pet, timestamps; unique constraint per pair direction; RLS owner-scoped; **transparent** to the requested pet’s owner.  
5. **Eligibility query:** Server-side (E4) — breed, sex, opt-in, radius; no client-side-only filtering for security.  
6. **Paw does not hide:** No “dismissed” or “hidden_candidates” table in Beta.  
7. **Mutual Paw detection:** Server-authoritative when both directions exist; unlocks introduction chat only then.  
8. **Introduction chat:** Consent-gated channel tied to the mutual pet pair; revoke/freeze if mutual Paw breaks; report/block wiring; no AI scanning in Phase 1.  
9. **Location:** Use contract location rules — approximate, honest distance; no fabrication.  
10. **Active pet:** All discovery queries keyed to active pet id + owner auth.  
11. **Feed visibility:** Companion flag remains display-only; must not gate mating visibility (CURRENT (G)).  
12. **Age:** Mating remains **18+** account holders only (Phase 1 India).

---

## 12. Acceptance criteria (gates E5)

Design/UX + Engineering can mark discovery complete when:

- [ ] Mental model: *exploring opportunities for [Pet Name]* — no catalogue, marketplace, or match-centre language  
- [ ] Mating intent: opt-in, About mating, radius on About/Edit — owner-only mutations; no user-facing “supply” copy  
- [ ] Discovery: orientation panel + To explore list + profile evaluation — no swipe stack  
- [ ] Eligibility matches contract only — no extra filters in UI  
- [ ] Paw on profile only, below evaluation context — distinct from moment heart; no list-row Paw; no permanent hide  
- [ ] Receiver sees **Interest in [Pet Name]** on About tab only — transparent who Pawed; full profile openable before deciding  
- [ ] Reciprocal: Paw back **or** calm no-response — no harsh reject UI  
- [ ] Mutual Paw unlocks **introduction chat only** — not open DMs; disclaimer at open; report/block available  
- [ ] Legal copy reflects scoped introduction chat (Terms / Privacy / Guidelines)  
- [ ] Discovery screen: orient + explore + scarcity only — no inbound interest or dual-tab layout  
- [ ] Zero opportunities → honest exploration empty state — not supply-building or empty deck  
- [ ] Not opted in → supply prompt — not fake candidates  
- [ ] No new bottom tab; progressive disclosure entry points only  
- [ ] No fabricated distance or candidates in production  
- [ ] Legacy “companion” user strings removed from mating surfaces  
- [ ] “Open to Companionship” string unchanged where it appears as Founder-locked copy  

---

## 13. Out of scope (this Mating wave)

Deferred or frozen unless Founder expands CURRENT.md:

- General open DMs / non-mating chat  
- Push notifications for new interest or chat  
- AI message scanning / automated moderation  
- Advanced matching criteria beyond breed / sex / user-selected distance  
- Multi-pet simultaneous discovery UI  
- Breeder verification, health document upload, or marketplace mechanics  
- Harsh reject / pass UI for incoming Paws  
- Swipe decks, match economy, compatibility scores  

---

## 14. Review & approval path

| Step | Owner | Action | Status |
|------|-------|--------|--------|
| 1 | CTO | Spec draft (PAW-18) | Done |
| 2 | CEO | Assessment — `PAWPLE_MATING_DISCOVERY_CEO_ASSESSMENT.md` | Done |
| 3 | CTO | Rev 2 amendments merged | Done |
| 4 | CEO | Founder principles reassessment — rev 3 proposed | Done |
| 5 | Founder | Sign-off **with amendments** (transparent Paw, reciprocal consent, introduction chat) | **Done — 30 Aug 2026** |
| 6 | CEO | Rev 4 amendments recorded in this document | **Done** |
| 7 | QA | Pre-implementation security/privacy/safety recommendations | Ticketed |
| 8 | CTO | Architecture: reciprocal-Paw state, consent-gated chat, report/block | Ticketed |
| 9 | Frontend | Legal copy update for introduction chat | Ticketed |
| 10 | Eng | E3/E4/E5 + chat after gates 7–8 | Blocked on CTO + QA pre-recs |
| 11 | QA | Wave SIGN-OFF / VETO | Final gate |

**On Founder approval (recorded):** Unlock sequenced Mating wave per CURRENT.md. **No commits until Founder decides.**

---

## 16. Review history

### Rev 4 (30 Aug 2026) — Founder Mating System authorization

Source: PAW-7 comment `00d919c3`. Supersedes mating freeze. Core flow: calm discovery → transparent Paw → full-profile evaluation by receiver → Paw back or calm silence → mutual Paw unlocks introduction chat (scoped, not open DMs) + Phase-1 safety disclaimer + report/block. Legal must stay honest. “Open to Companionship” unchanged.

### CTO Founder review report (28 Aug 2026)

Posted on PAW-18 — end-to-end experience, mental model, dating-app drift watchpoints.

### CEO assessment

See `docs/PAWPLE_MATING_DISCOVERY_CEO_ASSESSMENT.md`. Directionally approved with three amendments — incorporated in **rev 2**:

1. **Profile-only Paw** (no list-row Paw in Beta)  
2. **Interested on About tab only** (not on discovery screen)  
3. **Discovery screen:** eligible list + scarcity only — no browse/inbox dual layout  

### Rev 3 end-to-end experience

1. **Mating intent:** About → **Mating** — opt-in, About mating, Distance, **For [Pet Name]** link, **Interest in [Pet Name]** subsection.  
2. **Discovery:** **For [Pet Name]** — orientation panel (active pet) + **To explore** list or scarcity only.  
3. **Understanding:** Exploration row → full pet profile (Moments, traits, About mating).  
4. **Interest:** Paw below evaluation context on profile — sage paw, not purple heart.  
5. **Receiver:** Incoming interest in About **Interest in [Pet Name]** — not on discovery screen.

### Rev 4 end-to-end experience (additive)

6. **Transparent evaluation:** Receiver opens requesting pet’s full profile before deciding.  
7. **Reciprocal:** Paw back (mutual) or calm no-response.  
8. **Introduction chat:** Unlocks only after mutual Paw; disclaimer + report/block; not open DMs.  
9. **Legal:** Terms / Privacy / Guidelines updated for scoped introduction chat.

### Key surfaces (rev 4)

| Surface | Role |
|---------|------|
| Pet About → Mating | Mating intent + Interest in [Pet Name] (receiver) |
| For [Pet Name] | Orient (active pet) + To explore or scarcity |
| Foreign pet profile | Understanding + Paw (post-evaluation placement) |
| Introduction chat | Mutual-Paw-only channel between pet parents |
| Edit Pet | Mating intent parity |

---

## 15. Related documents

- `docs/CURRENT.md` — Mating wave Founder authorization  
- `docs/PAW2_MATING_PRODUCT_PRINCIPLE.md`  
- `docs/PAWPLE_BETA_ARCHITECTURE_PRODUCT_CONTRACT.md` § Pet mating/matching  
- `docs/PAWPLE_BETA_MVP_EXECUTION_PLAN.md` — Workstream E  
- `docs/PAWPLE_MATING_DISCOVERY_CEO_ASSESSMENT.md` — CEO review (28 Aug 2026)  
- `docs/PAWPLE_MATING_DISCOVERY_FOUNDER_REASSESSMENT.md` — Founder principles reassessment (28 Aug 2026)  
- `docs/PAWPLE_MVP_PHASE1_DELEGATION.md` — Phase 1 delegation chain  
- `docs/PAW13_MATING_DISCOVERY_MENTAL_MODEL_SPEC.md` — **superseded**; canonical spec is this document only  
