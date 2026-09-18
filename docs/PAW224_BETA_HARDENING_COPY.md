# PAW-224 — Beta Hardening Copy Finals

**Owner:** Pawple Product & Brand Copywriter  
**Parent:** PAW-222 (Beta Hardening / Pre-APK)  
**Also covers:** PAW-231 (Founder §26 Frontend placeholders)  
**Authority:** Founder directive on PAW-222 §12 / §17 / §19–§21 / §26; `docs/CURRENT.md` voice + Design Constitution  
**Status:** Final — Frontend drop-in ready  
**Date:** 2026-09-07

This document is **copy only**. It does not authorize product, legal, or engineering changes. No Mating/Chat copy. Moderation UI strings are prep-only; model/API install remains Founder-gated.

---

## 0. Frontend drop-in placeholders (PAW-231)

Use these exact strings. Do not invent alternate marketing lines.

```js
// Invite share (WhatsApp / Email / system share)
const INVITE_EMAIL_SUBJECT = "You're invited to Pawple";
const INVITE_WELCOME = "Welcome to Pawple.";
const INVITE_INTRO =
  "A calm home for pets and the people who love them - including the ones who found their way to you.";
// Primary action — never send bare PAW-XXXX
const INVITE_URL = `https://pawple.com/invite/${code}`;
const INVITE_FALLBACK_PROMPT = "Don't have the app yet?";
const INVITE_LINK_ANDROID_LABEL = "Android"; // → https://pawple.com (mock)
const INVITE_LINK_IOS_LABEL = "iOS";         // → https://pawple.com (mock)

// Fallback page (app not installed)
const INVITE_FALLBACK_TITLE = "Get Pawple";
const INVITE_FALLBACK_BODY = "Open this invite in the app.";
const INVITE_FALLBACK_HELPER = "Store links coming soon."; // optional, one line max

// Invite sheet (if shown)
const INVITE_SHEET_TITLE = "Invite to Pawple";
const INVITE_SHEET_CODE_LABEL = "Your invite";
const INVITE_SHEET_EMPTY = "All invites sent.";

// Image moderation (prep only — Founder-gated install)
const IMAGE_REJECT_NON_PET = "That doesn't look like a pet.";
const IMAGE_REJECT_INAPPROPRIATE = "This photo can't be used.";
const IMAGE_REJECT_CTA = "Choose another photo";

// Notifications — title only; no morning-of / descriptive subtitle (impact map N2/N4/N5)
const SETTINGS_NOTIFICATIONS_TITLE = "Notifications";
const SETTINGS_NOTIFICATIONS_SUBTITLE = null; // Settings + AccountSheet: remove morning-of line
const NOTIFICATION_NUDGE_BODY = null;         // remove or unmount; no replacement paragraph
```

**Remove today (no replacement paragraph):** any user-visible “morning-of” description on Settings, AccountSheet, and NotificationNudge. Do **not** invent substitute helper text.

---

## 0.1 Consolidation vs CTO impact map (PAW-231 / CTO note)

Checked against `docs/PAW222_BETA_HARDENING_IMPACT_MAP.md` order-3 Copywriter ask + N*/I*/M* copy notes. **No duplicate rewrite of PAW-224.** Delta below only.

| Map ask | PAW-224 status | Delta |
|---------|----------------|-------|
| Invite intro (1–2 lines, inclusive of adopted pets) + code-bearing URL + Android/iOS → mock `pawple.com` | §0 / §1 finals | **None** — keep as written |
| Moderation calm reject lines (non-pet / inappropriate); no jargon | §0 / §2 finals | **None** — keep as written |
| Notification rows: **no** description / remove morning-of; no replacement paragraph | §3 had Settings-only | **Align** — same lock applies to **Settings + AccountSheet + NotificationNudge** (map N2/N4/N5). Still **no** replacement subtitle. |
| OnboardingFinal primer path | Product/Frontend (map N1) | **Not copy rewrite** — path removal; do not ship morning-of body if the screen remains reachable |

Canonical strings remain §0. Frontend: drop-in from §0; remove morning-of strings on the three surfaces above.

---

## 1. Invites

One coherent share experience: welcome → code-bearing link → install fallback. Do **not** send a bare `PAW-XXXX` as the invite.

### 1.1 Share message (WhatsApp / Email / system share)

Use `{CODE}` and `{INVITE_URL}` as placeholders. Mock URL pattern for now: `https://pawple.com/invite/{CODE}`.

| Element | Final copy |
|---------|------------|
| Email subject | **You're invited to Pawple** |
| Line 1 | **Welcome to Pawple.** |
| Line 2 | **A calm home for pets and the people who love them - including the ones who found their way to you.** |
| Line 3 (blank) | *(empty line)* |
| Line 4 | **{INVITE_URL}** |
| Line 5 (blank) | *(empty line)* |
| Line 6 | **Don't have the app yet?** |
| Line 7 | **Android · iOS** |

