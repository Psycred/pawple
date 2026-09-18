# PAW-226 — Legal advisory: image safety vs “no AI moderation” claims

**Agent:** Legal & Compliance Counsel  
**Reports to:** CEO  
**Date:** 2026-09-07  
**Parent:** PAW-224 (Copywriter finals) · Wave: PAW-222 Beta Hardening  
**Authority (read-only):** `docs/CURRENT.md`, Product Contract, governance, `src/content/legalDocuments.js`  
**Nature:** Advisory research and recommendation only — **not** a binding legal opinion. Qualified India counsel required before store submission or material privacy-policy publication.

---

## 1. Executive summary (recommendation)

**Do not ship automated image-safety checks while `legalDocuments.js` still states that this launch “does not use AI moderation.”** That combination is an honesty / misleading-claim risk under Pawple’s own transparency posture, Apple/Google privacy-policy expectations, and DPDP notice duties.

**Recommended path (Founder decision):**

1. **Keep** quiet rejection UX from PAW-224 (no “AI,” models, scores, or reason codes in toasts). That UX is fine.
2. **Before** any automated pet/NSFW gate reaches Beta testers or users, **narrow and rewrite** Terms / Privacy / Guidelines so they:
   - **Stop** the blanket “no AI moderation” claim; and
   - **Disclose** upload-time image screening for pet-profile and Moment photos (purpose, whether on-device / Pawple server / third-party processor, retention of rejects, human report review still available); while
   - **Preserve** the CURRENT.md freeze: **no AI message scanning / automated chat moderation**.
3. Treat CURRENT.md’s frozen line as **chat-scoped**, not a ban on upload-time image filters. Image safety is Founder-authorized in PAW-222; legal copy must catch up, not block the product goal with stale wording.
4. Prefer **on-device** or **Pawple-operated ephemeral server** screening over external APIs for Beta (lower disclosure / cross-border / processor risk). External API = Founder material-tech approval + vendor diligence + Privacy processor disclosure as release conditions (consistent with PAW-225 note on PAW-223).

**Phase 1 remains 18+ only.** No teen / parental-consent scope in this memo.

---

## 2. Regulatory / industry framework analysis (sources)

### 2.1 Conflict inventory (Pawple facts)

| Surface | Current claim | Planned PAW-222 behaviour |
|--------|----------------|---------------------------|
| Terms — “What Pawple is not” | “…or AI moderation.” | Automated image checks on profile + Moments |
| Terms — “Safety” | “We do not claim … or AI moderation.” | Pre-upload filtering + human report review |
| Privacy — “What we do not do” | “…does not use AI moderation or AI message scanning.” | Possible ML/classifier or third-party safety API on images |
| Guidelines — “How we enforce” | “Safety is report-driven… We do not claim AI moderation or AI message scanning.” | Automated gate **plus** reports |
| CURRENT.md NOT AUTHORIZED | “AI message scanning / **automated chat** moderation” | Image safety is **in** PAW-222 scope; chat AI remains frozen |
| PAW-224 user copy | Quiet rejects; never expose AI | Compatible with honest legal docs |

**Verdict:** Product intent (Founder PAW-222 §§13–17) and legal copy (Phase 1a honesty language) are currently misaligned. Copywriter correctly escalated (PAW-224 §4 → PAW-226).

### 2.2 India — DPDP Act 2023 (+ Rules 2025 context)

