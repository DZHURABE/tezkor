/* Тезкор — HTTP API (Node.js, zero dependencies).
   Runs the SAME business logic as the browser prototype (apps/web/src/core) behind real HTTP:
     GET/POST/PATCH/DELETE /api/*   → JSON API ({ ok, data } | { ok:false, error })
     everything else                 → the web app (apps/web/dist/index.html) wired to this API
   Storage (storage.js): a JSON file on a disk (DATA_FILE), or PostgreSQL when DATABASE_URL is set (e.g. Neon free tier). */
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto"), zlib = require("zlib");
const { createServer } = require("../../web/src/core/server.js");
const payments = require("./providers/payments.js");
const maps = require("./providers/maps.js");
const { createVerify } = require("./verify.js");
const site = require("./site.js");
const verify = createVerify();   // Telegram / WhatsApp / SMS — each turns on when its settings are present (see verify.js)

const PORT = +process.env.PORT || 8080;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "../data/db.json");
const DIST = process.env.WEB_DIST || path.join(__dirname, "../../web/dist");
const WEB = path.join(DIST, "app.html");
/* files of the installable app; everything else that is a GET returns the app page */
const STATIC = { "/og.png": "image/png", "/sw.js": "application/javascript", "/manifest.webmanifest": "application/manifest+json", "/icons/icon-192.png": "image/png", "/icons/icon-512.png": "image/png", "/icons/maskable-512.png": "image/png", "/icons/apple-180.png": "image/png" };
const ORIGINS = (process.env.CORS_ORIGINS || "*").split(",");

