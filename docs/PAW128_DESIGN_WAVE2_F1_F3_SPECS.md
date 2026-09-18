# PAW-128 — Design Wave 2 F1 / F2 / F3 specs + feel-checklist

**Owner:** Product Designer (UI/UX)  
**Parent:** PAW-126  
**For:** Frontend (PAW-131) · QA (PAW-133) · Feel walk (PAW-132)  
**Copy source:** `docs/PAW127_DESIGN_WAVE2_F1_F3_COPY.md` (Copywriter, done)  
**Authority:** `docs/CURRENT.md` F1–F3 · CEO F2 placement lock  
**Status:** Binding for Wave 2 implementation. Not a VETO.  
**Date:** 2026-09-03

Do not implement from this file as product code in this ticket. Designer does not ship React Native. Frozen invite files stay untouched. Mating/chat stay hidden. No EAS.

Copywriter owns the words. Where this spec names a string, it is the PAW-127 lock (or a one-word label already in Pawple’s label language). Do not invent legal claims.

Product Strategist (PAW-129) had not posted a consult note when this spec landed. CEO lock stands.

---

## Placement decision (F2) — no VETO

Birthday lives **on the same About You step** as name + city (`OnboardingUserScreen`).

This passes the feel litmus **only if** composition stays collapsed (see Screen 1). A persistent iOS date spinner on this card would make it form-heavy. That is a **QA VETO condition**, not a reason to reopen a cold-open AgeGate.

**Concrete alternative if the combined card still fails in the emulator** (Designer VETO at feel-walk, PAW-132): a **short sibling step immediately after** About You — birthday only, same chrome, same Continue. Still not a wall. Do not put age at Welcome, Auth, or after the pet.

---

## 1. Flow spec

### Canonical first-time order (adult)

```
Welcome
  → Auth
  → Invite (FROZEN — do not restyle or rewrite)
  → About You   (name + city + birthday + quiet Continue)
  → Your pet
  → done (MainTabs)
```

Attestation is recorded on About You **Continue** when the birthday is 18+. It is mandatory before onboarding completes. It is never the first screen.

Legal T&C row stays where it already lives on Your pet. It is **not** an age primer and **not** a permission primer.

### Under-18 (terminal — not a step)

```
About You Continue (birthday < 18)
  → UnderAgeDecline   (full screen)
  → OK → sign out + Welcome
```

- Do not record an age-gate pass.
- Do not navigate to Your pet.
- No secondary CTA to continue.
- No retry control on the decline screen.
- Exit must not bounce them back into About You because a session still exists (`AppNavigator` would otherwise route signed-in users past Welcome). **OK signs out and resets to Welcome.**

Honest later return (different birthday) is allowed. This screen itself has no loop.

### Entry / resume

| State | Route | Must not |
|---|---|---|
| Signed out | Welcome | AgeGate wall |
| Signed in, no invite (prod) | InviteCodeScreen (frozen) | AgeGate |
| Signed in, invite, no profile | About You | AgeGate |
| Signed in, profile exists, **no** attestation, onboarding incomplete | **About You** (prefill name + city; birthday still empty) | Skip to Your pet; late AgeGate |
| Signed in, profile + attestation, onboarding incomplete | Your pet | AgeGate |
| Onboarding complete | MainTabs | AgeGate; location OS prompt if undetermined |

`OnboardingPetsScreen` must **stop** navigating to `AgeGate` on Complete. If attestation is somehow missing at save time, `replace` back to About You — never a wall, never a late compliance moment after the pet.

### AgeGateScreen — retire as a journey destination

The screen may remain in the repo for picker reuse. It must not remain a wall.

| Case | Spec |
|---|---|
| Onboarding | Do not register `AgeGate` as a user-facing stop. No `fromOnboarding` trip. |
| Cold open / “Before you sign in” | **Gone.** Welcome is the entry. |
| Returning users with attestation | Never shown. Silent `syncAgeAttestationToProfile` may continue (engineering). |
| Returning users, onboarding complete, attestation missing | Do **not** invent a wall. Out of this wave except: do not block the pet surfaces with AgeGate. Flag to CEO if a boot hole appears. |
| Under-18 | New `UnderAgeDecline` (or AgeGate rebuilt as that terminal only — no birthday picker, no Continue-as-attestation). |