- Digital personal data includes **images** that identify or relate to a person (pet photos often include humans; even pet-only uploads are tied to an account). Automated screening is **processing**.
- Lawful processing rests on **consent** or specified **legitimate use**, with **purpose limitation** and **necessity** (DPDP Act §§4–6; see FPF explainer: https://fpf.org/blog/the-digital-personal-data-protection-act-of-india-explained/).
- Consent must be free, specific, informed, unconditional, unambiguous; notice must describe personal data and purposes in plain language (DPDP Act §5–6; EY summary of Act + Rules 2025: https://www.ey.com/en_in/insights/cybersecurity/decoding-the-digital-personal-data-protection-act-2023).
- Saying “we do not use AI moderation” while running classifiers / safety APIs on uploads undermines **informed** notice and creates contradiction risk if users rely on Privacy/Terms.
- Third-party moderation APIs implicate **sharing with processors**, possible **cross-border** transfer rules, and vendor contracts — disclose and diligence before use.
- Phase 1 **18+** reduces children’s-data duties for now; do not imply child-safe AI screening as a substitute for age policy.

*Advisory only — timing of Rules enforcement and Significant Data Fiduciary thresholds need human counsel.*

### 2.3 India — IT Act / Intermediary Guidelines 2021

- Intermediaries must publish accurate rules, privacy policy, and user agreement, and inform users not to upload unlawful / obscene content (IT Rules 2021 Rule 3(1); PIB text: https://static.pib.gov.in/WriteReadData/specificdocs/documents/2021/feb/doc202122521.pdf).
- Voluntary filtering / removal for prohibited categories is contemplated; **honesty of published policies** remains due-diligence hygiene.
- Significant Social Media Intermediary automated-tool duties (Rule 4) are **unlikely** for invite-only Beta scale, but do not justify false “no AI” statements if tools are used.
- Upload-time image filtering for nude/obscene content **supports** UGC safety expectations; it does **not** require claiming “AI-powered safety” in marketing.

### 2.4 App stores / UGC industry practice

- **Apple App Store Review Guideline 1.2** requires UGC apps to filter objectionable material, provide report/block, and publish contact info (https://developer.apple.com/app-store/review/guidelines/). Automated or hybrid filtering is industry-normal and often expected; it does **not** conflict with quiet UX.
- Privacy policies must accurately describe collection and use (Guideline 5.1.1). Third-party AI / moderation SDKs need disclosure and consent where applicable.
- Quiet reject strings (PAW-224) match common practice: users see product language; legal docs carry mechanism disclosure.

### 2.5 Distinction that resolves the CURRENT.md tension

| Phrase | Status |
|--------|--------|
| “AI message scanning / automated **chat** moderation” | **Frozen** (CURRENT.md) — do not build |
| Upload-time **image** pet / NSFW screening | **Founder-authorized research → implementation after tech approval** (PAW-222) |
| Blanket “no AI moderation” in legal copy | **Stale / overbroad** once any automated image gate ships |

---

## 3. Pawple-specific blueprint

### 3.1 What should change (when Founder approves a gate + copy update)

**A. Privacy (`privacySections`) — required honesty**

- Remove or replace: “does not use AI moderation or AI message scanning” as a single blanket denial.
- Add a short section or bullet, e.g. direction of:
  - *“When you add a pet photo or Moment photo, Pawple may automatically check the image to help keep uploads pet-first and free of sexual or obscene content. Checks may run on your device and/or on our systems [and/or a safety provider — only if true]. Rejected images are not published. We do not use these checks to train advertising profiles. Chat message scanning is not part of this launch.”*
- Path-specific swaps:
  - **On-device only:** emphasize processing on device; no image leave-device for the check (if technically true).
  - **Pawple server:** disclose transmission to Pawple servers for the check; retention (prefer discard of rejects).
  - **Third-party API:** name category of provider, purpose, location/cross-border if known, and that provider processes the image for safety classification.

**B. Terms (`termsSections`)**

- “What Pawple is not”: drop blanket “AI moderation”; keep exclusions for open DMs, marketplace, behavioural ads, etc.; state **no AI chat/message scanning**.
- “Safety”: state hybrid model — automated upload checks **and** human review of reports; no guaranteed safety / no verified attendees.

**C. Guidelines (`guidelinesSections`)**

- “How we enforce”: replace pure “report-driven only” with: automated checks on certain photo uploads + report-driven human review + appeal path; still **no** AI chat scanning; still **no** claim of perfect safety.

**D. User-facing reject UX (PAW-224) — keep**

| Case | Copy | Legal view |
|------|------|------------|
| Non-pet | “That doesn't look like a pet.” | GO — no AI jargon |
| Inappropriate | “This photo can't be used.” | GO |
| Prohibited UI terms | AI, model, NSFW, scores, reason codes | Keep prohibited |

Disclosure belongs in **legal docs / Settings legal surfaces**, not rejection toasts.

**E. What stays restricted**

- No Mating/Chat reopen; no AI chat moderation.
- No teen accounts / VPC.
- No marketing claim of “AI-powered safety,” “guaranteed clean feed,” or similar.
- No durable storage of rejected images by default (Legal preference: discard) unless counsel + ops require a short dispute buffer — if buffer exists, disclose retention.
- No behavioural advertising use of moderation signals.

### 3.2 Recommended legal language principle

**Narrow negatives; specific positives.**

- Prefer: “We do not scan chat messages with AI” / “This launch has no automated chat moderation.”
- Prefer: “We may automatically check photos you upload for pet-profile and Moments against our Community Guidelines before they are saved.”
- Avoid: “We do not use AI moderation” (overbroad once any ML/API gate exists).
- Avoid: “AI keeps Pawple safe” (overclaim).

### 3.3 Sequencing (release coupling)

```
Founder approves moderation tech path (PAW-223 recommendation)
        ↓
Legal copy update ticket (authorized implementation — not this advisory)
        ↓
Engineering ships gate + Frontend drops PAW-224 strings
        ↓
QA verifies: runtime behaviour matches Privacy/Terms/Guidelines
        ↓
Tester / QA PASS on Pixel 6a matrix (incl. image safety)
```

**Do not** enable the gate in a build that still ships current `legalDocuments.js` denials.

---

## 4. Phased implementation considerations

| Phase | Legal posture |
|-------|----------------|
| **Now (advisory)** | PAW-226 complete: honesty map + rewrite blueprint. No code. No CURRENT.md edit. |
| **Beta / PAW-222** | If automated image gate ships: couple Privacy/Terms/Guidelines update in same release train. Keep 18+. Prefer on-device / ephemeral server. External API only with Founder approval + disclosures. |
| **Phase 1a Bulletin Board** | Image screening compatible with pet-first UGC + App Store 1.2 filtering expectation. Chat AI remains frozen. |
| **Later (held)** | Teen / family / chat moderation are separate Founder waves; do not preload teen AI-supervision claims. |

---

## 5. Risks, unknowns, human counsel

| Risk / unknown | Why it matters | Owner |
|----------------|----------------|-------|
| Shipping gate under current copy | Misleading Privacy/Terms; trust + store review | CEO / Founder gate |
| External API without disclosure | DPDP processor / cross-border; Apple 5.1.1 | CTO path + Legal copy + counsel |
| Retaining rejected images | Purpose limitation; deletion/export story | Backend + Legal |
| False sense of safety | Liability / Guidelines honesty | Keep “no guaranteed safety” |
| Over-filtering pets with people | Guidelines already allow humans-with-pets; pet-vs-human model error | CTO accuracy + QA matrix |
| SSMI / IT Rules classification later | Scale may change duties | Human counsel at growth |
| Exact classifier = “AI” for advertising law | Even non-LLM CV models are commonly described as AI; safer to disclose “automatic checks” | Counsel + Copy |

**Requires qualified human counsel:** final Privacy wording, vendor DPAs, cross-border transfer, intermediary classification, and store submission package.

**CTO input requested (non-blocking for this advisory):** confirm recommended Phase 1a path (on-device / server / API) on PAW-223 so Legal can lock path-specific Privacy sentences in the follow-on copy ticket.

**QA Auditor:** when gate + copy ship together, verify no residual “no AI moderation” string in runtime legal surfaces; verify reject UX never leaks model jargon; verify rejected images never appear in Feed/profile.

---

## 6. Compliance confirmation

- [x] Did **not** edit `docs/CURRENT.md`
- [x] Did **not** implement product code or change product behaviour
- [x] Did **not** commit or push
- [x] Did **not** authorize Phase 1 age-scope change (remains **18+ only**)
- [x] Advisory only — Founder decides whether/when to act; CEO coordinates follow-on tickets

**Recommended next tickets (CEO orchestration):**

1. After CTO PAW-223 moderation recommendation + Founder tech approval → **Legal copy implementation** ticket (Terms/Privacy/Guidelines honesty rewrite per §3).
2. Engineering implementation only after (1) is authorized or tightly sequenced in the same release.
3. QA gate on honesty match before Tester PASS closes image-safety acceptance.

---

---

## Addendum — Copywriter brief response (2026-09-07)

Wake comment `148f781c` (Copywriter / PAW-224): user-facing rejects do not mention AI; Legal asked to review Terms/Privacy/Guidelines if PAW-222 ships automated image checks.

**Confirmation:** Quiet reject finals remain Legal **GO**. Conflict with Phase 1a “no AI moderation” strings in `legalDocuments.js` stands. CURRENT.md CEO lock already requires same-release legal amendment if the gate ships. Full recommendation unchanged above. No code / no CURRENT.md edit / no commit.

*End of PAW-226 advisory memo.*
