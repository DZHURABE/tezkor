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
function send(res, status, obj, type = "application/json; charset=utf-8") { res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(typeof obj === "string" ? obj : JSON.stringify(obj)); }
function readBody(req) { return new Promise((ok, no) => { let b = ""; req.on("data", c => { b += c; if (b.length > 5e6) { no(new Error("TOO_LARGE")); req.destroy(); } }); req.on("end", () => ok(b)); req.on("error", no); }); }

/* very small rate limiter for auth endpoints (per IP) */
const hits = new Map();
function limited(ip, key, max = 20, windowMs = 60000) { const k = ip + key, now = Date.now(), h = (hits.get(k) || []).filter(t => now - t < windowMs); h.push(now); hits.set(k, h); return h.length > max; }

/* the app page, with the search-engine / share tags for the address it is served on */
const pages = new Map();
function webPage(base) {
  if (!pages.has(base)) {
    let p;
    try {
      p = fs.readFileSync(WEB, "utf8").replace("<head>", "<head><script>window.SOMON_CONFIG=" + JSON.stringify({ api: "/api", tiles: process.env.MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", tilesAttr: process.env.MAP_TILES_ATTR || "© OpenStreetMap" }) + "</script>")
        .replace(/<title>[^<]*<\/title>/, "<title>" + site.TITLE + "</title>").replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + site.DESC + '">')
        .replace("</head>", site.headTags(base) + "</head>").replace("<body>", "<body>" + site.noscript(base));
    } catch { p = "<h1>Build the web app first: node apps/web/build.mjs</h1>"; }
    pages.set(base, p);
  }
  return pages.get(base);
}

let api = null, be = null;
async function main() {
  be = await openStorage(process.env, console.log);
  const keep = { store: be.store, files: be.files, media: be.media, archive: be.archive, storageInfo: be.storageInfo, afterCleanup: be.sweepMedia, apkAvailable, verify, verifyStatus: verify.status };
  api = createServer(DEMO ? keep : Object.assign(keep, {
    production: true, hashPassword, checkPassword,
    newToken: () => crypto.randomBytes(24).toString("base64url"),
    newPassword: () => String(crypto.randomInt(100000, 1000000)),
    cardProvider: process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== "mock" ? process.env.PAYMENT_PROVIDER : null,
    admin: { phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_NAME || "Admin" },
    resetAdmin: process.env.ADMIN_RESET_PASSWORD ? { phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_RESET_PASSWORD } : null,
  }));
  /* housekeeping once a day (also a minute after start), so the storage never fills up */
  const housekeeping = async () => { try { const r = api.cleanup(); r.media = be.sweepMedia(api._db()); await be.backup(api._db()); console.log("cleanup:", JSON.stringify(r)); } catch (e) { console.error("cleanup failed:", e.message); } };
  setTimeout(housekeeping, +process.env.FIRST_CLEANUP_MS || 60e3).unref(); setInterval(housekeeping, 24 * 3600e3).unref();
  /* Render / systemd stop the server with SIGTERM: write what is still in memory first */
  const stop = async () => { try { verify.stop(); await be.flush(); } finally { process.exit(0); } };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);

  const server = http.createServer(async (req, res) => {
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
    const ip = req.socket.remoteAddress || "";
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
  if (req.method === "GET") return send(res, 200, webPage(site.baseUrl(req)), "text/html; charset=utf-8");
  send(res, 404, { ok: false, error: { code: "NOT_FOUND" } });
});
  server.listen(PORT, () => { console.log(`Tezkor API on http://localhost:${PORT}  (data: ${be.kind} ${be.where})`); verify.attach(api); console.log("Phone verification:", JSON.stringify(verify.status())); });
}
main().catch(e => { console.error("Could not start:", e.message); process.exit(1); });
