package tj.tezkor.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** after the phone restarts, a shop / courier that was on duty keeps getting orders */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        if (!c.getSharedPreferences(DutyService.PREFS, Context.MODE_PRIVATE).getBoolean("on", false)) return;
        Intent i = new Intent(c, DutyService.class);
        try { if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i); } catch (Exception ignored) { }
    }
}
