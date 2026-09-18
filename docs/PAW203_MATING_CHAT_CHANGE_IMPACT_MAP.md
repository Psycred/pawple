# PAW-203 — Mating Match + Chat Change Impact Map

**Authority:** Founder `f67e783b` on PAW-195; `docs/CURRENT.md`; `docs/PAW195_MATING_CHAT_REPAIR_WAVE.md`  
**Author:** CTO  
**Date:** 2026-09-06 (retention truth addendum same day)  
**Issue:** PAW-203  
**Scope:** Architecture and pre-implementation map only. No product UI implementation in this ticket.  
**Production gate:** `EXPOSE_MATING_SURFACES` remains `false`. Do not commit it true.

This is the official file-by-file map for the Mating Match + Chat **repair** wave.  
PAW-207 (Backend) and PAW-208 (Frontend) implement only what this document authorizes.

---

## 1. Verdict

Recover and repair. Do not rebuild.

Mating Match and introduction chat already exist as schema, RPCs, RLS, triggers, client service, and screens. They are hidden, not missing. The wave completes Founder product behaviour **behind a controlled non-production path**.

| Surface | Repo truth | This wave |
|---------|------------|-----------|
| Discovery / Paw / mutual unlock | Present; server-authoritative | Repair filters + 100 km client align |
| Introduction chat thread | Present; poll; link/report/block | Header + reuse |
| Chat list / inbox | Absent | Isolated new screen + parent list RPC |
| Bottom nav | Feed / Create / Pets | Conditional Discover/Match + Chat (Founder-pre-authorized) |
| Production visibility | Hidden | Stays hidden |

---

## 2. Controlled Tester / QA path (binding mechanism)

**Name:** `areMatingSurfacesVisible()` overlay + `EXPO_PUBLIC_MATING_TEST_SURFACES`

**Do not flip `EXPOSE_MATING_SURFACES`.** That constant stays hardcoded `false` in `src/config/phase1aSurfaces.js`. It is the production hide lock. It is not the Tester path.

### Exact mechanism

Add **one** helper in `src/config/phase1aSurfaces.js` (name locked):

```js
export const EXPOSE_MATING_SURFACES = false; // production lock — never commit true

export function areMatingSurfacesVisible() {
  if (pawpleEnv === 'production') return false;
  if (EXPOSE_MATING_SURFACES) return true; // reserved; stays false on main
  return (
    process.env.EXPO_PUBLIC_MATING_TEST_SURFACES === '1' &&
    (isLocalDevRuntime || isStaging)
  );
}
```

Import `pawpleEnv`, `isLocalDevRuntime` (`__DEV__`), and `isStaging` from `src/config/environment.js`. Do not add new environment modules.

### Fail-closed rules

| Build | Result |
|-------|--------|
| Production EAS (`EXPO_PUBLIC_PAWPLE_ENV=production`) | Always hidden, even if the test env var is leaked |
| Staging EAS (`__DEV__=false`, `pawpleEnv=staging`) | Visible only if **that build** was created with `EXPO_PUBLIC_MATING_TEST_SURFACES=1` |
| Local Metro / debug (`__DEV__=true`) | Visible only if `.env.development` sets `EXPO_PUBLIC_MATING_TEST_SURFACES=1` |
| Any other combination | Hidden |

### What is committed vs what is not

| Item | Commit? |
|------|---------|
| `EXPOSE_MATING_SURFACES = false` | Yes — stays false |
| `areMatingSurfacesVisible()` helper | Yes |
| Replace UI/nav/route reads of the raw constant with the helper | Yes |
| `EXPO_PUBLIC_MATING_TEST_SURFACES` in `eas.json` | **No** — never in development, staging, or production profiles |
| `EXPO_PUBLIC_MATING_TEST_SURFACES=1` in any committed `.env*` | **No** |
| Commented documentation in `.env.development.example` / `.env.staging.example` | Yes — unset / commented |

### How Tester / QA turn it on

1. **Local device / emulator (primary Tester path):** copy `.env.development.example` → `.env.development` (already gitignored). Add `EXPO_PUBLIC_MATING_TEST_SURFACES=1`. Restart Metro. Production gate remains false.
2. **Staging internal build (QA device path):** set `EXPO_PUBLIC_MATING_TEST_SURFACES=1` as an **EAS secret / local uncommitted build env** for a dedicated Tester/QA staging binary. Do not add it to committed `eas.json`. Ordinary staging users without that build stay hidden.
3. **Backend / RLS (no UI):** `scripts/rls-security-tests.js` against local or staging Supabase with synthetic accounts. Does not require the UI helper.

### Static guard

`scripts/verify-environment-config.js` must assert:

- `EXPOSE_MATING_SURFACES = false` is still present in `phase1aSurfaces.js`
- committed `eas.json` profiles do **not** contain `EXPO_PUBLIC_MATING_TEST_SURFACES`

UI hide is not authorization. RLS / RPCs remain the security boundary.

---

## 3. Technical approach (six Founder repairs)

### 3.1 Fixed 100 km — client / server align; picker dormant

