# PAWPLE — CURRENT FOUNDER AUTHORIZATION

STATUS: CURRENT
AUTHORITY: FOUNDER
CEO: READ ONLY
LAST UPDATED: 2026-08-30
WAVE: Correctness wave (3C + public meetup filtering + error/empty states)

The contents of this file define the Founder-authorized scope for the
current execution wave. The CEO must not modify this file.
Recommendations, observations, or proposed future work do not
constitute authorization unless explicitly included in a subsequent
CURRENT.md.

FOUNDER AUTHORIZATION — NEXT PAWPLE CORRECTNESS WAVE
FIXES 3C + FEED/PUBLIC MEETUP FILTERING + ERROR/EMPTY STATES

The previous CEO stocktake is complete.

Founder now AUTHORIZES implementation of ONLY the following three
narrowly scoped fixes:

1. Active-pet deletion integrity / Fix 3C
2. Only real, upcoming Meetups in public views
3. Honest error-vs-empty list states

CEO should orchestrate the appropriate specialist agents to implement,
test and verify these three fixes.

The CEO may delegate implementation to CTO / Frontend / Backend / QA as
appropriate.

Do not require Founder involvement for routine implementation steps within
these explicitly authorized scopes.

However, the CEO remains responsible for scope control and must stop any
work that expands beyond these three fixes.

============================================================
1. FIX 3C — ACTIVE-PET DELETION INTEGRITY
============================================================

Implement the minimal fix for the active-pet deletion crash identified in
the previous audit.

Requirements:

- After deleting the active pet, switch automatically to the user's next
  remaining pet.
- If it was the last pet, transition calmly to a no-pet state.
- Use the existing context's setPet function everywhere.
- Remove calls to the non-existent setActivePetId.
- On app start, validate the saved active pet against the user's actual
  pets.
- If the saved pet no longer exists, heal to the first remaining pet or
  no-pet state.
- Deleting a non-active pet must never change the active pet.
- Create Moment must never crash when there is no active pet.
- Show a calm one-line no-pet state.
- Never silently substitute another pet inside Create Moment.

Do not redesign active-pet architecture or storage.

Tests required:

- delete active pet with siblings;
- delete last pet;
- restart with stale active-pet storage;
- delete non-active pet;
- Create Moment with no pets.

============================================================
2. FIX — ONLY REAL, UPCOMING MEETUPS IN PUBLIC VIEWS
============================================================

Implement the minimum correction identified by the CEO audit.

Showable Meetup:

- status === 'upcoming'
- start time >= current time

Cancelled Meetups must never appear in public lists.

IMPORTANT BETA TIME RULE:

The rule "start time >= now" intentionally means that a Meetup disappears
from the Feed/public upcoming views at the moment its scheduled start time
is reached.

Therefore, a Meetup happening right now will NOT remain visible under this
rule.

This is intentional and ACCEPTED for the current beta because it keeps the
implementation simple.

Do NOT change this behavior during this ticket.

Record as a future product revisit only:

- Possible future "happening now / join us" visibility for Meetups already
  in progress, e.g. a Meetup taking place at a park where users may still
  join.

Do not implement that future behavior now.

Apply the current rule to:

A. Home Feed real Meetup fetch path.
   Verify the actual service function consumed by FeedScreen before
   changing it.

B. Public pet-profile hosted Meetup lists.

C. Audit public participated/going Meetup lists.
   If they exist, apply the same filter.
   If they do not exist, report that.

Rules:

- Counts remain unchanged.
- Counts continue to include completed Meetups.
- Counts exclude cancelled Meetups.
- My Meetups private Going/Hosting behavior remains unchanged.
- Do not change RSVP logic.
- Do not change RLS or triggers.
- Do not create RPCs.
- Do not introduce cron/sweeps.
- Keep the time comparison simple and client-side as specified.

Verify the actual fetch paths rather than assuming them.

============================================================
3. FIX — NEVER CONFUSE LOAD ERROR WITH EMPTY STATE
============================================================

Implement the minimum UI-state correction.

Apply to:

- Home Feed;
- My Meetups Going;
- My Meetups Hosting;
- public profile Meetup lists;
- other relevant list screens that currently expose an empty state.

Rules:

- Genuine empty result -> existing calm empty state.
- Load/database/network error -> calm retry state.
- Loading -> existing loading treatment.
- Do not create new queries.
- Where an existing service error is available, preserve and surface it
  rather than converting it into an empty result.
- If a screen currently discards the service error, wire the existing error
  through with the minimum change necessary.
- Use short, human, quiet copy consistent with .cursorrules.

Suggested copy:

"Couldn't load. Check your connection."

"Try again"

Do not introduce loud error UI or redesign these screens.

============================================================
STRICTLY OUT OF SCOPE / FROZEN
============================================================

Do NOT modify:

- Paw-T00y development invite behavior;
- the development invite bypass;
- the deferred 10-use mechanism;
- staging/production invite behavior;

