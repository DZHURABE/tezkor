/* A small PostgreSQL client with no dependencies: TLS (sslmode=require), SCRAM-SHA-256 / MD5 / password login,
   the simple query protocol, one connection with queued queries, reconnect when the server closed it
   (Neon puts an idle database to sleep). Enough for Тезкор's storage; values are passed with safe quoting (lit/bytes). */
const net = require("net"), tls = require("tls"), crypto = require("crypto");

function parseUrl(u) {
  const x = new URL(u);
  return { host: x.hostname, port: +x.port || 5432, user: decodeURIComponent(x.username), password: decodeURIComponent(x.password),
    database: decodeURIComponent(x.pathname.slice(1)) || "postgres", ssl: (x.searchParams.get("sslmode") || (/^(localhost|127\.0\.0\.1)$/.test(x.hostname) ? "disable" : "require")) };
}
/* safe literals: dollar-quoted text with a random tag, bytea from base64 */
function lit(s) { if (s == null) return "NULL"; s = String(s); let tag; do { tag = "$t" + crypto.randomBytes(5).toString("hex") + "$"; } while (s.includes(tag)); return tag + s + tag; }
function bytes(buf) { return "decode('" + Buffer.from(buf).toString("base64") + "','base64')"; }

function createClient(url) {
  const cfg = parseUrl(url);
  let sock = null, ready = null, buf = Buffer.alloc(0), handler = null, chain = Promise.resolve();

  const msg = (type, body) => { const len = Buffer.alloc(4); len.writeInt32BE(body.length + 4); return Buffer.concat([type ? Buffer.from(type) : Buffer.alloc(0), len, body]); };
  const cstr = s => Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])]);

  function onData(d) { buf = Buffer.concat([buf, d]);
    while (buf.length >= 5) { const len = buf.readInt32BE(1); if (buf.length < len + 1) break; const type = String.fromCharCode(buf[0]), body = buf.subarray(5, len + 1); buf = buf.subarray(len + 1); if (handler) handler(type, body); } }
  function errText(body) { const f = {}; let i = 0; while (i < body.length && body[i] !== 0) { const k = String.fromCharCode(body[i]); const e = body.indexOf(0, i + 1); f[k] = body.toString("utf8", i + 1, e); i = e + 1; } const err = new Error(f.M || "postgres error"); err.code = f.C; return err; }

  function connect() {
    return new Promise((resolve, reject) => {
      let raw = net.connect(cfg.port, cfg.host), done = false;
      const fail = e => { if (!done) { done = true; reject(e); } sock = null; ready = null; };
      raw.setNoDelay(true); raw.on("error", fail);   // keep listening: a dropped connection must never crash the server
      const start = s => {
        sock = s; buf = Buffer.alloc(0); s.on("data", onData); s.on("error", fail); s.on("close", () => { sock = null; ready = null; if (handler) handler("X", Buffer.alloc(0)); });
        const params = Buffer.concat([Buffer.from([0, 3, 0, 0]), cstr("user"), cstr(cfg.user), cstr("database"), cstr(cfg.database), cstr("client_encoding"), cstr("UTF8"), cstr("application_name"), cstr("tezkor"), Buffer.from([0])]);
        s.write(msg(null, params));
        let scram = null;
        handler = (type, body) => {
          if (type === "R") { const code = body.readInt32BE(0);
            if (code === 0) return;
            if (code === 3) return s.write(msg("p", cstr(cfg.password)));
            if (code === 5) { const salt = body.subarray(4, 8), inner = crypto.createHash("md5").update(cfg.password + cfg.user).digest("hex");
              return s.write(msg("p", cstr("md5" + crypto.createHash("md5").update(Buffer.concat([Buffer.from(inner), salt])).digest("hex")))); }
            if (code === 10) { const nonce = crypto.randomBytes(18).toString("base64"); scram = { nonce, first: "n=,r=" + nonce };
              const resp = Buffer.from("n,," + scram.first), n = Buffer.alloc(4); n.writeInt32BE(resp.length);
              return s.write(msg("p", Buffer.concat([cstr("SCRAM-SHA-256"), n, resp]))); }
            if (code === 11) { const sf = body.subarray(4).toString(), a = Object.fromEntries(sf.split(",").map(p => [p[0], p.slice(2)]));
              if (!a.r.startsWith(scram.nonce)) return fail(new Error("SCRAM nonce mismatch"));
              const salted = crypto.pbkdf2Sync(cfg.password, Buffer.from(a.s, "base64"), +a.i, 32, "sha256");
              const ck = crypto.createHmac("sha256", salted).update("Client Key").digest(), sk = crypto.createHash("sha256").update(ck).digest();
              const without = "c=biws,r=" + a.r, auth = scram.first + "," + sf + "," + without;
              const sig = crypto.createHmac("sha256", sk).update(auth).digest(), proof = Buffer.from(ck.map((b, i) => b ^ sig[i])).toString("base64");
              scram.server = crypto.createHmac("sha256", crypto.createHmac("sha256", salted).update("Server Key").digest()).update(auth).digest("base64");
              return s.write(msg("p", Buffer.from(without + ",p=" + proof))); }
            if (code === 12) { const v = body.subarray(4).toString().replace(/^v=/, ""); if (v !== scram.server) fail(new Error("SCRAM server signature mismatch")); return; }
            return fail(new Error("unsupported auth " + code)); }
          if (type === "E") return fail(errText(body));
          if (type === "Z") { done = true; handler = null; resolve(); }
        };
      };
      if (cfg.ssl === "disable") return raw.once("connect", () => start(raw));
      raw.once("connect", () => { const r = Buffer.alloc(8); r.writeInt32BE(8); r.writeInt32BE(80877103, 4); raw.write(r);
        raw.once("data", d => {
          if (d[0] !== 0x53) { if (cfg.ssl === "prefer" || cfg.ssl === "allow") return start(raw); return fail(new Error("the server does not accept SSL")); }
          const t = tls.connect({ socket: raw, servername: net.isIP(cfg.host) ? undefined : cfg.host, rejectUnauthorized: cfg.ssl === "verify-full" || cfg.ssl === "verify-ca" });
          t.once("secureConnect", () => start(t)); t.on("error", fail);
        }); });
    });
  }
  function ensure() { if (sock && ready) return ready; ready = connect(); return ready; }

  function run(sql) {
    return new Promise((resolve, reject) => {
      const rows = []; let cols = [], err = null;
      handler = (type, body) => {
        if (type === "T") { const n = body.readInt16BE(0); cols = []; let i = 2; for (let k = 0; k < n; k++) { const e = body.indexOf(0, i); cols.push(body.toString("utf8", i, e)); i = e + 1 + 18; } }
        else if (type === "D") { const n = body.readInt16BE(0), row = {}; let i = 2; for (let k = 0; k < n; k++) { const len = body.readInt32BE(i); i += 4; row[cols[k]] = len < 0 ? null : body.toString("utf8", i, i + len); if (len > 0) i += len; } rows.push(row); }
        else if (type === "E") err = errText(body);
        else if (type === "Z") { handler = null; err ? reject(err) : resolve({ rows }); }
        else if (type === "X") { handler = null; reject(err || new Error("connection closed")); }
      };
      sock.write(msg("Q", cstr(sql)));
    });
  }
  /* queries run one after another; a dropped connection is reopened once */
  function query(sql) {
    const p = chain.then(async () => {
      for (let attempt = 0; ; attempt++) {
        try { await ensure(); return await run(sql); }
        catch (e) { if (attempt === 0 && !e.code) { sock = null; ready = null; continue; } throw e; }
      }
    });
    chain = p.catch(() => {});
    return p;
  }
  function end() { try { if (sock) { sock.on("error", () => {}); sock.write(msg("X", Buffer.alloc(0))); sock.end(); } } catch {} sock = null; ready = null; }
  return { query, end, cfg };
}
module.exports = { createClient, lit, bytes };
