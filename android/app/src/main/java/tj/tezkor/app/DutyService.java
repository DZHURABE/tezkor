package tj.tezkor.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

/**
 * «On duty»: keeps working when the app is closed or the screen is off.
 * Every few seconds it asks the server for new notifications of the signed-in shop / courier / admin;
 * a new order rings LOUD on the alarm channel (like taxi-driver apps), vibrates and shows a full-screen notification.
 * Started from the page (window.TezkorApp.startDuty) after sign-in, stopped on sign-out or «finish work».
 */
public class DutyService extends Service {
    static final String PREFS = "duty";
    static final String CH_DUTY = "duty";
    static final String CH_ALERT = "alerts";
    static final String ACTION_STOP_SOUND = "tj.tezkor.app.STOP_SOUND";
    private static final int ID_DUTY = 7;
    private static final long EVERY_MS = 10000;

    private volatile boolean running;
    private Thread loop;
    private PowerManager.WakeLock wake;
    private MediaPlayer player;

    /* ---------- start / stop from the page ---------- */
    static void start(Context c, String api, String token) {
        c.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("on", true).putString("api", api).putString("token", token).apply();
        Intent i = new Intent(c, DutyService.class);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }

    static void stop(Context c) {
        c.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("on", false).remove("token").apply();
        c.stopService(new Intent(c, DutyService.class));
    }

