# PAW-206 — Discover/Match + mew Chat + pet-tab visual

**Owner:** Product Designer (UI/UX)  
**Parent:** PAW-195  
**For:** Frontend (implement) · QA / Tester (feel + functional gate)  
**Copy source:** `docs/PAW205_MATING_CHAT_PHASE1A_COPY.md` (Copywriter, final)  
**Authority:** Founder `f67e783b` · `docs/CURRENT.md` · `docs/PAW195_MATING_CHAT_REPAIR_WAVE.md`  
**Status:** Binding visual-system spec. Repair only. No product-scope change.  
**Date:** 2026-09-06

Designer does not ship React Native. Frozen invite files stay untouched. Production hide stays (`EXPOSE_MATING_SURFACES = false` for ordinary users). Controlled Tester/QA path is CTO-owned. No EAS. No Profile restructure.

Copywriter owns the words. This spec owns flow, hierarchy, tokens, and feel. Where a string is named, it is a PAW-205 lock or a Founder-locked pattern.

---

## Pet-first litmus (apply to every surface)

> What does the user see and feel first? Does that express pet-first?

Pass: the active pet’s face, the other pet’s face, or the pair `Pet A ↔ Pet B`.  
Fail: a human inbox, a dating deck, a metric, a generic empty chat bubble, or the human parent as the emotional centre.

---

## 1. Flow spec

### Visibility (product lock — do not invent a fourth state)

These tabs exist only on the **controlled Tester/QA path**. Ordinary production users remain **State 1** forever.

| State | When | Tabs (left → right) |
|---|---|---|
| **1** | Companionship OFF for the active pet **and** this parent has no remaining pet-pair conversations | Feed · Create · **Pet** |
| **2** | Companionship ON for the active pet · no conversations yet | Feed · Create · **Discover/Match** · **Pet** |
| **2b** | Companionship OFF for the active pet · other pets still have conversations | Feed · Create · **Chat** · **Pet** |
| **3** | Companionship ON · at least one remaining conversation | Feed · Create · **Discover/Match** · **Chat** · **Pet** |

State **2b** is not a new product mechanic. It is the honest reading of Founder: that pet’s chats close; other pets’ chats stay; Discover/Match is eligibility for the **active** pet.

Under-18: cannot enable companionship. They never leave State 1 via this wave. No 18+ banner.

### Entry / exit

```
State 1
  → Open to Companionship ON (existing Profile toggle; no layout change)
      → State 2 · Discover/Match tab appears

State 2 · Discover/Match tab
  → MatingDiscoveryScreen (existing)
      → tap a candidate → ViewPetProfileScreen (existing Paw)
      → mutual Paw → leave discovery → conversation
          → State 3 · Chat tab appears
          → MatingIntroductionChatScreen (existing, header repaired)

State 3 · Chat tab
  → Chat list (new isolated screen — CEO preferred)
      → tap a row → MatingIntroductionChatScreen
      → back → Chat list (not discovery)

Companionship OFF for active pet
  → that pet leaves Discover/Match
  → that pet’s conversations leave the Chat list
  → other pets’ conversations remain
  → State 2b or State 1
```

### What is hidden

| Hidden | Why |
|---|---|
| Discover/Match + Chat tabs in production | Founder: no production expose |
| 5 / 10 / 25 / 50 radius picker | Phase 1a is fixed 100 km; code stays dormant |
| Exact GPS / street location | Coarse ~km only |
| Human parent names | Chat is pet-pair only |
| Media, stickers, voice, + button | Text only |
| Unread counts, red dots, online dots, typing, read receipts | Engagement bait |
| 18+ banner on mating/chat UI | Founder lock |
| InviteSheet / invite screens | Frozen |
| Mating entry from Feed, Create, meetup RSVP | Wave is Mating Match + Chat only |

### Empty / error / paused

| Surface | State | Feel |
|---|---|---|
| Discover/Match | Not opted in | Existing empty. Copy: PAW-205 §5a. No swipe prompt. |
| Discover/Match | Stale / missing location | PAW-205 §5b. No custom location primer. |
| Discover/Match | Fresh location, zero candidates | PAW-205 §5c. Honest 100 km. No “finding matches.” |
| Discover/Match | Load fail | Existing `LoadErrorRetry`. |
| Chat list | Last conversation just removed while focused | One quiet centred line. No illustration. No CTA into Discover (that is engagement). Tab may disappear on next blur. |
| Chat list | Load fail | Existing `LoadErrorRetry`. |
| Conversation | No messages yet | Keep existing empty: “A quiet place to introduce yourselves.” |
| Conversation | Frozen / paused | Existing sage-light banner: “Introduction is paused.” Composer disabled. |
| Conversation | Link in draft | Existing link hint. Do not add a scary banner. |
| Conversation | First open | Existing disclaimer modal. Copy: PAW-205 §1. This is **not** an 18+ banner. |

