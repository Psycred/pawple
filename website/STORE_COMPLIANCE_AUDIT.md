# Pawple store compliance audit (static website)

Based on inspection of `E:\Pawple-Clean-PRESERVED-TEST` as of September 2026. This file is for internal use; deploy paths assume Firebase Hosting at your chosen domain.

## 1. Privacy Policy URL needed

**Suggested public URL:** `https://<your-domain>/privacy`  
**Local path:** `website/privacy/index.html`

Content is aligned with `src/content/legalDocuments.js` (`privacySections`) and current app behaviour. Gaps called out on the web page: legal entity name, registered address, grievance officer, and formal data-controller / cross-border disclosures are **not** present in the repository.

## 2. Support URL needed

**Suggested public URL:** `https://<your-domain>/support`  
**Local path:** `website/support/index.html`

**Support email in app:** `hello@pawple.app` (`SettingsScreen.js`, `legalDocuments.js`, `UserSheet.js`).

## 3. Account deletion URL needed

**Suggested public URL:** `https://<your-domain>/delete-account`  
**Local path:** `website/delete-account/index.html`

## 4. Does in-app account deletion already exist?

**Yes.**

| Item | Evidence |
|------|----------|
| Settings UI | `SettingsScreen.js` — Delete account → `openDeleteConfirm()` |
| Confirmation flow | `AuthContext.js` — `confirmDeleteAccount` → `deleteAccount()` |
| Client implementation | `src/lib/deleteAccount.js` — `supabase.rpc('delete_user_account')` plus storage cleanup |
| Legal copy | `legalDocuments.js` — Terms/Privacy “Ending your account” / “Retention and deletion” |

The public website **documents** this flow; it does **not** perform deletion.

## 5. Mobile-app changes required for Apple / Google account deletion

| Platform | Status |
|----------|--------|
| **In-app deletion** | Present — likely satisfies core “delete in app” requirements when the RPC succeeds in production. |
| **Public deletion URL** | Addressed by `website/delete-account` (host on production domain before submission). |
| **Optional gap** | If reviewers require deletion **without** opening the app, only email to `hello@pawple.app` is documented—no automated web deletion form (intentional; no backend on static site). |
| **Data export** | In-app export exists (`export_user_data` RPC / `exportAccount.js`); not required on static site. |

**No mobile code change is required solely to satisfy “document deletion on the web”** if store listings use the hosted delete-account URL and the in-app path remains working.

## 6. Other obvious store-blocking issues (from code review)

| Issue | Severity | Notes |
|-------|----------|--------|
| **Legal entity / address / grievance officer** | Medium (India / Play policy) | Marked in app legal copy as counsel review; not in repo. |
| **Android package `com.anonymous.Pawple`** | Medium | `app.json` — may need a production applicationId before Play release. |
| **Play: FCM / push** | Medium (if push marketed) | Prior audit: release push may fail without Firebase/EAS FCM setup; unrelated to static site. |
| **Placeholder Play store URL** | Low | `website/js/store-links.js` — update when listing is live. |
| **iOS** | Info | Home page shows “Coming soon”; App Store submission needs a live listing URL when ready. |
| **Firebase in mobile app** | None for privacy accuracy | `src/config/firebase.js` is unused placeholder; app uses Supabase, not Firebase backend. |
| **Privacy policy in app vs web** | Low | Keep in-app `legalDocuments.js` and web policy in sync when product changes. |

## Deploy checklist

1. Map custom domain (e.g. `pawple.app` or `pawple.com`) in Firebase Hosting.
2. Enter Privacy, Support, and Delete Account URLs in Play Console / App Store Connect.
3. Update `website/js/store-links.js` with the real Google Play URL.
4. Add iOS App Store URL when available.
