# PAW-205 — Mating/Chat Phase 1a Copy Deliverable

**Owner:** Copywriter  
**Parent:** PAW-195  
**Authority:** Founder `f67e783b`, `docs/CURRENT.md`, `docs/PAW195_MATING_CHAT_REPAIR_WAVE.md`, Founder §7 (`docs/PAWPLE_MATING_DISCOVERY_SPEC.md` §7.7)  
**Status:** Final — ready for Legal review + Frontend wiring  
**Date:** 2026-09-06

Copy-only. Does not authorize product, legal, security, or engineering changes.

---

## Scope

| # | Deliverable | Export constant(s) |
|---|-------------|-------------------|
| 1 | Chat-open safety message | `MATING_CHAT_DISCLAIMER_TITLE`, `MATING_CHAT_DISCLAIMER` |
| 2 | Companionship-OFF confirmation | `MATING_COMPANIONSHIP_OFF_CONFIRM_*` |
| 3 | Discover/Match tab label | `MATING_DISCOVER_TAB_LABEL` |
| 4 | Chat tab + header pattern | `MATING_CHAT_TAB_LABEL`, `formatMatingChatHeaderTitle()` |
| 5 | Honest discovery empty states | `MATING_DISCOVER_EMPTY_*` |
| 6 | Canonical source | `src/content/legalDocuments.js` — `mating.js` re-exports |

**Preserved:** “Open to Companionship” toggle label. No Profile layout or section-title redesign.

**Wave locks reflected in copy:** fixed **100 km** radius; no 18+ banner in mating/chat UI; no dating/stranger-danger tone; honest approximate `~km`; stale location ≠ “no matches.”

---

## 1 — Chat-open safety message

Shown once per introduction channel (modal). Founder §7.7: guidance + report/block; no AI scanning; calm compressed language.

| Element | Copy |
|---------|------|
| Title | **Before you continue** |
| Body | Keep it pet-first and respectful. Sharing phone, address, or where to meet is your choice — public, pet-friendly places work well. Pawple isn't part of what you share or arrange here. Report or block if something feels off. |
| Primary CTA | **Continue** |

**Prohibited on this modal:** 18+ banner; “mutual Paw” legalese; dating/match fireworks; stranger-danger framing; long Terms paragraphs.

---

## 2 — Companionship-OFF confirmation

Shown before turning **Open to Companionship** off. Matches backend retention truth (`mating_on_pet_opt_out`): outbound Paws removed; open channels frozen (`opt_out`); inbound Paws retained server-side for report evidence (not shown); other pets' chats untouched.

| Element | Copy |
|---------|------|
| Title | **Taking a little pause?** |
| Body | **[Pet Name]** won't appear in Discover/Match, and any chats for this pet will close. Your other pets stay the same. You can turn this back on anytime. |
| Confirm (destructive) | **Turn off** |
| Cancel | **Keep on** |

**Do not say:** “permanently deleted,” “all data erased,” or “all your chats.” **Do say:** close (user-visible); other pets unchanged; reversible.

---

## 3 — Discover/Match tab label

| Context | Copy | Notes |
|---------|------|-------|
| Tab bar label | **Discover/Match** | Founder default; concise |
| `tabBarAccessibilityLabel` | **Discover and match** | Screen readers |

---

## 4 — Chat tab + header

| Context | Copy | Notes |
|---------|------|-------|
| Tab bar label | **Chat** | |
| `tabBarAccessibilityLabel` | **Chat** | |
| Header (distance known) | **`{petA} ↔ {petB} · ~{n} km`** | Example: `Tyson ↔ Luna · ~12 km`. Honest approximate only. |
| Header (distance unknown) | **`{petA} ↔ {petB}`** | Omit distance segment — never fabricate |

**Prohibited:** human parent names in header; exact GPS; “Introduction · …” as the primary nav title when Chat tab is active.

Helper: `formatMatingChatHeaderTitle({ petAName, petBName, distanceKm })` in `legalDocuments.js`.

---

## 5 — Discovery empty states

Frontend must distinguish **stale/missing location** (RPC returns `[]` when `profile_location_is_fresh` is false) from **genuinely zero eligible candidates** within 100 km.

### 5a — Not opted in (unchanged)

| Element | Copy |
|---------|------|
| Title | **For [Pet Name]** |
| Body | Open to Companionship to discover suitable opportunities nearby. |
| CTA | **Back to About** |

### 5b — Stale or missing location

| Element | Copy |
|---------|------|
| Title | **Can't explore yet** |
| Body | Open Pawple once so we can look nearby. |

No custom location primer sheet (Design Constitution). OS prompt only at moment of need elsewhere.

### 5c — Fresh location, zero eligible candidates

| Element | Copy |
|---------|------|
| Title | **Nothing to explore yet** |
| Body | No suitable opportunities for **[Pet Name]** within 100 km yet. |

**Prohibited:** “finding matches,” supply-building promises, broken-heart illustrations, variable radius in user-facing copy (Phase 1a is fixed 100 km).

---

## 6 — Opt-in disclaimer (dormant until Frontend wires toggle)

For when **Open to Companionship** is turned **on** (not shown in Phase 1a production UX today).

| Element | Copy |
|---------|------|
| Title | **Open to Companionship** |
| Body | Your pet may appear to other opted-in pets nearby. Mutual Paw unlocks a one-to-one introduction chat. You can turn this off anytime. |

No 18+ line in UI (server enforces; under-18 cannot enable).

---

## 7 — Reconciliation note

**Before:** `MATING_CHAT_DISCLAIMER` lived in both `src/services/mating.js` and `src/content/legalDocuments.js` with different text.

**After:** `src/content/legalDocuments.js` is the single canonical export (Legal-owned). `src/services/mating.js` re-exports for existing import paths. Frontend should import mating copy from `legalDocuments.js` when convenient.

---

## Legal coordination

Copywriter requests Legal (PAW-196) confirm:

1. Companionship-OFF body (“chats will close”) matches retention/export posture.
2. Chat-open body is sufficient for Phase 1a without a separate 18+ instrument in the modal.
3. Dormant `DORMANT_MATING_*` sections remain unattached until Founder re-exposes surfaces.

---

## Frontend wiring checklist (PAW-198 — not Copywriter)

- [ ] Import constants from `legalDocuments.js`
- [ ] Wire companionship-OFF confirmation before toggle off
- [ ] Use `formatMatingChatHeaderTitle` on chat screen + list
- [ ] Branch discovery empty: stale location vs zero candidates
- [ ] Tab labels when conditional nav ships behind hide gate
