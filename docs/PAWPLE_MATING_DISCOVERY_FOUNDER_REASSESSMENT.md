# CEO Reassessment — Founder Mating Principles vs Canonical Spec Rev 2

**Reviewer:** CEO / Executive Leadership  
**Date:** 28 Aug 2026  
**Founder source:** PAW-7 issue document `mating-founder-principles` (rev 1)  
**Compared against:** `docs/PAWPLE_MATING_DISCOVERY_SPEC.md` (rev 2)  
**Authorization:** E3 / E4 / E5 remain **unauthorized**

---

## 1. Executive verdict

Rev 2 is **directionally aligned** with the Founder principles on eligibility, anti-swipe posture, profile-first evaluation, and separation of Paw from feed heart. The CEO amendments (profile-only Paw, Interested on About only) were correct first steps.

**Rev 2 is not yet sufficient for Founder approval.** The remaining gaps are not swipe mechanics — they are **mental-model and presentation gaps** that could still let the product feel like a calm pet catalogue or a softened dating loop: browse nearby pets → Paw → check Interested.

**Recommendation:** Promote **rev 3** (proposed in `PAWPLE_MATING_DISCOVERY_SPEC.md`) for Founder review. Do not authorize engineering until rev 3 is explicitly approved.

---

## 2. Founder principles — compliance matrix

| Founder principle | Rev 2 status | Rev 3 action |
|-------------------|--------------|--------------|
| Mental model: *exploring opportunities **for my pet*** — not *nearby pets available* | **Partial** — pet named, but discovery framed as “Eligible nearby” list | Reframe discovery as **exploration for [Pet Name]**; add orientation hero; ban catalogue language |
| Pet remains protagonist; human is facilitator | **Pass** | Strengthen with explicit 5-step journey (§2.5) |
| Mating not matching; no match emotional model | **Pass** | Retain; add explicit anti-loop rejection |
| Supply-first is internal only — not user mental model | **Fail** — spec uses “supply layer” in user-facing sections; scarcity copy is supply-building | Rename user surfaces to **Mating intent**; scarcity framed as *no suitable opportunity yet* |
| Avoid dating-app mental model beyond swipes (rapid browse → like → match) | **Partial** — list + Paw + Interested still enables shallow loop | Remove row-level mating description; Paw only after profile evaluation context; soften Interested framing |
| Thoughtful journey: orient → discover → understand → evaluate → interest | **Partial** — profile path exists but discovery opens on browse list | Add mandatory **orientation** before opportunities; journey map in spec |
| Calm, premium, not marketplace / directory | **Partial** — list rows resemble directory entries | Rows become **explore** affordances only; suitability question in copy hierarchy |
| Reassess Paw + Interested specifically | **Partial** — placement improved in rev 2, semantics still dating-adjacent | Paw = post-evaluation interest signal; Interested = quiet context, not inbox |
| One canonical spec | **Pass** | Rev 3 consolidates; PAW-13 remains duplicate to close |

---

## 3. What must change (concise)

### A. User mental model & copy hierarchy

- **Remove user-facing “supply” language** — internal engineering term only.
- **Ban catalogue framing:** “Eligible nearby,” “candidates pool,” “available pets,” “nearby pets.”
- **Centre the active pet** on every mating surface before showing any other pet.
- **Persistent suitability question:** *Could this be a suitable mating opportunity for [Pet Name]?*

### B. Discovery presentation

- Add **orientation panel** at top of `For [Pet Name]` — active pet identity + mating intent summary.
- Rename list section to **Explore** or **To explore** — not “Nearby” / “Eligible.”
- **Remove mating description from list rows** — understanding happens on full profile only (reduces catalogue scanning).
- Keep scrollable list (not swipe) but list is **exploration queue**, not inventory.

### C. Paw interaction

- Paw remains **profile-only** (rev 2 correct).
- Reframe Paw as **genuine interest after evaluation** — not a like.
- Paw control lives **below** About mating / evaluation context on profile — not hero-adjacent quick action.
- Explicit rejection: **no browse → Paw → browse loop** as primary use pattern.

### D. Interested / inbound interest

- Keep on **About tab only** (rev 2 correct).
- Rename subsection to **Interest in [Pet Name]** — factual, pet-scoped, not “Interested” inbox tone.
- **No** list-row parity with discovery rows on same visual tier as opportunities.
- Empty state: quiet; no implication of pending matches.

### E. Scarcity & empty states

- Replace supply-building copy with suitability exploration copy.
- Example: *No suitable opportunities for [Pet Name] within [distance] yet.*

### F. Pawple-native differentiation

- Add explicit § explaining why this cannot live in Tinder/Hinge or generic pet-matching — pet-scoped journey, archive-backed evaluation, invite-only trust, no volume-maximisation.

---

## 4. What rev 2 got right (retain)

- Breed / sex / radius eligibility only.
- No swipe, dismiss, compatibility scores, match celebrations.
- No bottom tab; progressive disclosure from pet profile.
- Paw distinct from moment heart (sage, not purple).
- Honest distance; no fabrication.
- Post-interest chat/consent deferred.
- Interested not on discovery screen (CEO amendment).

---

## 5. Authorization

| Item | Status |
|------|--------|
| E3 schema | **Not authorized** |
| E4 eligibility | **Not authorized** |
| E5 discovery UI | **Not authorized** |
| Rev 3 Founder review | **Requested** |

---

## 6. Next step

Founder reviews **rev 3** of `PAWPLE_MATING_DISCOVERY_SPEC.md`. On explicit approval, CEO records sign-off on PAW-18 and authorizes E3/E4 in parallel; E5 after foundations.