    static void silence(Context c) {
        if (!c.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("on", false)) return;   // not on duty: nothing rings
        Intent i = new Intent(c, DutyService.class).setAction(ACTION_STOP_SOUND);
        try { c.startService(i); } catch (Exception ignored) { }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_SOUND.equals(intent.getAction())) { stopSound(); if (running) return START_STICKY; }   // not running (killed): start duty again below
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!p.getBoolean("on", false) || p.getString("token", null) == null) { stopSelf(); return START_NOT_STICKY; }
        channels();
        Notification n = dutyNotification();
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID_DUTY, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(ID_DUTY, n);
        if (wake == null) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null) { wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tezkor:duty"); wake.setReferenceCounted(false); wake.acquire(); }
        }
        if (!running) { running = true; loop = new Thread(this::run, "tezkor-duty"); loop.start(); }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (loop != null) loop.interrupt();
        stopSound();
        if (wake != null && wake.isHeld()) wake.release();
        super.onDestroy();
    }

    /* ---------- the loop ---------- */
    private void run() {
        boolean first = true;
        while (running) {
            try {
                int code = poll(first);
                if (code == 401) { stop(this); return; }   // signed out elsewhere
                first = false;
            } catch (Exception ignored) { }
            try { Thread.sleep(EVERY_MS); } catch (InterruptedException e) { return; }
        }
    }

    private int poll(boolean first) throws Exception {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        String api = p.getString("api", null), token = p.getString("token", null);
        if (api == null || token == null) return 401;
        HttpURLConnection c = (HttpURLConnection) new URL(api + "/notifications").openConnection();
        c.setConnectTimeout(8000); c.setReadTimeout(8000);
        c.setRequestProperty("Authorization", "Bearer " + token);
        int code = c.getResponseCode();
        if (code != 200) { c.disconnect(); return code; }
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) { String line; while ((line = r.readLine()) != null) sb.append(line); }
        c.disconnect();
        JSONObject root = new JSONObject(sb.toString());
        JSONArray list = root.optJSONArray("data");
        if (list == null) return code;
        Set<String> seen = new HashSet<>(p.getStringSet("seen", new HashSet<>()));
        String alertTitle = null, alertBody = null;
        for (int i = 0; i < list.length(); i++) {
            JSONObject n = list.getJSONObject(i);
            String id = n.optString("id");
            if (seen.contains(id)) continue;
            seen.add(id);
            if (first) continue;   // what was already there when duty started does not ring
            String text = textOf(n.optString("key"), n.optJSONObject("params"));
            if (text != null && alertBody == null) { alertTitle = "Тезкор"; alertBody = text; }
        }
        if (seen.size() > 300) { Set<String> keep = new HashSet<>(); int k = 0; for (String s : seen) { if (k++ >= 200) break; keep.add(s); } seen = keep; }
        p.edit().putStringSet("seen", seen).apply();
        if (alertBody != null && !MainActivity.visible) alarm(alertTitle, alertBody);
        return code;
    }

    /** the notifications that must ring; everything else stays quiet */
    static String textOf(String key, JSONObject prm) {
        String n = prm != null ? prm.optString("n", "") : "";
        switch (key) {
            case "n.newOrder": return "Новый заказ №" + n + (prm != null && prm.has("sum") ? " · " + prm.optString("sum") + " с." : "");
            case "n.courierNew": return "Новый заказ на доставку №" + n;
            case "n.courierAssigned": case "n.courierAuto": return "Вам назначен заказ №" + n;
            case "n.ready": return "Заказ №" + n + " готов — заберите";
            case "n.orderEsc": return "Заказ №" + n + " ждёт решения";
            case "n.schedNew": return "Предзаказ №" + n + (prm != null && prm.has("time") ? " на " + prm.optString("time") : "");
            case "n.waiter": return "Вызов к столу";
            default: return null;
        }
    }

    /* ---------- sound, vibration, notification ---------- */
    private void alarm(String title, String body) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent mute = PendingIntent.getService(this, 2, new Intent(this, DutyService.class).setAction(ACTION_STOP_SOUND), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH_ALERT) : new Notification.Builder(this);
        b.setSmallIcon(R.mipmap.ic_launcher).setContentTitle(title).setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true).setContentIntent(pi).setFullScreenIntent(pi, true)
                .setCategory(Notification.CATEGORY_ALARM).setColor(Color.parseColor("#E8590C"))
                .addAction(new Notification.Action.Builder(null, "Тише", mute).build())
                .setDeleteIntent(mute);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_MAX);
        if (nm != null) nm.notify(2, b.build());
        vibrate();
        ring();
    }

    private void ring() {
        stopSound();
        try {
            AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
            if (am != null) { int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM); if (am.getStreamVolume(AudioManager.STREAM_ALARM) < max * 0.8) am.setStreamVolume(AudioManager.STREAM_ALARM, (int) Math.ceil(max * 0.9), 0); }
            Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            player.setDataSource(this, u);
            player.setLooping(true);
            player.prepare();
            player.start();
            final MediaPlayer mine = player;
            new Thread(() -> { try { Thread.sleep(45000); } catch (InterruptedException ignored) { } if (player == mine) stopSound(); }).start();   // rings 45 s at most
        } catch (Exception e) { stopSound(); }
    }

    private synchronized void stopSound() {
        if (player != null) { try { player.stop(); } catch (Exception ignored) { } player.release(); player = null; }
    }

    private void vibrate() {
        Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (v == null) return;
        long[] pattern = {0, 700, 300, 700, 300, 700, 300, 700};
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, -1)); else v.vibrate(pattern, -1);
    }

    private void channels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel duty = new NotificationChannel(CH_DUTY, "На линии", NotificationManager.IMPORTANCE_LOW);
        duty.setShowBadge(false);
        nm.createNotificationChannel(duty);
        NotificationChannel alerts = new NotificationChannel(CH_ALERT, "Новые заказы", NotificationManager.IMPORTANCE_HIGH);
        alerts.setSound(null, null);   // the service plays the loud alarm itself
        alerts.enableVibration(false);
        alerts.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        alerts.setBypassDnd(true);
        nm.createNotificationChannel(alerts);
    }

    private Notification dutyNotification() {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH_DUTY) : new Notification.Builder(this);
        return b.setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Тезкор — на линии")
                .setContentText("Новые заказы придут с громким сигналом, даже если приложение закрыто")
                .setOngoing(true).setContentIntent(pi).setColor(Color.parseColor("#13A35E")).build();
    }
}