**Server (already true):** `get_mating_opportunities` / `express_paw` hardcode `v_radius = 100`. Column CHECK is `mating_discovery_radius_km = 100`. Do not reopen user-selected radius. Do not edit historical migrations.

**Client repair:**

- Add `PHASE1A_MATING_RADIUS_KM = 100` in `src/services/mating.js`.
- Keep `MATING_RADIUS_KM_OPTIONS = [5, 10, 25, 50]`, `DEFAULT_MATING_RADIUS_KM`, `fetchMatingRadiusKm`, `updateMatingRadiusKm` in source. **Do not delete.**
- Add `SHOW_MATING_RADIUS_PICKER = false`. MatingSection distance row / sheet must not render as a product choice.
- Discovery empty copy must say **100 km**, not interpolate `fetchMatingRadiusKm()` (today defaults to 25 and would lie).
- Do not call `updateMatingRadiusKm(5|10|25|50)` from UI. Those writes fail the live CHECK.

### 3.2 Exclude already-matched pairs from discovery

`mating_eligible_pair` and `get_mating_opportunities` do **not** currently exclude mutual Paw. A matched pair can still appear in discovery.

**Repair (new migration, replace function body only):**

In `get_mating_opportunities`, after eligibility:

```
AND NOT public.pets_have_mutual_paw(v_viewer.id, c.id)
```

That is “open mutual-Paw introduction” in this model: mutual Paw is what opens the channel; freeze/unmatch clears mutuality.

After unmatch or companionship OFF (mutuality gone), the pair may reappear if still eligible. No new matching criteria. No swipe/hide/score.

### 3.3 Pet-pair chat list for the logged-in parent

No inbox exists. Client can SELECT own channels via RLS, but cannot compute `~km` (coords are not client-selectable).

**Backend — new RPC only** (do not invent a chat server):

`list_my_introduction_channels()`

- `SECURITY DEFINER`, `auth.uid()` required
- `GRANT EXECUTE` to `authenticated` only; `REVOKE` from `PUBLIC` / `anon`
- Returns rows where caller is `owner_low_id` or `owner_high_id` **and** `status = 'open'`
- Columns: `channel_id`, `pet_low_id`, `pet_high_id`, pet names, pet photo urls, `opened_at`, `distance_km` (rounded approximate, never lat/lng)
- No human names, no message bodies, no unread counts
- Client never INSERTs channels

**Frontend:** new isolated screen `src/screens/MatingChatListScreen.js`. Conversation screen stays `MatingIntroductionChatScreen`. Header becomes `Pet A ↔ Pet B · ~km` (pass names + `distance_km` as route params from the list; no owner display names).

### 3.4 Companionship OFF → that pet unmatched; its chats removed; others untouched

**Existing trigger** `mating_on_pet_opt_out`: deletes **outbound** Paws for that pet; freezes that pet’s open channels with `opt_out`. Inbound Paws retained. Other pets’ rows are already out of scope (`NEW.id` only).

**CTO lock (how “removed” is implemented):**

| Layer | Behaviour |
|-------|-----------|
| Unmatch | Keep outbound-Paw delete (existing). Mutuality ends. Pair can return to discovery if still eligible. |
| Chat product | Frozen + **excluded from `list_my_introduction_channels`**. Compose already denied by RLS (`status = 'open'`). Thread is gone from Chat. |
| Other pets | Untouched. Trigger stays scoped to the opted-out pet id. |
| Physical DELETE of channel/message rows | **Not in this wave.** Freeze-and-hide is “removed” for the parent. History remains for report evidence and rematch `ON CONFLICT` reopen. Do not claim “never saved.” |
| Inbound Paw rows | Keep (existing evidence quieting). Interest SELECT already requires the target still opted in. |

If Legal later requires physical wipe, that is a new Founder-authorized migration. Do not do it here.

Written answers for Legal (retention, counterpart read, TTL, export, age/hide confirmations): **§10**.

Frontend: confirmation copy is Copy/Legal. After OFF, refresh Chat list and tab visibility. Do not invent a second delete API.

### 3.5 Live helper GRANT repair

Live anon EXECUTE reached `mating_eligible_pair`, `pets_have_mutual_paw`, and `assert_mating_age_ok` (PAW-199). Repo intended the first two locked down as non-client APIs (`mating_eligible_pair` already `REVOKE`d from PUBLIC in repo; live drifted).

**New migration (GRANT/REVOKE + fail-closed body only):**

| Function | Repair |
|----------|--------|
| `mating_eligible_pair` | `REVOKE ALL` from `PUBLIC`, `anon`, `authenticated`. No client GRANT. Internal SECURITY DEFINER callers only. |
| `assert_mating_age_ok` | Same revoke. Internal only. |
| `pets_have_mutual_paw` | `REVOKE ALL` from `PUBLIC`, `anon`. Keep `GRANT EXECUTE` to `authenticated` + `service_role` (RLS + existing client mutual check). Body: if `auth.uid() IS NULL` then return `false` (blocks anon even if GRANT drifts again). Do **not** add a participant predicate this wave — RLS and triggers call this helper; a participant check risks breaking freeze/reopen. |