**Assembled example**

```
Welcome to Pawple.

A calm home for pets and the people who love them - including the ones who found their way to you.

https://pawple.com/invite/PAW-XXXX

Don't have the app yet?
Android · iOS
```

**Notes for Frontend**

- `{INVITE_URL}` is the primary action; the code lives inside the URL, not as a standalone code line.
- In the share body, **Android** and **iOS** should be clickable when the channel supports links.
  - Android → mock `https://pawple.com` (placeholder for Google Play)
  - iOS → mock `https://pawple.com` (placeholder for App Store)
- Do not label mock destinations as live store listings.
- Inclusive intent is carried by “including the ones who found their way to you” — natural, not a disclaimer. Do not add “adopted,” “rescued,” “breed,” or “home pets” wording.

### 1.2 Fallback page / web experience (app not installed)

When the invite link opens and Pawple is not installed:

| Element | Final copy |
|---------|------------|
| Title | **Get Pawple** |
| Body | **Open this invite in the app.** |
| Link labels | **Android** · **iOS** |
| Quiet helper (optional, one line max) | **Store links coming soon.** |

**Link targets (testing placeholders only)**

| Label | Destination |
|-------|-------------|
| Android | `https://pawple.com` |
| iOS | `https://pawple.com` |

Do not promise store availability, timelines, or “download now” if listings are not live.

### 1.3 In-app invite sheet labels (when InviteSheet is shown)

| Element | Final copy |
|---------|------------|
| Sheet title | **Invite to Pawple** |
| Code label (secondary; link remains primary in share) | **Your invite** |
| Empty / exhausted | **All invites sent.** |
| Share actions | **WhatsApp** · **Email** |

---

## 2. Image moderation (user-facing only)

Quiet rejections. Same voice for pet profile photos and Moments. **Never** expose AI, models, detection criteria, scores, or reason codes.

| Case | Final copy | Quiet CTA |
|------|------------|-----------|
| Non-pet / not a pet photo | **That doesn't look like a pet.** | **Choose another photo** |
| Inappropriate / explicit / sexual / obscene | **This photo can't be used.** | **Choose another photo** |

**Prohibited in UI**

- “AI,” “model,” “detected,” “flagged,” “NSFW,” “classifier,” “safety score”
- Reason codes, policy IDs, confidence percentages
- Long explanations or lecture tone

**Optional retry toast / alert title:** omit — body + CTA is enough.

---

## 3. Notifications (no morning-of description)

Per impact map §§4.2–4.3 (N2 / N4 / N5): remove morning-of **description** copy. No replacement paragraph.

| Surface | Final |
|---------|--------|
| Settings row title | **Notifications** |
| Settings row subtitle / description | **None.** Remove morning-of line if present. |
| AccountSheet Notifications subtitle | **None.** Remove `"Morning-of meetup reminders on this device"`. |
| NotificationNudge body | **None.** Remove morning-of body; prefer unmount / stop rendering over rewrite. |
| Structure | Keep existing Settings / AccountSheet structure. No redesign. No substitute helper. |

**Product path (not copy):** OnboardingFinal as required notification primer is Frontend (map N1). If that screen is still reachable, do not keep morning-of body as user-facing copy.

---

## 4. Legal coordination (recommendation — not authorization)

User-facing rejection strings above do **not** claim AI.

Current Phase 1a legal copy in `src/content/legalDocuments.js` states that this launch does **not** use AI moderation / AI message scanning, and that safety is report-driven with human review.

If Beta Hardening ships **automated** image checks, Legal should review Terms, Privacy, and Community Guidelines for honesty before those checks reach users. Copywriter does not authorize legal text changes.

---

## 5. Handoff

| Next owner | Action |
|------------|--------|
| Frontend | Drop §0 constants into invite share + moderation reject UI (when Founder-gated); remove morning-of description on Settings, AccountSheet, and NotificationNudge (map N2/N4/N5) |
| Legal | Review automated image-safety vs existing “no AI moderation” claims when engineering path is chosen (PAW-226) |
| Marketing Head | Voice check as needed; no further Copywriter gate unless Legal/Founder requests reword |

**Acceptance (Founder §26 / PAW-231 / impact-map consolidate):** Invite welcome + intro + inclusive adopted/rescued intent + code-bearing link + Android/iOS mock fallback wording; non-pet + inappropriate reject strings (no AI jargon); Notifications **Settings + AccountSheet + NotificationNudge** have **no** descriptive / morning-of subtitle or body. No product code in this ticket. Canonical file remains this doc — do not fork a second copy pack.