### Discover ≠ Chat (mental model)

Discover/Match is **potential** matches for the active pet.  
Chat is **already-introduced** pet-pairs for this parent.

Mutual Paw leaves discovery. Do not keep a matched pet in Discover. Do not open Chat from a Discover row. Do not put a Paw on the Chat list.

---

## 2. Screen specs

Tokens only. No new palette.

### 2.1 Bottom tab bar — all states

Reuse `src/navigation/BottomTabNavigator.js` chrome. Do not invent a second bar, a floating island, or a dating “dock.”

| Token | Value |
|---|---|
| Bar background | `theme.colors.background.screen` (`#F5F4F1`) |
| Height | existing `56 + max(insets.bottom, 0) + 8` |
| Top border | none |
| Item min height | 48 |
| Active tint | `theme.colors.brand.sage.light` (`#8FAF9B`) |
| Inactive tint | `theme.colors.tabBar.inactive` (`#8A94A6`) |
| Label | Inter Medium 11 · `letterSpacing` 0.1 · existing `tabBarLabelStyle` |
| Icon size | 24 (Create plus stays 28) |
| Motion | colour / opacity only, 180–260ms ease-out. No bounce. No badge pop. |

**Order is binding.** Pet is always far right. Feed and Create never move.

```
[ Feed ]  [ Create ]  [ Discover/Match? ]  [ Chat? ]  [ Pet photo ]
```

Five items will feel tighter than three. Absorb that in **item padding**, not in smaller type, not in dropped labels, not in a second row. If a label wraps, the implementation failed this spec.

#### Feed / Create

Unchanged icons and labels.

#### Discover/Match (new)

| Part | Spec |
|---|---|
| Icon | **Reuse the existing Pets-tab paw.** `Ionicons` `paw` / `paw-outline`, size 24, tinted with tab colours. Do not draw a new paw. Do not use a heart, flame, spark, or bone. |
| Visible label | **Discover** — one word, one line. |
| a11y | PAW-205: **Discover and match** |
| Why not “Discover/Match” on the bar | Copywriter locked the surface name. At Inter Medium 11 on a 4- or 5-item bar, the slash label wraps or truncates and reads as a control, not a place. Designer visual lock: one word. Never **Match** alone (dating-app). |

#### Chat / mew (new)

| Part | Spec |
|---|---|
| Icon | Soft rounded **speech bubble** with lowercase **mew** inside. Not an empty `chatbubble`. Not “meow.” Not “woof.” |
| Bubble geometry | ~24×20 pt. Corner radius 8. No iMessage tail. No WhatsApp notch. |
| Word | Inter Medium, ~9px, lowercase `mew`, letter-spacing 0. |
| Inactive | 1.5pt stroke `theme.colors.tabBar.inactive` · `mew` same colour · no fill |
| Active | Fill `theme.colors.brand.sage.light` · `mew` `theme.colors.text.inverse` |
| Visible label | PAW-205: **Chat** |
| a11y | **Chat** |
| Badges | **None.** No count. No red dot. No mute glyph. |

The word **mew** lives in the bubble. The tab label stays **Chat**. That pairing is the Pawple voice. Do not replace the label with mew, and do not ship an empty bubble with a Chat label.

#### Pet (far right — treatment change)

The paw **moves** to Discover/Match. The far-right tab is the **active pet**, using the existing circular profile treatment.

| Part | Spec |
|---|---|
| Photo | Circular crop of `activePet.photo_url`. Reuse `PetContextSelector` at **size 28**. |
| Fallback (no photo) | Soft circle, `theme.colors.brand.sageLight` fill, **first initial** in Inter Medium 11, `theme.colors.brand.sageDark`. **Do not use the paw fallback** from `PetContextSelector` — that paw is now Discover/Match. |
| Focused | 1.5pt ring in `theme.colors.brand.sage.light`. No glow. No heart. No status dot. |
| Label | Existing `formatPetTabLabel` (name, 12-character ellipsis, fallback `Pets`) |
| a11y | Existing `Pets tab` |

Do not put a human avatar on this tab. Do not put the paw here.

---

### 2.2 Chat list (new isolated screen)

