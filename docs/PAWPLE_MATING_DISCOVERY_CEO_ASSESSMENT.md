# CEO Assessment — Mating Discovery Spec (PAW-18)

**Reviewer:** CEO / Executive Leadership  
**Date:** 28 Aug 2026  
**Subject:** `docs/PAWPLE_MATING_DISCOVERY_SPEC.md` (PAW-18)  
**Founder principle:** `docs/PAW2_MATING_PRODUCT_PRINCIPLE.md`  
**PAW-2 decision:** Option B+ (supply-first, pet-centric, in Beta)

**Authorization status:** E3 / E4 / E5 **not authorized** pending Founder review of this assessment.

---

## 1. Executive verdict

**The spec is directionally correct and substantially Pawple-native.** It is not a dating-app pattern document dressed in pet branding. The mental model, language system, eligibility rules, supply-first posture, and explicit rejection list align with the Founder principle and Product Contract.

**However, I do not recommend authorizing E3/E4/E5 engineering yet.** Three presentation choices sit close enough to conventional matching-product patterns that they need Founder sign-off or spec tightening before implementation begins.

**CEO recommendation:** **Approve the mental model and supply-layer direction with amendments** (§5). Hold discovery UI (E5) until amendments are incorporated. E3/E4 may proceed only after Founder confirms the amended spec — not before.

---

## 2. What the spec gets right

### 2.1 Mental model — PASS

- Centres **“Mating discovery for [Pet Name]”** — pet as subject, human as facilitator.
- Rejects match/swipe/dismiss as product centre.
- Evaluation question is suitability for the pet, not “swipe right.”
- Option B+ arc (intent → waiting → evaluation → interest) matches PAW-2.

### 2.2 Interaction patterns — PASS (with one caveat in §4)

- Required: scrollable list → full pet profile evaluation.
- Forbidden: swipe stacks, card decks, pass/dismiss, compatibility scores, match celebrations.
- Paw semantics correct: interest only, no permanent hide, distinct from moment heart (sage vs purple).
- No new bottom tab; progressive disclosure from pet profile — consistent with pet-first architecture.

### 2.3 Contract alignment — PASS

- Eligibility limited to breed, sex, opt-in, radius.
- Traits descriptive only.
- Honest distance; no fabrication.
- Post-interest chat/consent correctly deferred.

### 2.4 Supply-first — PASS

- Supply layer complete without candidates.
- Honest scarcity copy — not “0 matches” dating empty state.
- Opt-in not forced in onboarding.

### 2.5 Language — PASS

- Migration from legacy “companion” to “Open to mating” / “Mating discovery.”
- Rejects match/like/superlike vocabulary.

---

## 3. Dating-app adjacency risks (Founder review required)

These are not violations, but they are the areas where implementation could drift toward Hinge/Bumble unless constrained now.

### Risk A — “Interested” section (MODERATE)

**Spec §9.4:** Incoming Paws surface in an **Interested** list — potentially on the same screen as **Nearby** candidates.

**Concern:** Structurally resembles “likes you” / inbound interest inboxes in dating apps. The spec correctly prohibits counts and celebration, but the **two-column mental model** (browse candidates + check who liked you) is a familiar dating loop.

**CEO position:** Acceptable only if:
1. **Interested** is secondary — on About tab or below the fold, not peer navigation to Nearby.
2. No badge counts, red dots, or “new interest” urgency patterns.
3. Copy stays factual (“Interested”) not emotional (“Someone Pawed [Pet Name]!”).

**Recommended amendment:** Move **Interested** to owner About tab subsection only. Do not combine Nearby + Interested as equal sections on one discovery screen.

### Risk B — Optional Paw on list row (MODERATE)

**Spec §7.4:** Paw may appear on list row as well as profile.

**Concern:** Row-level Paw enables quick-tap interest without profile evaluation — the same shallow interaction dating apps optimize for.

**CEO position:** **Remove optional row Paw for Beta.** Paw should live **only on full pet profile** after evaluation. List row tap → profile → Paw. This is a product decision within CEO authority; recommend spec amendment before E5.

