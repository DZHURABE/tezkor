/* The free setup: everything in PostgreSQL (like Neon), no disk.
   Needs a PostgreSQL server: PG_TEST_URL=postgresql://user:pass@host:port/postgres (a fresh database is created for the test) */
const { spawn } = require("child_process"), path = require("path"), assert = require("assert"), crypto = require("crypto");
const { createClient, lit } = require("../../api/src/pgwire.js");
const ADMIN = process.env.PG_TEST_URL;
if (!ADMIN) { console.log("PG_TEST_URL is not set — skipped"); process.exit(0); }
const NAME = "tz_" + crypto.randomBytes(4).toString("hex"), U = new URL(ADMIN); U.pathname = "/" + NAME; const URLDB = U.toString();
const PORT = 9950 + Math.floor(Math.random() * 40), B = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let srv = null;
const start = async () => { srv = spawn(process.execPath, [path.resolve(__dirname, "../../api/src/index.js")], { env: { ...process.env, PORT, DATABASE_URL: URLDB, ADMIN_PHONE: "931112233", ADMIN_PASSWORD: "Admin2026", FIRST_CLEANUP_MS: "600000" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; srv.stdout.on("data", d => out += d); srv.stderr.on("data", d => process.stderr.write("APP " + d));
  for (let i = 0; i < 60; i++) { if (/Tezkor API on/.test(out)) return out; await sleep(100); } throw new Error("server did not start: " + out); };
const stop = async (sig = "SIGTERM") => { const p = srv; await new Promise(r => { p.once("exit", r); p.kill(sig); }); };
const api = async (m, u, body, tok) => (await fetch(B + "/api" + u, { method: m, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined })).json();
let pass = 0; const t = async (n, f) => { await f(); pass++; console.log("✓", n); };
(async () => {
  const adm = createClient(ADMIN); await adm.query(`create database ${NAME}`);
  const db = createClient(URLDB);
  try {
    const out = await start();
    await t("сервер PostgreSQL билан ишга тушди: " + out.match(/data: ([^)]+)/)[1], async () => {
      const r = await db.query("select count(*) n from tezkor_state"); assert.equal(+r.rows[0].n, 1, "first state written"); });
    const img = "data:image/jpeg;base64," + Buffer.alloc(20000, 9).toString("base64"), rimg = "data:image/jpeg;base64," + Buffer.alloc(40000, 3).toString("base64");
    let a = (await api("POST", "/auth/login", { phone: "931112233", password: "Admin2026" })).data.token;
    const nr = (await api("POST", "/admin/restaurants", { name: "Ошхонаи Неон", ownerPhone: "935550077", cityId: "c5" }, a)).data;
    const rt = (await api("POST", "/auth/login", { phone: "935550077", password: nr.login.password })).data.token;
    const p1 = (await api("POST", "/restaurant/products", { name: "Палав", price: 40, categoryId: "k1", photo: img }, rt)).data;
    await api("PATCH", "/restaurant/me", { open: true, hours: { from: "00:00", to: "23:59" }, payCard: { number: "1111222233334444", holder: "A", bank: "B" } }, rt);
    const cu = (await api("POST", "/auth/register", { name: "Мижоз", phone: "938880101", password: "Parol123" })).data.token;
    const o = (await api("POST", "/orders", { restaurantId: nr.id, items: [{ productId: p1.id, qty: 2 }], address: { text: "кӯчаи Ленин 5", lat: 37.268, lng: 68.145 }, paymentMethod: "transfer", receipt: rimg }, cu)).data;
    await t("расм ва чек дарҳол кўринади", async () => {
      const ph = await fetch(B + p1.photo); assert.equal(ph.status, 200); assert.equal((await ph.arrayBuffer()).byteLength, 20000);
      const rc = await api("GET", "/orders/" + o.id + "/receipt", null, rt); assert.equal(rc.data.image, rimg);
      assert.equal((await api("GET", "/orders/" + o.id + "/receipt", null, cu)).ok, true); });
    await sleep(400);
    await t("расм ва чек базага ёзилди (bytea)", async () => {
      const r = await db.query("select kind, octet_length(data) n from tezkor_files order by kind"); assert.deepEqual(r.rows.map(x => x.kind + ":" + x.n), ["media:20000", "receipt:40000"]); });
    await stop("SIGTERM"); await start();
    await t("сервер қайта ёқилди — ҳамма нарса жойида (мижоз пароли, буюртма, расм, чек)", async () => {
      const lg = await api("POST", "/auth/login", { phone: "938880101", password: "Parol123" }); assert.ok(lg.ok); const cu2 = lg.data.token;
      assert.equal((await api("GET", "/orders/" + o.id, null, cu2)).data.items[0].qty, 2);
      assert.equal((await (await fetch(B + p1.photo)).arrayBuffer()).byteLength, 20000);
      const rt2 = (await api("POST", "/auth/login", { phone: "935550077", password: nr.login.password })).data.token;
      assert.equal((await api("GET", "/orders/" + o.id + "/receipt", null, rt2)).data.image, rimg); });
    await t("база уланишни узса (Neon ухлаганда) — сервер тушмайди, қайта уланади", async () => {
      await adm.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = '${NAME}' and application_name = 'tezkor' and pid <> pg_backend_pid()`);
      await sleep(300); assert.equal(srv.exitCode, null, "server still running");
      a = (await api("POST", "/auth/login", { phone: "931112233", password: "Admin2026" })).data.token; await api("PATCH", "/admin/settings", { deliveryBase: 9 }, a); await sleep(400);
      assert.equal(JSON.parse((await db.query("select data from tezkor_state where id = 1")).rows[0].data).settings.deliveryBase, 9, "written after reconnect"); });
    await stop("SIGKILL"); await start();
    await t("сервер «қулаганда» ҳам (kill -9) охирги ўзгариш сақланди", async () => {
      const a2 = (await api("POST", "/auth/login", { phone: "931112233", password: "Admin2026" })).data.token; assert.equal((await api("GET", "/admin/settings", null, a2)).data.deliveryBase, 9); });
    await stop();
    /* an old finished order with a receipt, as if 4 months passed */
    const st = JSON.parse((await db.query("select data from tezkor_state where id = 1")).rows[0].data), old = Date.now() - 120 * 864e5;
    st.orders.push({ id: "o99", number: 99, customerId: "x", restaurantId: nr.id, cityId: "c5", items: [], subtotal: 70, deliveryFee: 10, discount: 0, total: 80, status: "delivered", createdAt: old, updatedAt: old, deliveredAt: old, history: [], payment: { method: "transfer", status: "paid", receiptId: "rc99" } });
    st.meta.lastCleanup = null; await db.query(`update tezkor_state set data = ${lit(JSON.stringify(st))} where id = 1; insert into tezkor_files (id, kind, mime, data) values ('rc:rc99', 'receipt', 'image/jpeg', decode('AAAA','base64'))`);
    await start();
    await t("тозалаш: эски чек базадан ўчди, эски буюртма архив жадвалига ўтди", async () => {
      const a3 = (await api("POST", "/auth/login", { phone: "931112233", password: "Admin2026" })).data.token; await api("POST", "/admin/cleanup", null, a3); await sleep(600);
      assert.equal(+(await db.query("select count(*) n from tezkor_files where id = 'rc:rc99'")).rows[0].n, 0);
      const ar = (await db.query("select month, orders from tezkor_archive")).rows; assert.equal(ar.length, 1); assert.equal(JSON.parse(ar[0].orders.split("\n")[0]).id, "o99");
      assert.ok(!JSON.parse((await db.query("select data from tezkor_state where id = 1")).rows[0].data).orders.some(x => x.id === "o99"));
      const s = (await api("GET", "/admin/storage", null, a3)).data; assert.equal(s.info.kind, "postgres"); assert.ok(s.info.total > 0 && s.info.disk === 512 * 1048576); });
    await stop();
    await t("база ишламаса — сервер аниқ хато билан тўхтайди (бўш ҳолда ишламайди)", async () => {
      const p = spawn(process.execPath, [path.resolve(__dirname, "../../api/src/index.js")], { env: { ...process.env, PORT: PORT + 1, DATABASE_URL: "postgresql://tezkor:x@127.0.0.1:1/none?sslmode=disable", ADMIN_PHONE: "931112233", ADMIN_PASSWORD: "Admin2026" } });
      let err = ""; p.stderr.on("data", d => err += d); const code = await new Promise(r => p.on("exit", r)); assert.equal(code, 1); assert.match(err, /Could not start/); });
    console.log(`\n${pass} та PostgreSQL синови ўтди`);
  } finally { try { if (srv && srv.exitCode == null) srv.kill(); } catch {} db.end(); await sleep(300); await adm.query(`drop database if exists ${NAME} with (force)`).catch(() => {}); adm.end(); }
  process.exit(0);
})().catch(e => { console.error("FAIL", e); try { srv && srv.kill(); } catch {} process.exit(1); });
