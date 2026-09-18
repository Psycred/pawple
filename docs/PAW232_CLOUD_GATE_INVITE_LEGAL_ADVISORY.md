# PAW-232 — Legal advisory: §5.4 cloud moderation gate + invite / deep-link (pre-production)

**Agent:** Legal & Compliance Counsel  
**Reports to:** CEO  
**Date:** 2026-09-07  
**Parent:** PAW-222 Beta Hardening / Pre-APK Wave  
**Inputs:** CTO map `docs/PAW222_BETA_HARDENING_IMPACT_MAP.md` §5.4 & §6; PAW-225 CONDITIONAL-GO; PAW-226 honesty advisory; Founder locks in `docs/CURRENT.md`  
**Scope:** Image moderation privacy for the **proposed cloud Edge Function gate** + invite / deep-link implications only. **No** Mating/Chat legal reopen.  
**Nature:** Advisory research and recommendation — **not** a binding legal opinion. Qualified India counsel required before public store submission or material Privacy publication.

---

## 1. Executive summary (plain language)

| Area | Verdict | Takeaway |
|------|---------|----------|
| **Cloud gate (§5.4)** | **CONDITIONAL-GO** (Founder material-tech approval + release conditions) | Legal does **not** STOP the CTO cloud path. It is the **highest-disclosure** option among Phase 1a paths (external processor + likely cross-border). Founder may approve it for controlled Beta **only if** the conditions below ship with (or before) any live user-image traffic to a vendor. |
| **Invite / deep-link (§6)** | **CONDITIONAL-GO** | Code-bearing `pawple.com` invite URLs + device-local retain/prefill + honest mock Android/iOS destinations remain **GO**. No deferred deep-link vendor required. Mock destinations must not look like live Play/App Store listings. |
| **Mating / Chat** | **Not reopened** | Confirmed. |

**Relative to PAW-225:** Path preference remains on-device → Pawple ephemeral server → external API. CTO §5.4 chooses external API for credibility/Expo fit. That choice is **legally allowable with conditions**, not preferred on privacy alone.

**Production enablement** (ordinary users / store path) is **stricter** than “Founder may authorize Backend M1 in this wave.” Do not treat Founder accept of §5.4 as a blank production Privacy GO until diligence + same-release legal copy land.

**Coordinate:** Pending Founder confirmation / path questions on **PAW-222** should treat this memo as the Legal condition set for option `approve_cloud_edge`.

---

## 2. Regulatory / industry framework analysis (sources)

### 2.1 Fact pattern — CTO §5.4

Proposed post-approval architecture (`PAW222_BETA_HARDENING_IMPACT_MAP.md` §5.4):

1. Supabase Edge Function `moderate-image` receives image bytes or short-lived staging upload.  
2. Calls a **cloud vendor** (examples: Sightengine / Hive) for nudity/sexual/offensive **and** person/face (pet-profile non-pet signal).  
3. Returns `{ allow, reasonCode }` — **reasonCode never shown to users**.  
4. Gate runs **before** permanent public Storage; staging TTL preferred.  
5. Vendor keys in secrets; feature-flag kill-switch.  
6. Explicit STOP until Founder approves material technical change.

**Legal classification:** User-uploaded photos (often containing identifiable humans; always tied to an authenticated account) are **personal data**. Sending them to a third-party classifier is **processing by a data processor** on Pawple’s instructions. Pawple remains the **Data Fiduciary** for DPDP accountability.

### 2.2 India — DPDP Act 2023 (+ Rules context)

- **Personal data** includes digital data about an identifiable individual; photographs of people qualify; pet uploads remain linked to the uploading Data Principal’s account.  
- **Purpose limitation / notice:** Processing for “safety screening of pet profile and Moment photos before publication” must be described in plain language. Current `legalDocuments.js` still asserts this launch does **not** use AI moderation — that is **incompatible** with §5.4 if enabled (see PAW-226).  
- **Processors (DPDP §8):** Engaging a vendor requires a **valid contract**; fiduciary retains primary accountability; processor must follow instructions, secure data, support erasure/breach flows. Cross-border transfers must respect government-notified restrictions (DPDP §16 framework as implemented).  
- **Erasure / purpose end:** Rejected images should not persist beyond the check (aligns with CURRENT CEO lock: discard rejects by default). Staging objects need short TTL + deletion.  
- **Children:** Phase 1 remains **18+ only** (`CURRENT.md`). Cloud gate does **not** authorize teen accounts or parental-consent flows.