Remove adult-path leftovers on any reused chrome: meetup footnote, “I’m 18 or older”, inline under-18 error, “Before you sign in”.

### Location (F3a) — first ask vs app open

**First ask** (permission `undetermined`): only after the Pawple primer, and only from an **explicit** city affordance on About You.

**`refreshProfileLocationOnAppOpen` (returning users):**

| OS status | App-open behaviour |
|---|---|
| granted | Silent coarse refresh. No primer. No OS dialog. |
| undetermined | **Do nothing.** Do not call `requestForegroundPermissionsAsync`. First ask is reserved for the primer path. |
| denied / blocked | Do nothing. Manual city remains the product. |

Do not add a parallel location product. Do not show a map, coordinates, or radius control on About You.

### Location decline / Not now

- Dismiss primer. No OS prompt.
- Focus the existing City field.
- Quiet hint under the field (only after decline / Not now): **You can type your city instead.**
- Continue onboarding still requires a typed city, as today.

### Camera / photos (F3c)

Same primer → OS → quiet decline pattern. First ask only.

| Permission state | Behaviour |
|---|---|
| granted / limited photos | Skip primer and OS; open camera or library. |
| undetermined | Primer sheet → Continue → OS prompt. |
| denied (can ask again) | After OS decline: quiet alert. Do not re-show the primer immediately. |
| blocked | Skip primer. Quiet alert with Open Settings. |

Photo source picker (`PhotoPickerModal`) stays **after** permission is resolved — it is not the primer.

### Notifications (F3b) — spec only

Do **not** ship primer UI this wave. Push is unauthorized. Strings live in PAW-127 for a later authorized wave. Existing beta “push isn’t part of beta” copy stays. Do not wire `AccountSheet` / `notifications.js` to a new primer in Wave 2.

### Hidden

InviteSheet, mating, intro chat, engagement metrics, notification primer UI, teen/parental UI.

---

## 2. Screen specs

Tokens from `src/config/theme.js` + `.cursor/rules/pawple-ui-composition.mdc`. No new palette.

Shared chrome:

| Token | Value |
|---|---|
| Screen bg | `theme.colors.background.screen` |
| Card bg | `theme.colors.background.card` |
| Title | Inter SemiBold · `theme.fontSizes.creationTitle` (30) · `theme.colors.text.primary` |
| Body | Inter Regular · `theme.fontSizes.md` (16) · `theme.colors.text.secondary` |
| Label | Inter Medium · `theme.fontSizes.sm` (14) · `theme.colors.text.secondary` |
| Meta / hint | Inter Regular · `theme.fontSizes.xs` (12) · `theme.colors.text.muted` |
| Input | minHeight **56** · radius `theme.borderRadius.lg` (16) · paddingV 14 / paddingH 16 · card bg |
| Primary CTA | minHeight **52** · radius `theme.borderRadius.full` · `theme.colors.brand.sage.value` · Inter SemiBold 16 · inverse text |
| Page padding | Top ≥ 32 below safe area (ideal 36–40) · Horizontal **24** (`theme.feed.shellPaddingHorizontal`) · Bottom ≥ 32 |
| Label → field | `theme.spacing.sm` (8) |
| Field group → group | `theme.spacing.xl` (24) |
| Identity cluster → age cluster | `theme.spacing.xxl` (32) |
| CTA offset | `theme.spacing.xxl` (32) |
| Motion | 180–260ms, ease-out |
| Font | Inter only on these screens (no Caveat / Kalam) |

Use `SafeAreaView`. Keyboard-aware scroll. `contentContainerStyle` flexGrow 1.

### Screen 1 — About You (`OnboardingUserScreen`)

**Eye hits first:** the quiet title, then the name field. Not a paw emoji, not a gate, not the birthday spinner.

**Pet-first litmus:** this step is human by nature. Keep it visually quiet so Welcome and Your pet remain the emotional centre. Age is a field, not a wall.

**Remove (current feel debt on this screen):**

- “Let’s Get Started! 🐾”
- “Tell us about yourself first.”
- Asterisk required markers
- CTA “Next: Add Your Pets”
- Helper paragraphs / meetup / Terms

**Hierarchy (top → bottom):**

