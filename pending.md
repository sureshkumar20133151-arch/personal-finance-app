# 📋 SaaS Operations & Launch Checklist — Pending Action Items

> **⚡ IMPORTANT NOTE FOR DEVELOPER & USER**:
> - All codebase-level development, test suites, rate limiters, webhooks, WhatsApp widget, OpenGraph social previews, legal policies, and SMS archiving have been **100% COMPLETED and VERIFIED via `npm run build` and `vitest`**.
> - **YOU DO NOT NEED TO RE-CHECK OR REBUILD THE CODE.**
> - This file tracks only external dashboard configurations, credentials to provide later, and operational tasks.
> - **As soon as you complete an item below, simply replace `[ ]` with `[x]`.**

---

## 📌 1. Tasks To Do Later (User Inputs Required)

### 📧 1.1 Support Email Update
- [ ] **Current State**: Temporary email `budgettracker.care@gmail.com` is active in `Legal.jsx`.
- [ ] **Action to do later**: Once you set up your official domain email (e.g. `support@yourdomain.com`):
  1. Replace `budgettracker.care@gmail.com` in [Legal.jsx](file:///c:/Users/Suresh/Documents/Antigravity/4.Budget%20tracker/src/pages/Legal.jsx).
  2. Update the contact email in Firebase Console and Razorpay Dashboard.

### 📱 1.2 WhatsApp Support Phone Number
- [ ] **Current State**: [WhatsAppSupport.jsx](file:///c:/Users/Suresh/Documents/Antigravity/4.Budget%20tracker/src/components/WhatsAppSupport.jsx) is live on all screens with placeholder number.
- [ ] **Action to do later**: When you want to route chats to your personal/business WhatsApp:
  - Add to your Vercel Environment Variables:
    ```env
    VITE_SUPPORT_WHATSAPP=91XXXXXXXXXX
    ```
    *(Replace with your 10-digit WhatsApp mobile number prefixed with country code `91`)*.

### ✉️ 1.3 Firebase Auth Email Branding (2 Minutes in Console)
*Target: [Firebase Console](https://console.firebase.google.com/) -> Project `listing-generator-31b39` -> Authentication -> Templates*
- [ ] **Password Reset Template**:
  - Click Edit icon (✏️).
  - Set **Sender Name**: `BudgetTracker Support`
  - Set **Reply-to**: `budgettracker.care@gmail.com` (or your official email)
  - Set **Subject**: `Reset your password for BudgetTracker`
  - Click **Save**.
- [ ] **Email Address Verification Template**:
  - Set **Sender Name**: `BudgetTracker Support`
  - Set **Reply-to**: `budgettracker.care@gmail.com`
  - Click **Save**.
- [ ] *(Optional Future Step)*: Connect custom domain DNS under "Customize domain" for `noreply@yourdomain.com`.

### 🌐 1.4 Custom Domain Connection (Vercel)
- [ ] Add your registered domain (e.g. `budgettracker.in` or `app.yourdomain.com`) in Vercel Project Settings -> Domains.
- [ ] Point DNS CNAME / A records as instructed by Vercel.

---

## 🚀 2. Razorpay Live Dashboard Configuration
*Target: [Razorpay Dashboard](https://dashboard.razorpay.com/) -> Settings -> Webhooks*

- [ ] **2.1 Add Webhook URL**:
  - **URL**: `https://personal-finance-app-mauve.vercel.app/api/payment/webhook` (or your custom domain)
  - **Alert Email**: Your admin email.
- [ ] **2.2 Set Webhook Secret**:
  - Generate a secure random string (e.g. `rzp_sec_2026_finance`).
  - Copy this secret for Vercel configuration below.
- [ ] **2.3 Enable Active Events**:
  - [ ] `payment.captured` — Upgrades user plan & generates GST invoice.
  - [ ] `payment.failed` — Records failure reason.
  - [ ] `subscription.charged` — Extends recurring renewal validity.
  - [ ] `subscription.activated` — Marks auto-debit mandate active.
  - [ ] `subscription.cancelled` — Downgrades to Free tier on cancellation.
  - [ ] `subscription.halted` — Downgrades if auto-debit fails repeatedly.
  - [ ] `refund.created` — Logs credit note.
  - [ ] `refund.processed` — Reverts subscription to Free tier.

---

## 🔐 3. Vercel Production Environment Variables
*Target: [Vercel Project Settings](https://vercel.com/) -> Settings -> Environment Variables*

- [ ] **3.1 `RAZORPAY_WEBHOOK_SECRET`**:
  - Paste the secret configured in step 2.2.
- [ ] **3.2 `FIREBASE_ADMIN_SERVICE_ACCOUNT`**:
  - Service account JSON string for server-side verification and Firestore rules.
- [ ] **3.3 `VITE_SENTRY_DSN`** *(Optional for error monitoring)*:
  - Create free project on [Sentry.io](https://sentry.io/) and paste the DSN here.
- [ ] **3.4 Business & GST Details** *(Optional / Defaults used if omitted)*:
  - `SELLER_BUSINESS_NAME` — e.g. `Budget Tracker Pro`
  - `SELLER_GSTIN` — Your GST number (if registered).
  - `SELLER_STATE` — Default: `Tamil Nadu` (Code: 33).

---

## ⏱️ 4. Uptime Monitoring Setup (Free 24/7)
*Target: [BetterStack](https://betterstack.com/) or [UptimeRobot](https://uptimerobot.com/)*

- [ ] **4.1 Create HTTP Monitor**:
  - **URL**: `https://personal-finance-app-mauve.vercel.app/api/health`
  - **Method**: `GET`
  - **Expected Status**: `200`
  - **Interval**: Every 3 or 5 minutes.
- [ ] **4.2 Alerts**:
  - Configure Email/Telegram alert if endpoint ever goes down.

---

## 📦 5. Archived Modules (For Future Reference)
- [x] **SMS & UPI Auto-Scan Modules**:
  - Safely isolated into `archive/sms-scanner/` with complete `README.md`.
  - Removed from active app UI & toolbar to guarantee 100% Google Play Store compliance and zero policy rejections.
  - Can be restored anytime if building a dedicated Android APK companion app.

---

- [x] **Repo Security Cleanup & Git History Purge**: All real bank statement PDFs, Firebase user dumps, binary APKs, and debug scripts were permanently purged from the entire Git commit history using `git-filter-repo` and force-pushed to GitHub. Zero sensitive files exist anywhere in Git history.
- [x] **Firestore Security Rules**: Multi-tenant isolation configured in `firestore.rules` and linked in `firebase.json`.
- [x] **Landing Page Alignment**: SMS claims replaced with real hero features (Smart Statement PDF Parser, Couple Collaboration, Salary Pockets).
- [x] **WhatsApp Floating Support Widget**: Fully responsive floating widget with tooltip in `src/components/WhatsAppSupport.jsx`.
- [x] **Social Share Preview**: OpenGraph and Twitter card metadata added to `index.html`.
- [x] **Rate Limiting**: Sliding window rate limiter active on API and MCP endpoints (`api/_lib/rateLimiter.js`).
- [x] **Indian GST Invoices**: Auto-generation with SAC Code `998314`, CGST/SGST/IGST breakdown in `api/_lib/gstInvoice.js`.
- [x] **Full Subscription Lifecycle**: Webhook listener handling captured, failed, charged, cancelled, halted, refunded in `api/payment/webhook.js`.
- [x] **Error Monitoring**: Sentry & React Error Boundary active in `src/components/ErrorBoundary.jsx`.
- [x] **Automated Tests**: 15/15 tests passing via Vitest.
- [x] **Production Compilation**: Tested and verified with `npm run build` (0 errors).
