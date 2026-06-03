package com.budgettracker.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Capacitor Plugin that bridges the BankNotificationListenerService
 * to the JavaScript layer.
 *
 * Methods:
 *  - isListenerEnabled() → { enabled: boolean }
 *  - openListenerSettings() → opens Android notification access settings
 *  - getCapturedNotifications() → { notifications: [{body, title, date, packageName}] }
 *  - clearNotifications() → clears stored notifications
 */
@CapacitorPlugin(name = "NotificationListener")
public class NotificationListenerPlugin extends Plugin {

    private static final String PREFS_NAME = "bank_notifications";
    private static final String KEY_NOTIFICATIONS = "captured_notifications";

    @PluginMethod
    public void isListenerEnabled(PluginCall call) {
        boolean enabled = BankNotificationListenerService.isEnabled(getContext());
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void openListenerSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open notification settings", e);
        }
    }

    @PluginMethod
    public void getCapturedNotifications(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String stored = prefs.getString(KEY_NOTIFICATIONS, "[]");
            JSONArray array = new JSONArray(stored);

            // Optional: filter by minDate
            String minDateStr = call.getString("minDate");
            long minDate = 0;
            if (minDateStr != null) {
                try {
                    minDate = Long.parseLong(minDateStr);
                } catch (NumberFormatException ignored) {}
            }

            JSArray resultArray = new JSArray();
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                if (minDate > 0) {
                    long notifDate = Long.parseLong(obj.optString("date", "0"));
                    if (notifDate < minDate) continue;
                }
                JSObject jsObj = new JSObject();
                jsObj.put("body", obj.optString("body", ""));
                jsObj.put("title", obj.optString("title", ""));
                jsObj.put("date", obj.optString("date", ""));
                jsObj.put("packageName", obj.optString("packageName", ""));
                resultArray.put(jsObj);
            }

            JSObject ret = new JSObject();
            ret.put("notifications", resultArray);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error reading notifications", e);
        }
    }

    @PluginMethod
    public void clearNotifications(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_NOTIFICATIONS, "[]").apply();
        call.resolve();
    }
}
