/* Phone verification on a phone screen.
   A) demo build: sign up with the on-screen code, wrong code first; forgot password → code → new password → logged in
   B) real server + fake Telegram / WhatsApp: sign up through the bot, reset the password through WhatsApp */
const { chromium, devices } = require("/opt/npm-tools/node_modules/playwright");
const http = require("http"), crypto = require("crypto"), { spawn } = require("child_process"), path = require("path"), fs = require("fs"), os = require("os");
const S = path.resolve(__dirname, "../shots/verify"); fs.mkdirSync(S, { recursive: true });
const DEMO = "file://" + path.resolve(__dirname, "../dist/index.html");
const FAKE = 9600 + Math.floor(Math.random() * 300), APP = FAKE + 400;
const calls = [], updates = []; let waiters = [], uid = 1;
const fake = http.createServer((req, res) => { let b = ""; req.on("data", c => b += c); req.on("end", () => {
  const u = new URL(req.url, "http://x"), body = b ? JSON.parse(b) : {}; const ok = r => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true, result: r })); };
  if (u.pathname.startsWith("/botTEST/")) { const m = u.pathname.split("/").pop();
    if (m === "getMe") return ok({ username: "tezkor_bot" }); if (m === "deleteWebhook") return ok(true);
    if (m === "getUpdates") { const send = () => ok(updates.filter(x => x.update_id >= (body.offset || 0))); if (updates.some(x => x.update_id >= (body.offset || 0))) return send();
      const tm = setTimeout(() => { waiters = waiters.filter(w => w !== f); send(); }, 700); const f = () => { clearTimeout(tm); send(); }; waiters.push(f); return; }
    if (m === "sendMessage") { calls.push({ tg: body }); return ok({}); } return ok(true); }
  if (u.pathname === "/PH/messages") { calls.push({ wa: body }); res.writeHead(200); return res.end("{}"); }
  res.writeHead(404); res.end(); }); });