Do not change helper eligibility math. Do not weaken table RLS.

### 3.6 Matched-pair isolation

Already present: unique ordered pair; channel INSERT denied to clients; message SELECT/INSERT limited to participants; open + mutual + adult + no-block on INSERT; third parties have no policy path.

**This wave:** prove it, do not redesign it.

- List RPC must only return caller channels.
- RLS suite: user C cannot SELECT or INSERT on A–B channel.
- No shared inbox table. No cross-pair leak in the new list RPC.

---

## 4. File-by-file impact map

Each row is the Founder 9-field set.

### 4.1 `src/config/phase1aSurfaces.js`

| Field | Content |
|-------|---------|
| **Path** | `src/config/phase1aSurfaces.js` |
| **Why** | Production hide lock + controlled overlay. Single visibility predicate. |
| **Existing behaviour** | `EXPOSE_MATING_SURFACES = false`. Comment states it is UI-only, not authorization. |
| **Previously working?** | Yes as a hide. No Tester path. |
| **Section** | Controlled path |
| **Proposed change** | Keep constant false. Add `areMatingSurfacesVisible()` per §2. |
| **What stays** | Constant false; mating code preserved. |
| **Regression risk** | Accidental true constant; production env ignoring fail-closed. Mitigate with verify script. |
| **QA / Tester verify** | Production-shaped env → helper false. Dev + flag `1` → true. Staging + flag `1` → true. Staging without flag → false. Constant still `false` on disk. |

### 4.2 `App.js`

| Field | Content |
|-------|---------|
| **Path** | `App.js` |
| **Why** | Stack registration is the hide. Chat list needs a gated route. Founder-pre-authorized for gated stack register only. |
| **Existing behaviour** | `MatingDiscoveryScreen` and `MatingIntroductionChatScreen` registered only when `EXPOSE_MATING_SURFACES`. |
| **Previously working?** | Yes when the constant was true (pre-hide wave). |
| **Section** | Navigation / gate |
| **Proposed change** | Swap predicate to `areMatingSurfacesVisible()`. Register `MatingChatListScreen` behind the same helper. Do not register when helper is false. |
| **What stays** | All other stack screens; animation options; no Feed/Meetup route edits. |
| **Regression risk** | Routes leaking when helper is false; navigation to unregistered names. Fail closed: no register → no navigate. |
| **QA / Tester verify** | Flag off: deep-link / navigate to mating route names is a no-op / not in navigator. Flag on: three mating routes exist. Production binary: none. |

### 4.3 `src/navigation/BottomTabNavigator.js`

| Field | Content |
|-------|---------|
| **Path** | `src/navigation/BottomTabNavigator.js` |
| **Why** | Founder §6.6 conditional nav. Pre-authorized. |
| **Existing behaviour** | Feed / Create / Pets. Pets tab uses paw icon + name. No Discover. No Chat. |
| **Previously working?** | Yes for Bulletin Board tabs. Mating tabs never shipped on this bar. |
| **Section** | Navigation |
| **Proposed change** | When helper is true: Discover/Match tab if **any owned pet** has `is_looking_for_companion`; Chat tab if parent has **≥1 open** channel (`list_my_introduction_channels` length or equivalent count). Reuse existing paw icon for Discover/Match. Chat: `mew` bubble (Designer asset when delivered; until then a quiet non-emoji placeholder — not a system paw). Far-right Pets tab: active pet **photo** (extend the existing name query to `photo_url`), not the paw. When helper is false: **identical** to today’s three tabs. |
| **What stays** | Route names `FeedScreen`, `CreateHub`, `PetsScreen`. Tab geometry tokens. Feed and Create implementations untouched. |
| **Regression risk** | Extra tabs in production; Feed/Create broken; Pets label/photo flicker. Helper false must pixel-match current bar. |
| **QA / Tester verify** | Production / flag off: 3 tabs, paw on Pets. Flag on + no companionship: 3 tabs. Flag on + companionship, no chats: Discover appears, Chat does not. After first mutual open channel: Chat appears. Opt-off last companion pet: Discover and that pet’s chats gone; other pets’ chats remain; Chat tab only if another open channel exists. |

### 4.4 `src/services/mating.js`

| Field | Content |
|-------|---------|
| **Path** | `src/services/mating.js` |
| **Why** | Client contract for radius, list, distance labels. |
| **Existing behaviour** | Opportunities, express/withdraw, inbound, mutual, pair/channel/message helpers. Radius options 5/10/25/50, default 25. `formatDistanceKm` honest `~N km`. Chat disclaimer string in-file. |
| **Previously working?** | Yes except radius drift vs server 100. No parent list helper. |
| **Section** | Client service |
| **Proposed change** | Add `PHASE1A_MATING_RADIUS_KM = 100`, `SHOW_MATING_RADIUS_PICKER = false`. Add `fetchMyIntroductionChannels()` → `list_my_introduction_channels`. Keep dormant radius writers. Do not add Realtime or push. |
| **What stays** | RPC names, SELECT-only channels, link guard, age assert, Paw helpers. |
| **Regression risk** | Calling radius UPDATE from new UI; exposing coords; creating channels from client. Forbidden. |
| **QA / Tester verify** | List returns only caller open channels, pet names + `~km`, no human names. Radius UPDATE not invoked on load. Link send still client-blocked. |