Preferred addition. Do not bolt an inbox onto Profile, Feed, or Discover.

**What the eye hits first:** the other pet’s face in the first row.

| Part | Spec |
|---|---|
| Shell | `ScreenWrapper` · title **Chat** (PAW-205 tab word) · no back button (it is a tab) |
| Screen bg | `theme.colors.background.screen` |
| List padding | top 24 · horizontal 24 · bottom 32 · `flexGrow: 1` |
| Row gap | 12 |

#### Row

| Part | Spec |
|---|---|
| Surface | `theme.colors.background.card` · radius 18 · inner padding 16 · min height 72 |
| Pressed | `theme.opacity.pressedUi` (0.88) |
| Leading | Other pet photo, **circle 52**. Fallback: sageLight circle + initial. Not a squircle (Discover rows may stay as they are; this list is portraits). |
| Title | Other pet name · Inter SemiBold 18 · `theme.colors.text.primary` · 1 line |
| Pair line | `{myPetName} · {formatDistanceKm}` · Inter Regular 14 · `theme.colors.text.muted` · 1 line |
| Preview | Last message body · Inter Regular 16 · `theme.colors.text.secondary` · 1 line · no link decoration |
| Trailing | Nothing. No time column. No unread pill. No chevron required. |
| Distance missing | Omit the `· ~km` segment. Never fabricate. Use PAW-205 `formatMatingChatHeaderTitle` logic for the pair wherever a title is needed. |

The pair line is what stops this from becoming a human DM inbox. The user should always know **which of their pets** is in the conversation.

Sort: most recently active first. No “pinned.” No “requests” segment. No “matches” filter chips.

Empty (transient): one centred line, Inter Regular 16, muted, marginTop 48. Copywriter may lock the sentence; until then use the quietest honest line already in voice — do not add an illustration or a Discover CTA.

---

### 2.3 Conversation (repair existing `MatingIntroductionChatScreen`)

Do not rebuild the thread. Repair the header and keep the rest.

**What the eye hits first:** the pair title, then the other pet’s words.

| Part | Spec |
|---|---|
| Title | PAW-205: `{petA} ↔ {petB} · ~{n} km` or `{petA} ↔ {petB}` |
| Pet A | The viewer’s pet in this pair |
| Pet B | The other pet |
| Distance | `formatDistanceKm` only. Honest `~`. Omit if unknown. |
| Type | Inter Medium 14 if both names are long; otherwise existing header (Inter heading 18). One line. Ellipsis the names, never drop `↔`. |
| Prohibited title | `Introduction · {otherPet}` as the primary title once Chat is a tab |
| Left | Existing back |
| Right | Existing `⋯` safety (report / block pet). Keep. |
| Disclaimer | Existing modal. PAW-205 §1. Once per channel. |
| Frozen | Existing sage-light banner. Keep. |
| Empty thread | Existing centred line. Keep. |
| Bubbles | Existing: mine sage fill + inverse text; theirs card fill + primary text. Radius 18. Max width 82%. No tails. No avatars in the thread (the header already named the pets). |
| Composer | Existing card field, radius 18, minHeight 48. Placeholder **Message** / **Paused**. Send is the existing sage circle + arrow-up. |
| Hidden | + media, emoji tray chrome, voice, GIFs, reactions, seen ticks, “online,” human names |

Keyboard: keep existing avoiding behaviour. Composer must not sit on the gesture bar (min 24px above system UI).

---

### 2.4 Discover/Match screen (no visual rebuild)

`MatingDiscoveryScreen` stays. This ticket does not restyle it.

Binding for the tab entry only:

- Active pet remains the orientation hero (already pet-first). Keep it.
- List is “To explore,” not a swipe deck, not a catalogue Paw-strip.
- Distance uses `formatDistanceKm`. Fixed 100 km window. No picker UI.
- Empty states branch per PAW-205 §5.
- Mutual Paw exits this screen.

Do **not** restructure Profile. Companionship toggle stay where it is. OFF confirmation copy is PAW-205 §2 — a sheet, not a new Profile section.

---

### 2.5 Files Frontend may touch (Designer awareness — not a Change Impact Map)

Founder-pre-authorized:

- `src/navigation/BottomTabNavigator.js` (and `MainTabs.js` re-export)
- `App.js` only if the Chat list must be registered **behind the hide / controlled gate**

Isolated / mating:

- New Chat list screen (preferred)
- `src/screens/MatingIntroductionChatScreen.js` (header only + existing chrome)

