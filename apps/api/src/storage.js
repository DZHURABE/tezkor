/* Where Тезкор keeps its data. Two interchangeable backends:
     file      — db.json + folders on a disk (Render with a disk, a VPS)                       [default]
     postgres  — everything in one PostgreSQL database (Neon free tier, Render free plan)      DATABASE_URL=postgresql://…
   Both give the core server the same synchronous store/files/media and an archive for old orders,
   plus async readers for receipt and picture bytes, storage sizes and a picture sweep. */
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const IMG = /^data:image\/(jpeg|png|webp);base64,(.+)$/;
const monthOf = o => new Date(o.createdAt).toISOString().slice(0, 7);
const usedMedia = db => { const used = new Set(), add = u => { if (u && String(u).startsWith("/media/")) used.add(path.basename(u)); };
  db.products.forEach(p => add(p.photo)); db.restaurants.forEach(r => add(r.cover)); db.banners.forEach(b => add(b.photo));
  /* also category pictures, restaurant logos, profile photos and classified-ad photos */
  (db.categories || []).forEach(c => add(c.photo)); db.restaurants.forEach(r => add(r.logo)); (db.users || []).forEach(u => add(u.avatar)); (db.ads || []).forEach(a => (a.photos || []).forEach(add));
  db.orders.forEach(o => (o.items || []).forEach(i => add(i.photo))); return used; };

/* ------------------------------------------------------------------ file ------------------------------------------------------------------ */
function fileBackend(DATA_FILE) {
  const DIR = path.dirname(DATA_FILE), BACKUPS = path.join(DIR, "backups"), RECEIPTS = path.join(DIR, "receipts"), MEDIA = path.join(DIR, "media"), ARCHIVE = path.join(DIR, "archive");
  let lastBackup = 0;
  const store = {
    load() { if (!fs.existsSync(DATA_FILE)) return null; return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); },   // a corrupt file stops the start instead of starting empty
    save(db) {
      fs.mkdirSync(DIR, { recursive: true });
      const tmp = DATA_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DATA_FILE);
      if (Date.now() - lastBackup > 3600e3) {   // hourly compressed copy: the last 24 hours + one a day for 14 days
        lastBackup = Date.now(); fs.mkdirSync(BACKUPS, { recursive: true });
        fs.writeFileSync(path.join(BACKUPS, "db-" + new Date().toISOString().slice(0, 13).replace(/[-T:]/g, "") + ".json.gz"), zlib.gzipSync(fs.readFileSync(DATA_FILE)));
        const all = fs.readdirSync(BACKUPS).filter(f => /^db-\d{10}\.json(\.gz)?$/.test(f)).sort(), keep = new Set(all.slice(-24)), days = {};
        all.forEach(f => { const d = f.slice(3, 11); if (!days[d]) days[d] = f; });
        Object.keys(days).sort().slice(-14).forEach(d => keep.add(days[d]));
        all.forEach(f => { if (!keep.has(f)) fs.unlinkSync(path.join(BACKUPS, f)); });
      }
    },
  };
  const clean = id => String(id).replace(/[^\w-]/g, "");
  const files = {
    put(id, dataUrl) { const m = IMG.exec(dataUrl); if (!m) return; fs.mkdirSync(RECEIPTS, { recursive: true }); fs.writeFileSync(path.join(RECEIPTS, clean(id) + "." + m[1]), Buffer.from(m[2], "base64")); },
    get(id) { for (const ext of ["jpeg", "png", "webp"]) { const f = path.join(RECEIPTS, clean(id) + "." + ext); if (fs.existsSync(f)) return "data:image/" + ext + ";base64," + fs.readFileSync(f).toString("base64"); } return null; },
    del(id) { for (const ext of ["jpeg", "png", "webp"]) fs.rmSync(path.join(RECEIPTS, clean(id) + "." + ext), { force: true }); },
  };
  const media = {
    put(id, dataUrl) { const m = IMG.exec(dataUrl); fs.mkdirSync(MEDIA, { recursive: true }); const name = clean(id) + "." + m[1]; fs.writeFileSync(path.join(MEDIA, name), Buffer.from(m[2], "base64")); return "/media/" + name; },
    del(url) { const n = path.basename(String(url || "")); if (/^[\w-]+\.(jpeg|png|webp)$/.test(n)) fs.rm(path.join(MEDIA, n), { force: true }, () => {}); },
  };
  function archive(orders) {   // one compressed file per month, appended to; zcat reads it
    fs.mkdirSync(ARCHIVE, { recursive: true }); const by = {};
    orders.forEach(o => (by[monthOf(o)] = by[monthOf(o)] || []).push(JSON.stringify(o)));
    Object.keys(by).forEach(m => fs.appendFileSync(path.join(ARCHIVE, "orders-" + m + ".jsonl.gz"), zlib.gzipSync(by[m].join("\n") + "\n")));
  }
  const dirSize = d => { let n = 0; try { for (const f of fs.readdirSync(d)) { const st = fs.statSync(path.join(d, f)); n += st.isDirectory() ? dirSize(path.join(d, f)) : st.size; } } catch {} return n; };
  function storageInfo() {
    const size = f => { try { return fs.statSync(f).size; } catch { return 0; } };
    const out = { kind: "disk", db: size(DATA_FILE), receipts: dirSize(RECEIPTS), media: dirSize(MEDIA), archive: dirSize(ARCHIVE), backups: dirSize(BACKUPS) };
    out.total = out.db + out.receipts + out.media + out.archive + out.backups;
    try { const s = fs.statfsSync(DIR); out.free = s.bavail * s.bsize; out.disk = s.blocks * s.bsize; } catch {}
    return out;
  }
  function sweepMedia(db) {   // pictures nothing points to any more go away after a day
    const used = usedMedia(db); let n = 0;
    try { for (const f of fs.readdirSync(MEDIA)) { const fp = path.join(MEDIA, f); if (!used.has(f) && Date.now() - fs.statSync(fp).mtimeMs > 86400e3) { fs.rmSync(fp, { force: true }); n++; } } } catch {}
    return n;
  }
  return {
    kind: "file", where: DATA_FILE, store, files, media, archive, storageInfo, sweepMedia,
    async readReceipt(id) { return files.get(id); },
    async readMedia(name) { const m = /^[\w-]+\.(jpeg|png|webp)$/.exec(name); if (!m) return null; try { return { mime: "image/" + m[1], buf: fs.readFileSync(path.join(MEDIA, name)) }; } catch { return null; } },
    async flush() {}, async backup() {},
  };
}