*Sources:* Digital Personal Data Protection Act, 2023; processor / fiduciary summaries (e.g. [KSANDK — processor duties](https://ksandk.com/data-protection-and-data-privacy/data-processor-duties-under-indias-dpdp-act-2023/); [EY — fiduciary–processor engagement](https://www.ey.com/en_in/insights/technology/how-data-fiduciaries-should-engage-processors-for-effective-compliance); [Inamdar Legal — DPA under DPDP](https://inamdarlegal.com/resources/data-processing-agreement-under-dpdp-act)). **Human counsel must confirm** notice text and transfer posture before store submission.

### 2.3 India — IT Act / Intermediary Guidelines 2021

- Accurate rules / privacy policy / user agreement; inform users not to upload unlawful / obscene content (IT Rules 2021 Rule 3(1)).  
- Pre-upload filtering for nude/obscene content **supports** due-diligence hygiene; it does **not** replace report + human review.  
- SSMI automated-tool duties are **unlikely** at invite-only Beta scale — still no excuse for false “no AI” statements.

*Source:* [PIB IT Rules text](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2021/feb/doc202122521.pdf).

### 2.4 Vendor / industry posture (illustrative — not vendor selection)

CTO cites Sightengine / Hive-class APIs. Public vendor materials commonly advertise:

- Signable **DPA** / GDPR-oriented terms (e.g. [Sightengine GDPR FAQ](https://sightengine.com/faq/gdpr-content-moderation); [Sightengine Security](https://sightengine.com/security) — region routing / immediate delete often **enterprise**-gated).  
- Configurable retention (industry practice varies; some default retention windows must be **contracted down** to ephemeral / delete-on-process for Pawple’s discard-by-default lock).  
- Cross-border default processing regions may be **outside India** unless enterprise routing is purchased.

**Legal implication:** Vendor **marketing** pages are not compliance. Before production enablement, obtain: signed DPA, retention = process-and-delete (or ≤ minutes), no secondary use / model training on Pawple bytes without Founder decision, sub-processor list, breach notice SLA, and known processing geography.

### 2.5 App stores / UGC

- Apple Guideline **1.2** expects filtering of objectionable UGC + report/block + contact ([Apple Guidelines](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)).  
- Privacy policies must accurately describe collection / third-party sharing (Guideline 5.1.1).  
- Quiet UI reject copy (PAW-224) may stay non-technical; **legal docs** carry mechanism disclosure (PAW-226).

### 2.6 Invite / deep-link framework

- Invite codes are **access credentials** for an invite-gated Product Contract flow — not passwords, but **semi-sensitive** (avoid analytics logging of full codes; users may forward).  
- Device-local pending-invite storage for retain/prefill is purpose-limited and consistent with validate-without-consume → redeem-at-completion.  
- **Deferred deep-link / attribution SDKs** add third-party processors and tracking surfaces — Founder correctly deferred them for Phase 1a; Legal **recommends keep deferred**.  
- Mock `pawple.com` Android/iOS destinations: consumer-protection / platform honesty risk if presented as live store listings (trademark / misleading UX). CURRENT already requires honest placeholders.

---

## 3. Pawple-specific blueprint

### 3.1 Cloud gate (§5.4) — what may change vs what stays restricted

**May change (after Founder approve + conditions):**

| Element | Blueprint |
|---------|-----------|
| Pre-storage Edge Function gate | Allowed under Founder material-tech approval |
| Transmission of candidate upload bytes to named safety vendor | Allowed **only** under DPA + Privacy disclosure that a safety provider processes images for policy checks |
| Staging prefix with auto-expire | Preferred — reduces durable personal data footprint for rejects |
| Quiet UI rejects (PAW-224) | Allowed — no AI/vendor/scores/`reasonCode` |
| Same-release Legal honesty rewrite | **Required** (Terms / Privacy / Guidelines) — PAW-226 |
| Kill-switch flag | Required operational control |

**Stays restricted:**

| Element | Rule |
|---------|------|
| Phase 1a age | **18+ only** |
| Mating / Chat / message AI scanning | **Frozen** — do not extend cloud moderation to chat |
| Durable reject store / training on rejects | **Forbidden** unless new Founder decision + Privacy update |
| Claiming “no AI moderation” while gate is on | **Forbidden** |
| Claiming guaranteed safety / verified content | **Forbidden** |
| Behavioural ads / profiling from moderation signals | **Forbidden** (aligns with existing Privacy posture) |
| UI exposure of model/vendor/reasonCode | **Forbidden** |
| Production Mating expose | Unrelated; remains out of scope |

**Privacy disclosure direction (path-specific for cloud):**  
When a user adds a pet photo or Moment photo, Pawple may send the image to a **safety service provider** (and/or process it on Pawple systems) to help keep uploads pet-first and free of sexual or obscene content. Rejected images are not published and are not kept. These checks are not used for advertising profiles. Chat messages are not scanned with AI in this launch. Human review of reports continues.

### 3.2 Invites / deep links (§6) — blueprint

| Element | Legal view |
|---------|------------|
| Warm intro + `https://pawple.com/invite/{CODE}` | **GO** |
| Device-local retain + onboarding prefill | **GO** |
| Re-click after install (no deferred DL vendor) | **GO** (preferred) |
| Mock Android/iOS → `https://pawple.com` | **CONDITIONAL-GO** — honest “Get Pawple” / placeholder destinations; **no** fake Play/App Store chrome |
| Custom scheme `pawple://invite/...` | **GO** as fallback while App Links / Universal Links hosting matures |
| Hosting a minimal invite landing page | **GO** if it collects no unnecessary data and does not impersonate stores |
| Logging full invite codes to third-party analytics | **Avoid** |
| Selling / public listing of invite codes | Already restricted in Terms — keep |

Invite-file freeze for this wave is already lifted in CURRENT for mapped invite work only — Engineering may edit those files within CTO map scope. Legal does not edit CURRENT.md.

---

## 4. Phased implementation considerations

| Phase | Cloud gate (§5.4) | Invites |
|-------|-------------------|---------|
| **Now — Founder decision on PAW-222** | Accept / revise / defer. If accept cloud path: Backend may build M1 **behind kill-switch**; **do not** route live tester images to vendor until DPA + discard config + Privacy draft ready for the same enablement. |
| **Controlled Beta / Pre-APK (this wave)** | Enable gate for Pixel 6a tester path only when conditions in §5 met. Same-release amend of `legalDocuments.js` (or ship gate OFF). Discard rejects. QA verifies no reject leak + no residual “no AI moderation” strings. |
| **Phase 1a store / broader production** | Full vendor diligence pack signed; App Store / Play privacy nutrition labels match third-party image processing; processing region documented; India counsel review of notice + transfer. Replace any temporary “Beta” vagueness with accurate provider category language. |
| **Later (held)** | On-device hybrid to reduce vendor volume; optional reject-audit retention only with new Founder + counsel; teen/family; chat moderation — **out of scope**. Real Play/App Store URLs replace mocks. |

**CTO / Backend feasibility note (request):** Confirm whether vendor can be configured for **delete-on-process**, whether enterprise region pinning is available for Beta budget, and whether staging objects never become public URLs on reject.

**QA note (request):** When gate + copy ship together — residual honesty strings, reject UX non-technical, rejects never in Feed/profile, invite mock links not labelled as stores, deep-link retain/prefill.

---

## 5. Risks, unknowns, and what requires qualified human counsel

### Release conditions checklist (cloud path) — all required for production enablement

1. **Founder** accepts §5.4 material technical change (pending on PAW-222).  
2. **Written DPA / processor terms** with chosen vendor before live image transmission.  
3. **Retention:** process-and-delete (or minutes-scale TTL); **no** durable reject gallery.  
4. **No secondary use / training** on Pawple images without separate Founder decision.  
5. **Privacy / Terms / Guidelines** amended same release (PAW-226 blueprint) — stop blanket “no AI moderation”; keep “no AI chat/message scanning.”  
6. **Kill-switch** and server-side enforcement (UI-only gate is not the control).  
7. **Staging before permanent public URL**; unauthorized Edge Function callers rejected.  
8. **Quiet UI** only (PAW-224).  
9. **India-qualified counsel** review before public store Privacy publication / transfer reliance.  

### Residual risks / unknowns

- Exact vendor geography and whether India-restricted transfer lists will bind at store launch date.  
- Whether “pet vs human” classes create higher false-positive friction vs Guidelines (humans-with-pets OK on Moments) — product policy risk, not solely legal.  
- CSAM / child-imagery edge cases: automated gate is **not** a complete child-safety programme; keep report + human review; escalate unknown serious content via existing safety process.  
- Domain control of `pawple.com` / App Links hosting readiness for HTTPS invites.  

### Verdicts (acceptance format)

1. **§5.4 cloud moderation privacy — CONDITIONAL-GO** for Founder approval and controlled enablement under the checklist above.  
2. **Invite / deep-link — CONDITIONAL-GO** (honest mocks; device-local retain; no deferred DL vendor).  
3. **Neither area — STOP** of the wave as scoped.  
4. **Mating/Chat — no legal reopen.**

---

## 6. Process confirmation

- Did **not** edit `docs/CURRENT.md`.  
- Did **not** implement product code or change product behaviour.  
- Did **not** commit or push.  
- Did **not** reopen Mating / Matching / Chat legal or product scope.  
- Advisory only — **Founder decides** whether and when to act (via CEO / PAW-222 confirmation paths).

*End of PAW-232 advisory memo.*
