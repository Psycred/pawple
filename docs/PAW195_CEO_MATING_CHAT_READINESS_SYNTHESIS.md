# PAW-195 — CEO synthesis: Mating Match + Chat readiness

**Authority:** Founder instruction on PAW-195  
**Author:** CEO  
**Date:** 2026-09-06  
**Inputs:** CEO repo-truth (`docs/PAW195_CEO_MATING_CHAT_READINESS_AUDIT.md`) + PAW-196 Legal, PAW-197 Copy, PAW-198 Frontend, PAW-199 Backend, PAW-200 CTO, PAW-201 QA, PAW-202 Tester  
**Scope:** Audit complete. No implementation. Feature remains hidden.

---

## Two levels of truth

| Layer | Finding |
|-------|---------|
| **Repository truth** | Mating ~**85%** coded. Chat ~**80%** coded. Both **0%** user-visible. Recover, do not rebuild. |
| **Team readiness** | Unanimous **NO-GO to re-expose**. Coded ≠ releasable. Blocked by Legal + Founder product conflicts + live proof + moderation ops + QA/device path. |

This is **90% coded and blocked**, not 70% missing.

---

## J first — CEO recommendation

**NO-GO for implementation.**  
**NO-GO for re-expose.**  
**YES — treat the existing stack as recoverable infrastructure.**

I would not start a Mating/Chat build wave now. I would not flip `EXPOSE_MATING_SURFACES`. I would not rebuild what already exists.

Phase 1a stays Bulletin Board. Mating stays hidden. That is already Founder-authorized in `docs/CURRENT.md`. This audit does not reopen it.

Mating belongs in a **later adult wave** (Phase 1b / post-bulletin), and only after Founder records the decisions in §Founder. A small invite network is not a reason to delete the feature. It is a reason to keep empty states honest and not launch into disappointment.

**What would change this:** Founder records distance + location-honesty + an authorized later wave in CURRENT.md; Legal can re-attach instruments; Backend/CTO prove live RPCs/GRANTs; QA/Tester get a controlled non-production path. Then I would open a **repair** wave — not a rebuild.

---

## A. What we already have

Reusable. Do not strip. Do not replace.

- Discovery, opt-in (“Open to Companionship”), Paw on viewed profile, inbound interest, breed / opposite-sex / opt-in / distance eligibility.
- Mutual-Paw introduction chat only. Client never creates channels. No open DMs. No meetup group chat.
- 18+ fail-closed (`attest_adult_account`, `assert_mating_age_ok`, message adult trigger).
- Report + block (`mating_interest`, `introduction_chat`). Link block (client + DB). Phones allowed.
- Hide gate: `EXPOSE_MATING_SURFACES = false`. Routes unregistered. Live Terms honestly omit mating.
- Live project (`pexurgcfkxkouthuhlnb`): mating tables and auth-gated write RPCs exist (Backend read-only probe).
- Account delete includes mating rows. Export v2 exists in repo (live version unconfirmed).
- Copy is largely in place and pet-first (Paw, Introduction, quiet empty chat). Legal dormant sections exist, unattached.

---

## B. What is partially complete

- Chat: send/history/disclaimer/frozen UI exist; 8s poll; no Realtime; no push; no inbox.
- Age: server assert exists; PAW-53 KYC still open; self-declared DOB only.
- Safety: report insert + block freeze exist; no human review queue, SLA, appeal UI, or grievance officer.
- Consent: toggle exists; `MATING_OPT_IN_DISCLAIMER` is **not shown**; chat ack is AsyncStorage only.
- Tests: link-guard unit 5/5; RLS mating section exists but was **not run** (staging secrets); no mating integration/UI tests.
- Hide is presentation only. RLS is the real boundary. Hidden ≠ unauthorized for a crafted client.

---

## C. What is missing

- Production entry points (intentional).
- Mating/chat notifications and badges.
- Chat inbox / deep links (profile-only entry — confirm as product, do not “helpfully” add).
- Informed opt-in + server consent records.
- Live Terms/Privacy/Guidelines mating sections (correctly omitted today).
- Stated chat/interest retention policy.
- Moderated ops path beyond `reports` insert.
- Authenticated live smoke of discovery, 100 km CHECK, freeze, export v2.
- Controlled staging test path that does not expose normal users.
- Hide-gate regression test.

---

## D. What is broken or drifted

| Item | Why it matters |
|------|----------------|
| **Radius client vs server** | Client 5/10/25/50 + default 25. Server CHECK/RPC = **100 km**. Save would fail. Empty copy lies. |
| **Product-source conflict** | Product Contract + CEO mandate: user-selected distance. PAW-73 / CURRENT.md: fixed 100 km. **Founder must resolve.** |
| **Location honesty** | Phase 1a Privacy: city-only, no precise GPS. Mating RPCs use ~1 km grid + `~N km` labels. Legal will not approve both claims. |
| **Live GRANT drift** | Anon EXECUTE reached `mating_eligible_pair`, `pets_have_mutual_paw`, `assert_mating_age_ok`. Repo intended these locked down. |
| **Silent empty discovery** | Stale/missing location returns `[]`. Reads as “no matches.” |
| **Disclaimer split** | `mating.js` (what chat shows) vs `legalDocuments.js` (dormant; includes 18+ / mutual Paw). |
| **“Mating” / “About mating”** | Copy flags dating-adjacent tone vs Design Constitution. Founder/Product rename if re-exposed. |
| **Runtime stale** | PAW-69 SIGN-OFF predates hide wave. No device pass since. |
| **RLS fixture gap** | Mating RLS test may set fresh location for one user only; eligibility needs both. |

