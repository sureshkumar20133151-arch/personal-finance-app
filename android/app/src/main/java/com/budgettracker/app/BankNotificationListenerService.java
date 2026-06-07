package com.budgettracker.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Background service that listens for bank/UPI SMS notifications.
 * Stores captured notification text in SharedPreferences so the
 * Capacitor plugin can retrieve them when the app opens.
 *
 * No READ_SMS permission needed — only Notification Access.
 */
public class BankNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "BankNotifListener";
    private static final String PREFS_NAME = "bank_notifications";
    private static final String KEY_NOTIFICATIONS = "captured_notifications";
    private static final int MAX_STORED = 200;

    // Known Indian bank / UPI sender package names
    private static final Set<String> BANK_PACKAGES = new HashSet<>(Arrays.asList(
        "com.google.android.apps.messaging",  // Google Messages (SMS)
        "com.samsung.android.messaging",       // Samsung Messages
        "com.android.mms",                     // Default MMS/SMS app
        "com.iqoo.sms",                        // iQOO/Vivo Messages
        "com.vivo.sms",                        // Vivo Messages  
        "com.xiaomi.sms",                      // Xiaomi Messages
        "com.oneplus.mms",                     // OnePlus Messages
        "com.coloros.sms",                     // OPPO Messages
        "com.realme.sms",                      // Realme Messages
        "com.google.android.apps.nbu.paisa.user", // Google Pay
        "net.one97.paytm",                     // Paytm
        "com.phonepe.app",                     // PhonePe
        "in.amazon.mShop.android.shopping",    // Amazon Pay
        "com.whatsapp",                        // WhatsApp Pay notifications
        "com.myairtelapp",                     // Airtel Thanks (Airtel Payments Bank)
        "com.jio.myjio",                       // Jio (Jio Payments Bank)
        "com.csam.icici.bank.imobile",         // ICICI iMobile
        "com.sbi.SBIFreedomPlus",              // SBI Yono
        "com.axis.mobile",                     // Axis Bank
        "com.hdfcbank.hdfcquickbank",          // HDFC Bank
        "com.kotak.mobile.banking"             // Kotak Mahindra Bank
    ));

    private static final String[] BANK_KEYWORDS = {
        "debited", "credited", "debit", "credit",
        "withdrawn", "deposited", "transferred",
        "sent", "received", "paid", "pay",
        "a/c", "acct", "account",
        "upi", "neft", "imps", "rtgs",
        "atm", "pos", "balance",
        "txn", "transaction", "₹", "rs", "inr"
    };

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String packageName = sbn.getPackageName();
            Bundle extras = sbn.getNotification().extras;

            String title = extras.getString("android.title", "");
            CharSequence textCs = extras.getCharSequence("android.text");
            CharSequence bigTextCs = extras.getCharSequence("android.bigText");

            // Prefer bigText (full SMS), fallback to text
            String text = "";
            if (bigTextCs != null && bigTextCs.length() > 0) {
                text = bigTextCs.toString();
            } else if (textCs != null) {
                text = textCs.toString();
            }

            if (TextUtils.isEmpty(text)) return;

            // Check if this is a bank/financial notification
            boolean isFromSMSApp = BANK_PACKAGES.contains(packageName);
            boolean hasBankKeyword = false;

            String textLower = text.toLowerCase();
            for (String keyword : BANK_KEYWORDS) {
                if (textLower.contains(keyword)) {
                    hasBankKeyword = true;
                    break;
                }
            }

            // Only capture if it contains bank keywords
            // Accept from ANY app as long as it has financial keywords
            if (!hasBankKeyword) return;

            // Build notification JSON
            JSONObject notif = new JSONObject();
            notif.put("body", text);
            notif.put("title", title);
            notif.put("date", String.valueOf(sbn.getPostTime()));
            notif.put("packageName", packageName);
            notif.put("key", sbn.getKey());

            // Store in SharedPreferences
            storeNotification(notif);

            Log.d(TAG, "Captured bank notification: " + text.substring(0, Math.min(50, text.length())));

        } catch (Exception e) {
            Log.e(TAG, "Error processing notification", e);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Not needed for our use case
    }

    private void storeNotification(JSONObject notif) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existing = prefs.getString(KEY_NOTIFICATIONS, "[]");
            JSONArray array = new JSONArray(existing);

            // Duplicate check — skip if same body+date already exists
            String newBody = notif.optString("body", "");
            String newDate = notif.optString("date", "");
            for (int i = 0; i < array.length(); i++) {
                JSONObject old = array.getJSONObject(i);
                if (newBody.equals(old.optString("body", "")) 
                    && newDate.equals(old.optString("date", ""))) {
                    Log.d(TAG, "Duplicate notification skipped");
                    return;
                }
            }

            // Add new notification at the beginning
            JSONArray newArray = new JSONArray();
            newArray.put(notif);
            for (int i = 0; i < array.length() && i < MAX_STORED - 1; i++) {
                newArray.put(array.get(i));
            }

            prefs.edit().putString(KEY_NOTIFICATIONS, newArray.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error storing notification", e);
        }
    }

    /**
     * Check if notification listener is enabled for this app.
     */
    public static boolean isEnabled(Context context) {
        String pkgName = context.getPackageName();
        String flat = android.provider.Settings.Secure.getString(
            context.getContentResolver(),
            "enabled_notification_listeners"
        );
        if (flat != null) {
            String[] names = flat.split(":");
            for (String name : names) {
                ComponentName cn = ComponentName.unflattenFromString(name);
                if (cn != null && cn.getPackageName().equals(pkgName)) {
                    return true;
                }
            }
        }
        return false;
    }
}