### 4.5 `src/screens/MatingDiscoveryScreen.js`

| Field | Content |
|-------|---------|
| **Path** | `src/screens/MatingDiscoveryScreen.js` |
| **Why** | Potential matches only; honest empty / distance. |
| **Existing behaviour** | List-only. Loads opportunities for opted-in owned pet. Empty copy interpolates client `radiusKm` (default 25). Silent empty when server returns `[]` (includes stale location). |
| **Previously working?** | Yes as a list. Empty copy is dishonest vs 100 km. |
| **Section** | Discover / Match |
| **Proposed change** | Stop fetching client radius for copy. Use 100 km in empty text. Do not client-filter matched pairs (server excludes). If opted in and location not fresh, show a **stale-location** empty, not “nobody nearby.” Context via new tiny RPC `get_mating_discovery_context(viewer_pet_id)` → `{ opted_in, location_fresh }` (no coords). No swipe deck. No 18+ banner. |
| **What stays** | Orient header, `MatingExploreRow`, navigate to `ViewPetProfileScreen` with `viewerPetId`. |
| **Regression risk** | Treating stale `[]` as no matches; showing picker; showing matched pets. |
| **QA / Tester verify** | Matched pair absent from list. After unmatch, eligible pair can return. Stale location: honest empty. Fresh + none: “nothing within 100 km.” Distance labels `~N km` only. |

### 4.6 `src/screens/MatingIntroductionChatScreen.js`

| Field | Content |
|-------|---------|
| **Path** | `src/screens/MatingIntroductionChatScreen.js` |
| **Why** | Reuse the thread. Founder header. Keep safety. |
| **Existing behaviour** | Title `Introduction · {otherPetName}`. 8s poll. Disclaimer modal (AsyncStorage ack). Link guard. Report/block. Compose fails closed when frozen. |
| **Previously working?** | Yes as a pair thread. Header is not `Pet A ↔ Pet B · ~km`. |
| **Section** | Chat thread |
| **Proposed change** | Header: `Pet A ↔ Pet B · ~km` (both pet names + `formatDistanceKm`; never owner names). Accept route params from the list. Keep poll. Keep link/report/block. First-open disclaimer: keep current string until Legal/Copy deliver a canonical replacement; then swap import only. No 18+ banner. No media. No Realtime. |
| **What stays** | Channel SELECT by id; message INSERT path; frozen UI; DISCLAIMER_KEY. |
| **Regression risk** | Showing human names; losing link block; push/Realtime add. |
| **QA / Tester verify** | Header pets only + honest `~km` or omit if null. URL/bare domain rejected. Phone allowed. Frozen: no send. Third user cannot open. |

### 4.7 `src/screens/MatingChatListScreen.js` (new)

| Field | Content |
|-------|---------|
| **Path** | `src/screens/MatingChatListScreen.js` |
| **Why** | Founder dedicated Chat page for the logged-in parent’s pet-pair threads. Isolated addition — preferred over stuffing Feed or Profile. |
| **Existing behaviour** | Does not exist. Entry today is view-profile only. |
| **Previously working?** | No list. Thread existed. |
| **Section** | Chat list |
| **Proposed change** | Parent-level list of **open** channels. Rows: pet pair names + `~km`. No human names. No unread badges. Tap → existing thread screen. Empty: quiet “No introductions yet.” Gated register only. |
| **What stays** | No generic DM inbox; no meetup chat. |
| **Regression risk** | Showing frozen/opt-out threads; leaking other parents’ channels; human names. |
| **QA / Tester verify** | Only caller open pairs. Opt-off pet X: X’s rows gone; pet Y’s rows remain. Production: screen unregistered. |

### 4.8 `src/components/MatingSection.js`

| Field | Content |
|-------|---------|
| **Path** | `src/components/MatingSection.js` |
| **Why** | Restore Open to Companionship; hide live radius picker. |
| **Existing behaviour** | Toggle, “About mating” text, **live** Distance row opening 5/10/25/50 sheet, explore link, inbound interest + report/block. |
| **Previously working?** | Yes. Picker conflicts with server 100 / CHECK. |
| **Section** | Profile mating (owner) |
| **Proposed change** | Keep toggle. Wrap radius row/sheet so it does not render (`SHOW_MATING_RADIUS_PICKER`). **Do not delete** picker code. No extra Yes/No. No 18+ banner. Confirmation on OFF is Copy/Legal when they deliver; until then keep the existing immediate toggle (server already fail-closes under-18). |
| **What stays** | Inbound interest, explore link, description field, safety menus. |
| **Regression risk** | Picker still writable; Profile restructure (forbidden). |
| **QA / Tester verify** | Toggle on → Discover can appear. Toggle off → that pet unmatched; its chats gone. No distance sheet. Under-18 opt-in fails closed (server). |

