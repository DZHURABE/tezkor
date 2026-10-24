/* Phone verification channels for the real server. Each one turns on by itself when its settings are present.

   Telegram bot (free)            TELEGRAM_BOT_TOKEN
     The person taps "Telegram" → the bot opens → they tap "Send my number" → Telegram sends the bot their own number.
   Telegram Gateway (paid, ~1¢)   TELEGRAM_GATEWAY_TOKEN   (only when there is no bot)
     Telegram delivers a 6-digit code straight to the number; the person types it on the site.
   WhatsApp (free for us)         WHATSAPP_NUMBER + WHATSAPP_VERIFY_TOKEN  (+ WHATSAPP_TOKEN, WHATSAPP_PHONE_ID to reply,
                                  WHATSAPP_APP_SECRET to check Meta's signature)
     The person taps "WhatsApp" → a message with a code opens in their WhatsApp → they press send → Meta's webhook
     tells us which number sent which code.
   SMS (any HTTP gateway)         SMS_URL (+ SMS_METHOD, SMS_BODY, SMS_HEADERS)
     The code is sent by SMS and typed on the site. {phone} {phone_local} {text} {code} are filled in.

   Test doubles can point the HTTP calls elsewhere: TELEGRAM_API_BASE, TELEGRAM_GATEWAY_BASE, WHATSAPP_GRAPH_BASE. */
const crypto = require("crypto");
const env = process.env;
const log = (...a) => console.log("[verify]", ...a);

