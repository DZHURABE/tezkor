/* Build:
   dist/index.html — one self-contained page (online demo: runs the API inside the browser)
   dist/app.html   — the same app for the real server, plus "install as an app" (PWA): manifest, icons, service worker */
import fs from "fs";
const order = ["core/rules.js","core/seed.js","core/server.js","core/client.js","ui/kit.js","ui/photos.js","ui/qr.js","ui/i18n.js","ui/map.js","ui/shell.js","ui/customer.js","ui/home.js","ui/ads.js","ui/table.js","ui/auth.js","ui/verify.js","ui/restaurant.js","ui/starter.js","ui/catalog.js","ui/courier.js","ui/admin.js","ui/books.js","ui/pause.js","ui/pwa.js","ui/alarm.js","ui/push.js","ui/app.js"];
const NAME = "Тезкор", VERSION = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const css = fs.readFileSync("src/styles.css", "utf8");
const js = order.map(f => `/* ==== ${f} ==== */\n` + fs.readFileSync("src/" + f, "utf8")).join("\n");
const page = (extraHead) => `<!doctype html>
<html lang="tg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>${NAME}</title>
<meta name="description" content="${NAME} — расонидани тез дар Шаҳритус">
<meta name="theme-color" content="#E8590C">${extraHead}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@600;700;800&display=swap" rel="stylesheet">
<style>${css}</style></head>
<body><div id="app"></div><div id="modal" hidden></div><div id="toasts" aria-live="polite"></div>
<script>window.SOMON_BUILD="${VERSION}";</script>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;

fs.mkdirSync("dist/icons", { recursive: true });
fs.writeFileSync("dist/index.html", page(""));
fs.writeFileSync("dist/app.html", page(`
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-180.png">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${NAME}"><meta name="apple-mobile-web-app-status-bar-style" content="default">`));
for (const f of fs.readdirSync("public/icons")) fs.copyFileSync("public/icons/" + f, "dist/icons/" + f);
fs.copyFileSync("public/og.png", "dist/og.png");   // picture shown when the link is shared
/* the Android app, built by GitHub Actions (.github/workflows/apk.yml) */
if (fs.existsSync("public/tezkor.apk")) fs.copyFileSync("public/tezkor.apk", "dist/tezkor.apk"); else if (fs.existsSync("dist/tezkor.apk")) fs.unlinkSync("dist/tezkor.apk");
fs.writeFileSync("dist/manifest.webmanifest", JSON.stringify({
  name: NAME + " — расонидани таом", short_name: NAME, id: "/", start_url: "/?source=app", scope: "/", display: "standalone", orientation: "portrait",
  background_color: "#F4F1EC", theme_color: "#E8590C", lang: "tg", categories: ["food", "shopping"],
  icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
}, null, 1));
/* service worker: always asks the server first (so every update reaches people at once), keeps a copy for when the network drops */
fs.writeFileSync("dist/sw.js", `/* ${NAME} ${VERSION} */
const CACHE = "tez-${VERSION}";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png"]))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title || "Тезкор", { body: d.body || "", tag: d.tag || "tezkor", renotify: true, requireInteraction: !!d.urgent, vibrate: d.urgent ? [400, 150, 400, 150, 600] : [200], icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: d.url || "/" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => { for (const c of cs) { if ("focus" in c) { c.navigate && c.navigate(url).catch(() => {}); return c.focus(); } } return self.clients.openWindow(url); }));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || /^\/(api|webhooks|media)\//.test(u.pathname) || /^\/(download|tezkor\.apk|app\.apk|robots\.txt|sitemap\.xml)$/.test(u.pathname)) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok && ((e.request.mode === "navigate" && u.pathname === "/") || u.pathname.startsWith("/icons/"))) { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request.mode === "navigate" ? "/" : e.request, c)); } return r; })
    .catch(() => caches.match(e.request.mode === "navigate" ? "/" : e.request)));
});
`);
console.log("dist/index.html + dist/app.html", (page("").length / 1024).toFixed(0) + "KB, version " + VERSION);