Any other working file (Feed, Create Moment/Meetup, invite, bulletin RSVP, Profile layout) → **STOP**. Report to CEO for Founder §17 pack.

---

## 3. Feel-checklist for Frontend / QA

Walk as a **first-time Tester** on the controlled path. Ordinary production must still look like today’s three-tab app.

Designer experiential gate (emulator walk + this list green) is required before QA SIGN-OFF of the user-facing wave. This ticket is **spec only**. The walk happens after Frontend ships, on a later Designer assignment.

### First-time-user walk

1. Production / gate-off build: only Feed · Create · Pet. No paw-for-discover. No mew. No Chat.
2. Controlled path, companionship OFF, no chats: same three tabs. Pet tab is the **photo**, not the paw.
3. Turn companionship ON (existing toggle). Discover/Match appears. Paw is on that tab, not on Pet.
4. Discover opens on **my pet**, then “To explore.” No deck. No radius chips. Distance reads `~n km`.
5. Mutual Paw leaves Discover and opens the conversation. Header is `Pet A ↔ Pet B · ~n km`. No human name.
6. Chat tab appears with **mew** inside the bubble and label **Chat**. No badge.
7. Chat list: other pet’s face first; pair line names **my** pet; no timestamps-as-hero; no unread pills.
8. Switch to a pet with companionship OFF while another pet still has a chat: Discover disappears; Chat remains (State 2b).
9. Turn companionship OFF for the chatting pet (PAW-205 confirm). That conversation leaves. Other pets’ threads remain.
10. Under-18 path: cannot enable companionship; never sees Discover or Chat.

### Pet-first litmus per screen

| Screen | First thing felt | Fail if |
|---|---|---|
| Tab bar State 1 | My pet’s face on the right | Paw still sits on Pet; human silhouette |
| Tab bar State 2/3 | Paw = exploring for my pet | Heart / flame / “Match” / empty chat bubble |
| Discover | My pet, then others to explore | Swipe deck, grid of faces, “people nearby” |
| Chat list | The other pet | Inbox chrome, human names, unread economy |
| Conversation | The two pets, then their words | `Introduction ·` as a product title; parent names; media tray |

### VETO conditions (Designer feel — concrete alternative required)

A feel VETO must name the screen and the replacement. Feel VETOs are overridden only by the Founder.

| If this ships | VETO because | Change this instead |
|---|---|---|
| Empty chat-bubble icon | Founder locked **mew** in the bubble; empty bubble is generic DM | Bubble contains lowercase **mew** |
| New illustrated paw | Founder: reuse the existing paw | `Ionicons` `paw` / `paw-outline` from today’s Pet tab |
| Paw remains on the Pet tab after Discover exists | Paw now means Discover/Match; two paws confuse the bar | Pet tab = circular photo (or initial). Paw only on Discover |
| Visible tab label **Match** | Dating-app | Visible **Discover**; a11y “Discover and match” |
| Unread counts / red dots / online dots | Engagement bait | No badges. Poll may refresh content quietly |
| Human names in list or header | Breaks pet-pair | Pets only. Pair line `{myPet} · ~km` |
| Swipe / card deck on Discover | Forbidden mental model | Keep existing list + profile Paw |
| 18+ banner on Discover or Chat | Founder lock | Age stays server-side; under-18 never see the tabs |
| Radius chips 5/10/25/50 | Phase 1a is fixed 100 km | Keep picker code dormant |
| Profile hero / About / Journal restyle | Out of wave | Toggle + confirm sheet only |
| iMessage / WhatsApp tails, reaction bar, + media | Generic messenger | Existing sage/card bubbles, text only |
| “It’s a match!” overlay | Dating fireworks | Mutual Paw simply leaves Discover for the thread |

### Not a Designer VETO (belongs to QA / Legal / CTO)

- RLS / auth strength
- Controlled-path mechanism
- Disclaimer legal sufficiency
- Whether poll interval is 8s

---

## 4. What this spec does not do

- Does not flip `EXPOSE_MATING_SURFACES`
- Does not change matching criteria
- Does not redesign location
- Does not add push or Realtime
- Does not rewrite copy (PAW-205 stands, with the one-word Discover **visual** lock above)
- Does not implement

---

## Remaining for the wave (not this ticket)

- Frontend implements behind the hide / controlled gate
- Copywriter if they want to re-lock a one-word Discover tab label in PAW-205
- Designer emulator feel-walk after implementation (CEO assigns)
- Founder feel-pass
- QA SIGN-OFF requires this feel-checklist green