function createVerify() {
  let api = null;                      // set by attach() once the core server exists
  const state = { botName: env.TELEGRAM_BOT_USERNAME || null, botOk: false, running: false };

  const TG_TOKEN = env.TELEGRAM_BOT_TOKEN || "";
  const TG_BASE = (env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, "");
  const GW_TOKEN = env.TELEGRAM_GATEWAY_TOKEN || "";
  const GW_BASE = (env.TELEGRAM_GATEWAY_BASE || "https://gatewayapi.telegram.org").replace(/\/$/, "");
  const WA_NUMBER = String(env.WHATSAPP_NUMBER || "").replace(/\D/g, "");
  const WA_VERIFY = env.WHATSAPP_VERIFY_TOKEN || "";
  const WA_TOKEN = env.WHATSAPP_TOKEN || "", WA_PHONE_ID = env.WHATSAPP_PHONE_ID || "", WA_SECRET = env.WHATSAPP_APP_SECRET || "";
  const WA_BASE = (env.WHATSAPP_GRAPH_BASE || "https://graph.facebook.com/v21.0").replace(/\/$/, "");
  const SMS_URL = env.SMS_URL || "";

  /* ---------------- channels ---------------- */
  function channels() {
    const out = [];
    if (TG_TOKEN && state.botOk && state.botName) out.push({ id: "telegram", kind: "link" });
    else if (!TG_TOKEN && GW_TOKEN) out.push({ id: "telegram", kind: "code" });
    if (WA_NUMBER && WA_VERIFY) out.push({ id: "whatsapp", kind: "link" });
    if (SMS_URL) out.push({ id: "sms", kind: "code" });
    return out;
  }

  function start(v, ch) {
    if (ch.id === "telegram" && ch.kind === "link") return { link: `https://t.me/${state.botName}?start=${v.token}` };
    if (ch.id === "telegram") { gatewaySend(v).catch(e => log("telegram gateway:", e.message)); return {}; }
    if (ch.id === "whatsapp") return { link: `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Тезкор: рамзи тасдиқи ман " + v.code)}` };
    if (ch.id === "sms") { smsSend(v).catch(e => log("sms:", e.message)); return {}; }
    throw new Error("unknown channel " + ch.id);
  }

  /* ---------------- Telegram bot (long polling: no public URL or webhook setup needed) ---------------- */
  async function tg(method, body) {
    const r = await fetch(`${TG_BASE}/bot${TG_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(40000) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(`${method}: ${j.description || r.status}`);
    return j.result;
  }
  const say = (chat_id, text, extra) => tg("sendMessage", Object.assign({ chat_id, text, parse_mode: "HTML" }, extra || {})).catch(e => log("telegram send:", e.message));
  const askContact = { reply_markup: { keyboard: [[{ text: "📱 Рақами ман — фиристодан", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } };
  const noKeyboard = { reply_markup: { remove_keyboard: true } };
  /* the site's address (Render gives RENDER_EXTERNAL_URL by itself) — used for the bot's buttons and menu */
  const SITE = (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  const welcome = () => SITE ? { reply_markup: { inline_keyboard: [[{ text: "🍽 Фармоиш додан", url: SITE + "/" }], [{ text: "📲 Барномаи Тезкор (боргирӣ)", url: SITE + "/download" }]] } } : {};

  async function onTelegram(m) {
    if (!m || !m.chat) return;
    const chatId = m.chat.id;
    if (m.chat.type !== "private") return;
    const text = String(m.text || "");
    if (text.startsWith("/start")) {
      const token = text.split(/\s+/)[1];
      if (!token) return say(chatId, "Салом! Ин боти <b>Тезкор</b> аст 🍽\n\nТаом ва мол — то дари хона." + (SITE ? "" : "\n\nБарои тасдиқи рақам дар сайт ё барнома тугмаи <b>Telegram</b>-ро пахш кунед."), welcome());
      const r = api.inbound("telegram", { token, chatId });
      if (!r.ok) return say(chatId, "⏱ Мӯҳлати ин истинод гузашт ё он аллакай истифода шудааст.\n\nДар сайт тугмаи <b>Telegram</b>-ро бори дигар пахш кунед.", noKeyboard);
      return say(chatId, (r.purpose === "reset" ? "🔑 <b>Барқарор кардани парол</b>\n\n" : "👋 <b>Хуш омадед ба Тезкор!</b>\n\n") +
        "Тугмаи поёнро пахш кунед — Telegram рақами телефони шуморо худаш мефиристад.", askContact);
    }
    if (m.contact) {
      if (!m.from || m.contact.user_id !== m.from.id) return say(chatId, "Лутфан танҳо <b>рақами худатонро</b> бо тугмаи поён фиристед.", askContact);
      const r = api.inbound("telegram", { chatId, phone: m.contact.phone_number });
      if (r.ok) return say(chatId, "✅ <b>Рақам тасдиқ шуд!</b>\n\nБа сайт ё барномаи Тезкор баргардед — он худаш давом медиҳад.", noKeyboard);
      if (r.reason === "PHONE_MISMATCH") return say(chatId, `❗ Рақами Telegram-и шумо бо рақами дар сайт навишташуда (${r.expected}) як нест.\n\nДар сайт рақамеро нависед, ки Telegram-и шумо бо он кушода шудааст, ё роҳи дигарро интихоб кунед.`, noKeyboard);
      return say(chatId, "Аввал дар сайт тугмаи <b>Telegram</b>-ро пахш кунед, баъд ин ҷо рақамро фиристед.", noKeyboard);
    }
    return say(chatId, "Барои тасдиқи рақам дар сайт ё барнома тугмаи <b>Telegram</b>-ро пахш кунед.");
  }

  async function botLoop() {
    let offset = 0, wait = 2000;
    while (state.running) {
      try {
        if (!state.botOk) {
          await tg("deleteWebhook", { drop_pending_updates: false });       // getUpdates does not work while a webhook is set
          const me = await tg("getMe"); state.botName = me.username; state.botOk = true; wait = 2000;
          log("Telegram bot @" + state.botName + " is on");
          /* the menu button in the chat opens Тезкор right inside Telegram */
          if (/^https:\/\//.test(SITE)) tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Тезкор", web_app: { url: SITE + "/?source=telegram" } } }).catch(e => log("menu button:", e.message));
          tg("setMyCommands", { commands: [{ command: "start", description: "Тезкор — оғоз" }] }).catch(() => {});
        }
        const ups = await tg("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
        for (const u of ups) { offset = u.update_id + 1; try { await onTelegram(u.message); } catch (e) { log("telegram message:", e.message); } }
      } catch (e) {
        if (/401|404|Unauthorized|Not Found/.test(e.message)) { state.botOk = false; log("Telegram token is wrong:", e.message); }
        else log("telegram:", e.message);
        await new Promise(r => setTimeout(r, wait)); wait = Math.min(wait * 2, 60000);
      }
    }
  }

  /* ---------------- Telegram Gateway (code to the number) ---------------- */
  async function gatewaySend(v) {
    const r = await fetch(`${GW_BASE}/sendVerificationMessage`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + GW_TOKEN },
      body: JSON.stringify({ phone_number: v.phone, code: v.code, ttl: 600 }), signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.error || "HTTP " + r.status);
  }

  /* ---------------- WhatsApp (Meta Cloud API webhook) ---------------- */
  async function waReply(to, body) {
    if (!WA_TOKEN || !WA_PHONE_ID) return;
    await fetch(`${WA_BASE}/${WA_PHONE_ID}/messages`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + WA_TOKEN },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }), signal: AbortSignal.timeout(15000) }).catch(e => log("whatsapp reply:", e.message));
  }
  /* GET: Meta checks the webhook once when you save it */
  function whatsappVerify(query) {
    if (query["hub.mode"] === "subscribe" && WA_VERIFY && query["hub.verify_token"] === WA_VERIFY) return { status: 200, body: String(query["hub.challenge"] || "") };
    return { status: 403, body: "forbidden" };
  }
  /* POST: incoming messages. Answer 200 quickly; Meta retries otherwise */
  function whatsappIncoming(raw, headers) {
    if (WA_SECRET) {
      const sig = String(headers["x-hub-signature-256"] || ""), want = "sha256=" + crypto.createHmac("sha256", WA_SECRET).update(raw).digest("hex");
      if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return { status: 401, body: "bad signature" };
    }
    let body; try { body = JSON.parse(raw || "{}"); } catch { return { status: 400, body: "bad json" }; }
    (body.entry || []).forEach(e => (e.changes || []).forEach(c => ((c.value && c.value.messages) || []).forEach(msg => {
      const from = String(msg.from || ""), text = msg.type === "text" && msg.text ? msg.text.body : "";
      const r = api.inbound("whatsapp", { phone: from, text });
      if (r.ok) waReply(from, "✅ Рақами шумо тасдиқ шуд! Ба сайт ё барномаи Тезкор баргардед.");
      else if (r.reason === "PHONE_MISMATCH") waReply(from, `❗ Ин рақами WhatsApp бо рақами дар сайт навишташуда (${r.expected}) як нест. Аз WhatsApp-и ҳамон рақам фиристед.`);
      else if (/\d{6}/.test(text)) waReply(from, "⏱ Ин рамз кӯҳна шудааст. Дар сайт тугмаи WhatsApp-ро бори дигар пахш кунед.");
    })));
    return { status: 200, body: "ok" };
  }

  /* ---------------- SMS through any HTTP gateway ---------------- */
  async function smsSend(v) {
    const text = `Тезкор: рамзи тасдиқ ${v.code}. Онро ба касе нагӯед.`;
    /* in the URL the values are URL-encoded; in a POST body (JSON or form) they are put in as they are */
    const fill = (s, enc) => { const e = enc ? encodeURIComponent : (x => x);
      return String(s).replace(/\{phone\}/g, e(v.phone)).replace(/\{phone_local\}/g, v.phone.replace(/^\+992/, "")).replace(/\{phone_digits\}/g, v.phone.replace(/\D/g, ""))
        .replace(/\{text\}/g, e(text)).replace(/\{code\}/g, v.code); };
    const method = (env.SMS_METHOD || "GET").toUpperCase(), headers = env.SMS_HEADERS ? JSON.parse(env.SMS_HEADERS) : {};
    const body = method === "GET" ? undefined : fill(env.SMS_BODY || "", false);
    const r = await fetch(fill(SMS_URL, true), { method, headers, body, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
  }

  /* any text through the same SMS gateway (new-order alerts for shops and couriers) */
  async function smsText(phone, text) {
    const fill = (s, enc) => { const e = enc ? encodeURIComponent : (x => x);
      return String(s).replace(/\{phone\}/g, e(phone)).replace(/\{phone_local\}/g, phone.replace(/^\+992/, "")).replace(/\{phone_digits\}/g, phone.replace(/\D/g, "")).replace(/\{text\}/g, e(text)).replace(/\{code\}/g, ""); };
    const method = (env.SMS_METHOD || "GET").toUpperCase(), headers = env.SMS_HEADERS ? JSON.parse(env.SMS_HEADERS) : {};
    const r = await fetch(fill(SMS_URL, true), { method, headers, body: method === "GET" ? undefined : fill(env.SMS_BODY || "", false), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
  }

  return {
    smsReady: !!SMS_URL, sms: (phone, text) => { if (SMS_URL) smsText(phone, text).catch(e => log("sms alert:", e.message)); },
    channels, start, whatsappVerify, whatsappIncoming,
    attach(coreApi) { api = coreApi; if (TG_TOKEN && !state.running) { state.running = true; botLoop(); } },
    stop() { state.running = false; },
    status() { return { telegramBot: TG_TOKEN ? (state.botOk ? "@" + state.botName : "error") : "off", telegramGateway: GW_TOKEN ? "on" : "off", whatsapp: WA_NUMBER && WA_VERIFY ? "on" : "off", sms: SMS_URL ? "on" : "off" }; },
  };
}
module.exports = { createVerify };