- mating/matching;
- E3/E4/E5;
- any mating implementation;
- mating database/schema/RLS;
- mating discovery or matching logic;
- mating navigation;
- mating UI architecture;

- notifications;
- realtime;
- deep links;

- RSVP logic;
- meetup capacity logic;
- RLS;
- database schema;
- Supabase;
- Feed design/composition;
- navigation architecture;
- Product Contract;
- unrelated UI polish;
- unrelated authentication/OAuth work.

IMPORTANT MATING COPY PROTECTION:

The existing "Open to Companionship" wording and any mating-adjacent UI
copy are a Founder decision and MUST remain unchanged.

Do not rename, remove, rewrite, soften, expand, relocate, or otherwise
alter this copy as part of this wave.

It will become functional during the future mating implementation wave.

If any specialist believes this copy should change, record that as an
out-of-scope recommendation only.

Do not implement it.

Do not clean up unrelated working-tree changes.

Do not revert Founder/Cursor changes.

Do not commit or push.

============================================================
EXECUTION / AGENT SEQUENCING
============================================================

CEO must sequence the three fixes so that NO TWO SPECIALISTS MODIFY THE
SAME FILE AT THE SAME TIME.

Before assigning work:

1. Identify the likely files for each fix.
2. Check for overlap.
3. If two fixes require the same file, sequence them rather than allowing
   concurrent edits.
4. A later specialist must work from the earlier specialist's resulting
   state.
5. CEO must review the combined result for unintended interactions.

Parallel work is acceptable ONLY when specialists are working on disjoint
files and cannot conflict.

If file ownership becomes ambiguous, CEO decides the safe sequence or
serializes the work.

============================================================
OUT-OF-SCOPE DISCOVERIES
============================================================

During implementation, specialists may discover additional issues.

Do NOT fix those issues unless they are required to complete one of the
three explicitly authorized fixes.

Record every such observation as:

OUT-OF-SCOPE OBSERVATION / RECOMMENDATION

Include it in the final report.

Do not silently expand scope.

============================================================
QA FINAL GATE
============================================================

Before the completion report is issued, the QA Auditor must perform a
FINAL READ-ONLY SCOPE CHECK of the COMBINED DIFF produced by this wave.

The QA Auditor must verify:

- only the three authorized fixes were implemented;
- no frozen area was modified;
- Paw-T00y remains unchanged;
- "Open to Companionship" and other mating-adjacent copy remain unchanged;
- no notification work was introduced;
- no mating work was introduced;
- no database/Supabase/RLS changes were introduced;
- no unrelated working-tree changes were modified;
- no unauthorized navigation/design changes were introduced;
- tests/verification are consistent with the reported changes.

The QA Auditor must explicitly:

- SIGN OFF if the combined diff is within scope and correct; OR
- VETO if scope or correctness is unacceptable.

QA cannot override the Founder.

If the environment prevents material verification, state exactly
what could not be verified and why. The Founder decides whether to
accept the residual risk. QA does not invent conditional sign-offs.

A QA VETO returns the work to the responsible specialist for correction.

A CEO override of a QA veto requires EXPLICIT FOUNDER APPROVAL.

The CEO must not override a QA veto independently.

The final completion report must include the QA Auditor's sign-off.

============================================================
VERIFICATION REQUIRED
============================================================

Before declaring the wave complete, run the relevant tests and report:

1. Files changed.
2. Root cause of each original issue.
3. Exact implementation for each fix.
4. Tests run and results.
5. Any tests skipped and why.
6. Confirmation active-pet deletion no longer crashes.
7. Confirmation stale active-pet state heals on restart.
8. Confirmation deleting a non-active pet leaves the active pet unchanged.
9. Confirmation Create Moment handles no-pet state without crashing.
10. Confirmation Feed/public lists contain only real, non-cancelled,
    non-past/upcoming Meetups.
11. Confirmation the agreed beta time rule is applied:
    start time >= now.
12. Confirmation counts were not changed.
13. Confirmation private My Meetups behavior was not changed.
14. Confirmation genuine empty and load-error states are distinguishable.
15. Confirmation Paw-T00y was untouched.
16. Confirmation "Open to Companionship" and mating-adjacent copy were
    untouched.
17. Confirmation mating/matching was untouched.
18. Confirmation notifications were untouched.
19. Confirmation no unrelated working-tree changes were modified.
20. Confirmation no database/Supabase changes were made.
21. Confirmation no commit/push occurred.
22. QA Auditor final scope check result.
23. QA Auditor sign-off or veto.
24. List of ALL out-of-scope observations recorded during the wave,
    as recommendations only.

CEO should return ONE consolidated completion report.

============================================================
FINAL AUTHORITY
============================================================

This Founder authorization applies ONLY to the three fixes explicitly
listed above.

The CEO may orchestrate and approve routine implementation within this
authorized scope.

The CEO may NOT authorize expansion into frozen areas.

Any new product, architecture, schema, mating, notification,
authentication, navigation, design-system, or other material decision
outside these three fixes must return to Founder for approval.

Founder retains final authority over all such decisions.