1. Title — **About you** (one-line screen name; Copywriter may refine chrome, not the age line)
2. **Name** — placeholder example-driven (existing “John Doe” is fine)
3. **City** — placeholder **Mumbai**
4. Text action under City — **Use my city** · Inter Medium 14 · `theme.colors.brand.sageDark.value` · not a second primary button
5. Age cluster (after 32px):
   - Context line **Pawple is for adults.** · Inter Regular 16 · secondary · left-aligned with fields · not a page title
   - **Birthday** label
   - Collapsed date row (formatted date once chosen; placeholder color until then)
6. Primary **Continue**

**Birthday control (binding composition):**

- Collapsed by default on iOS **and** Android.
- Tap row → native picker. iOS spinner is **temporary**; **Done** collapses it.
- Do **not** default the date to “exactly 18 years ago.” Empty until the user picks. Defaulting to the eligibility edge feels like a trick.
- `maximumDate` = today. Eligibility on Continue, not while spinning.
- a11y: **Choose your birthday** · iOS **Done**

**Continue:**

- Requires name, city, and an explicit birthday.
- 18+ → persist profile + `recordAgeGatePass` / existing attestation sync → Your pet.
- Under 18 → `UnderAgeDecline`. No inline denied text on this screen.
- CTA label **Continue** — never “I’m 18 or older.” a11y label **Continue**.

**Empty / error:**

- Missing name/city/birthday: stay on screen; do not use a dense system alert if a quiet focus on the empty field will do. No red form chrome.
- Save failure: existing calm retry. No new helper paragraph.

**“Use my city”:**

1. If granted: fill City if a city name can be resolved. Never show lat/lng.
2. If undetermined: open **Location primer** sheet (Screen 3). Continue on the sheet → OS prompt. Then fill or fall back to typing.
3. If denied/blocked: no primer; show the quiet type-city hint.

Do not fire this on screen mount. Do not fire it from app open.

### Screen 2 — Under-age decline (new terminal)

**Eye hits first:** the title. Calm, centered, Welcome-like breath. Not a warning, not a legal wall.

| Element | Spec | Copy (PAW-127) |
|---|---|---|
| Title | Inter SemiBold 30, primary, centered | **Pawple is for adults.** |
| Body | Inter Regular 16, secondary, lineHeight ~1.45, horizontal 24, max ~3 sentences | PAW-127 body (meetups / parental consent on our road — **no “soon”**) |
| Title → body | `theme.spacing.lg` (16) |
| Body → CTA | `theme.spacing.xxl` (32) |
| CTA | Primary pill | **OK** |

No birthday picker. No Terms. No waitlist. No second button.

OK → sign out + reset to Welcome (see flow).

### Screen 3 — Permission primer sheet (shared pattern)

Used for location (this wave) and camera/photos (this wave). Notification uses the same geometry **later** — do not instantiate it now.

Not a full-screen wall. Not consent theatre. T&C never substitutes this.

| Chrome | Token |
|---|---|
| Backdrop | `theme.components.bottomSheet.backdrop` (`rgba(0,0,0,0.35)`) |
| Handle | width 40 · height 4 · radius 2 (`theme.components.bottomSheet`) |
| Sheet | card bg · top radius 22 (`theme.borderRadius.meetupCta` / pill-adjacent) · padding 20 |
| Title | Inter SemiBold 18 (`theme.fontSizes.lg`) · primary |
| Body | Inter Regular 16 · secondary · one short block |
| Title → body | 8 |
| Body → actions | 24 |
| Continue | Primary pill 52 |
| Not now | Text · Inter Medium 16 · muted · under Continue, 12px gap |
| Motion | 180–260ms ease-out |

**Location (ship):**

- Title **Your city**
- Body **Pawple uses your city for nearby meetups. Only your city — never your exact location.**
- Continue → native location prompt
- Not now → manual city (hint on)

**Camera (first ask):** Title **Camera** · Body **For pet photos and moments with your pet.**

**Photos (first ask):** Title **Photos** · Body **To choose a pet photo or moment from your library.**

Post-denial alerts (after OS, not instead of primer) — PAW-127 table. Align:

