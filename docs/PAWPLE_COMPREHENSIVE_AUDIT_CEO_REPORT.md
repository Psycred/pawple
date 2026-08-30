# Pawple Comprehensive App Audit — CEO Report for Founder

**Date:** 2026-08-30  
**Authority:** Founder `AUDIT GO` on PAW-7  
**Chain:** PAW-39 (QA Auditor) → PAW-40 (CTO) → CEO synthesis (this document)  
**Constraints honored:** Read-only throughout. No implementation. No commits. Recommendations ≠ authorization.

**Source reports:**
- QA: PAW-39 comment `281b7ac5-91ae-4004-b971-57f14f5749ad`
- CTO: PAW-40 comment `cfbc0087-971b-46fe-bd2c-390aa0d23b44`

---

## 1. Bottom line (CEO recommendation)

**Pawple’s pet-first philosophy is largely intact** in the product surfaces we care about: no engagement metrics, pet-centric meetups, invite-gated onboarding, passwordless Apple/Google shape, mating not implemented.

**I do not recommend a Contract §13-style production / store closed beta yet.**

The blockers are not missing polish. They are **honesty and enforcement gaps** that would ship a product different from what the Contract and legal copy claim:

| # | P0 issue | Why it matters |
|---|----------|----------------|
| 1 | Meetup / host / participant **public SELECT** (anon key) | Venue, time, attendee pets world-readable — contradicts Contract §7 |
| 2 | **`profiles.last_location_*`** readable by any authenticated user | Undermines Contract §8 approximate-location intent |
| 3 | **`locationUtils.js` fabricates distances** without `__DEV__` | Contradicts Contract §8 / §13 “never fabricate” |
| 4 | **Legal / privacy / placeholder copy** (password, phone, DMs, push, verification) | Trust, store review, authenticity |

**Invite-only does not neutralize the anon key.** Anything `USING (true)` to `public` is readable with the shipped client key.

QA’s audit-task SIGN-OFF and CTO’s technical assessment are **accepted as input**. They are **not** product-readiness SIGN-OFF. **PAW-34 and PAW-38 remain closed.**

---

## 2. What is working (keep)

- Pet-first Feed / journals; likes without public counts; no comments / followers / reposts
- Meetups belong to pets via junction tables
- Invite after OAuth; delete/export RPC paths exist
- Notification nudge honesty (push not beta)
- Demo feed/RSVP `__DEV__` gating (verify scripts passed)
- Correctness wave + Fast Lane restore already QA-closed under prior Founder authorization
- Mating engine **not** built (frozen — correct)

**Conscious Beta debt CTO/QA treat as acceptable *if you explicitly accept*:** weak provider-only recovery; no IDV; no push; no chat; mating not built; limited moderation **inside a known invite circle**.

---

## 3. CEO integration of QA + CTO

| Topic | CEO position |
|-------|----------------|
| Overall QA read | **Agree** — sound and correctly prioritized |
| Architecture coherence | **Agree with CTO** — Expo → Supabase, ActivePet, pet meetups are coherent for Beta |
| Closed beta readiness | **Agree with CTO** — do not recommend until P0 remediations **or** written Founder acceptance of residual risk |
| Mating | **Do not implement**; freeze stands until PAW-18. Copy/liability only |
| Companion flag as pet visibility gate | **Escalate to you** before Backend invents a new gate — product rule needed |
| Report/block | **SHOULD before widening circle**; acceptable residual *inside* known invite circle if you accept |
| Age 13+ vs meetup UGC | **Founder decision** — likely too low for honest store questionnaires if stranger meetups ship |
| Public profile life-record | **Still queued post-audit** — not authorized; timing is your call |

---

## 4. Founder decisions needed (before any remediation wave)

These are company decisions. CEO will not open implementation tickets until you authorize a wave.

### Decision A — Legal / privacy rewrite
Rewrite Terms/Privacy (and retire conflicting legal surfaces) to match the **actual** product: passwordless OAuth, no phone/password/DMs/push-as-product, approximate location honesty, deletion timing aligned with RPC.

**CEO recommendation:** Authorize as part of the next honesty/safety wave (or a parallel legal track). Shipping current PrivacySettings / Privacy copy into store review is a trust failure.

### Decision B — Meetup RLS + profile coordinates (accept vs fix)
For invite-only closed beta, do you:

1. **Must fix** before any closed beta (CEO **recommends** this if claiming Contract compliance), or  
2. **Accept as residual risk** in writing for a tightly known invite circle?

**CEO recommendation:** **Must fix** for anything called production/store closed beta. Accepting residual risk is only coherent if the circle is tiny, known, and you document that Contract §7/§8 are waived for that window.

### Decision C — Age rating / gate
Keep **13+** with no age gate, or move toward **17+ / adult meetup** framing with an honest gate?

**CEO recommendation:** Decide before store submission. In-person meetups with strangers + UGC push toward the higher bar.

### Decision D — Companionship helper copy (mating frozen)
Keep Founder string **“Open to Companionship”**. Helper text that implies live human connecting while discovery/matching is off is the problem.

**CEO recommendation:** Soften/remove the “find and connect” helper until mating is authorized; do not implement mating to “make the helper true.”

### Decision E — Timing of public pet-profile life-record
Already decided as product direction; **queued after this audit**. When to authorize Contract update + implementation?

**CEO recommendation:** After P0 honesty/RLS wave, or in parallel only if it does not distract from P0. Not before P0 if bandwidth is scarce.

---

## 5. If/when you authorize remediation — recommended sequence

*(Recommendations only — not tickets yet.)*

1. Your decisions A–E above  
2. **Frontend honesty:** gate/remove production distance fabrication; strip false PrivacySettings / notification promises; companion helper once you decide D  
3. **Backend RLS:** meetup SELECT → authenticated; remove/replace profile coordinate exposure; re-run RLS suite with service role on staging  
4. **Storage:** codify bucket policies in migrations (or accepted exception + CI check)  
5. **Release smoke:** Apple/Google on Release binaries; delete/export on staging; wire `SUPABASE_SERVICE_ROLE_KEY` in CI (standing CEO reminder duty)  
6. **Later SHOULD:** quantized coords; report/block; share URL; live invite count; Caveat alignment  

**Do not** start mating, chat, push, phone/password, or reopen PAW-34/38.

---

## 6. What could not be verified (environment)

- Live anon-key SELECT probe against staging/prod (inferred from migrations)  
- Live Storage Dashboard policies  
- Delete/export against a real project  
- Integration / RLS suites (no service-role key in audit runs)  
- Device Release OAuth / Apple entitlements  
- Lawyer review of ToS / age questionnaires  

Residual risk on unverified live environment sits with Founder until staging smoke is authorized.

---

## 7. Standing state (unchanged by this audit)

| Track | Status |
|-------|--------|
| Correctness wave (PAW-34) | QA-closed — not reopened |
| Fast Lane restore (PAW-38) | QA-closed — not reopened |
| Commits | **Hold** until you authorize |
| Mating | Frozen until PAW-18 |
| Public profile life-record | Queued; not authorized |
| This audit chain | **Complete** (QA + CTO + CEO synthesis) |

---

## 8. Next step for Founder

Answer the decision package (A–E), or post a superseding instruction (e.g. authorize a named remediation wave, accept specific residual risks, or hold).

CEO will not implement or commit until you authorize.
