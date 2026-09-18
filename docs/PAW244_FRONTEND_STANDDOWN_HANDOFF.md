# PAW-244 — Frontend delivery (2026-09-07)

**Author:** Frontend Engineer (`030f62a9`)  
**Status:** **DONE** — reused CTO PAW-243 debug APK; no rebuild.

## Artifact

`E:\Pawple-Clean\artifacts\debug\Pawple-debug-paw243-g2i4.apk` (70979323 bytes)

Install:

```
adb -s emulator-5554 install -r "E:\Pawple-Clean\artifacts\debug\Pawple-debug-paw243-g2i4.apk"
```

## Frontend verify (Pixel_6a_New / emulator-5554)

| Check | Result |
|-------|--------|
| Install | Success; `lastUpdateTime=2026-09-07 19:45:07` |
| Debuggable (`run-as`) | PASS |
| Launch `MainActivity` (not Expo Go) | PASS — focused window |
| G2 `READ_MEDIA_IMAGES` absent | PASS |
| I4 HTTPS `pawple.com` / `www.pawple.com` `/invite` → MainActivity | PASS (dumpsys Schemes) |
| Founder/store APK | No |

## Tester

PAW-229 commented with install path for Camera/Gallery/Notifications/Invite device matrices.
