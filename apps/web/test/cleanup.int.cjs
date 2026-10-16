/* Real server, real disk: old receipt files are deleted, old orders go to compressed monthly archives,
   unused pictures are swept, backups are compressed, the admin sees the sizes */
const { spawn } = require("child_process"), path = require("path"), fs = require("fs"), os = require("os"), zlib = require("zlib"), assert = require("assert");
const PORT = 9800 + Math.floor(Math.random() * 150), B = `http://localhost:${PORT}/api`;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cl-")), DATA = path.join(DIR, "db.json");
const run = () => { const p = spawn(process.execPath, [path.resolve(__dirname, "../../api/src/index.js")], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_PHONE: "931112233", ADMIN_PASSWORD: "Admin2026" }, stdio: ["ignore", "pipe", "pipe"] }); p.stderr.on("data", d => process.stderr.write(d)); return p; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const api = async (m, u, body, tok) => (await fetch(B + u, { method: m, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined })).json();
(async () => {
  let srv = run(); await sleep(900);
  const a = (await api("POST", "/auth/login", { phone: "931112233", password: "Admin2026" })).data.token;
  const nr = (await api("POST", "/admin/restaurants", { name: "Ошхона", ownerPhone: "935550099", cityId: "c5" }, a)).data;
  const rt = (await api("POST", "/auth/login", { phone: "935550099", password: nr.login.password })).data.token;
  const img = "data:image/jpeg;base64," + Buffer.alloc(30000, 7).toString("base64");
  const p1 = (await api("POST", "/restaurant/products", { name: "Палав", price: 40, categoryId: "k1", photo: img }, rt)).data;
  await api("PATCH", "/restaurant/products/" + p1.id, { photo: img }, rt);                 // replaced: the old picture is now unused
  srv.kill(); await sleep(400);
  /* put two old finished orders (with receipt files) and one fresh one straight into the data, as if months passed */
  const db = JSON.parse(fs.readFileSync(DATA, "utf8")), DAY = 864e5, now = Date.now();
  fs.mkdirSync(path.join(DIR, "receipts"), { recursive: true });
  const mk = (n, ageDays, status) => { const t = now - ageDays * DAY; fs.writeFileSync(path.join(DIR, "receipts", "rc" + n + ".jpeg"), Buffer.alloc(150000, 1));
    return { id: "o" + n, number: n, customerId: "x", restaurantId: nr.id, cityId: "c5", items: [], subtotal: 50, deliveryFee: 10, discount: 0, total: 60, status, createdAt: t, updatedAt: t, deliveredAt: t, history: [], payment: { method: "transfer", status: "paid", receiptId: "rc" + n } }; };
  db.orders.push(mk(9001, 120, "delivered"), mk(9002, 45, "delivered"), mk(9003, 2, "delivered"));
  fs.writeFileSync(DATA, JSON.stringify(db));
  const mediaDir = path.join(DIR, "media"); fs.readdirSync(mediaDir).forEach(f => { const t = new Date(now - 2 * DAY); fs.utimesSync(path.join(mediaDir, f), t, t); });
  const mediaBefore = fs.readdirSync(mediaDir).length;
  srv = run(); await sleep(900);
  const a2 = (await api("POST", "/auth/login", { phone: "931112233", password: "Admin2026" })).data.token;
  const r = (await api("POST", "/admin/cleanup", null, a2)).data;
  const rc = fs.readdirSync(path.join(DIR, "receipts"));
  assert.ok(!rc.includes("rc9001.jpeg") && !rc.includes("rc9002.jpeg"), "old receipts deleted"); assert.ok(rc.includes("rc9003.jpeg"), "fresh receipt kept");
  console.log("✓ receipt files: 45 and 120 days old deleted, 2 days old kept");
  const arch = fs.readdirSync(path.join(DIR, "archive")); const m = new Date(now - 120 * DAY).toISOString().slice(0, 7);
  assert.ok(arch.includes("orders-" + m + ".jsonl.gz")); const lines = zlib.gunzipSync(fs.readFileSync(path.join(DIR, "archive", "orders-" + m + ".jsonl.gz"))).toString().trim().split("\n");
  assert.equal(JSON.parse(lines[0]).id, "o9001");
  const left = JSON.parse(fs.readFileSync(DATA, "utf8")).orders.map(o => o.id); assert.ok(!left.includes("o9001") && left.includes("o9002") && left.includes("o9003"));
  console.log("✓ 120-day-old order in archive/" + "orders-" + m + ".jsonl.gz (readable), removed from the database; newer ones stay");
  const mediaAfter = fs.readdirSync(mediaDir); assert.equal(mediaAfter.length, mediaBefore - 1, "unused picture swept"); assert.ok(mediaAfter.includes(path.basename((await api("GET", "/products/" + p1.id)).data.photo)), "the dish photo in use stays");
  console.log("✓ media: the replaced, unused picture swept; the current dish photo kept (" + r.media + " removed)");
  const st = (await api("GET", "/admin/storage", null, a2)).data; assert.ok(st.info.db > 0 && st.info.archive > 0 && st.info.total > 0);
  console.log("✓ admin storage:", Object.entries(st.info).filter(([k]) => ["db", "receipts", "media", "archive", "backups"].includes(k)).map(([k, v]) => k + " " + Math.round(v / 1024) + "KB").join(", "));
  const bk = fs.readdirSync(path.join(DIR, "backups")); assert.ok(bk.length >= 1 && bk.every(f => f.endsWith(".json.gz"))); JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, "backups", bk[0]))).toString());
  console.log("✓ backups compressed and readable:", bk.join(", "));
  srv.kill(); console.log("\n5 та тозалаш синови ўтди"); process.exit(0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
