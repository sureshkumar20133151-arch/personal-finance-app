# 📊 Budget Tracker Pro: Application Features & Details

Budget Tracker Pro is a premium, real-time personal finance and automated budget tracking application. Built as a unified cross-platform hybrid application, it operates seamlessly across Web, Mobile (Android), and Desktop (Windows/macOS/Linux) environments. 

---

## 🚀 Cross-Platform Client Architecture
Budget Tracker Pro is optimized for three distinct deployment clients, using a unified React codebase and sharing database contracts:

1. **🌐 Progressive Web App (PWA) / Web Client**
   * Accessible on any device via modern browsers.
   * Houses the central authentication, web portal, and real-time cloud data backup views.
   * Integrated with **Razorpay SDK** for subscription checkout.
   * Host for OAuth deep linking helpers.

2. **📱 Native Android Mobile App (Capacitor wrapper)**
   * Packaged via **Capacitor.js** to run as a native Android utility.
   * Utilizes background services to monitor transactional SMS messages and system push notifications.
   * Integrated with **Native Google Auth** and the **Native Razorpay Capacitor Plugin** to bypass mobile WebView blocks.
   * Employs local alerts and notification indicators.

3. **💻 Native Desktop Client (Electron app)**
   * Packaged via **Electron** to run as a desktop program.
   * Configured with Windows registry system-level deep linking (`budget-tracker://`) to route Google SSO authentication flows through Chrome/Edge and prevent native WebView auth blocks.
   * Offline-first operations with file import/export utilities.

---

## 💎 Features & Subscription Gating
The application implements two pricing structures: the privacy-sandboxed **Free Plan** and the fully automated **Pro Plan** (priced at **₹100/month** or **₹900/year**, including a **30-day Free Trial**).

| Feature | 🆓 Free Plan | 👑 Pro Plan |
| :--- | :---: | :---: |
| **Data Storage** | Local (`localStorage`) | Secure Real-time Cloud (`Firestore`) |
| **Real-time Syncing** | ❌ None (Device-isolated) | ✔️ Multi-device Cloud Sync |
| **Transaction Ingestion** | Manual Entry Only | Automatic SMS & Push Alert Scanning |
| **Transaction Capacity** | Capped at 50/month | Infinite |
| **Bank Statement Importer** | Manual PDF/CSV Upload | Manual PDF/CSV Upload |
| **CSV/Excel Export** | ❌ Locked | ✔️ Full CSV/XLSX Export |
| **Budgeting & Alerts** | Basic Categories | Advanced Category Limits + Limit Indicators |
| **Loans & Debts Ledger** | ❌ Locked | ✔️ Advanced Loans Tracker with EMIs |
| **Premium UI Themes** | Standard Theme | Pro Gold Crown & Golden Profile Rings |

---

## 🔍 In-Depth Feature Breakdown

### 1. Automated Transaction Ingestion (Mobile Only)
* **Background SMS Scanning:** Uses a native background listener (`@solimanware/capacitor-sms-reader`) to scan incoming text messages. A built-in regex-based transaction parser (`transaction-sms-parser`) extracts transaction details (amount, bank, merchant, debit/credit status, date, UPI reference ID).
* **UPI Notification Listener:** If SMS permissions are restricted, the app scans incoming push notifications from popular payment apps (Google Pay, PhonePe, Paytm) to log transactions instantly.
* **ATM Auto-Routing:** Detects ATM cash withdrawals (e.g. SMS contains "ATM WDL") and automatically creates a ledger transfer from the corresponding bank card to the cash wallet. This updates bank balances while increasing cash-in-hand balance without logging double expenses.

### 2. Manual Transaction Ledgers & Wallets
* **Multi-Source Cards:** Create separate digital ledger cards representing physical accounts (e.g., Indian Bank, Canara Bank, HDFC, Credit Cards).
* **Dedicated Cash Wallet:** Separate ledger for physical cash transactions.
* **Visual Categorization:** Assign colors, custom tags, and emojis (via native emoji pickers) to log incomes, expenses, or transfers between wallets.

### 3. Smart Document Statement Parsers (Web & Desktop)
* **PDF Statement Reader:** Upload bank statements (tested against Canara Bank e-Passbooks and Indian Bank e-statements) to parse transaction tables automatically.
* **Excel & CSV Import/Export:** Import sheets from spreadsheets (`xlsx`) or bulk-export all transactions for backup or accounting purposes.

### 4. Loans & Debts Management Ledger
* **Debt Tracker:** Dedicated section to record lent or borrowed money from individuals or commercial lenders.
* **EMI Planning:** Setup repayment schedules, interest accruals, and due date reminders.

### 5. Category Budgets & Visual Limit Alerts
* **Budget Limits:** Define strict spending ceilings for specific categories (e.g., Food, Travel, Subscriptions).
* **Live Progress Indicators:** Responsive color-coded bars change dynamically (Green ➡️ Amber ➡️ Red) as spending approaches or exceeds the budget.

### 6. Interactive Financial Analytics
* **Dashboard Trends:** Rich comparative line graphs showing monthly Income vs. Expenses (powered by Recharts).
* **Category Breakdown:** Interactive pie/doughnut charts illustrating spending distribution.
* **Key KPIs:** Quick-glance summaries showing total net worth, current cash-in-hand, bank totals, and current credit outstanding.

---

## 🛡️ Data Integrity & Security Systems

> [!IMPORTANT]
> **12-Digit UPI Reference ID Deduplication Engine**
> To prevent duplicate transactions (caused by multiple network scans, concurrent SMS/push notifications, or manual input overlaps), the app maps a unique `upiRef` key to every scanned transaction. If the ID is already present, the transaction is rejected instantly.

> [!TIP]
> **Boot-Time Context Auto-Healing**
> In case an older mobile client uploads duplicate transactions to Firestore, the React Context (`FinanceContext`) runs a background self-healing deduplication sweep upon booting. It cleans duplicates and recalculates balances automatically.

* **Firebase Firestore Security Rules:** Configured to restrict database operations:
  ```javascript
  allow read, write: if request.auth != null && request.auth.uid == userId;
  ```
  This ensures user data is private and accessible only by authenticated users.
* **Electron Google Auth deep linking:** Restricts OAuth window access to system browsers, satisfying Google's modern authentication policy for desktop wrappers.
