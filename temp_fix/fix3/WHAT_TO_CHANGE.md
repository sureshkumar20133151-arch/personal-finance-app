# ROOT CAUSE FOUND — Single Bug, One File Fix

## THE BUG

Inside `autoScanSms.js`, the permission check used the wrong key name:

```js
// ❌ WRONG — plugin returns "readSms", not "messages"
r?.messages === "granted"   // always false → permission dialog every time → SMS never read
```

The plugin `@solimanware/capacitor-sms-reader` returns:
```json
{ "readSms": "granted" }
```
NOT `{ "messages": "granted" }`.

So the SMS path was **always failing silently** — the permission was never
confirmed as granted, getMessages was never called.

---

## THE FIX

**Replace your `autoScanSms.js`** with the file in this folder.

That's the only change needed. Everything else (FinanceContext, Dashboard) is correct.

---

## Verify it worked

Open Android Studio → Logcat → filter by `AutoScan`

You should see:
```
[AutoScan] checkPermissions result: {"readSms":"granted"}
[AutoScan] Raw SMS count: 47
[AutoScan] Parsed financial SMS: 8
[AutoScan] 8 parsed, 6 new unique
[FinanceContext] Auto-imported 6 SMS transactions
```

If SMS permission was previously denied (user tapped "Don't allow"):
```
[AutoScan] SMS not granted — requesting...
```
→ Android permission dialog appears → user taps Allow → SMS loads.

If user already denied permanently (tapped "Don't allow" twice):
→ requestPermissions silently fails
→ App falls back to Notification Listener
→ If listener not enabled → SmsSetupGuide modal appears

---

## Indian Bank users — additional fix needed in Android

If your bank is **Indian Bank**, add this package to `BANK_PACKAGES` in
`android/app/src/main/java/com/budgettracker/app/BankNotificationListenerService.java`:

```java
"com.indianbank.mpassbook",  // Indian Bank MPassbook app
"com.fss.pnb",               // PNB app  
"in.org.npci.upiapp",        // BHIM UPI
```

Find the `BANK_PACKAGES` array in that file and add these lines.
