# PAW-222 — Pawple Beta Hardening / Pre-APK Wave

**Authority:** Founder directive on PAW-222 (2026-09-07)  
**CEO kickoff:** 2026-09-07  
**Status:** Wave open — PAW-236 done; Tester Pixel 6a **device FAIL** (env: no debug binary). **PAW-244** Frontend debug install next. Moderation gated on Founder. **No Founder APK.**

## Scope (locked)

Camera · Gallery · Notifications · Image Safety · Invites

Separate from the Mating + Chat repair wave (PAW-195 closed for controlled Beta).

## Hard locks

| Lock | Rule |
|------|------|
| Working product | Frozen unless required by this directive |
| Logout / Delete Account | Untouched |
| Mating / Matching / Chat | Confirm intact only — **no changes** |
| Production hide | `EXPOSE_MATING_SURFACES = false` |
| Live Mating/Chat SQL | None |
| Other permissions | Do not touch Location / Mic / Contacts / Bluetooth / Calendar |
| Persistent app permission flags | Forbidden (`hasAskedCamera`, etc.) |
| Moderation installs | Founder approval required before new model/API/dep |
| APK build | **Not** part of this wave |

## Team sequence

1. **CTO (PAW-223)** — impact map + diagnoses + moderation recommendation (research only)
2. **Copywriter (PAW-224)** — invite / moderation / notification copy (parallel; no code)
3. **Legal (PAW-225)** — moderation privacy + invite/deep-link (parallel; no Mating reopen)
4. **Frontend / Backend** — only after CTO map; smallest isolated repairs
5. **Tester** — Pixel 6a Android emulator only
6. **QA** — independent regression + scope audit

Founder physical validation (fresh APK → Pixel 10 Pro) is **after** Tester + QA PASS and is outside this wave’s build responsibility.

## Child issues

| ID | Owner | Role | Status |
|----|-------|------|--------|
| PAW-223 | CTO | Impact map + camera/gallery/notifications/moderation/invite architecture | **done** → `docs/PAW222_BETA_HARDENING_IMPACT_MAP.md` |
| PAW-224 / 231 | Copywriter | Final copy strings | **done** |
| PAW-225 / 232 | Legal | Moderation privacy + invite/deep-link (+ cloud-gate advisory) | **done** (CONDITIONAL-GO) |
| PAW-226 | Legal | Image safety vs “no AI moderation” honesty | **done** |
| PAW-227 | Frontend | Camera / Gallery / Notifications / Invites (skip M*) | **done — QA VETO** |
| PAW-236 | Frontend | QA VETO remediation (camera contract + invite export + unit test) | **done** |
| PAW-244 | Frontend | Installable Pixel 6a **debug** binary (not Founder APK) | **todo / critical** |
| PAW-228 | Backend | Moderation Edge Function M1 | **blocked** — Founder moderation-path ask |
| PAW-229 | Tester | Pixel 6a matrices | **blocked** on PAW-244 — prior device **FAIL** (env); units PASS |
| PAW-230 | QA | Hard-lock + regression audit | **blocked** on PAW-229 — do not treat device matrices as proven |

## Legal CONDITIONAL-GO (PAW-225) — binding for Engineering handoff

Neither area is a legal STOP. Both ship only under these conditions:

| Area | Verdict | Conditions |
|------|---------|------------|
| Image moderation / privacy | CONDITIONAL-GO | Prefer on-device > Pawple ephemeral server > external API. External API = Founder material-tech approval + Privacy disclosure + processor diligence. Discard rejects by default. Amend Privacy/Terms/Guidelines same release (PAW-226). Quiet UI copy may stay non-technical (PAW-224). |
| Invite / deep-link | CONDITIONAL-GO | Warm intro + code-bearing URL + honest mock Android/iOS destinations. Device-local invite retain OK. Invite-file freeze lifted in CURRENT for this wave only. No deferred DL vendor required for Beta. |

Mating/Chat legal scope **not** reopened.

## Legal PAW-232 — if Founder selects approve_cloud_edge

Enablement conditions (binding before live images):
- Vendor DPA before live image traffic
- Discard rejects by default; no secondary training use
- Same-release legal honesty rewrite (PAW-226)
- Kill-switch; quiet UI reject copy
- Qualified counsel before store Privacy publication

Memo: `docs/PAW232_CLOUD_GATE_INVITE_LEGAL_ADVISORY.md`

## CEO locks recorded in CURRENT.md (2026-09-07)

- Invite-file freeze lifted **for PAW-222 invite work only**.
- Rejected images: discard by default.
- Pet-vs-human for profile-expected photos; Moments keep humans-with-pets OK while rejecting explicit/bikini-style human imagery.
- Legal honesty amendments required same release as any automated image gate.
- Mock Play/App Store destinations remain honest placeholders (no fake store chrome).

## Acceptance gate (summary)

See PAW-222 §31. Wave complete only when permissions/camera/gallery/notifications/image safety/invites acceptance criteria pass on Pixel 6a, mating untouched, logout/delete intact, Tester PASS, QA PASS. No APK in this wave.
