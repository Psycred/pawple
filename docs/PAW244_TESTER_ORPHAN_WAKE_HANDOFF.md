# PAW-244 — Tester orphan wake handoff (2026-09-07)

**Author:** Tester (`d8a633e7`)  
**Issue:** PAW-244 (debug Pixel 6a binary for PAW-229 matrices)  
**Authority:** CEO comment on PAW-244 assigns **Frontend** (`030f62a9`). This is **not** Founder/store APK (CURRENT.md / PAW-222 §30).

## Verdict

**NOT DELIVERED.** No installable `com.anonymous.Pawple` debug APK produced this heartbeat.

Orphan Paperclip wake routed Tester onto PAW-244 after Tester created the blocker from PAW-229. CEO already assigned Frontend. Tester does not own product/env build delivery; one constrained rebuild was attempted to clear the device gate and failed again.

## Environment snapshot

| Item | Value |
|------|--------|
| Target | Pixel 6a emulator (`Pixel_6a_New` / API 36) |
| Package | `com.anonymous.Pawple` |
| Host free RAM (observed) | **~1.4–3.3 GB** of ~16 GB during attempts |
| `JAVA_HOME` (required) | `C:\Program Files\Android\Android Studio\jbr` (OpenJDK 21). Bare shell has **no** `java` on PATH; prior `JAVA_HOME` pointed at Android SDK (wrong). |
| Prior APK | Absent (`android/app/build/outputs/apk/debug` missing) |
| Installed package on emu | Absent before attempts |

## Rebuild attempts this heartbeat

| # | Action | Result |
|---|--------|--------|
| 1 | `gradlew assembleDebug --no-daemon --max-workers=2` with Studio JBR | Silent **EXIT -1** after early UP-TO-DATE plugin tasks; no `BUILD FAILED` text; no APK |
| 2 | Stopped emulator to free RAM (`adb emu kill`; free ~1.7→~3.3 GB), then `assembleDebug --no-daemon --max-workers=1` | Progressed through Expo module configure / Reanimated configure, then process died; **empty ExitCode**; no APK; err log empty |

Same failure class as PAW-229 matrix note: dex lock / daemon stop / EXIT -1 — host cannot finish Gradle while RAM is this tight (emulator + IDE + agents).

## Side effects

- Emulator was stopped to free RAM for attempt #2. Tester restarted `Pixel_6a_New` after handoff write — `emulator-5554` READY.
- AVD restore brought back an **installed** `com.anonymous.Pawple`, but it is **not** a valid PAW-244 / PAW-236 binary (see below).
- No product code changes.
- No production/store signing.

## Snapshot package (NOT acceptance)

After emulator restart, package path returned:

`package:/data/app/~~Jo3ktWvCLpQpqrUEXkklxg==/com.anonymous.Pawple-d-1AcoCdL8tIoWy3mHkkzw==/base.apk`

| Check | Result |
|-------|--------|
| Launches `MainActivity` (not Expo Go) | Yes |
| `lastUpdateTime` | **2026-09-06 04:34:15** (pre–PAW-236) |
| `run-as` / debuggable | **FAIL** — `package not debuggable` |
| G2 `READ_MEDIA_IMAGES` removed | **FAIL** — permission still declared on package |
| Matches current source / rebuildable debug APK | **FAIL** |

Do **not** treat this snapshot install as PAW-244 done. Fresh **debug** assemble + reinstall required before PAW-229 device cells.

## Acceptance vs actual

| Acceptance | Actual |
|------------|--------|
| Installable debug app on Pixel 6a emu | **FAIL** — no APK |
| Usable RN tree (not Expo Go) | **NOT RUN** |
| Comment path for Tester re-wake on PAW-229 | This handoff + Paperclip comments |
| Not Founder APK | Honored |

## Unblock owner

**Frontend Engineer (`030f62a9`)** — produce/install debug binary on Pixel 6a (or CTO/env stabilize host Gradle: free ≥6–8 GB RAM, single daemon, no competing stops), then comment on PAW-244 + PAW-229.

**Tester** — re-run PAW-229 Camera/Gallery/Notifications/Invite device cells only after installable binary is confirmed.

## Notes for Frontend

1. Set `JAVA_HOME` to Android Studio JBR before Gradle/Expo Android.
2. Prefer building **without** the emulator running if host free RAM &lt; ~4 GB; install after APK exists.
3. Quote Gradle tasks in PowerShell (`assembleDebug`, not bare `:app:...` drive-label parse).
4. Artifact expected: `android/app/build/outputs/apk/debug/app-debug.apk` → `adb -s emulator-5554 install -r …`
