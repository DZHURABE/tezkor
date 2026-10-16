/* SOMON FOOD — HTTP API (Node.js, zero dependencies).
   Runs the SAME business logic as the browser prototype (apps/web/src/core) behind real HTTP:
     GET/POST/PATCH/DELETE /api/*   → JSON API ({ ok, data } | { ok:false, error })
     everything else                 → the web app (apps/web/dist/index.html) wired to this API
   Storage: JSON file (DATA_FILE). Swap for PostgreSQL via db/schema.sql + a repository layer (see README). */
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
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
const BACKUP_DIR = path.join(path.dirname(DATA_FILE), "backups");
let lastBackup = 0;
const store = {
  load() {
    if (!fs.existsSync(DATA_FILE)) return null;
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));   // a corrupt file stops the start instead of silently starting empty
  },
  save(db) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DATA_FILE);
    if (Date.now() - lastBackup > 3600e3) {   // hourly copy, the last 7 days kept
      lastBackup = Date.now(); fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, "db-" + new Date().toISOString().slice(0, 13).replace(/[-T:]/g, "") + ".json"));
      fs.readdirSync(BACKUP_DIR).sort().slice(0, -168).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
    }
  },
};
/* passwords: scrypt with a random salt per user */
function hashPassword(pw) { const salt = crypto.randomBytes(16).toString("hex"); return "s1$" + salt + "$" + crypto.scryptSync(String(pw), salt, 32).toString("hex"); }
function checkPassword(pw, stored) {
  if (!stored || !stored.startsWith("s1$")) return false;
  const [, salt, hex] = stored.split("$"), a = crypto.scryptSync(String(pw), salt, 32), b = Buffer.from(hex, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/* payment receipt photos: files next to the data, never inside db.json */
const RECEIPTS = path.join(path.dirname(DATA_FILE), "receipts");
const files = {
  put(id, dataUrl) { const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl); if (!m) return; fs.mkdirSync(RECEIPTS, { recursive: true }); fs.writeFileSync(path.join(RECEIPTS, id + "." + m[1]), Buffer.from(m[2], "base64")); },
  get(id) { for (const ext of ["jpeg", "png", "webp"]) { const f = path.join(RECEIPTS, id + "." + ext); if (fs.existsSync(f)) return "data:image/" + ext + ";base64," + fs.readFileSync(f).toString("base64"); } return null; },
};
/* dish photos, restaurant covers and ads: public files served at /media/… */
const MEDIA = path.join(path.dirname(DATA_FILE), "media");
const media = {
  put(id, dataUrl) { const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl); fs.mkdirSync(MEDIA, { recursive: true }); const name = id + "." + m[1]; fs.writeFileSync(path.join(MEDIA, name), Buffer.from(m[2], "base64")); return "/media/" + name; },
  del(url) { const n = path.basename(String(url || "")); if (/^[\w-]+\.(jpeg|png|webp)$/.test(n)) fs.rm(path.join(MEDIA, n), { force: true }, () => {}); },
};
/* Android app: the file built by GitHub Actions, or APK_URL (e.g. a GitHub release link) */
const APK = path.join(DIST, "tezkor.apk");
const apkAvailable = () => fs.existsSync(APK) || !!process.env.APK_URL;
const api = createServer(DEMO ? { store, files, media, apkAvailable, verify, verifyStatus: verify.status } : {
  store, files, media, apkAvailable, verify, verifyStatus: verify.status, production: true, hashPassword, checkPassword,
  newToken: () => crypto.randomBytes(24).toString("base64url"),
  newPassword: () => String(crypto.randomInt(100000, 1000000)),
  cardProvider: process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== "mock" ? process.env.PAYMENT_PROVIDER : null,
  admin: { phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_NAME || "Admin" },
  resetAdmin: process.env.ADMIN_RESET_PASSWORD ? { phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_RESET_PASSWORD } : null,
});

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

http.createServer(async (req, res) => {
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
    if (m) { try { const body = fs.readFileSync(path.join(MEDIA, n)); res.writeHead(200, { "Content-Type": "image/" + m[1], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" }); return res.end(body); } catch {} }
    return send(res, 404, { ok: false, error: { code: "NOT_FOUND" } });
  }
  if (req.method === "GET" && (url.pathname === "/download" || url.pathname === "/download/" || url.pathname === "/app")) {
    const st = verify.status(); return send(res, 200, site.downloadPage(site.baseUrl(req), { apk: apkAvailable(), botName: /^@/.test(st.telegramBot) ? st.telegramBot.slice(1) : null }), "text/html; charset=utf-8"); }
  if (req.method === "GET" && url.pathname === "/robots.txt") return send(res, 200, site.robots(site.baseUrl(req)), "text/plain; charset=utf-8");
  if (req.method === "GET" && url.pathname === "/sitemap.xml") return send(res, 200, site.sitemap(site.baseUrl(req)), "application/xml; charset=utf-8");
  if (req.method === "GET") return send(res, 200, webPage(site.baseUrl(req)), "text/html; charset=utf-8");
  send(res, 404, { ok: false, error: { code: "NOT_FOUND" } });
}).listen(PORT, () => { console.log(`Tezkor API on http://localhost:${PORT}  (data: ${DATA_FILE})`); verify.attach(api); console.log("Phone verification:", JSON.stringify(verify.status())); });