### 4.9 `src/screens/PetProfileScreen.js`

| Field | Content |
|-------|---------|
| **Path** | `src/screens/PetProfileScreen.js` |
| **Why** | Existing owner MatingSection mount. Working profile — **minimal, necessary**. |
| **Existing behaviour** | MatingSection, read-only “About mating”, companion badge all gated on raw `EXPOSE_MATING_SURFACES`. |
| **Previously working?** | Yes when exposed. |
| **Section** | Profile |
| **Proposed change** | Swap to `areMatingSurfacesVisible()`. Toggle-only restore via existing MatingSection. **No layout restructure.** Do not retitle “About mating” unless Copy delivers. |
| **What stays** | Journal/About, details card, Community counts, meetup section. |
| **Regression risk** | Profile layout drift; Community section edits. |
| **QA / Tester verify** | Flag off: no MatingSection, no companion badge. Flag on + owner: toggle visible, rest of About unchanged. |

### 4.10 `src/screens/EditPetScreen.js`

| Field | Content |
|-------|---------|
| **Path** | `src/screens/EditPetScreen.js` |
| **Why** | Existing second toggle (`PetCompanionCommunitySection showToggle`). Gate swap only. |
| **Existing behaviour** | `showToggle={EXPOSE_MATING_SURFACES}`. Community counts always shown. |
| **Previously working?** | Yes when exposed. |
| **Section** | Edit pet |
| **Proposed change** | `showToggle={areMatingSurfacesVisible()}`. No form redesign. No new fields. |
| **What stays** | Traits, photos, save/delete, community counts. |
| **Regression risk** | Touching unrelated edit fields. |
| **QA / Tester verify** | Flag off: no toggle. Flag on: toggle only. Community Hosted/Joined unchanged. |

### 4.11 `src/screens/ViewPetProfileScreen.js`

| Field | Content |
|-------|---------|
| **Path** | `src/screens/ViewPetProfileScreen.js` |
| **Why** | Paw + introduction CTA already exist here. |
| **Existing behaviour** | Skips Paw/channel fetches when hidden. Paw, intro CTA, frozen state, mating copy all raw-gated. |
| **Previously working?** | Yes when exposed. |
| **Section** | Viewed pet |
| **Proposed change** | Swap to helper. Keep Paw on viewed profile (not on discovery rows). After mutual Paw, pair leaves discovery (server) and lives in Chat. Intro CTA may open thread **or** list — prefer existing thread navigation. No human names. |
| **What stays** | Report/block, profile fetch, non-mating profile body. |
| **Regression risk** | Fetching mating state when helper false; Paw on list rows. |
| **QA / Tester verify** | Flag off: no Paw, no intro CTA, no mating fetches. Mutual Paw → channel opens; pair gone from Discover. |

### 4.12 `src/components/MatingExploreRow.js`

| Field | Content |
|-------|---------|
| **Path** | `src/components/MatingExploreRow.js` |
| **Why** | Discovery / interest row. Already uses `formatDistanceKm`. |
| **Existing behaviour** | Navigate only; no row Paw; `~km` when present. |
| **Previously working?** | Yes. |
| **Section** | Discover / Match |
| **Proposed change** | **None** unless distance/name rendering is broken. Do not add Paw. |
| **What stays** | Entire component. |
| **Regression risk** | Accidental row actions. |
| **QA / Tester verify** | Tap opens profile. Distance `~N km` or omitted. No Paw on the row. |

### 4.13 `src/components/MatingPawButton.js`

| Field | Content |
|-------|---------|
| **Path** | `src/components/MatingPawButton.js` |
| **Why** | Existing Paw control. |
| **Existing behaviour** | Sage pulse Paw. Used from viewed profile. |
| **Previously working?** | Yes. |
| **Section** | Discover / Match |
| **Proposed change** | **None.** |
| **What stays** | Entire component. |
| **Regression risk** | Feed-heart behaviour bleed (do not). |
| **QA / Tester verify** | Still only on viewed profile when helper true. |

### 4.14 `src/components/PetCompanionCommunitySection.js`

| Field | Content |
|-------|---------|
| **Path** | `src/components/PetCompanionCommunitySection.js` |
| **Why** | Edit-pet toggle host. Already implements the switch. |
| **Existing behaviour** | `showToggle` optional; Community Hosted/Joined. |
| **Previously working?** | Yes. |
| **Section** | Edit pet |
| **Proposed change** | **None.** Parent passes the helper. Do not restyle Community. |
| **What stays** | Entire component. |
| **Regression risk** | Community count edits (forbidden opportunistic cleanup). |
| **QA / Tester verify** | Community stats unchanged. |

### 4.15 New migration (Backend)

