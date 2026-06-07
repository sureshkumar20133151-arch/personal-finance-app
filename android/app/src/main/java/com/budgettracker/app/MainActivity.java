package com.budgettracker.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;
import com.ionicframework.capacitor.Checkout;
import ai.soliman.plugins.messagereader.MessageReaderPlugin;
import com.capacitorjs.plugins.localnotifications.LocalNotificationsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom Capacitor plugins
        registerPlugin(NotificationListenerPlugin.class);
        registerPlugin(GoogleAuth.class);
        registerPlugin(Checkout.class);
        registerPlugin(MessageReaderPlugin.class);
        registerPlugin(LocalNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
