# 📋 Budget Tracker Pro: Master Project Handover & Resume Guide

This document serves as the single source of truth for the project setup, completed features, resolved bugs, known issues, and next tasks. Provide this file to any new AI coding assistant session to resume development instantly.

---

## 📌 Project Overview & Stack
* **Project Name:** Budget Tracker Pro
* **Architecture:** Unified React 19 codebase, Tailwind CSS, Lucide icons, Vite.
* **Database & Auth:** Google Firebase (Firestore Database, Firebase Authentication).
* **Payment Integration:** Razorpay Checkout SDK & Capacitor Native Razorpay Plugin.
* **Native Wrappers:**
  1. **🌐 Progressive Web App (PWA):** Deployed on Vercel at `https://personal-finance-app-mauve.vercel.app`
  2. **📱 Native Android Mobile App:** Wrapped using **Capacitor.js** (`com.budgettracker.app`) targeting Android SDK 34 (Android 14).
  3. **💻 Native Desktop Client:** Electron wrapper (`electron/main.cjs`) supporting system-level protocols.

---

## 🛠️ Errors Faced & How They Were Resolved

### 1. Google Sign-In & Payment Overlay Freeze on Android
* **Problem:** Clicking "Continue with Google" or trying to upgrade to Pro would hang indefinitely on native Android devices.
* **Cause:** Modern Capacitor versions do not auto-register plugins built with legacy `@NativePlugin` annotations.
* **Fix:** Manually registered the plugins inside `MainActivity.java`:
  ```java
  import com.ionicframework.capacitor.Checkout; // Razorpay
  import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;
  import ai.soliman.plugins.messagereader.MessageReaderPlugin; // SMS Scan

  registerPlugin(Checkout.class);
  registerPlugin(GoogleAuth.class);
  registerPlugin(MessageReaderPlugin.class);
  ```

### 2. Google Authentication Blocks in Electron Desktop
* **Problem:** Google OAuth blocks login requests originating inside Electron's built-in Chromium browser window, throwing a `"browser not supported"` error.
* **Fix:** Implemented browser deep-linking:
  * Electron launches the user's default external browser (e.g. Chrome) to open `/login?electronAuthFlow=true`.
  * Once logged in, the web app redirects the credentials to the custom protocol `budget-tracker://auth?idToken=<TOKEN>`.
  * Electron's main process listens for this protocol, extracts the auth token, and logs the user in securely.

### 3. Google Login Popup COOP Block on Localhost
* **Problem:** Under modern Chrome versions, the Google Sign-in popup on `localhost:5173` failed to communicate credentials back to the main app window.
* **Cause:** Chrome blocks cross-origin popup communications if Cross-Origin-Opener-Policy (COOP) headers are missing.
* **Fix:** Added the following headers configuration to the Vite dev server inside `vite.config.js`:
  ```javascript
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
  }
  ```

### 4. Duplicate UPI Transactions & Older Client Ingestion
* **Problem:** The live Firestore database accumulated duplicate transactions for UPI transfers.
* **Causes:**
  1. Older mobile app builds without deduplication scan SMS inboxes and upload updates continuously.
  2. Transactions scanned from SMS and payment app push notifications created duplicate logs.
* **Fixes:**
  * **Auto-Healing Sweeper:** Added a boot-time self-healing deduplication pass inside `FinanceContext.jsx` that automatically purges duplicate entries from the database upon loading.
  * **UPI Ref Mapping:** Integrated parsing rules that extract 12-digit transaction numbers to block overlaps.
  * **Database Purging:** Ran a custom script to sweep out duplicates from the Firestore backend directly.
  * **Rebuilt APK:** Distributed a fresh APK to override old scanner rules on the user's device.

### 5. Over-Aggressive Deduplication
* **Problem:** Valid, distinct transactions of the exact same amount on the same day were being deleted.
* **Fix:** Expanded the composite key in `FinanceContext.jsx` to include `bankName` and `accountEnding` to ensure unique tracking.

### 6. Settings Loss During Data Import
* **Problem:** Importing JSON data files from mobile/desktop overwrote user settings like themes, monthly budgets, and Pro subscription status.
* **Fix:** Updated the `importData` method in `FinanceContext.jsx` to safely extract and merge settings variables alongside transaction lists.

---

## 🟢 Currently Implemented Features
* **Automated Scan:** Native Android service scanning transactional bank SMS (`@solimanware/capacitor-sms-reader`) and push notifications for UPI apps.
* **Multi-Source Accounts:** Support for Bank Balances, Credit Cards, and Cash-in-Hand ledgers.
* **ATM Auto-Routing:** Auto-routes ATM withdrawals from cards to cash.
* **Smart Parsers:** PDF statement parser (Canara Bank e-Passbooks, Indian Bank) and Excel/CSV input/output engines.
* **Budget Gating:** Color-coded limit indicator alerts.
* **Loan Tracker:** Dedicated loan ledger with EMI tracking.
* **Premium UI**: Golden crown icon overlays and profile rings for Pro subscriptions.

---

## ⏳ Active Status & Balance Verification
* **Indian Bank Balance:** Verified at **₹355.69** (anchored to June 10th statement balance of **₹271.59**).
* **Database State:** Successfully deduplicated to 482 clean transactions.
* **Razorpay Status:** Verification submitted for live production credentials. Currently runs on test key.

---

## 🚀 Upcoming Tasks & Next Steps
1. **Mobile APK Installation:** Ensure the rebuilt [app-debug.apk](file:///d:/anti%20gravity/Demo/4.Budget%20tracker/app-debug.apk) is installed on the mobile device to activate the new scanning rules.
2. **Razorpay Live Activation:** Once approved, update the `.env` file with `rzp_live_...` keys and rebuild the production bundles.
3. **Monitor Vercel Builds:** Ensure auto-deployments build cleanly following commits on the `main` branch.

---

## 💻 Technical Build & Deploy Commands

Run these commands in order from your shell:
```powershell
# 1. Compile the React frontend
npm run build

# 2. Sync assets to Capacitor Android app
npx cap sync android

# 3. Compile debug APK
cd android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat assembleDebug

# 4. Copy output APK to workspace root
cd ..
Copy-Item android/app/build/outputs/apk/debug/app-debug.apk -Destination . -Force
```