| Field | Content |
|-------|---------|
| **Path** | `supabase/migrations/<timestamp>_mating_chat_repair_wave.sql` (**new file only**) |
| **Why** | Discovery exclude; list RPC; discovery context; GRANT repair; opt-out remains freeze-and-hide. |
| **Existing behaviour** | Historical `20260830200000_*` and `20260831100000_*` already define tables, triggers, 100 km RPCs. |
| **Previously working?** | Core path yes. Exclude-matched no. List RPC no. Live GRANTs drifted. |
| **Section** | Backend / SQL |
| **Proposed change** | `CREATE OR REPLACE` `get_mating_opportunities` with mutual-Paw exclusion (keep 100 km). Add `list_my_introduction_channels` and `get_mating_discovery_context`. GRANT/REVOKE per §3.5. `pets_have_mutual_paw` null-uid fail-closed. **Do not edit** already-applied migration files. **Do not DELETE** message rows on opt-out. |
| **What stays** | Tables, RLS policies, link trigger, adult trigger, express/withdraw, freeze/reopen, export/delete coverage. |
| **Regression risk** | Weakening RLS; granting helpers to anon; radius CHECK change; location rewrite. |
| **QA / Tester verify** | Anon EXECUTE on helpers fails. Authenticated discovery omits mutual pairs. List isolation. Opt-out freezes + list omits that pet; sibling pet channels remain. RLS: C cannot read A–B. Link still rejected. |

### 4.16 `scripts/rls-security-tests.js`

| Field | Content |
|-------|---------|
| **Path** | `scripts/rls-security-tests.js` |
| **Why** | Controlled server path. Current mating section covers channel open + link/phone only. |
| **Existing behaviour** | Mutual Paw → channel; URL/bare domain reject; phone/plain allow. Does not cover discovery, 100 km, exclude-matched, stale location, opt-out list, GRANTs, third-party isolation. |
| **Previously working?** | Partial. Fixture may set location for one user only. |
| **Section** | QA / Backend verification |
| **Proposed change** | Extend **mating section only**: both fixtures get fresh coarse location; discovery 100 km; exclude mutual; list isolation; anon helper deny; opt-out freeze + list omission; unauthorized message INSERT deny. Do not rewrite meetup/honesty cases. |
| **What stays** | Existing link-guard cases; non-mating suites. |
| **Regression risk** | Flaky fixtures; using production user data. Synthetic accounts only. |
| **QA / Tester verify** | Suite green on local/staging. Not a production gate flip. |

### 4.17 `scripts/verify-environment-config.js`

| Field | Content |
|-------|---------|
| **Path** | `scripts/verify-environment-config.js` |
| **Why** | Prevent committed production expose. |
| **Existing behaviour** | Checks Supabase env-driven config and EAS `EXPO_PUBLIC_PAWPLE_ENV`. |
| **Previously working?** | Yes for env contract. |
| **Section** | Controlled path |
| **Proposed change** | Assert hide constant still false; assert `eas.json` has no `EXPO_PUBLIC_MATING_TEST_SURFACES`. |
| **What stays** | Existing asserts. |
| **Regression risk** | None material. |
| **QA / Tester verify** | `node scripts/verify-environment-config.js` passes on main. |

### 4.18 `.env.development.example` and `.env.staging.example`

| Field | Content |
|-------|---------|
| **Path** | `.env.development.example`, `.env.staging.example` |
| **Why** | Document the Tester flag without enabling it. |
| **Existing behaviour** | Env + Supabase placeholders. |
| **Previously working?** | Yes. |
| **Section** | Controlled path |
| **Proposed change** | Commented line: `# EXPO_PUBLIC_MATING_TEST_SURFACES=1` plus one-line note: local/staging Tester builds only; never production; never commit a live `.env` with it set. |
| **What stays** | Existing keys. `.env.production.example` **untouched** (no flag mentioned). |
| **Regression risk** | Committing a filled `.env`. Gitignore must keep real `.env.development`. |
| **QA / Tester verify** | Examples do not set the flag to `1` as active config. Production example has no flag. |

### 4.19 `src/content/legalDocuments.js` — Legal-owned, not Frontend-now

| Field | Content |
|-------|---------|
| **Path** | `src/content/legalDocuments.js` |
| **Why** | Dormant mating sections exist; live Terms omit messaging. |
| **Existing behaviour** | Live launch copy says no in-app messaging. Dormant mating/chat blocks are unattached. |
| **Previously working?** | Honest for hidden Phase 1a. |
| **Section** | Legal |
| **Proposed change** | **Do not touch in PAW-207/208.** Re-attach only when Legal says. Controlled Tester path does not rewrite live Terms. Frontend keeps `MATING_CHAT_DISCLAIMER` until Legal/Copy deliver one string. |
| **What stays** | Entire file. |
| **Regression risk** | Live Terms claiming chat exists for normal users. |
| **QA / Tester verify** | Production/legal surfaces still omit mating. Tester UI may show in-app disclaimer only. |

---

## 5. STOP list

Do **not** touch unless a later Founder §17 pack says so. If implementation discovers a genuine need, **STOP** and report to CEO for Founder approval.

### 5.1 Protected / frozen working files

