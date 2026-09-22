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

### 7. Unparsed Bank SMS Messages
* **Problem:** Some specific bank SMS messages were failing to be recognized and parsed by the auto-scan system.
* **Fix (Ongoing):** Located the parsing logic in `src/context/autoScanSms.js` and `src/context/smsParser.js`. Ready to analyze sample SMS messages to write precise regex rules to capture the missed transactions.

### 8. Pro Account Data Loss on Firebase Auth (Data Location Anomaly)
* **Problem:** Users who paid for the Pro account via Razorpay while in Demo Mode or while using the Email/Password authentication method found their accounts reverting to "Free" when logging in with "Continue with Google".
* **Cause:**
  1. Demo Mode saves data to `localStorage`. `FinanceContext.jsx`'s boot logic completely overwrote this data when authenticating with Firebase, deleting their recent purchase.
  2. Firebase treats "Continue with Google" and "Email/Password" logins as entirely separate backend accounts, separating their subscription status even if they share an email address.
* **Fixes:**
  * **Local-to-Cloud Merge:** Updated `FinanceContext.jsx` to intercept the Firebase login process, detect `localStorage` data, and automatically merge Pro subscriptions (`localData.subscription !== 'free'`) and offline transactions into the Cloud Firestore account upon first login.
  * **Manual Sync:** Added `adjustBankBalance` to `FinanceContext.jsx` to manually align offline and online ledgers via custom adjustment transactions.

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
### 9. Zombie Deleted Categories Reappearing from Local Storage
* **Problem:** When deleting a category in Cloud mode, the category would reappear upon page reload or snapshot refresh.
* **Cause:** `hasMigrated` was resetting on snapshot triggers, causing old `localStorage` categories to merge back into Firestore.
* **Fix:** `FinanceContext.jsx` migration now writes a persistent flag (`fintrack_migrated_${uid}`) to `localStorage` and only runs once for brand-new cloud users. Also ensured category IDs are compared using `String(id)`.

### 10. Remote MCP Server & Claude Connector Integration
* **Architecture:**
  * Created `api/mcp.js` hosted as a Vercel Serverless Function supporting Streamable HTTP (JSON-RPC 2.0).
  * Endpoint: `https://personal-finance-app-mauve.vercel.app/api/mcp?key=<MCP_API_KEY>`
  * Authentication: Query parameter `?key=` (for Claude "No sign-in" mode) or `Authorization: Bearer <key>`.
  * Exposed Tools to Claude:
    1. `get_balances` — bank-by-bank balances and cash ledger.
    2. `get_transactions` — search & filter transactions.
    3. `get_monthly_summary` — income, expense, savings & category breakdowns.
    4. `add_transaction` — writes transactions directly into Firestore.
    5. `list_categories` — lists categories, budgets, and monthly burn.
    6. `add_category` — creates custom budget category.
    7. `edit_category` — edits category name, budget limit, icon, color.
    8. `delete_category` — deletes custom category.
    9. `get_loans_and_recurring` — loans & recurring bills.
  * **Favicon & Icon:** Updated `index.html` and MCP `serverInfo` to point to `/app-icon-512.png` so Claude shows the official app icon in Connectors.

---

## 🚨 CRITICAL HANDOVER NOTE: The Two-Account / Zero-Balance Issue (Suresh & Rosie)

### What Happened:
1. In Claude Desktop / Mobile, Claude connects to the MCP server with `MCP_USER_UID=do139V31SkRXMSpkLIW1AroA9ZO2`.
2. When Claude added transactions (e.g. ₹500 Salary, Gym Category), it wrote to UID `do139V31SkRXMSpkLIW1AroA9ZO2`.
3. However, when user logged in as "Suresh" (`sureshkumar20133151@gmail.com`) on `personal-finance-app-mauve.vercel.app`, the dashboard showed **₹0 balance and 0 transactions**.
4. **Root Cause:**
   * In Firebase Authentication, logging in via **Google Sign-In** generates a **different UID** than logging in via **Email / Password**, even with the same email.
   * Or, the user account currently active in the web app is a different UID than `do139V31SkRXMSpkLIW1AroA9ZO2`.
   * Also, the Admin SDK in `api/_lib/firebaseAdmin.js` was historically using `FIREBASE_PROJECT_ID=billing-dc0b2` (from payment setup), whereas client app uses `VITE_FIREBASE_PROJECT_ID=listing-generator-31b39`.
   * We added dedicated `getMcpDb()` and created `/api/mcp-debug` to verify the active Firestore project.
   * We added a copyable `UID: <currentUser.uid>` badge on the **Account** page (`src/pages/Account.jsx`) so the user can easily see their exact active UID.

---

## 🚀 Upcoming Tasks & Next Steps for New Session
1. **Identify Exact Active App UID:**
   * Open the app in browser, navigate to **Account**, check the displayed UID for Suresh and Rosie.
   * If the UID is different from `do139V31SkRXMSpkLIW1AroA9ZO2`, update `MCP_USER_UID` in Vercel to match the user's active UID (or support multi-user routing via query param `?uid=`).
2. **Verify Firebase Project Alignment:**
   * Ensure Vercel's `FIREBASE_PROJECT_ID` or `MCP_FIREBASE_PROJECT_ID` is set to `listing-generator-31b39` with the corresponding service account private key from Firebase Console.
3. **Multi-User MCP Support:**
   * Enhance `api/mcp.js` to accept `?user=suresh` or `?user=rosie` or pass the UID directly so Claude can interact with either account seamlessly.
4. **Mobile APK Installation:** Ensure the rebuilt APK is installed on the mobile device to activate the new scanning rules.
5. **Firebase Account Linking:** Implement Firebase's `linkWithCredential` to seamlessly merge Google and Email/Password accounts.

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