/* ------------------------------------------------------------------ postgres ------------------------------------------------------------------ */
async function pgBackend(url, opts = {}) {
  const { createClient, lit, bytes } = require("./pgwire.js");
  const pg = createClient(url), log = opts.log || console.log;
  await pg.query(`create table if not exists tezkor_state (id int primary key, data text not null, updated_at timestamptz not null default now());
    create table if not exists tezkor_files (id text primary key, kind text not null, mime text not null, data bytea not null, created_at timestamptz not null default now());
    create table if not exists tezkor_archive (id bigserial primary key, month text not null, orders text not null, created_at timestamptz not null default now());
    create table if not exists tezkor_backups (day text primary key, data bytea not null, created_at timestamptz not null default now());`);
  const first = await pg.query("select data from tezkor_state where id = 1");
  const initial = first.rows[0] ? JSON.parse(first.rows[0].data) : null;

  /* writes: the newest state is written in the background; archived orders go in the same statement (all or nothing) */
  let dirty = null, writing = false, failures = 0; const archiveQ = [], idle = [];
  async function flushLoop() {
    if (writing) return; writing = true;
    try {
      while (dirty) {
        const json = dirty, arch = archiveQ.splice(0); dirty = null;
        const sql = arch.map(a => `insert into tezkor_archive (month, orders) values (${lit(a.month)}, ${lit(a.orders)});`).join("\n") +
          `insert into tezkor_state (id, data, updated_at) values (1, ${lit(json)}, now()) on conflict (id) do update set data = excluded.data, updated_at = now();`;
        try { await pg.query(sql); failures = 0; }
        catch (e) { archiveQ.unshift(...arch); if (!dirty) dirty = json; failures++; log("database write failed (" + failures + "), retrying:", e.message); await new Promise(r => setTimeout(r, Math.min(30000, 1000 * failures))); }
      }
    } finally { writing = false; idle.splice(0).forEach(f => f()); }
  }
  const store = { load: () => initial, save(db) { dirty = JSON.stringify(db); setImmediate(flushLoop); } };

  /* pictures and receipts: kept in memory until written, so they can be shown at once */
  const pending = new Map();
  function putBlob(kind, id, dataUrl) {
    const m = IMG.exec(dataUrl); if (!m) return null; const mime = "image/" + m[1], buf = Buffer.from(m[2], "base64");
    pending.set(id, { mime, buf });
    pg.query(`insert into tezkor_files (id, kind, mime, data) values (${lit(id)}, ${lit(kind)}, ${lit(mime)}, ${bytes(buf)}) on conflict (id) do update set data = excluded.data, mime = excluded.mime`)
      .then(() => pending.delete(id), e => log("picture save failed:", e.message));
    return m[1];
  }
  async function readBlob(id) {
    if (pending.has(id)) return pending.get(id);
    const r = await pg.query(`select mime, encode(data, 'base64') as b from tezkor_files where id = ${lit(id)}`);
    return r.rows[0] ? { mime: r.rows[0].mime, buf: Buffer.from(r.rows[0].b, "base64") } : null;
  }
  const delBlob = id => { pending.delete(id); pg.query(`delete from tezkor_files where id = ${lit(id)}`).catch(e => log("delete failed:", e.message)); };
  const files = { put(id, dataUrl) { putBlob("receipt", "rc:" + id, dataUrl); }, get() { return null; }, del(id) { delBlob("rc:" + id); } };
  const media = {
    put(id, dataUrl) { const name = String(id).replace(/[^\w-]/g, "") + "." + (IMG.exec(dataUrl) || [, "jpeg"])[1]; putBlob("media", "m:" + name, dataUrl); return "/media/" + name; },
    del(url) { const n = path.basename(String(url || "")); if (/^[\w-]+\.(jpeg|png|webp)$/.test(n)) delBlob("m:" + n); },
  };
  function archive(orders) { const by = {}; orders.forEach(o => (by[monthOf(o)] = by[monthOf(o)] || []).push(JSON.stringify(o)));
    Object.keys(by).forEach(m => archiveQ.push({ month: m, orders: by[m].join("\n") })); }

  /* sizes for the admin page, refreshed in the background (the free tier allows about 0.5 GB) */
  let sizes = { kind: "postgres", db: 0, receipts: 0, media: 0, archive: 0, backups: 0, total: 0, disk: (+process.env.DB_LIMIT_MB || 512) * 1048576 };
  async function refreshSizes() {
    try {
      const r = await pg.query(`select (select coalesce(octet_length(data),0) from tezkor_state where id = 1) as db,
          (select coalesce(sum(octet_length(data)),0) from tezkor_files where kind = 'receipt') as receipts,
          (select coalesce(sum(octet_length(data)),0) from tezkor_files where kind = 'media') as media,
          (select coalesce(sum(octet_length(orders)),0) from tezkor_archive) as archive,
          (select coalesce(sum(octet_length(data)),0) from tezkor_backups) as backups,
          pg_database_size(current_database()) as total`);
      const x = r.rows[0]; Object.keys(x).forEach(k => { sizes[k] = +x[k] || 0; });
      sizes.free = Math.max(0, sizes.disk - sizes.total);
    } catch (e) { log("size check failed:", e.message); }
  }
  refreshSizes(); setInterval(refreshSizes, 10 * 60e3).unref();

  return {
    kind: "postgres", where: pg.cfg.host + "/" + pg.cfg.database, store, files, media, archive,
    storageInfo: () => Object.assign({}, sizes),
    async readReceipt(id) { const b = await readBlob("rc:" + id); return b ? "data:" + b.mime + ";base64," + b.buf.toString("base64") : null; },
    async readMedia(name) { return /^[\w-]+\.(jpeg|png|webp)$/.test(name) ? readBlob("m:" + name) : null; },
    sweepMedia(db) {   // async in the background; returns at once
      const used = usedMedia(db);
      pg.query(`select id from tezkor_files where kind = 'media' and created_at < now() - interval '1 day'`).then(r => {
        const gone = r.rows.map(x => x.id).filter(id => !used.has(id.slice(2)));
        if (gone.length) return pg.query(`delete from tezkor_files where id in (${gone.map(lit).join(",")})`).then(() => log("swept pictures:", gone.length));
      }).catch(e => log("sweep failed:", e.message));
      return null;
    },
    /* a compressed copy of the data once a day, the last 7 days kept */
    async backup(db) { const day = new Date().toISOString().slice(0, 10);
      await pg.query(`insert into tezkor_backups (day, data) values (${lit(day)}, ${bytes(zlib.gzipSync(JSON.stringify(db)))}) on conflict (day) do update set data = excluded.data, created_at = now();
        delete from tezkor_backups where day not in (select day from tezkor_backups order by day desc limit 7);`); refreshSizes(); },
    /* before the server stops: write what is still in memory */
    async flush(ms = 8000) { const end = Date.now() + ms;
      while ((dirty || writing || pending.size) && Date.now() < end) { setImmediate(flushLoop); await new Promise(r => setTimeout(r, 100)); }
      pg.end(); },
  };
}

async function openStorage(env, log) {
  if (env.DATABASE_URL) return pgBackend(env.DATABASE_URL, { log });
  return fileBackend(env.DATA_FILE || path.join(__dirname, "../data/db.json"));
}
module.exports = { openStorage, fileBackend, pgBackend };
