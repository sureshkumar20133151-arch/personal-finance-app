# SMS & UPI Notification Scanner (Archived)

This folder contains the complete, working implementation of the SMS auto-scanner and UPI notification parser for BudgetTracker.

## Archived Components & Modules:
- `autoScanSms.js`: Core parser module using `transaction-sms-parser` and custom regex rules for Indian banks (Canara Bank, Indian Bank, SBI, HDFC, ICICI, etc.), UPI handles, and SMS permission requests.
- `SMSScanModal.jsx`: Interactive modal for scanning the device inbox, reviewing detected transactions, selecting categories, and bulk importing.
- `SmsSetupGuide.jsx`: Step-by-step onboarding walkthrough helping users grant background SMS permissions.

## Why this is archived:
1. Google Play Store enforces strict Sensitive Permission policies for `READ_SMS` / `RECEIVE_SMS` which requires specialized declaration forms and can cause app rejections.
2. Web and iOS clients cannot access native Android SMS inboxes.
3. BudgetTracker's primary, reliable import mechanism is **Client-Side Bank Statement PDF & Excel Parser**, which works 100% across Web, Android, and iOS with zero permission hurdles.

## How to restore:
If you build a dedicated Android APK or Companion App specifically for SMS scanning, you can re-import these modules directly into `src/`.