const push = m => { updates.push({ update_id: uid++, message: m }); const w = waiters; waiters = []; w.forEach(f => f()); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errs = [];
(async () => {
  await new Promise(r => fake.listen(FAKE, r)); const B = `http://localhost:${FAKE}`;
  const srv = spawn(process.execPath, [path.resolve(__dirname, "../../api/src/index.js")], { env: { ...process.env, PORT: APP, DATA_FILE: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ve-")), "db.json"), ADMIN_PHONE: "931112233", ADMIN_PASSWORD: "Admin2026",
    TELEGRAM_BOT_TOKEN: "TEST", TELEGRAM_API_BASE: B, WHATSAPP_NUMBER: "992900000000", WHATSAPP_VERIFY_TOKEN: "v", WHATSAPP_TOKEN: "w", WHATSAPP_PHONE_ID: "PH", WHATSAPP_GRAPH_BASE: B }, stdio: "ignore" });
  process.on("exit", () => srv.kill());
  const b = await chromium.launch();
  const phone = async (url) => { const c = await b.newContext({ ...devices["Pixel 7"] }); await c.route(/fonts\.|tile\./, x => x.abort()); const p = await c.newPage(); p.on("pageerror", e => errs.push(e.message));
    await p.goto(url + "#/"); await p.evaluate(() => { localStorage.clear(); localStorage.setItem("somon.lang", '"tg"'); }); await p.reload(); await p.waitForTimeout(900); return p; };
  const go = async (p, h) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(600); };
  const toast = p => p.evaluate(() => document.querySelector("#toasts").innerText.trim().split("\n").pop());
  const shot = async (p, n) => { await p.evaluate(() => { document.getElementById("toasts").innerHTML = ""; }); await p.waitForTimeout(250); await p.screenshot({ path: `${S}/${n}.png` }); };
  const fillReg = async (p, name, ph, pw) => { await go(p, "/register"); await p.fill("[data-form=register] [name=name]", name); await p.fill("[data-form=register] [name=phone]", ph); await p.fill("[data-form=register] [name=password]", pw); await p.click("[data-form=register] button.primary"); await p.waitForTimeout(700); };

  /* A) demo */
  const d = await phone(DEMO);
  await fillReg(d, "Мадина", "93 444 55 66", "Madina1");
  console.log("A choose:", await d.evaluate(() => [...document.querySelectorAll(".vbtn b")].map(x => x.innerText).join(", ")));
  await shot(d, "a1-choose");
  await d.click("[data-act=vstart][data-ch=demo]"); await d.waitForTimeout(600);
  const code = await d.evaluate(() => document.querySelector("#modal .msg b").innerText); console.log("A demo code:", code);
  await d.fill(".vcode", "111111"); await d.click("[data-form=vcode] button.primary"); await d.waitForTimeout(500);
  console.log("A wrong code:", await d.evaluate(() => (document.querySelector(".verr") || {}).innerText));
  await shot(d, "a2-code");
  await d.fill(".vcode", code); await d.click("[data-form=vcode] button.primary"); await d.waitForTimeout(1000);
  console.log("A registered:", await toast(d), await d.evaluate(() => location.hash + " " + (SF.state.user && SF.state.user.phoneVerified)));
  await d.evaluate(() => SF.actions.logout()); await d.waitForTimeout(400); await go(d, "/login");
  await d.click("[data-act=forgot]"); await d.waitForTimeout(400); await shot(d, "a3-forgot");
  await d.click("[data-form=forgotself] button.primary"); await d.waitForTimeout(500);
  await d.click("[data-act=vstart][data-ch=demo]"); await d.waitForTimeout(500);
  const code2 = await d.evaluate(() => document.querySelector("#modal .msg b").innerText); await d.fill(".vcode", code2); await d.click("[data-form=vcode] button.primary"); await d.waitForTimeout(700);
  await shot(d, "a4-newpw");
  await d.fill("[data-form=vreset] [name=password]", "Madina2"); await d.click("[data-form=vreset] button.primary"); await d.waitForTimeout(900);
  console.log("A reset + logged in:", await toast(d), await d.evaluate(() => location.hash + " " + (SF.state.user && SF.state.user.name)));
  await d.evaluate(() => SF.actions.logout()); await d.waitForTimeout(400); await go(d, "/login"); await d.fill("[data-form=login] [name=password]", "Madina2"); await d.click("[data-form=login] button.primary"); await d.waitForTimeout(800);
  console.log("A login with new password:", await toast(d));

  /* B) real server */
  const base = `http://localhost:${APP}/`;
  for (let i = 0; i < 40; i++) { try { const r = await (await fetch(base + "api/auth/verify/channels")).json(); if (r.data.channels.length === 2) break; } catch {} await sleep(150); }
  const p = await phone(base);
  await fillReg(p, "Фарҳод", "93 555 00 11", "Farhod11");
  console.log("B choose:", await p.evaluate(() => [...document.querySelectorAll(".vbtn")].map(x => x.innerText.replace(/\s+/g, " ")).join(" | ")));
  await shot(p, "b1-choose");
  await p.click("[data-act=vstart][data-ch=telegram]"); await p.waitForTimeout(700);
  const link = await p.getAttribute(".vopen", "href"); console.log("B telegram link:", link, "| target:", await p.getAttribute(".vopen", "target"));
  await shot(p, "b2-telegram");
  const token = link.split("start=")[1];
  push({ chat: { id: 77, type: "private" }, from: { id: 77 }, text: "/start " + token }); await sleep(900);
  push({ chat: { id: 77, type: "private" }, from: { id: 77 }, contact: { phone_number: "+992935550011", user_id: 77 } });
  await p.waitForFunction(() => location.hash === "#/" && window.SF && SF.state.user, null, { timeout: 15000 }).catch(() => {});
  console.log("B registered via Telegram:", await p.evaluate(() => SF.state.user && SF.state.user.name + " / " + SF.state.user.phoneVerified), "| bot said:", (calls.filter(c => c.tg && c.tg.chat_id === 77).pop() || {}).tg.text.split("\n")[0]);
  await p.evaluate(() => SF.actions.logout()); await p.waitForTimeout(500); await go(p, "/login");
  await p.click("[data-act=forgot]"); await p.waitForTimeout(400); await p.click("[data-form=forgotself] button.primary"); await p.waitForTimeout(500);
  await p.click("[data-act=vstart][data-ch=whatsapp]"); await p.waitForTimeout(700);
  const wl = await p.getAttribute(".vopen", "href"); const wcode = decodeURIComponent(wl.split("text=")[1]).match(/\d{6}/)[0]; console.log("B whatsapp link:", wl.slice(0, 40) + "…");
  await shot(p, "b3-whatsapp");
  const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: "992935550011", type: "text", text: { body: "Тезкор: рамзи тасдиқи ман " + wcode } }] } }] }] });
  await fetch(base + "webhooks/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
  await p.waitForSelector("[data-form=vreset]", { timeout: 10000 }); await shot(p, "b4-newpw");
  await p.fill("[data-form=vreset] [name=password]", "Farhod22"); await p.click("[data-form=vreset] button.primary"); await p.waitForTimeout(1000);
  console.log("B reset via WhatsApp, logged in:", await p.evaluate(() => location.hash + " " + (SF.state.user && SF.state.user.name)), "| WhatsApp reply:", (calls.find(c => c.wa) || {}).wa ? "yes" : "no");
  const r = await (await fetch(base + "api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "935550011", password: "Farhod22" }) })).json(); console.log("B new password works:", r.ok);
  /* admin sees the channels */
  const a = await phone(base); await go(a, "/login"); await a.fill("[data-form=login] [name=phone]", "931112233"); await a.fill("[data-form=login] [name=password]", "Admin2026"); await a.click("[data-form=login] button.primary"); await a.waitForTimeout(1200);
  await go(a, "/admin/settings"); await a.evaluate(() => { const h = [...document.querySelectorAll("h3")].find(x => /Тасдиқи рақам/.test(x.innerText)); h && h.scrollIntoView(); });
  console.log("admin card:", await a.evaluate(() => { const h = [...document.querySelectorAll("h3")].find(x => /Тасдиқи рақам/.test(x.innerText)); return h ? h.closest(".card").innerText.replace(/\s+/g, " ").slice(0, 200) : "none"; }));
  await shot(a, "b5-admin");
  await go(a, "/admin/users?role=customer"); console.log("verified badges:", await a.evaluate(() => document.querySelectorAll(".vok").length));
  console.log(errs.length ? "PAGE ERRORS: " + errs.join(" | ") : "NO PAGE ERRORS");
  await b.close(); srv.kill(); fake.close(); process.exit(0);
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