---

## E. What each function needs before go-ahead

| Function | Will not go-ahead until |
|----------|-------------------------|
| **Legal** | Founder: stay hidden vs later expose; distance; location honesty; phone-in-chat notice. Then live Terms/Privacy rewrite, informed opt-in, server acks, export v2 proof, human review/appeal/grievance. External India counsel for DPDP/intermediary pack. **NO-GO now.** |
| **Copy** | Founder distance + Constitution title (“Mating”). Legal canonical disclaimer. Engineering truth for radius and stale-location. Controlled build to walk strings. |
| **Frontend** | Founder radius rule, then align picker/copy. Legal/Copy one disclaimer import. Backend live-apply. Controlled staging gate — **not** production. |
| **Backend** | Founder radius. Live GRANT repair. Legal on export/moderation. CTO-approved authenticated smoke. **No-GO to re-expose.** |
| **CTO** | Distance decision; live RPC/trigger proof; client/server align; honest empty state; Legal re-attach plan; RLS suite repaired and run; PAW-53 accepted or closed; poll-vs-push recorded. **Technical go-ahead: NO.** |
| **QA** | Not SIGN-OFF. Needs Founder radius, staging `test:rls`, hide-gate test, Legal/Copy attach, Designer feel + Founder feel-pass, PAW-52 if store-bound. |
| **Tester** | Cannot reach mating screens today. Needs staging + controlled non-prod gate + seeded adults + radius decision. |

---

## F. Dependencies — who is waiting on whom

```
Founder (distance + location honesty + whether a later wave exists)
    │
    ├── Legal ──► Copy (canonical disclaimers / Terms rewrite)
    ├── Backend ◄── CTO (GRANT repair + live smoke design)
    └── Frontend (radius UI / empty-state) waits on Founder + Legal/Copy
                 │
                 ▼
         QA / Tester (controlled staging path, CEO/CTO coordinated)
                 │
                 ▼
         Designer feel + Founder feel-pass (org DoD)
                 │
                 ▼
         Only then: implementation tickets
```

Nobody is waiting on a rebuild. Everyone is waiting on **Founder product truth** and **Legal honesty**.

---

## G. Recommended implementation sequence

**Do not start this sequence until Founder authorizes a later wave.**

1. Founder records: stay hidden now; distance model; location model; poll-only first expose; no inbox.
2. CTO + Backend: revoke live helper GRANTs; prove RPCs/triggers/export/delete on staging.
3. Legal + Copy: one disclaimer; informed opt-in; Privacy/Terms that match the location model; Guidelines report surfaces.
4. Frontend: remove or restore radius UI to match the Founder rule; stale-location empty state; wire opt-in notice; keep gate false on production.
5. QA hide-gate test + expanded RLS; Tester device matrix on **staging-only** build.
6. Designer feel-walk. Founder feel-pass. Then — and only then — consider a production gate flip in a new authorization.

---

## H. Release blockers

1. No Founder authorization to re-expose (CURRENT.md still hides mating).
2. Distance-model conflict unresolved.
3. Location-honesty conflict unresolved.
4. Live Terms would be **false** if chat appeared (“no in-app messaging”).
5. Opt-in is not informed consent.
6. Live helper GRANT drift.
7. No authenticated runtime proof since hide wave.
8. No moderation ops / grievance publication for 1:1 chat.
9. QA/Tester have no controlled path; cannot SIGN-OFF.
10. Store still blocked on PAW-52 regardless.

---

## I. Non-blocking improvements

- Inbox / chat list — do not add unless Founder asks.
- Push / Realtime — CTO: keep 8s poll for a first controlled Beta; do not build a notification platform.
- Extra matching criteria — **do not invent**. Breed, gender, distance only.
- AI scanning — frozen; absence is honest; it raises the need for human review, it does not require a rebuild.
- Deep links — not required to recover the feature.
- “Mating” title tone — Copy recommendation; Founder call if/when exposed.
- Pagination / discovery indexes — fine for invite-only Beta.

---

## Founder decisions (cannot be made by CEO or engineering)

1. **Distance:** user-selected (Product Contract / CEO mandate) **or** fixed 100 km (PAW-73 / later CURRENT.md). Pick one. I will not.
2. **Location:** city-only eligibility **or** approximate-km with Privacy that admits ~1 km grid. Legal will not bless both.
3. **Timing:** keep hidden through current Phase 1a / store path, **or** authorize a later adult recovery wave. I recommend **keep hidden now**.

---

## Confirmation

- Did not implement, flip the gate, or create implementation tickets.
- Did not resolve Founder-level product conflicts.
- Feature stays hidden.