### Risk C — List row truncation of mating description (LOW)

**Spec §6.2:** Mating description truncated on list row.

**Concern:** Could encourage superficial scanning like card subtitles. Mitigated by profile-first path.

**CEO position:** Acceptable if Paw is profile-only (Risk B fix). Keep truncation to one line max; no “read more” engagement hook on row.

### Risk D — Nearest-first ordering (LOW)

**Concern:** Proximity sorting can feel like “nearby singles.”

**CEO position:** Acceptable for responsible mating logistics. Not a dating pattern in this context. No change required.

---

## 4. Process & document hygiene

### Duplicate specs

Two near-identical E2 documents exist:
- `docs/PAWPLE_MATING_DISCOVERY_SPEC.md` (PAW-18 — CTO)
- `docs/PAW13_MATING_DISCOVERY_MENTAL_MODEL_SPEC.md` (PAW-13 — CEO draft)

**Action:** Consolidate to **one canonical spec** (`PAWPLE_MATING_DISCOVERY_SPEC.md`) before engineering. PAW-13 should reference or close against PAW-18.

### Approval path in spec §14

The spec says Founder confirmation only if CEO escalates identity conflict. Founder has **explicitly requested review** of the complete experience. This assessment fulfils that request; Founder sign-off is required before E3+ regardless.

---

## 5. Recommended amendments (before E3/E4/E5)

| # | Amendment | Owner |
|---|-----------|-------|
| 1 | **Paw only on pet profile** — remove list-row Paw for Beta | Spec update (CTO/CEO) |
| 2 | **Interested** lives on About tab only — not equal section on discovery screen | Spec update |
| 3 | Consolidate PAW-13 and PAW-18 into single canonical doc | CTO |
| 4 | Add wireframe-level note: discovery screen shows **only** Nearby/eligible list + scarcity — no dual-tab “browse/inbox” | Design/UX or CTO |

---

## 6. Authorization recommendation

| Workstream | Authorize now? | Rationale |
|------------|----------------|-----------|
| **E3** Schema (opt-in, mating description, interest records) | **No** — after Founder confirms amended spec | Schema encodes product semantics |
| **E3b** Supply layer UI | **No** — after Founder confirms | Owner-facing mating controls |
| **E4** Eligibility query | **No** — after Founder confirms | Parallel with E3 once spec locked |
| **E5** Discovery list UI | **No** — hold until amendments + Founder sign-off | Highest dating-app drift risk |
| **E6** Scarcity/empty states | **No** — part of E5 bundle | |

**What Founder is being asked to confirm:**
1. Mental model and overall direction — **recommended YES**
2. Supply layer on pet About tab — **recommended YES**
3. List + profile evaluation (no swipe) — **recommended YES**
4. Amendments in §5 — **recommended YES**
5. Proceed to E3/E4 after amended spec merged — **recommended YES**
6. E5 after E3/E4 foundations — **recommended YES**

---

## 7. Why this is not Tinder for pets (CEO view)

If implemented per amended spec, Pawple mating would differ materially:

| Dimension | Dating app | Pawple (amended spec) |
|-----------|------------|------------------------|
| Entry | App-open / tab centre | Pet profile, deliberate opt-in |
| Evaluation | Card photo + swipe | Full pet profile, Moments, traits |
| Interest | Like/match/superlike | Paw on profile only |
| Inbound | “Likes you” gamification | Quiet Interested subsection on About |
| Empty state | Broken deck / boost prompts | Honest supply-building |
| Success metric | Matches | Responsible suitability |

The experience could not live inside Tinder/Hinge because it is **pet-scoped, archive-backed, invite-only, and evaluation-first** — not human-centred rapid matching.

---

## 8. Next steps

1. Founder reviews this assessment + `PAWPLE_MATING_DISCOVERY_SPEC.md`
2. CTO incorporates §5 amendments into spec revision
3. CEO records Founder approval on PAW-18
4. Then authorize E3/E3b/E4 in parallel; E5 after schema + eligibility exist
