# PAW-195 — Mating Match + Chat repair wave (CEO brief)

**Authority:** Founder comment `f67e783b` on PAW-195 (2026-09-06)  
**Recorded in:** `docs/CURRENT.md`  
**CEO:** Dispatch only. No product implementation by CEO.

## Visibility

| Audience | State |
|----------|--------|
| Normal production users | Hidden. `EXPOSE_MATING_SURFACES = false`. |
| Tester / QA | Controlled non-production path (CTO designs; not committed true on main). |

## Founder locks (do not reopen)

- Recover / repair. Do not rebuild existing mating/chat.
- Phase 1a radius: **fixed 100 km**. Keep 5/10/25/50 code dormant for later.
- Coarse/approximate location. Honest ~km. No GPS expose. No location redesign.
- Criteria: breed, gender, 100 km only.
- Companionship OFF → that pet unmatched; its chats **removed from the product** (not listed, not continuable). Phase 1a retention is **freeze-and-hide**, not a physical wipe. History may remain for report evidence and rematch reopen. Do not claim Pawple never saves chats. Physical delete-from-database is a **Founder** decision — not in this wave.
- Chat: pet-pair only; dedicated list page; no human names; text only; keep link/report/block; poll OK.
- Discover/Match ≠ Chat. Mutual Paw leaves discovery.
- Conditional bottom nav. Reuse existing paw for Discover/Match. `mew` bubble for Chat. Pet photo on far-right tab.
- No 18+ banner. Under-18 cannot enable companionship.
- No production expose.

## Sequence

1. **CTO** — Change Impact Map + controlled test path + backend architecture. **No product UI code until this lands.**
2. **Legal + Copy + Designer** — parallel (disclaimer, Terms, nav/chat visual).
3. **Backend** then **Frontend** — repair/complete behind the hide gate.
4. **Tester** then **QA**.
5. CEO synthesizes A–Q and recommends ready / not ready for controlled Beta.

## Founder-pre-authorized cross-module files

These are required by the directive. Do not treat as unauthorized drift:

- `src/navigation/BottomTabNavigator.js` (and `MainTabs.js` re-export)
- `App.js` only if a new stack screen must be registered **behind the hide/controlled gate**

Any **other** working file (Feed, Create Moment/Meetup, invite, bulletin meetup RSVP, onboarding, etc.) → **STOP** and return to Founder per §17.

**2026-09-06 §17 pack:** Tester Metro cannot bundle because uncommitted work in `src/screens/OnboardingPetsScreen.js` is missing a JSX `</>` (L991–1134). HEAD compiles. CEO did not edit or revert that protected file. Founder question is on PAW-195.

## Protected working files (default: do not touch)

Invite freeze files, Feed cards, meetup RSVP, onboarding, delete-account, honesty RLS unrelated to mating.

## Starting inventory (CEO pointer — CTO must complete the official map)

| Likely change | Why | Protected? |
|---------------|-----|------------|
| `src/config/phase1aSurfaces.js` | Controlled path; production stays false | Mating gate |
| `src/services/mating.js` | 100 km client align; hide picker writes; chat list | Mating |
| `src/screens/MatingDiscoveryScreen.js` | Exclude matched; honest empty/distance | Mating |
| `src/screens/MatingIntroductionChatScreen.js` | Header Pet A ↔ Pet B · ~km; disclaimer | Mating (dedicated screen already exists) |
| New chat list screen | Founder §6.4 common Chat page | Isolated addition — preferred |
| `src/components/MatingSection.js` | Toggle restore behind gate; dormant radius UI | Mating |
| `src/screens/PetProfileScreen.js` | Toggle only; no layout restructure | Working profile — **minimal, necessary** |
| `src/screens/ViewPetProfileScreen.js` | Paw / intro already exist | Mating |
| `src/navigation/BottomTabNavigator.js` | Conditional Discover/Match + Chat | Working nav — **Founder-required** |
| Mating SQL / RPCs | Exclude matched; opt-off chat removal; GRANTs; 100 km | Mating |
| `src/content/legalDocuments.js` | Re-attach only when Legal says; still not live for Phase 1a users | Legal |

Official map is the CTO deliverable, not this table.

**Landed:** `docs/PAW203_MATING_CHAT_CHANGE_IMPACT_MAP.md` (PAW-203). Backend (PAW-207) and Frontend (PAW-208) implement only that map. Production `EXPOSE_MATING_SURFACES` stays false. Controlled path is `areMatingSurfacesVisible()` + `EXPO_PUBLIC_MATING_TEST_SURFACES` (never committed true; production env fail-closed).
