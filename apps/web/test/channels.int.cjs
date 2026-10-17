/* Telegram bot, Telegram Gateway, WhatsApp webhook and SMS — over real HTTP against local fakes of those services */
const http = require("http"), crypto = require("crypto"), { spawn } = require("child_process"), path = require("path"), fs = require("fs"), os = require("os");
const assert = require("assert");
const FAKE = 9100 + Math.floor(Math.random() * 400), APP = FAKE + 500, APP2 = FAKE + 501;
const calls = [], updates = []; let waiters = [];
const fake = http.createServer((req, res) => { let b = ""; req.on("data", c => b += c); req.on("end", () => {
  const u = new URL(req.url, "http://x"), body = b ? (() => { try { return JSON.parse(b); } catch { return b; } })() : null;
  const ok = (result) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true, result })); };
  if (u.pathname.startsWith("/botTEST/")) { const m = u.pathname.split("/").pop(); if (m === "setChatMenuButton" || m === "setMyCommands") calls.push({ tgcfg: m, body });
    if (m === "getMe") return ok({ id: 1, is_bot: true, username: "tezkor_test_bot" });
    if (m === "deleteWebhook") return ok(true);
    if (m === "getUpdates") { const send = () => { const out = updates.filter(x => x.update_id >= (body.offset || 0)); ok(out); };
      if (updates.some(x => x.update_id >= (body.offset || 0))) return send(); const t = setTimeout(() => { waiters = waiters.filter(w => w !== send); send(); }, 800); waiters.push(() => { clearTimeout(t); send(); }); return; }
    if (m === "sendMessage") { calls.push({ tg: body }); return ok({ message_id: calls.length }); }
    return ok(true); }
  if (u.pathname === "/sendVerificationMessage") { calls.push({ gateway: body, auth: req.headers.authorization }); res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: true, result: { request_id: "r1" } })); }
  if (u.pathname === "/PHONEID/messages") { calls.push({ wa: body, auth: req.headers.authorization }); res.writeHead(200, { "Content-Type": "application/json" }); return res.end("{}"); }
  if (u.pathname === "/sms") { calls.push({ sms: Object.fromEntries(u.searchParams) }); res.writeHead(200); return res.end("OK"); }
  res.writeHead(404); res.end();
}); });
let uid = 1; const push = (message) => { updates.push({ update_id: uid++, message }); const w = waiters; waiters = []; w.forEach(f => f()); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(120); } throw new Error("timeout waiting"); };
const run = (port, extra) => { const p = spawn(process.execPath, [path.resolve(__dirname, "../../api/src/index.js")], { env: { ...process.env, PORT: port, DATA_FILE: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ch-")), "db.json"), ADMIN_PHONE: "931112233", ADMIN_PASSWORD: "Admin2026", ...extra }, stdio: ["ignore", "pipe", "pipe"] });
  p.stdout.on("data", d => process.env.DEBUG && process.stdout.write("APP " + d)); p.stderr.on("data", d => process.stderr.write("APP " + d)); return p; };
let pass = 0; const t = async (n, f) => { await f(); pass++; console.log("✓", n); };
(async () => {
  await new Promise(r => fake.listen(FAKE, r));
  const B = `http://localhost:${FAKE}`;
  const srv = run(APP, { PUBLIC_URL: "https://tezkor.example.tj", TELEGRAM_BOT_TOKEN: "TEST", TELEGRAM_API_BASE: B, WHATSAPP_NUMBER: "+992 900 00 00 00", WHATSAPP_VERIFY_TOKEN: "vtok", WHATSAPP_TOKEN: "wtok", WHATSAPP_PHONE_ID: "PHONEID", WHATSAPP_APP_SECRET: "appsecret", WHATSAPP_GRAPH_BASE: B, SMS_URL: B + "/sms?to={phone_digits}&text={text}" });
  const srv2 = run(APP2, { TELEGRAM_GATEWAY_TOKEN: "GWTOKEN", TELEGRAM_GATEWAY_BASE: B });
  process.on("exit", () => { srv.kill(); srv2.kill(); });
  const A = `http://localhost:${APP}/api`, A2 = `http://localhost:${APP2}/api`;
  const api = async (base, m, u, body) => { const r = await fetch(base + u, { method: m, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return r.json(); };
  const ch = await until(async () => { try { const r = await api(A, "GET", "/auth/verify/channels"); return r.data.channels.length === 3 && r.data; } catch { return null; } });
  await t("ҳамма каналлар ёқилди: " + ch.channels.map(c => c.id + "/" + c.kind).join(", "), async () => { assert.deepEqual(ch.channels.map(c => c.id), ["telegram", "whatsapp", "sms"]); assert.equal(ch.required, false, "стандарт: Telegramсиз ҳам мумкин"); });

  await t("Telegram бот: /start → «рақамни юбориш» тугмаси → контакт → тасдиқ → рўйхатдан ўтиш", async () => {
    const v = (await api(A, "POST", "/auth/verify/start", { phone: "93 888 55 00", purpose: "register", channel: "telegram" })).data;
    assert.match(v.link, /^https:\/\/t\.me\/tezkor_test_bot\?start=[\w-]+$/); const token = v.link.split("start=")[1];
    push({ message_id: 1, chat: { id: 4242, type: "private" }, from: { id: 4242 }, text: "/start " + token });
    const ask = await until(() => calls.find(c => c.tg && c.tg.chat_id === 4242 && c.tg.reply_markup && c.tg.reply_markup.keyboard));
    assert.equal(ask.tg.reply_markup.keyboard[0][0].request_contact, true);
    push({ message_id: 2, chat: { id: 4242, type: "private" }, from: { id: 4242 }, contact: { phone_number: "+992 93 777 00 00", user_id: 9999 } });
    await until(() => calls.find(c => c.tg && c.tg.chat_id === 4242 && /худатонро/.test(c.tg.text)));
    push({ message_id: 3, chat: { id: 4242, type: "private" }, from: { id: 4242 }, contact: { phone_number: "992937770000", user_id: 4242 } });
    await until(() => calls.find(c => c.tg && c.tg.chat_id === 4242 && /як нест/.test(c.tg.text)));
    assert.equal((await api(A, "GET", "/auth/verify/" + v.id)).data.status, "pending", "бошқа рақам — тасдиқланмайди");
    push({ message_id: 4, chat: { id: 4242, type: "private" }, from: { id: 4242 }, contact: { phone_number: "992938885500", user_id: 4242 } });
    await until(async () => (await api(A, "GET", "/auth/verify/" + v.id)).data.status === "verified");
    await until(() => calls.find(c => c.tg && c.tg.chat_id === 4242 && /тасдиқ шуд/.test(c.tg.text)));
    const r = await api(A, "POST", "/auth/register", { name: "Telegram Ali", phone: "938885500", password: "Parol123", verifyId: v.id });
    assert.ok(r.ok, JSON.stringify(r)); assert.equal(r.data.user.phoneVerified, "telegram");
    push({ message_id: 5, chat: { id: 4242, type: "private" }, from: { id: 4242 }, text: "/start " + token });
    await until(() => calls.find(c => c.tg && c.tg.chat_id === 4242 && /Мӯҳлат/.test(c.tg.text)));
  });
  await t("Telegram: ботни шунчаки очса — йўриқ; гуруҳда жим", async () => {
    push({ message_id: 6, chat: { id: 5555, type: "private" }, from: { id: 5555 }, text: "/start" });
    const w = await until(() => calls.find(c => c.tg && c.tg.chat_id === 5555 && /боти/.test(c.tg.text)));
    const kb = w.tg.reply_markup.inline_keyboard.flat(); assert.equal(kb[0].url, "https://tezkor.example.tj/"); assert.equal(kb[1].url, "https://tezkor.example.tj/download");
    const before = calls.length; push({ message_id: 7, chat: { id: -100, type: "group" }, from: { id: 5555 }, text: "/start x" }); await sleep(900);
    assert.ok(!calls.slice(before).some(c => c.tg && c.tg.chat_id === -100));
  });

  await t("WhatsApp: webhook текшируви, имзоли хабар → тасдиқ, имзосиз рад, бегона рақам рад", async () => {
    let r = await fetch(`http://localhost:${APP}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=vtok&hub.challenge=XYZ123`); assert.equal(await r.text(), "XYZ123");
    r = await fetch(`http://localhost:${APP}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=XYZ`); assert.equal(r.status, 403);
    const v = (await api(A, "POST", "/auth/verify/start", { phone: "938886600", purpose: "register", channel: "whatsapp" })).data;
    assert.match(v.link, /^https:\/\/wa\.me\/992900000000\?text=/); const code = decodeURIComponent(v.link.split("text=")[1]).match(/\d{6}/)[0];
    const hook = async (from, text, secret = "appsecret") => { const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [{ from, type: "text", text: { body: text } }] } }] }] });
      return fetch(`http://localhost:${APP}/webhooks/whatsapp`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex") }, body: raw }); };
    assert.equal((await hook("992938886600", "Тезкор: рамзи тасдиқи ман " + code, "wrong")).status, 401);
    assert.equal((await hook("992931110000", "Тезкор: рамзи тасдиқи ман " + code)).status, 200);
    await until(() => calls.find(c => c.wa && c.wa.to === "992931110000" && /як нест/.test(c.wa.text.body)));
    assert.equal((await api(A, "GET", "/auth/verify/" + v.id)).data.status, "pending");
    assert.equal((await hook("992938886600", "Тезкор: рамзи тасдиқи ман " + code)).status, 200);
    await until(async () => (await api(A, "GET", "/auth/verify/" + v.id)).data.status === "verified");
    const rep = await until(() => calls.find(c => c.wa && c.wa.to === "992938886600")); assert.equal(rep.auth, "Bearer wtok"); assert.match(rep.wa.text.body, /тасдиқ шуд/);
    assert.ok((await api(A, "POST", "/auth/register", { name: "WhatsApp Vali", phone: "938886600", password: "Parol123", verifyId: v.id })).ok);
  });

  await t("SMS: паролни унутган мижоз код олади → киритади → янги парол → киради", async () => {
    const v = (await api(A, "POST", "/auth/verify/start", { phone: "938886600", purpose: "reset", channel: "sms" })).data; assert.equal(v.kind, "code");
    const sms = await until(() => calls.find(c => c.sms && c.sms.to === "992938886600")); const code = sms.sms.text.match(/\d{6}/)[0]; assert.match(sms.sms.text, /Тезкор/);
    assert.equal((await api(A, "POST", "/auth/verify/" + v.id + "/code", { code: "000000" })).error.code, "VERIFY_BAD_CODE");
    assert.equal((await api(A, "POST", "/auth/verify/" + v.id + "/code", { code })).data.status, "verified");
    const r = await api(A, "POST", "/auth/reset", { verifyId: v.id, password: "YangiParol9" }); assert.ok(r.data.token);
    assert.ok((await api(A, "POST", "/auth/login", { phone: "938886600", password: "YangiParol9" })).ok);
  });

  await t("Telegram Gateway (ботсиз): код Telegram’га боради, сайтга ёзилади", async () => {
    const c2 = await until(async () => { try { return (await api(A2, "GET", "/auth/verify/channels")).data; } catch { return null; } });
    assert.deepEqual(c2.channels, [{ id: "telegram", kind: "code" }]);
    const v = (await api(A2, "POST", "/auth/verify/start", { phone: "938887700", purpose: "register", channel: "telegram" })).data;
    const g = await until(() => calls.find(c => c.gateway && c.gateway.phone_number === "+992938887700")); assert.equal(g.auth, "Bearer GWTOKEN"); assert.equal(g.gateway.ttl, 600);
    assert.equal((await api(A2, "POST", "/auth/verify/" + v.id + "/code", { code: g.gateway.code })).data.status, "verified");
    assert.ok((await api(A2, "POST", "/auth/register", { name: "Gateway", phone: "938887700", password: "Parol123", verifyId: v.id })).ok);
  });
  await t("бот менюси: «Тезкор» тугмаси сайтни Telegram ичида очади", async () => {
    const m = await until(() => calls.find(c => c.tgcfg === "setChatMenuButton")); assert.equal(m.body.menu_button.type, "web_app"); assert.match(m.body.menu_button.web_app.url, /^https:\/\/tezkor\.example\.tj\//); });
  await t("Telegramсиз ҳам рўйхатдан ўтса бўлади (стандарт), рақам «тасдиқланмаган» бўлиб қолади", async () => {
    const r = await api(A, "POST", "/auth/register", { name: "Oddiy", phone: "938889999", password: "Parol123" }); assert.ok(r.data.token); assert.ok(!r.data.user.phoneVerified); });
  console.log(`\n${pass} та канал синови ўтди`); srv.kill(); srv2.kill(); fake.close(); process.exit(0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
