/* Real-launch rehearsal: the production server over HTTP, four people on four separate phones.
   Run from apps/web:  node build.mjs && node test/prod.e2e.cjs */
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const _origClick = Symbol();
function quietAlarms(p) { const orig = p.click.bind(p); p.click = async (sel, o) => { await p.evaluate(() => { if (!window.SF) return; SF.alarmCheck = function () {}; const a = document.getElementById("alarm"); if (a) a.hidden = true; }).catch(() => {}); return orig(sel, o); }; return p; }
const { spawn } = require("child_process"), path = require("path"), fs = require("fs"), os = require("os");
const PORT = 8100 + Math.floor(Math.random() * 800), BASE = `http://localhost:${PORT}/`;
const DATA = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tez-")), "db.json");
const S = path.resolve(__dirname, "../shots/prod"); fs.mkdirSync(S, { recursive: true });
const log = (...a) => console.log("•", ...a);
(async () => {
  const srv = spawn(process.execPath, [path.resolve(__dirname, "../../api/src/index.js")], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_PHONE: "931112233", ADMIN_PASSWORD: "Admin2026", ADMIN_NAME: "Admin" }, stdio: ["ignore", "pipe", "pipe"] });
  srv.stderr.on("data", d => process.stderr.write("SERVER " + d)); process.on("exit", () => { try { srv.kill(); } catch (e) {} });
  await new Promise(r => setTimeout(r, 900));
  const b = await chromium.launch(), errs = [];
  const phone = async (name) => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await c.route(/fonts\.(googleapis|gstatic)|tile\.openstreetmap/, r => r.abort()); const p = await c.newPage(); await p.clock.setFixedTime(new Date("2026-10-16T08:00:00Z"));
    p.on("pageerror", e => errs.push(name + ": " + e.message)); await p.goto(BASE + "#/"); await p.evaluate(() => localStorage.setItem("somon.lang", '"tg"')); await p.reload(); await p.waitForTimeout(700); p.nm = name; return quietAlarms(p); };
  const go = async (p, h, w = 600) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(w); };
  const shot = (p, n) => p.screenshot({ path: `${S}/${n}.png` });
  const login = async (p, ph, pw) => { await go(p, "/login"); await p.fill("[data-form=login] [name=phone]", ph); await p.fill("[data-form=login] [name=password]", pw); await p.click("[data-form=login] button.primary"); await p.waitForTimeout(1000);
    if (await p.$("[data-form=newpw]")) { p.mustChangeSeen = true; await p.click("[data-form=newpw] [data-act=closemodal]"); await p.waitForTimeout(300); } };
  const creds = async (p) => { const c = await p.$$eval(".creds code", e => e.map(x => x.textContent)); await p.evaluate(() => SF.closeModal()); return { phone: c[0].replace(/\D/g, "").slice(3), password: c[1] }; };

  /* guest: no demo traces */
  const guest = await phone("guest");
  log("demo button:", !!(await guest.$(".demofab")), "| demo logins:", !!(await (await go(guest, "/login"), guest.$("[data-act=demologin]"))));
  log("old demo admin works:", (await guest.evaluate(() => fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "900000001", password: "1234" }) }).then(r => r.status))));
  await go(guest, "/"); await shot(guest, "01-empty-home");
  log("manifest:", (await guest.evaluate(() => fetch("/manifest.webmanifest").then(r => r.json()).then(m => m.short_name + " " + m.icons.length + " icons"))), "| install card:", !!(await guest.$(".installcard")));
  await guest.waitForTimeout(800); await guest.reload(); await guest.waitForTimeout(900); log("service worker active:", await guest.evaluate(() => !!navigator.serviceWorker.controller)); log("guest home:", (await guest.textContent("main")).replace(/\s+/g, " ").slice(0, 120));

  /* admin adds a restaurant and a courier */
  const admin = await phone("admin"); await login(admin, "931112233", "Admin2026"); log("admin ->", await admin.evaluate(() => location.hash));
  await go(admin, "/admin/restaurants"); await admin.click("[data-act=arestnew]"); await admin.waitForTimeout(300);
  await admin.fill("[data-form=arestnew] [name=name]", "Ошхонаи Сино"); await admin.fill("[data-form=arestnew] [name=cuisine]", "Миллӣ · Палав"); await admin.fill("[data-form=arestnew] [name=ownerName]", "Сино"); await admin.fill("[data-form=arestnew] [name=ownerPhone]", "935556677");
  await admin.click("[data-form=arestnew] button.primary"); await admin.waitForTimeout(700); await shot(admin, "02-admin-creds"); const rc = await creds(admin); log("restaurant login:", rc);
  await go(admin, "/admin/couriers"); await admin.click("[data-act=acournew]"); await admin.waitForTimeout(300);
  await admin.fill("[data-form=acournew] [name=name]", "Фаррух"); await admin.fill("[data-form=acournew] [name=phone]", "938889900"); await admin.click("[data-form=acournew] button.primary"); await admin.waitForTimeout(700); const kc = await creds(admin); log("courier login:", kc);

  /* restaurant sets up: hours, place on the map, opens, adds dishes */
  const rest = await phone("restaurant"); await login(rest, rc.phone, rc.password); log("restaurant ->", await rest.evaluate(() => location.hash), "| asked to set own password:", !!rest.mustChangeSeen);
  await go(rest, "/rest/settings", 900); await rest.fill("[data-form=rset] [name=from]", "07:00"); await rest.fill("[data-form=rset] [name=to]", "23:30"); await rest.click("[data-form=rset] button.primary"); await rest.waitForTimeout(600);
  const mb = await (await rest.$("[data-tmap=rloc]")).boundingBox(); await rest.mouse.click(mb.x + mb.width * 0.35, mb.y + mb.height * 0.55); await rest.waitForTimeout(600); await rest.click("[data-act=rloc]"); await rest.waitForTimeout(600);
  await rest.fill("#rc-num", "1111 2222 3333 4444"); await rest.fill("#rc-holder", "SINO K."); await rest.fill("#rc-bank", "Алиф"); await rest.click("[data-form=rcard] button.primary"); await rest.waitForTimeout(500);
  await rest.fill("#pw-old", rc.password); await rest.fill("#pw-new", "Sino2026"); await rest.click("[data-form=pw] button.btn"); await rest.waitForTimeout(600);
  await go(rest, "/rest"); const sw = await rest.$("[data-act=ropen]"); if (sw && (await sw.getAttribute("aria-checked")) !== "true") { await sw.click(); await rest.waitForTimeout(500); }
  for (const [n, pr, k] of [["Оши палов", "35", "plov"], ["Қурутоб", "30", "qurutob"], ["Чойи кабуд", "5", "tea"]]) {
    await go(rest, "/rest/menu"); await rest.click("[data-act=prodnew]"); await rest.waitForTimeout(300);
    await rest.fill("[data-form=prod] [name=name]", n); await rest.fill("[data-form=prod] [name=price]", pr); await rest.fill("[data-form=prod] [name=weight]", "1 порс");
    const kb = await rest.$(`[data-act=pkind][data-v=${k}]`); if (kb) await kb.click();
    await rest.click("[data-form=prod] button.primary"); await rest.waitForTimeout(500); }
  await go(rest, "/rest/menu"); log("menu items:", (await rest.$$(".mrowp")).length); await shot(rest, "03-rest-menu");
  log("old restaurant password refused:", (await rest.evaluate((p) => fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "935556677", password: p }) }).then(r => r.status), rc.password)));

  /* courier goes online */
  const cour = await phone("courier"); await login(cour, kc.phone, kc.password); await go(cour, "/courier", 700);
  if (await cour.$(".chero:not(.on)")) { await cour.click(".chero [data-act=online]"); await cour.waitForTimeout(500); }

  /* a new customer registers and orders, cash only */
  const cust = await phone("customer"); await go(cust, "/register");
  await cust.fill("[data-form=register] [name=name]", "Алишер"); await cust.fill("[data-form=register] [name=phone]", "907001122"); await cust.fill("[data-form=register] [name=password]", "alisher1"); await cust.click("[data-form=register] button.primary"); await cust.waitForTimeout(800);
  await go(cust, "/", 900); await shot(cust, "04-home"); const rid = await cust.$eval("a.rcard", a => a.getAttribute("href").split("/r/")[1]); await go(cust, "/r/" + rid, 800);
  const adds = await cust.$$("[data-act=add]"); await adds[0].click(); await cust.waitForTimeout(300); await (await cust.$$("[data-act=add]"))[1].click(); await cust.waitForTimeout(300);
  await go(cust, "/cart"); await cust.click("[data-act=tocheckout]"); await cust.waitForTimeout(900);
  log("pay options:", await cust.$$eval("[data-act=paym]", b => b.map(x => x.dataset.v)), "| selected:", await cust.$eval(".payopt.on", b => b.dataset.v));
  await cust.fill("#co-ll", "37.2700, 68.1450"); await cust.click("form[data-form=coords] button"); await cust.waitForTimeout(900);
  await cust.fill('[data-input=co][data-k=text]', "кӯчаи Ленин 12"); await shot(cust, "05-checkout");
  await cust.click(".cobar [data-act=placeorder]"); await cust.waitForTimeout(800); log("without receipt stays:", await cust.evaluate(() => location.hash), "|", (await cust.textContent("#toasts")).replace(/\s+/g, " ").slice(-70));
  const png = path.join(path.dirname(DATA), "chek.png"); fs.writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  await cust.setInputFiles("#receipt-file", png); await cust.waitForTimeout(900); log("receipt shown:", !!(await cust.$(".upload.done img"))); await cust.evaluate(() => document.querySelector(".transfer").scrollIntoView()); await shot(cust, "05b-transfer");
  await cust.click(".cobar [data-act=placeorder]"); await cust.waitForTimeout(1000); const oid = await cust.evaluate(() => location.hash.split("/o/")[1]); log("order:", oid);

  /* live: restaurant sees it without reloading */
  await go(rest, "/rest/orders"); await rest.waitForTimeout(3000); log("restaurant sees new order:", !!(await rest.$(`[data-act=accept][data-id="${oid}"]`)));
  log("restaurant pay check:", (await rest.textContent(".paycheck")).replace(/\s+/g, " ")); await rest.click(`.paycheck [data-act=rcpt]`); await rest.waitForTimeout(600); log("receipt image opened:", !!(await rest.$(".rcptimg"))); await rest.evaluate(() => SF.closeModal());
  log("accept button:", (await rest.textContent(`[data-act=accept][data-id="${oid}"]`)).trim());
  await rest.click(`[data-act=accept][data-id="${oid}"]`); await rest.waitForTimeout(500); await rest.click(`[data-act=ready][data-id="${oid}"]`); await rest.waitForTimeout(500);
  await go(cour, "/courier"); await cour.waitForTimeout(3000); log("courier sees offer:", !!(await cour.$(`[data-act=take][data-id="${oid}"]`)));
  await cour.click(`[data-act=take][data-id="${oid}"]`); await cour.waitForTimeout(600); await cour.click("[data-act=pickup]"); await cour.waitForTimeout(600); await shot(cour, "06-courier");
  log("courier nav:", await cour.$eval(".navbtns a", a => a.href));
  await cour.click("[data-act=deliver]"); await cour.waitForTimeout(600);
  await go(cust, "/o/" + oid, 900); await cust.waitForTimeout(2600); log("customer status:", (await cust.textContent(".lbody h1")).trim()); await shot(cust, "07-delivered");
  await go(admin, "/admin", 900); await shot(admin, "08-admin"); log("admin dashboard today:", (await admin.textContent(".kpi")).replace(/\s+/g, " "));
  if (process.env.DATABASE_URL) log("data in PostgreSQL"); else log("data file saved:", fs.statSync(DATA).size, "bytes; backups:", fs.readdirSync(path.join(path.dirname(DATA), "backups")).length);
  console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "NO PAGE ERRORS");
  await b.close(); srv.kill();
})().catch(e => { console.error("FAIL", e.message.split("\n")[0]); try { process.kill(-0); } catch (x) {} process.exit(1); });
