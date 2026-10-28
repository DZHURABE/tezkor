package tj.tezkor.app;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Тезкор for Android: the live site in a full-screen WebView.
 * Everything (menus, orders, updates) comes from the server, so the app never needs updating for new features.
 * Adds what a browser tab cannot do well: system notifications for new orders, keeping the screen on,
 * location, photo upload, phone calls and navigation apps.
 */
public class MainActivity extends Activity {
    private static final String CHANNEL = "orders";
    private static final int REQ_FILE = 11;
    private static final int REQ_CAMERA = 7731;
    private Uri photoUri;
    private static final int REQ_PERMS = 12;

    private WebView web;
    private String home;
    private String homeHost;
    private ValueCallback<Uri[]> fileCallback;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        home = getString(R.string.app_url);
        homeHost = Uri.parse(home).getHost();
        createChannel();

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#F4F1EC"));
        /* Android 15+ draws the app under the status and navigation bars: keep the page between two colored strips */
        final android.widget.LinearLayout root = new android.widget.LinearLayout(this);
        root.setOrientation(android.widget.LinearLayout.VERTICAL);
        final View top = new View(this), bottom = new View(this);
        top.setBackgroundColor(Color.parseColor("#E8590C")); bottom.setBackgroundColor(Color.parseColor("#F4F1EC"));
        root.addView(top, new android.widget.LinearLayout.LayoutParams(-1, 0));
        root.addView(web, new android.widget.LinearLayout.LayoutParams(-1, 0, 1f));
        root.addView(bottom, new android.widget.LinearLayout.LayoutParams(-1, 0));
        /* full screen: the page runs up under the status bar (the home picture reaches the clock and battery);
           the page gets the bar's height as --sat and keeps its own text clear of it */
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        root.setOnApplyWindowInsetsListener((v, ins) -> {
            int t, bt, l, r, kb;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets b = ins.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = ins.getInsets(android.view.WindowInsets.Type.ime());
                t = b.top; bt = b.bottom; l = b.left; r = b.right; kb = ime.bottom;
            } else { t = ins.getSystemWindowInsetTop(); bt = ins.getSystemWindowInsetBottom(); l = ins.getSystemWindowInsetLeft(); r = ins.getSystemWindowInsetRight(); kb = 0; }
            top.getLayoutParams().height = 0; bottom.getLayoutParams().height = Math.max(bt, kb);
            root.setPadding(l, 0, r, 0); top.requestLayout(); bottom.requestLayout();
            satPx = Math.round(t / getResources().getDisplayMetrics().density); pushSat();
            return Build.VERSION.SDK_INT >= 30 ? android.view.WindowInsets.CONSUMED : ins.consumeSystemWindowInsets(); });
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // the order bell must ring without a tap
        s.setAllowFileAccess(false);
        /* a phone app, not a web page: the phone's big-font setting does not blow the screen up, no pinch zoom, no sideways scroll */
        s.setTextZoom(100);
        s.setSupportZoom(false); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true); s.setLoadWithOverviewMode(true);
        web.setHorizontalScrollBarEnabled(false); web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        s.setUserAgentString(s.getUserAgentString() + " TezkorApp/" + BuildInfo.version(this));

        web.addJavascriptInterface(new Bridge(), "TezkorApp");
        web.setWebViewClient(new Client());
        /* a file link (the new APK) is handed to the browser, which downloads it */
        web.setDownloadListener((url, ua, cd, mime, len) -> { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (ActivityNotFoundException ignored) { } });
        web.setWebChromeClient(new Chrome());

        askPermissions();
        if (state != null) web.restoreState(state);
        else web.loadUrl(openTarget(getIntent()));
    }

    /** a tap on a notification opens the app where it was; a link to the site opens that page */
    private String openTarget(Intent intent) {
        Uri data = intent != null ? intent.getData() : null;
        if (data != null && homeHost != null && homeHost.equals(data.getHost())) return data.toString();
        return home + "/?source=apk";
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Uri data = intent.getData();
        if (data != null && homeHost != null && homeHost.equals(data.getHost())) web.loadUrl(data.toString());
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /* JavaScript keeps running in the background (no onPause on the WebView), so orders keep arriving
       while the phone shows another app; the page then asks for a system notification. */

    private void askPermissions() {
        if (Build.VERSION.SDK_INT < 23) return;
        java.util.ArrayList<String> need = new java.util.ArrayList<>();
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
            need.add(Manifest.permission.ACCESS_FINE_LOCATION);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED)
            need.add("android.permission.POST_NOTIFICATIONS");
        if (!need.isEmpty()) requestPermissions(need.toArray(new String[0]), REQ_PERMS);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (geoCallback != null) {
            boolean ok = Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            geoCallback.invoke(geoOrigin, ok, false);
            geoCallback = null;
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, getString(R.string.channel_orders), NotificationManager.IMPORTANCE_HIGH);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 600, 200, 600, 200, 600});
        ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build());
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.createNotificationChannel(ch);
    }

    private void showNotification(String title, String body) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        b.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setCategory(Notification.CATEGORY_CALL)
                .setColor(Color.parseColor("#E8590C"));
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_MAX).setDefaults(Notification.DEFAULT_ALL);
        }
        nm.notify(1, b.build());
    }

    /** window.TezkorApp in the page */
    private class Bridge {
        @JavascriptInterface
        public void notify(final String title, final String body) {
            runOnUiThread(() -> showNotification(title, body));
        }

        @JavascriptInterface
        public void keepAwake(final boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        /** on duty: new orders ring loud even when the app is closed (see DutyService) */
        @JavascriptInterface
        public void startDuty(final String api, final String token) {
            if (api == null || token == null || token.isEmpty()) return;
            String base = api.startsWith("http") ? api : home + (api.startsWith("/") ? api : "/" + api);
            DutyService.start(MainActivity.this, base, token);
            askBatteryOnce();
        }

        @JavascriptInterface
        public void stopDuty() {
            DutyService.stop(MainActivity.this);
        }

        @JavascriptInterface
        public boolean onDuty() {
            return getSharedPreferences(DutyService.PREFS, MODE_PRIVATE).getBoolean("on", false);
        }

        @JavascriptInterface
        public void statusBar(final boolean lightIcons) { statusIcons(lightIcons); }

        @JavascriptInterface
        public String version() {
            return BuildInfo.version(MainActivity.this);
        }
    }

    private int satPx = 0;
    private void pushSat() { if (web != null) web.post(() -> web.evaluateJavascript("document.documentElement.style.setProperty('--sat','" + satPx + "px');document.documentElement.classList.add('inapp-full')", null)); }
    /** white or dark clock and battery icons, as the page asks (white over the dark home picture) */
    void statusIcons(boolean light) { runOnUiThread(() -> {
        if (Build.VERSION.SDK_INT >= 30) { android.view.WindowInsetsController c = getWindow().getInsetsController(); if (c != null) c.setSystemBarsAppearance(light ? 0 : android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS, android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS); }
        else if (Build.VERSION.SDK_INT >= 23) { View d = getWindow().getDecorView(); int f = d.getSystemUiVisibility(); d.setSystemUiVisibility(light ? f & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR : f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR); } }); }

    private class Client extends WebViewClient {
        @Override
        public void onPageFinished(WebView view, String url) { super.onPageFinished(view, url); pushSat(); }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            String scheme = u.getScheme() == null ? "" : u.getScheme();
            boolean ours = ("https".equals(scheme) || "http".equals(scheme)) && homeHost != null && homeHost.equals(u.getHost());
            if (ours) return false;
            /* phone calls, maps, Telegram and every other site open in their own apps */
            try {
                Intent i = scheme.equals("intent") ? Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, u);
                i.addCategory(Intent.CATEGORY_BROWSABLE);
                startActivity(i);
            } catch (ActivityNotFoundException | java.net.URISyntaxException e) {
                if (scheme.equals("http") || scheme.equals("https")) return false;
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
            if (req.isForMainFrame()) view.loadDataWithBaseURL(null, OFFLINE.replace("%URL%", home + "/?source=apk"), "text/html", "utf-8", null);
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                geoCallback = callback;
                geoOrigin = origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_PERMS);
            } else {
                callback.invoke(origin, true, false);
            }
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            /* «Сфотографировать» (capture): the camera opens at once and the full-size photo comes back (Android 10+) */
            if (params.isCaptureEnabled() && Build.VERSION.SDK_INT >= 29) {
                try {
                    android.content.ContentValues cv = new android.content.ContentValues();
                    cv.put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, "tezkor_" + System.currentTimeMillis() + ".jpg");
                    cv.put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                    cv.put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Tezkor");
                    photoUri = getContentResolver().insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                    Intent cam = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
                    cam.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, photoUri);
                    cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    startActivityForResult(cam, REQ_CAMERA);
                    return true;
                } catch (Exception e) { photoUri = null; }
            }
            try {
                startActivityForResult(params.createIntent(), REQ_FILE);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
            return true;
        }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == REQ_CAMERA && fileCallback != null) {
            Uri u = photoUri; photoUri = null;
            if (result == RESULT_OK && u != null) fileCallback.onReceiveValue(new Uri[]{u});
            else { if (u != null) try { getContentResolver().delete(u, null, null); } catch (Exception ignored) { } fileCallback.onReceiveValue(null); }
            fileCallback = null;
            return;
        }
        if (code == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
    }

    /** while the app is on screen the page itself rings; the duty service stays quiet */
    static volatile boolean visible;

    @Override
    protected void onResume() {
        super.onResume();
        visible = true;
        DutyService.silence(this);   // the person opened the app: the bell may stop
    }

    @Override
    protected void onPause() {
        visible = false;
        super.onPause();
    }

    /** once: ask Android not to put the app to sleep, otherwise the phone may stop checking for orders */
    private void askBatteryOnce() {
        if (Build.VERSION.SDK_INT < 23) return;
        android.content.SharedPreferences p = getSharedPreferences(DutyService.PREFS, MODE_PRIVATE);
        if (p.getBoolean("askedBattery", false)) return;
        p.edit().putBoolean("askedBattery", true).apply();
        android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
        if (pm == null || pm.isIgnoringBatteryOptimizations(getPackageName())) return;
        runOnUiThread(() -> {
            try {
                /* the app's own settings page: «Battery» → «Unrestricted» (no special permission needed) */
                android.widget.Toast.makeText(MainActivity.this, "Батарея → «Без ограничений», чтобы заказы звонили всегда", android.widget.Toast.LENGTH_LONG).show();
                startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
            } catch (Exception ignored) { }
        });
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    private static final String OFFLINE = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>body{margin:0;font-family:sans-serif;background:#F4F1EC;color:#1F1A17;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}"
            + ".b{display:inline-block;margin-top:18px;background:#E8590C;color:#fff;padding:14px 26px;border-radius:14px;text-decoration:none;font-weight:700}"
            + ".l{width:72px;height:72px;border-radius:20px;background:#E8590C;color:#fff;font:800 44px/72px sans-serif;margin:0 auto 18px}</style></head>"
            + "<body><div><div class='l'>T</div><h2>Интернет нест</h2><p>Пайвастро санҷед ва боз кӯшиш кунед.</p>"
            + "<a class='b' href='%URL%'>Боз кӯшиш</a></div></body></html>";
}