const DEMO = process.env.DEMO === "1";          // DEMO=1: example restaurants, test cards, demo logins
const { openStorage } = require("./storage.js");
/* passwords: scrypt with a random salt per user */
function hashPassword(pw) { const salt = crypto.randomBytes(16).toString("hex"); return "s1$" + salt + "$" + crypto.scryptSync(String(pw), salt, 32).toString("hex"); }
function checkPassword(pw, stored) {
  if (!stored || !stored.startsWith("s1$")) return false;
  const [, salt, hex] = stored.split("$"), a = crypto.scryptSync(String(pw), salt, 32), b = Buffer.from(hex, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/* Android app: the file built by GitHub Actions, or APK_URL (e.g. a GitHub release link) */
const APK = path.join(DIST, "tezkor.apk");
const apkAvailable = () => fs.existsSync(APK) || !!process.env.APK_URL;
function cors(req, res) {
  const o = req.headers.origin; const ok = ORIGINS.includes("*") || (o && ORIGINS.includes(o));
  if (ok) { res.setHeader("Access-Control-Allow-Origin", ORIGINS.includes("*") ? "*" : o); res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS"); }
}
/* responses bigger than a few KB are compressed when the browser accepts it (lists of dishes, orders…) */
function send(res, status, obj, type = "application/json; charset=utf-8") {
  let body = typeof obj === "string" ? obj : JSON.stringify(obj); const h = { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Vary": "Accept-Encoding" };
  const ae = String((res.req && res.req.headers["accept-encoding"]) || "");
  if (body.length > 4096 && /\bgzip\b/.test(ae)) { body = zlib.gzipSync(body, { level: 5 }); h["Content-Encoding"] = "gzip"; }
  res.writeHead(status, h); res.end(body);
}
/* the real visitor address: behind Render / Caddy / nginx the socket is the proxy, the last X-Forwarded-For entry is the visitor */
function clientIp(req) { const xf = String(req.headers["x-forwarded-for"] || "").split(",").map(x => x.trim()).filter(Boolean); return (process.env.TRUST_PROXY !== "0" && xf.length ? xf[xf.length - 1] : req.socket.remoteAddress) || ""; }
function readBody(req) { return new Promise((ok, no) => { let b = ""; req.on("data", c => { b += c; if (b.length > 5e6) { no(new Error("TOO_LARGE")); req.destroy(); } }); req.on("end", () => ok(b)); req.on("error", no); }); }

/* very small rate limiter for auth endpoints (per IP) */
const hits = new Map();
function limited(ip, key, max = 20, windowMs = 60000) { const k = ip + key, now = Date.now(), h = (hits.get(k) || []).filter(t => now - t < windowMs); h.push(now); hits.set(k, h); return h.length > max; }
/* forget old entries so the table does not grow forever */
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (!h.length || now - h[h.length - 1] > 120000) hits.delete(k); }, 60000).unref();
/* overall per-visitor limit for the API — generous, because many phones share one mobile-network address */
const API_MAX = +process.env.API_RATE_PER_MIN || 600;

/* the app page, with the search-engine / share tags for the address it is served on */
const pages = new Map();
function webPage(base) {
  if (!pages.has(base)) {
    let p;
    try {
      p = fs.readFileSync(WEB, "utf8").replace("<head>", "<head><script>window.SOMON_CONFIG=" + JSON.stringify({ api: "/api", tiles: process.env.MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", satTiles: process.env.MAP_SAT_TILES != null ? process.env.MAP_SAT_TILES : undefined, satAttr: process.env.MAP_SAT_ATTR || undefined, tilesAttr: process.env.MAP_TILES_ATTR || "© OpenStreetMap" }) + "</script>")
        .replace(/<title>[^<]*<\/title>/, "<title>" + site.TITLE + "</title>").replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + site.DESC + '">')
        .replace("</head>", site.headTags(base) + "</head>").replace("<body>", "<body>" + site.noscript(base));
    } catch { p = "<h1>Build the web app first: node apps/web/build.mjs</h1>"; }
    const tag = '"' + crypto.createHash("sha1").update(p).digest("base64url").slice(0, 20) + '"';
    pages.set(base, { html: p, tag, gz: zlib.gzipSync(p, { level: 9 }), br: zlib.brotliCompressSync(p, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }) });
  }
  return pages.get(base);
}
/* the app page: compressed once at start (1.5 MB → ~0.3 MB), and "not modified" when the phone already has this version */
function sendPage(req, res, base) {
  const pg = webPage(base), h = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "ETag": pg.tag, "Vary": "Accept-Encoding", "X-Content-Type-Options": "nosniff" };
  if (req.headers["if-none-match"] === pg.tag) { res.writeHead(304, h); return res.end(); }
  const ae = String(req.headers["accept-encoding"] || "");
  if (/\bbr\b/.test(ae)) { h["Content-Encoding"] = "br"; res.writeHead(200, h); return res.end(pg.br); }
  if (/\bgzip\b/.test(ae)) { h["Content-Encoding"] = "gzip"; res.writeHead(200, h); return res.end(pg.gz); }
  res.writeHead(200, h); res.end(pg.html);
}

let api = null, be = null;
async function main() {
  be = await openStorage(process.env, console.log);
  let push = null;
  /* the push keys live in the database: on Render free there is no disk, a key file would vanish on every restart
     and every phone would silently stop getting order alerts */
  let saved = null; try { const d0 = be.store.load(); saved = d0 && d0.settings && d0.settings.vapid; } catch (e) {}
  const pushEnv = Object.assign({}, process.env, !process.env.VAPID_PUBLIC_KEY && saved && saved.pub && saved.priv ? { VAPID_PUBLIC_KEY: saved.pub, VAPID_PRIVATE_KEY: saved.priv } : {});
  try { push = require("./providers/webpush").create(pushEnv, { dir: path.dirname(DATA_FILE), i18nFile: path.join(__dirname, "../../web/src/ui/i18n.js"), log: console.log }); } catch (e) { console.error("push disabled:", e.message); }
  const keep = { alertSms: verify.smsReady ? verify.sms : null, push, store: be.store, files: be.files, media: be.media, archive: be.archive, storageInfo: be.storageInfo, afterCleanup: be.sweepMedia, apkAvailable, verify, verifyStatus: verify.status };
  api = createServer(DEMO ? keep : Object.assign(keep, {
    production: true, hashPassword, checkPassword,
    newToken: () => crypto.randomBytes(24).toString("base64url"),
    newPassword: () => String(crypto.randomInt(100000, 1000000)),
    cardProvider: process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== "mock" ? process.env.PAYMENT_PROVIDER : null,
    admin: { phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_NAME || "Admin" },
    resetAdmin: process.env.ADMIN_RESET_PASSWORD ? { phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_RESET_PASSWORD } : null,
  }));
  try { const d1 = api._db(); if (push && push.keys && d1 && d1.settings && !process.env.VAPID_PUBLIC_KEY && !(d1.settings.vapid && d1.settings.vapid.pub === push.keys.pub)) { d1.settings.vapid = { pub: push.keys.pub, priv: push.keys.priv }; be.store.save(d1); console.log("push: keys kept in the database"); } } catch (e) { console.error("push keys:", e.message); }
  /* every minute: nudge the shop phones about orders nobody has accepted yet, even when nobody opens the app */
  setInterval(() => { try { api.tick(); } catch (e) {} }, 60e3).unref();
  /* housekeeping once a day (also a minute after start), so the storage never fills up */
  const housekeeping = async () => { try { const r = api.cleanup(); r.media = be.sweepMedia(api._db()); await be.backup(api._db()); console.log("cleanup:", JSON.stringify(r)); } catch (e) { console.error("cleanup failed:", e.message); } };
  setTimeout(housekeeping, +process.env.FIRST_CLEANUP_MS || 60e3).unref(); setInterval(housekeeping, 24 * 3600e3).unref();
  /* Render / systemd stop the server with SIGTERM: write what is still in memory first */
  const stop = async () => { try { verify.stop(); await be.flush(); } finally { process.exit(0); } };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);

  const server = http.createServer((req, res) => handler(req, res).catch(e => {
    console.error("request failed:", req.method, req.url, e && e.message);
    if (!res.headersSent) send(res, 500, { ok: false, error: { code: "SERVER_ERROR" } }); else res.end();
  }));
  async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return send(res, 204, "");
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/health") return send(res, 200, { ok: true, version: api.version() });
  /* WhatsApp (Meta) webhook: GET once to check it, POST for every incoming message */
  if (url.pathname === "/webhooks/whatsapp") {
    if (req.method === "GET") { const r = verify.whatsappVerify(Object.fromEntries(url.searchParams)); return send(res, r.status, r.body, "text/plain; charset=utf-8"); }
    if (req.method === "POST") { let raw; try { raw = await readBody(req); } catch { return send(res, 413, "too large", "text/plain"); } const r = verify.whatsappIncoming(raw, req.headers); return send(res, r.status, r.body, "text/plain; charset=utf-8"); }
  }
  if (url.pathname.startsWith("/api/")) {
    const ip = clientIp(req);
    if (limited(ip, "*api", API_MAX)) return send(res, 429, { ok: false, error: { code: "RATE_LIMITED" } });
    if (url.pathname.startsWith("/api/auth/") && req.method === "POST" && limited(ip, url.pathname)) return send(res, 429, { ok: false, error: { code: "RATE_LIMITED" } });
    let body = null;
    if (req.method !== "GET") { try { const raw = await readBody(req); body = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, { ok: false, error: { code: "BAD_JSON" } }); } }
    /* payment webhooks from real providers land here and are verified by the provider adapter */
    if (url.pathname.startsWith("/api/payments/webhook/")) {
      const name = url.pathname.split("/").pop(); const p = payments.get(name);
      if (!p) return send(res, 404, { ok: false, error: { code: "NOT_FOUND" } });
      return send(res, 200, { ok: true, data: await p.handleWebhook(req.headers, body) });
    }
    if (url.pathname === "/api/maps/route") { const q = Object.fromEntries(url.searchParams); return send(res, 200, { ok: true, data: await maps.get().route({ lat: +q.fromLat, lng: +q.fromLng }, { lat: +q.toLat, lng: +q.toLng }) }); }
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || null;
    /* receipt photo: the core checks who may see it, the storage reads the bytes */
    const rm = /^\/api\/orders\/([^/]+)\/receipt$/.exec(url.pathname);
    if (rm && req.method === "GET") { const ref = api.handle("GET", "/orders/" + rm[1] + "/receipt-ref", null, token); if (!ref.body.ok) return send(res, ref.status, ref.body);
      const image = await be.readReceipt(ref.body.data.receiptId); return image ? send(res, 200, { ok: true, data: { image } }) : send(res, 404, { ok: false, error: { code: "NOT_FOUND" } }); }
    const r = api.handle(req.method, url.pathname.slice(4) + url.search, body, token);
    return send(res, r.status, r.body);
  }
  if (req.method === "GET" && STATIC[url.pathname]) {
    try { const body = fs.readFileSync(path.join(DIST, url.pathname)); res.writeHead(200, { "Content-Type": STATIC[url.pathname], "Cache-Control": url.pathname.startsWith("/icons/") ? "public, max-age=604800" : "no-cache" }); return res.end(body); }
    catch { return send(res, 404, { ok: false, error: { code: "NOT_FOUND" } }); }
  }
  if (req.method === "GET" && (url.pathname === "/tezkor.apk" || url.pathname === "/app.apk")) {
    if (fs.existsSync(APK)) { const st = fs.statSync(APK); res.writeHead(200, { "Content-Type": "application/vnd.android.package-archive", "Content-Length": st.size, "Content-Disposition": 'attachment; filename="tezkor.apk"', "Cache-Control": "no-cache" }); return fs.createReadStream(APK).pipe(res); }
    if (process.env.APK_URL) { res.writeHead(302, { Location: process.env.APK_URL }); return res.end(); }
    return send(res, 404, "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><body style='font-family:sans-serif;padding:24px'><h2>APK ҳоло тайёр нест</h2><p>Барномаро аз браузер насб кунед: менюи браузер → «Ба экрани асосӣ илова кардан».</p><p><a href='/'>Ба саҳифаи асосӣ</a></p>", "text/html; charset=utf-8");
  }
  if (req.method === "GET" && url.pathname.startsWith("/media/")) {
    const n = path.basename(url.pathname), m = /^[\w-]+\.(jpeg|png|webp)$/.exec(n);
    if (m) { const f = await be.readMedia(n).catch(() => null); if (f) { res.writeHead(200, { "Content-Type": f.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" }); return res.end(f.buf); } }
    return send(res, 404, { ok: false, error: { code: "NOT_FOUND" } });
  }
  if (req.method === "GET" && (url.pathname === "/download" || url.pathname === "/download/" || url.pathname === "/app")) {
    const st = verify.status(); return send(res, 200, site.downloadPage(site.baseUrl(req), { apk: apkAvailable(), botName: /^@/.test(st.telegramBot) ? st.telegramBot.slice(1) : null }), "text/html; charset=utf-8"); }
  /* table QR stickers: /t/<code> opens the restaurant menu for that table (no sign-up) */
  { const tm = req.method === "GET" && url.pathname.match(/^\/t\/([A-Za-z0-9_-]{4,40})\/?$/);
    if (tm) { res.writeHead(302, { Location: "/#/t/" + tm[1], "Cache-Control": "no-store" }); return res.end(); } }
  if (req.method === "GET" && url.pathname === "/robots.txt") return send(res, 200, site.robots(site.baseUrl(req)), "text/plain; charset=utf-8");
  if (req.method === "GET" && url.pathname === "/sitemap.xml") return send(res, 200, site.sitemap(site.baseUrl(req)), "application/xml; charset=utf-8");
  if (req.method === "GET") return sendPage(req, res, site.baseUrl(req));
  send(res, 404, { ok: false, error: { code: "NOT_FOUND" } });
  }
  /* slow or stuck connections do not pile up; keep-alive outlasts the proxy's idle timeout */
  server.on("error", e => { console.error("server error:", e.message); process.exit(1); });
  server.requestTimeout = 30000; server.headersTimeout = 20000; server.keepAliveTimeout = 65000;
  server.listen(PORT, () => { console.log(`Tezkor API on http://localhost:${PORT}  (data: ${be.kind} ${be.where})`); verify.attach(api); console.log("Phone verification:", JSON.stringify(verify.status())); });
}
/* one bad request or a provider that throws must not take the whole site down */
process.on("unhandledRejection", e => console.error("unhandled:", e && e.message || e));
process.on("uncaughtException", e => console.error("uncaught:", e && e.stack || e));
main().catch(e => { console.error("Could not start:", e.message); process.exit(1); });
