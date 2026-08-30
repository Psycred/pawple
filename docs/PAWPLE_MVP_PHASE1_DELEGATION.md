# Pawple MVP — Phase 1 Delegation (Founder Approved 28 Aug 2026)

**Parent:** PAW-7  
**Plan:** `docs/PAWPLE_BETA_MVP_EXECUTION_PLAN.md` (Paperclip plan rev 4)  
**Founder directive:** Preserve existing working implementation. No unnecessary rewrites. Mating must be pet-centric and distinctly Pawple — not dating-app patterns.

## Phase 1 critical path (start immediately)

| Issue | Workstream | Owner | Depends on |
|-------|------------|-------|------------|
| PAW-4 | A1 Backend/data audit | Backend / Data Engineer | — |
| PAW-9 | A5 Account deletion RPC | Backend / Data Engineer | PAW-4 findings |
| PAW-10 | B1 Google + Apple OAuth | Frontend Engineer | — |
| PAW-11 | C1 Disable demo injection (prod/staging) | Frontend Engineer | — |
| PAW-12 | B3–B5 Invite + onboarding contract | Frontend + Backend | PAW-10 |
| PAW-13 | E2 Mating mental model spec | CEO → Founder review | **done** — canonical: `docs/PAWPLE_MATING_DISCOVERY_SPEC.md` |
| PAW-14 | F1 Notification copy honesty | Frontend Engineer | — |
| PAW-15 | CTO Phase 1 sequencing + A2 env plan | CTO | PAW-4 findings |

## Dependencies recorded

- **PAW-12** blocked by **PAW-10** (invite contract requires real OAuth sessions)
- **PAW-9** should follow **PAW-4** audit findings

- **A2** Environment config → CTO (after PAW-4)
- **A6** Export RPC → Backend (after PAW-4)
- **E3/E3b/E4** Mating supply layer → after PAW-13 approved
- **E5/E6** Discovery UI → after E2 approved + eligible candidates exist

## Preservation principle

Extend and correct the current codebase. Do not replace working meetup, moment, pet, or navigation architecture unless audit proves contract violation.
