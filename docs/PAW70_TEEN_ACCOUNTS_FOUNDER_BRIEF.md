# Consolidated Founder Brief — Teen Accounts / DPDP (PAW-70 + PAW-71 + PAW-72)

**Prepared for:** Founder review on PAW-7 (request `b4dc1acf`)  
**Sources:** Legal PAW-70 memo · CTO PAW-71 (`teen-account-feasibility` rev 3) · QA PAW-72  
**Phase 1 constraint:** Remains **18+ only**. This brief does **not** authorize teen implementation.

---

### Bottom line (CEO)

| Question | Answer |
|----------|--------|
| Open teen access now? | **No.** |
| Keep Phase 1 at 18+? | **Yes** — Legal, CTO, and QA agree. |
| Is a future Teen Account possible? | **Yes, later** — technically feasible; legally gated on VPC; QA says first surface must be stricter than Legal’s Phase 2b feed package. |
| What to do next on this track? | Nothing product-wise until Founder re-authorizes. Prioritize **PAW-53** (adult attestation + meetup age asserts) as integrity prerequisite. |

---

### 1. Legal (PAW-70) — Meta Teen Accounts, DPDP, Pawple blueprint

**Recommendation:** Do not open general teen access until (a) **verifiable parental consent (VPC)** under DPDP Rules Rule 10, (b) **hard product blocks** on meetups / mating / introduction chat / real-world coordination, and (c) a **parent-linked supervision** layer.

**Suggested future age posture (advisory only):**
| Phase | Age | Notes |
|-------|-----|-------|
| Phase 1 (now) | **18+** | Binding — no change |
| Phase 2 (first teen tier) | **16+** | Lower burden than 13+ |
| Phase 3 (optional) | **13–15** | Only after 16+ proven |

**Meta Teen Account takeaways (industry reference):**
- Auto enroll 13–17; **restrictive-by-default**; under-16 needs parent permission to relax settings
- Defaults: private profile, limited DMs, restricted tags, content filters, Live off, time/notification limits, adult-contact throttling
- Location not default-on; parents can see/disable sharing when supervised
- Unlock = parent approve/deny less-protective settings; parents see **metadata**, not message content; ends at 18

**Pawple adaptation:** Copy Meta’s default-restrictive philosophy, but go **further** — **hard-disable** (not soft-restrict) meetups, mating, and any 1:1 messaging for teens.

**India DPDP (child = under 18):**
- §9(1) VPC of parent/guardian **before** processing child’s personal data
- §9(2) no processing likely to harm well-being
- §9(3) **no** tracking / behavioural monitoring / targeted ads at children
- Rule 10: adult must be **identifiable** (held ID or authorised-entity token e.g. DigiLocker); **self-declaration alone is not VPC**
- Pawple not in Fourth Schedule exemptions → full §9 duties
- Burden of proof on Pawple → immutable VPC audit trail required

**Pawple Teen Account blueprint (supervised pet journal, not social discovery):**
| Surface | Teen |
|---------|------|
| Pet profile + Moments journal | Allowed (restrictive defaults) |
| Community feed | Legal proposed view + restricted post |
| Mating / Paw / intro chat | **Hard blocked** (no parental override) |
| Meetups | **Hard blocked** |
| Open DMs | **Hard blocked** (none today — keep) |
| Location / proximity | **Off** |
| Supervision | **Required** parent link |

**Preferred consent flow:** Parent-initiated (adult verify → itemised Rule 3 notice → create teen → VPC audit **before** child data → teen signs in → parent dashboard).

Full memo: [PAW-70](/PAW/issues/PAW-70).

---

### 2. CTO (PAW-71) — Feasibility

**Verdict:** Blueprint is **technically feasible** on Supabase/RLS, with three hard prerequisites:
1. **Non-forgeable server account tier** (extends **PAW-53**) — clients must not self-SET adult/teen fields
2. **VPC vendor spike** before DigiLocker production work
3. **Founder authorization** before any teen schema in production

| Topic | Result |
|-------|--------|
| Server tier + RLS hard blocks (mating/meetups/chat) | Feasible — `assert_adult_features_ok`; note meetups currently **unguarded** for age |
| VPC audit log + DigiLocker | Schema feasible now; DigiLocker needs **vendor spike** (not drop-in RN OAuth) |
| Parent–child link | Feasible — separate auth users + `guardian_user_id` + supervision flag; parent-initiated preferred |
| Effort | Phase 2a design+spike **1.5–2.5 weeks**; Phase 2b 16+ pilot **6–8 weeks** (+2–4 vendor contingency) |

**Sequencing CTO recommends:** PAW-53 harden adult attestation (+ meetup age asserts) → Phase 2a design + vendor spike → Founder go/no-go → Phase 2b only if authorized.

**Do not** ship teen paths (even behind flags) without Founder auth + server hard blocks.

Full doc: [PAW-71](/PAW/issues/PAW-71) document `teen-account-feasibility`.

---

### 3. QA (PAW-72) — Child-safety advisory

**Verdict: VETO** of treating Legal’s **Phase 2b (16+ journal + pet + restricted community feed)** as child-safety-ready under PAW-70 gates alone.

**Aligned with Legal:** Stay 18+ now; hard-disable meetups/mating/chat/DMs for any under-18 tier; VPC before child data; server-authoritative tier.

**Additional blockers before any under-18 pilot:**
| # | Blocker |
|---|---------|
| B1 | Teen **feed posting** leaves caption/share/heart contact vectors; no parent-notified teen report pipeline; no AI scanning |
| B2 | Invite-only ≠ vetted adults — adult↔teen adjacency via view/heart remains |
| B3 | Teen media risk + Honesty **storage public SELECT** residual; need EXIF strip + private journal first |
| B4 | Adult-path age evasion — **PAW-53** must harden before any teen tier |
| B5 | Soft feed unlocks for 16–17 under-specified without adult visibility caps |

**QA plain answer:** Remain **18+** until B1–B4 designed and Founder-authorized. First discussable teen surface later = **supervised private journal only** (no community feed posting) — still not pre-approved. **13–15** out of horizon until 16+ private-journal proven.

Full review: [PAW-72](/PAW/issues/PAW-72).

---

### 4. Integrated recommendation for Founder

1. **No teen product work now.** Phase 1 stays 18+.
2. **Accept Legal’s hard blocks** (meetups / mating / chat) as non-negotiable for any future teen tier.
3. **Accept QA’s stricter first surface:** private supervised journal before any feed posting.
4. **Prioritize PAW-53** (non-forgeable adult attestation + meetup age asserts) as Phase 1 integrity + teen prerequisite.
5. **Teen track = future Founder decision only** after VPC vendor path + CURRENT.md re-authorization. Human India counsel required for VPC vendor/DPA.

No implementation. No commits. Store remains gated on **PAW-52**.

---

*Posted on PAW-7 for Founder review. Advisory only.*