- `src/lib/onboardingInvite.js`
- `src/screens/InviteCodeScreen.js`
- `src/components/InviteSheet.js`
- Feed: `src/screens/FeedScreen.js`, `src/components/MomentCard.js`, `src/components/MeetupCard.js`
- Create Moment / Create Meetup screens
- Meetup RSVP / bulletin: `src/services/meetups.js`, `src/screens/MeetupDetailsScreen.js`, `src/screens/MyMeetupsScreen.js`, `src/components/MeetupPetJoinSheet.js`, `src/data/demoMeetupRsvp.js`
- Onboarding: Welcome, Auth, AgeGate, UnderAgeDecline, OnboardingUser, OnboardingPets, OnboardingFinal
- Delete-account: `src/lib/deleteAccount.js`, `src/components/AccountLifecycleModal.js`, delete-account migrations
- Honesty RLS migrations unrelated to mating GRANT repair
- Location architecture: `src/lib/cityFromLocation.js`, `src/lib/profileLocation.js`, `src/lib/viewerFeedLocation.js`, `src/lib/locationUtils.js` (if present)
- Notifications: `src/lib/notifications.js`, `src/lib/meetupLocalNotifications.js`
- `src/content/legalDocuments.js` (until Legal)
- `.env.production.example`
- `eas.json` env blocks (do not add the Tester flag)

### 5.2 Mating-adjacent files that stay untouched this wave

- Historical migrations `20260830200000_mating_paw_interest_chat.sql`, `20260831100000_mating_fixed_100km_radius.sql` (replace via **new** migration only)
- `src/services/pets.js` — `updatePetCompanionDiscovery` already exists
- `src/services/reports.js`, `src/services/blocks.js`
- `src/lib/introChatLinkGuard.js` — keep; do not “improve”
- `src/lib/ageGate.js` — under-18 remains server-fail-closed; no new 18+ UI
- `src/navigation/MainTabs.js` — re-export only
- `src/config/environment.js` — import existing flags only; no new demo gates
- `src/config/supabase.js`

### 5.3 Founder-pre-authorized cross-module (only these)

- `src/navigation/BottomTabNavigator.js`
- `App.js` — gated stack register only

Any other working-file need (Feed, Create, invite, bulletin RSVP, onboarding, delete-account, location rewrite) → **STOP**.

---

## 6. Security

Do not weaken RLS, GRANT surface, or storage policies.

### Material issues (reported; not a wave stop)

1. **Live helper EXECUTE drift** — anon reached internal helpers. This wave **repairs** it (§3.5). Backend must verify live after apply. Treat unrepaired live GRANT as a **re-expose blocker**, not an implementation blocker.
2. **UI hide ≠ authorization** — an authenticated, 18+, opted-in client can still call mating RPCs. Acceptable for controlled Beta. Production users must not be offered opt-in. RLS remains the boundary.
3. **`pets_have_mutual_paw` is SECURITY DEFINER** — any role that can EXECUTE can test arbitrary pairs. Anon revoke + null-uid fail-closed is the repair. Full participant restriction deferred so triggers/RLS do not break.
4. **Export includes counterpart message bodies** — Legal residual (PAW-199). Out of this wave. Do not change `export_user_data` here.
5. **Location** — mating RPCs still use `profiles.last_location_*` internally. Clients must not SELECT coords. No location architecture rewrite. Honest `~km` only.

If Backend finds a new RLS hole while implementing: **STOP**, comment CEO/Founder, do not “fix” by loosening policy.

---

## 7. Delegation

| Issue | Owner | Authorized work |
|-------|--------|-----------------|
| **PAW-207** | Backend | New migration: exclude matched; list RPC; discovery context; GRANT repair; keep freeze-and-hide opt-out; extend mating RLS tests. No UI. No gate flip. |
| **PAW-208** | Frontend | Helper wiring; dormant picker; discovery honesty; Chat list screen; thread header; gated App.js + tab bar; toggle restore. No production constant flip. |
| **Legal / Copy / Designer** | Parallel | Disclaimer string, confirmation copy, mew asset, Terms re-attach. Frontend does not invent these. |
| **Tester** | After 207+208 | Local flag path, then staging Tester binary. |
| **QA** | After Tester | Hide-gate regression, RLS suite, device matrix. SIGN-OFF required before any commit of implementation (org rule). |

Sequence remains: Backend then Frontend. Frontend may stub the list against RLS SELECT if the RPC is not yet applied, but must not ship a production-visible path.

---

## 8. Explicit non-goals

- Flipping `EXPOSE_MATING_SURFACES` for production
- Rebuilding mating/chat
- User-selected 5/10/25/50 as a product choice
- GPS expose or location stack rewrite
- New matching mechanics (traits, age, scores, swipe)
- Push, Realtime, unread badges, generic DMs
- 18+ banner
- Physical chat wipe on opt-out
- Opportunistic cleanup outside this map
- Live Terms claiming chat for Phase 1a users

---

## 9. CTO recommendation to CEO

Technical go-ahead for **repair implementation behind the controlled path: YES.**  
Technical go-ahead to **re-expose to normal users: NO.**