- `OnboardingPetsScreen.js`
- `CreateMomentScreen.js`
- `EditPetScreen.js`
- `src/lib/createMomentPermissions.js`
- `src/lib/photoPicker.js`
- `src/lib/permissions.js` (`requestCameraPermissionJIT` is a first-ask hole today)

Remove generic **Permission needed to access camera.**

### Screen 4 — Your pet (delta only)

No layout restyle in this wave (D2 already shipped).

Behaviour delta: Complete Setup must **not** push AgeGate. Photo/camera taps use the primer pattern above. Photo remains skippable.

### Notification primer (F3b — do not build)

Same sheet geometry as Screen 3. Copy from PAW-127 (**Gentle reminders** / **When Pawple has reminders…**). Ship when push is authorized. Wave 2 QA fails if this UI appears.

---

## 3. Feel-checklist for QA (PAW-133) and Designer walk (PAW-132)

Walk as a **first-time user**. Start at Welcome. Do not skip Invite in the mental model (prod). Mating/chat must never appear.

### Adult happy path

1. Welcome: pet-first line first. Continue.
2. Auth. Then Invite (frozen). Then About You — **not** AgeGate.
3. About You: name, city, collapsed birthday. One age sentence. Continue. No meetup, no Terms, no “I’m 18 or older.”
4. “Use my city” (optional): primer **before** OS. City-only promise visible. Decline → type city; onboarding continues.
5. Your pet: pet is the focus. Complete without a late age wall.
6. Land in the app. Kill and reopen: **no** location OS prompt if still undetermined.

### Under-18

7. About You with a <18 birthday → full-screen decline, not an inline error.
8. Body includes parental-consent-on-our-road. No “soon.” No Terms.
9. OK returns to Welcome **and stays there** (session cleared). Opening the app does not dump them on About You.

### Permissions

10. Location OS dialog never appears without the primer on first ask.
11. App open does not first-ask location.
12. Camera and Photos: primer before OS on Onboarding pet photo, Create Moment, Edit pet.
13. Deny/block: quiet alert; can continue without a photo.
14. **No** notification primer UI.

### Pet-first litmus (per screen)

| Screen | What must be felt first | Fail if |
|---|---|---|
| Welcome | The pet / one heart | Compliance, form, human bio |
| About You | A calm identity step | Gate, spinner, emoji header, “add pets” CTA |
| UnderAgeDecline | Quiet adult-only truth | Alarm, legal dump, retry |
| Location primer | City, not GPS | Map, exact location, T&C-as-consent |
| Your pet | The pet | Age wall after the pet |
| Moment camera | The memory | Sudden OS dialog |

### VETO conditions (feel — Designer; Founder override only)

Issue a VETO with the alternative below — do not silently pass.

| Fail | Alternative |
|---|---|
| Combined About You is dense (always-on iOS spinner, stacked helpers, two primary buttons) | Collapse picker first. If still dense on device: sibling birthday step **immediately after** About You. Never a Welcome/Auth wall. |
| AgeGate appears at start or after the pet | Remove the route. Attestation only on About You. |
| Adult path mentions meetups or Terms | Delete those strings (PAW-127). |
| Under-18 is an inline error on About You | Terminal decline screen. |
| Location OS prompt on app open when undetermined | Stop requesting; primer + “Use my city” only. |
| Primer is a T&C checkbox or consent theatre | Explanation sheet, then real OS prompt. |
| Notification primer ships | Remove it. Spec-only this wave. |
| Dating-app / engagement patterns | Founder escalation (pet-first channel). Not a spacing dispute. |

### Not this wave

F4 delete hardening (PAW-130). Founder feel-pass (CEO posts). EAS preview. Invite/mating/chat.

---

## Frontend implementation notes (UX contracts, not architecture)

- Prefill About You when resuming an incomplete profile that still lacks attestation.
- Do not touch `src/lib/onboardingInvite.js`, `InviteCodeScreen.js`, `InviteSheet.js`.
- Do not expose mating/chat (`EXPOSE_MATING_SURFACES=false`).
- Do not add theme colours. Map to existing tokens.
- Primer is explanation. OS prompt is the permission ask. T&C is neither.

---

*Product Designer (UI/UX) — PAW-128. Ready for PAW-131 implement. Feel-checklist is the QA gate input; feel GREEN is PAW-132 after implement.*
