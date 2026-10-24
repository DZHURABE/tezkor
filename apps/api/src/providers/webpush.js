/* Web Push without any package: VAPID (RFC 8292) + aes128gcm message encryption (RFC 8291), Node `crypto` only.
   The private key stays on the server: env VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY, or a 0600 file next to the data (vapid.json). */
const crypto = require("crypto"), https = require("https"), fs = require("fs"), path = require("path"), vm = require("vm");
const b64u = (b) => Buffer.from(b).toString("base64url");
const unb64u = (s) => Buffer.from(String(s), "base64url");

function loadKeys(env, dir, log) {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) return { pub: env.VAPID_PUBLIC_KEY, priv: env.VAPID_PRIVATE_KEY };
  const file = path.join(dir, "vapid.json");
  try { const k = JSON.parse(fs.readFileSync(file, "utf8")); if (k.pub && k.priv) return k; } catch (e) {}
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  const pub = b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)])), priv = jwk.d;
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify({ pub, priv }), { mode: 0o600 }); log && log("push: new VAPID keys saved to " + file); }
  catch (e) { log && log("push: could not save VAPID keys (" + e.message + ") — they change on restart; set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY"); }
  return { pub, priv };
}

function signer(keys, subject) {
  const pubBuf = unb64u(keys.pub);
  const key = crypto.createPrivateKey({ key: { kty: "EC", crv: "P-256", d: keys.priv, x: b64u(pubBuf.subarray(1, 33)), y: b64u(pubBuf.subarray(33, 65)) }, format: "jwk" });
  return (aud) => {
    const h = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" })), p = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
    const sig = crypto.sign("sha256", Buffer.from(h + "." + p), { key, dsaEncoding: "ieee-p1363" });
    return h + "." + p + "." + b64u(sig);
  };
}

const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, len));

/* RFC 8291 */
function encrypt(sub, payload) {
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth), salt = crypto.randomBytes(16);
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey(), secret = ecdh.computeSecret(ua);
  const ikm = hkdf(auth, secret, Buffer.concat([Buffer.from("WebPush: info\0"), ua, asPub]), 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16), nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, body]);
}
/* the receiving side, used by the tests */
function decrypt(body, uaPriv /* ECDH with the subscription keys */, auth) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), data = body.subarray(21 + idlen);
  const uaPub = uaPriv.getPublicKey(), secret = uaPriv.computeSecret(asPub);
  const ikm = hkdf(auth, secret, Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub]), 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16), nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce); d.setAuthTag(data.subarray(data.length - 16));
  const pt = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  return pt.subarray(0, pt.lastIndexOf(2)).toString();
}

/* notification texts: the same i18n table the app uses */
function texts(file) {
  let I = {};
  try { const SF = {}; vm.runInNewContext(fs.readFileSync(file, "utf8"), { SF, window: {}, console }); I = SF.I18N || {}; } catch (e) {}
  const fill = (s, p, lang) => s.replace(/\{(\w+)\}/g, (_, k) => { const v = p && p[k]; return v == null ? "" : typeof v === "object" ? (v[lang] || v.tg || v.ru || "") : v; });
  return (key, params, lang) => { const r = I[key]; if (!r) return null; lang = r[lang] ? lang : "tg";
    const t = I[key + ".t"]; return { title: t ? (t[lang] || t.tg) : "Тезкор", body: fill(r[lang] || r.tg, params, lang) }; };
}

function create(env, opts) {
  opts = opts || {};
  const keys = loadKeys(env, opts.dir || ".", opts.log), sign = signer(keys, env.VAPID_SUBJECT || "mailto:" + (env.ADMIN_EMAIL || "admin@tezkor.pro"));
  const text = opts.i18nFile ? texts(opts.i18nFile) : () => null;
  function send(sub, payload) {
    return new Promise((resolve) => {
      let u; try { u = new URL(sub.endpoint); } catch (e) { return resolve({ gone: true }); }
      if (u.protocol !== "https:") return resolve({ gone: true });
      let body; try { body = encrypt(sub, JSON.stringify(payload)); } catch (e) { return resolve({ gone: true }); }
      const req = https.request({ method: "POST", hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, timeout: 10000, headers: {
        Authorization: "vapid t=" + sign(u.origin) + ", k=" + keys.pub, "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
        "Content-Length": body.length, TTL: String(payload.ttl || 86400), Urgency: "high" } }, (res) => { res.resume(); resolve({ ok: res.statusCode < 300, gone: res.statusCode === 404 || res.statusCode === 410 || res.statusCode === 403, status: res.statusCode }); });
      req.on("timeout", () => req.destroy()); req.on("error", () => resolve({ ok: false }));
      req.end(body);
    });
  }
  return { publicKey: keys.pub, keys, send, text };
}
module.exports = { create, encrypt, decrypt, texts };