PAW-207 and PAW-208 are unblocked by this map. Production hide stays.

---

## 10. Legal retention truth (binding — 2026-09-06)

Posted for Legal [PAW-204](/PAW/issues/PAW-204) and Backend [PAW-207](/PAW/issues/PAW-207).  
This is the written answer Legal asked for before live Terms/Privacy attach. It does **not** flip `EXPOSE_MATING_SURFACES`.

Founder “removed” is implemented as **product inaccessibility**, not physical wipe. Physical DELETE of channel/message rows is **out of this wave**. If Founder later wants a wipe, that is a new Founder-authorized migration (privacy / report-evidence / rematch). CEO: do not treat this as a product reopen.

### Q1 — Companionship OFF: freeze or delete?

**Phase 1a after this repair wave: freeze-and-hide. Keep messages.**

| Layer | Behaviour |
|-------|-----------|
| Trigger `mating_on_pet_opt_out` | Deletes **outbound** Paws for that pet. Sets that pet’s **open** channels to `status = 'frozen'`, `freeze_reason = 'opt_out'`. Does **not** DELETE channel or message rows. |
| Chat product | Frozen channels are **excluded** from `list_my_introduction_channels` (`status = 'open'` only). Compose already denied by RLS (`status = 'open'` required on INSERT). |
| Other pets | Untouched (`NEW.id` only). |
| Physical wipe | **Not in this wave.** History remains for report evidence and rematch `ON CONFLICT` reopen. |

**Legal / Copy must not say:** deleted; removed from Pawple; never saved; all data erased.  
**May say:** the conversation ends / closes / won’t be available to continue.  
Copy already on disk (`MATING_COMPANIONSHIP_OFF_CONFIRM_BODY`): “any chats for this pet will close.” That matches this lock.

### Q2 — Can the other parent still read frozen history?

| Surface | After opt-out |
|---------|----------------|
| Chat list | **No.** Channel is frozen for the **pair**. Both parents lose the row. |
| Profile intro CTA | **No.** CTA only when `status === 'open'`. Frozen shows a paused note and does not navigate. |
| Compose | **No.** RLS INSERT requires `status = 'open'` + live mutual Paw. |
| Thread already open / known `channel_id` | **Yes, history is still SELECTable.** Message SELECT is participant-only and does **not** require `open`. Existing frozen UI: “Introduction is paused.” plus the message list. |
| `export_user_data` | **Yes** — see Q4. |

Do **not** write that the other parent cannot read or that history is gone. Write that the conversation **ends and cannot be continued**.

This wave does **not** tighten frozen SELECT. Changing that would alter existing paused-thread behaviour and needs a separate Founder decision.

### Q3 — How long are frozen rows / messages kept?

**No TTL. Indefinite** until one of:

1. Either parent deletes their Pawple account — `delete_user_account` deletes **all** messages in channels they participate in, then the channel (counterpart also loses that history).
2. A later Founder-authorized physical-wipe migration (none exists; none in this wave).

Rematch of the same pet pair `ON CONFLICT` reopens the **same** channel. Prior messages remain unless an account delete already removed them.

Inbound Paws on the opted-out pet are **retained** (report evidence). Interest SELECT already quiets them when the target is no longer opted in.

### Q4 — Does `export_user_data` include counterpart message bodies?

**Yes. Unchanged this wave.**

`export_user_data` (schema_version 2) returns every `mating_introduction_messages` row on channels where the caller is `owner_low_id` or `owner_high_id`. That includes the other parent’s `body` text. It also includes frozen channels and inbound `paw_interests` on owned pets.

Do not change `export_user_data` in PAW-207. Redaction is a separate Legal/Founder decision (PAW-199 residual).

### Q5 — Confirmations

| Control | Phase 1a after this wave |
|---------|--------------------------|
| Under-18 cannot enable companionship | **Yes, server.** `trg_pets_mating_age_on_opt_in` → `assert_mating_age_ok` → `assert_adult_account_ok` (`account_tier = adult` AND `age_attested_adult`). Client hide is not the control. |
| Location | **~km only.** Existing coarse/approximate model. No GPS expose. No location architecture rewrite. |
| Report / block | **Unchanged.** `pet_blocks` still freezes `block`; report targets unchanged. |
| Link deny | **Unchanged.** INSERT trigger still rejects URL / bare domain. Phone/plain allowed. |
| Production hide | **`EXPOSE_MATING_SURFACES` stays `false`.** Controlled Tester path is `areMatingSurfacesVisible()` + `EXPO_PUBLIC_MATING_TEST_SURFACES` (never committed true; production env fail-closed). |

### What this unblocks

- **Legal:** live Terms/Privacy still must **not** attach mating/chat for ordinary Phase 1a users (production hide). Controlled-path in-app copy may proceed using “ends / close / won’t be available to continue.”
- **Backend (PAW-207):** keep freeze-and-hide. Do not DELETE message/channel rows on opt-out.
- **Frontend (PAW-208):** do not invent delete/wipe copy. Use PAW-205 close language.
