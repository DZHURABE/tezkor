/* SOMON FOOD — API server that runs inside the browser for the prototype.
   Every handler mirrors a REST endpoint of apps/api (see docs/openapi.yaml).
   In production the web app talks to the real API over HTTP instead (see client.js). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./rules.js"), require("./seed.js"));
  else root.SomonServer = factory(root.SomonRules, root.SomonSeed);
})(typeof self !== "undefined" ? self : this, function (Rules, Seed) {

  function ApiError(status, code, extra) { this.status = status; this.code = code; this.extra = extra || {}; }

  function createServer(opts) {
    opts = opts || {};
    var store = opts.store || { load: function () { return null; }, save: function () {} };
    var clock = opts.now || function () { return Date.now(); };
    var PROD = !!opts.production;                                  // real launch: no demo data, no test cards, no demo reset
    var hashPw = opts.hashPassword || function (pw) { return Seed.hash(pw); };
    var checkPw = opts.checkPassword || function (pw, stored) { return stored === Seed.hash(pw); };
    var newToken = opts.newToken || function () { return "t" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + clock().toString(36); };
    var newPassword = opts.newPassword || function () { return String(100000 + Math.floor(Math.random() * 900000)); };
    /* receipt images: the Node API stores them as files; the browser prototype keeps them in its own data */
    var files = opts.files || { put: function (id, dataUrl) { db.files = db.files || {}; db.files[id] = dataUrl; }, get: function (id) { return (db.files || {})[id] || null; } };
    /* phone verification channels. The Node API plugs in Telegram / WhatsApp / SMS (apps/api/src/verify.js);
       the browser demo has a "demo" channel that shows the code on screen. channels() → [{ id, kind: "link"|"code" }],
       start(v, ch) → { link } for link channels, sends the code for code channels (may throw if the channel is down). */
    var verify = opts.verify || (PROD ? { channels: function () { return []; }, start: function () { return {}; } }
      : { channels: function () { return [{ id: "demo", kind: "code" }]; }, start: function (v) { return { demoCode: v.code }; } });
    /* public pictures (dish photos, covers, ads): the Node API writes files and returns their URL; the browser prototype keeps the data URL */
    var media = opts.media || { put: function (id, dataUrl) { return dataUrl; }, del: function () {} };
    var db = store.load();
    /* forgotten admin password: start once with ADMIN_RESET_PASSWORD set, then remove it */
    function resetAdmin() { if (!opts.resetAdmin || !opts.resetAdmin.password) return; var ph = Rules.normPhone(opts.resetAdmin.phone);
      var a = db.users.filter(function (u) { return u.role === "admin" && (!ph || u.phone === ph); })[0]; if (!a) return;
      a.pass = hashPw(opts.resetAdmin.password); a.active = true; Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].userId === a.id) delete db.sessions[k]; }); store.save(db); }
    if (!db || !db.meta) { db = Seed.build(clock(), { demo: !PROD, admin: opts.admin ? { name: opts.admin.name || "Admin", phone: Rules.normPhone(opts.admin.phone), pass: hashPw(opts.admin.password) } : null }); store.save(db); }
    else if (!PROD && db.meta.schema !== Seed.SCHEMA) { db = Seed.build(clock()); store.save(db); }   // demo data only; real data is never wiped
    resetAdmin();
    /* one-time upgrade of saved data: the ten home categories (sushi, groceries, other goods added; empty extras hidden) */
    (function upgrade() { if (!db.meta || (db.meta.up || 0) >= 1) return; var add = Seed.EXTRA_CATS || [];
      add.forEach(function (c) { if (!db.categories.some(function (x) { return x.id === c.id; })) db.categories.push(Object.assign({}, c)); });
      var order = Seed.CAT_ORDER || []; db.categories.forEach(function (c) { var i = order.indexOf(c.id); if (i >= 0) c.sort = i + 1; else c.sort = 50 + (c.sort || 0); });
      ["k6", "k7"].forEach(function (id) { var c = db.categories.filter(function (x) { return x.id === id; })[0]; if (c && !db.products.some(function (p) { return p.categoryId === id; })) c.active = false; });
      db.meta.up = 1; store.save(db); })();
    /* shops (Tezkor «Мағозаҳо»): the same engine as restaurants with kind "shop" and their own goods categories */
    /* kinds of shop: what the owner sells decides the sections, the fields and the staff names he sees */
    var SHOP_TYPES = ["tech", "grocery", "clothes", "home", "general"];
    var T_ = function () { return Array.prototype.slice.call(arguments); };
    var SHOP_CATS = [["s1", "Телефонҳо", "Телефоны", "Phones", "phone", T_("tech", "general")], ["s2", "Планшет ва ноутбук", "Планшеты и ноутбуки", "Tablets & laptops", "laptop", T_("tech", "general")], ["s3", "Қулоқчин ва аудио", "Наушники и аудио", "Headphones & audio", "audio", T_("tech", "general")],
      ["s4", "Зарядка ва кабел", "Зарядки и кабели", "Chargers & cables", "charge", T_("tech", "general")], ["s5", "Ғилоф ва шиша", "Чехлы и стёкла", "Cases & glass", "case", T_("tech", "general")], ["s6", "Аксессуарҳо", "Аксессуары", "Accessories", "acc", T_("tech", "clothes", "general")],
      ["s7", "Техникаи маишӣ", "Бытовая техника", "Home appliances", "tech", T_("tech", "home", "general")], ["s8", "Либос ва пойафзол", "Одежда и обувь", "Clothes & shoes", "clothes", T_("clothes", "general")], ["s9", "Косметика", "Косметика", "Cosmetics", "beauty", T_("clothes", "home", "general")], ["s10", "Дигар молҳо", "Другие товары", "Other goods", "other", T_("tech", "grocery", "clothes", "home", "general")],
      ["g1", "Орд, ярма ва макарон", "Мука, крупы, макароны", "Flour, grains & pasta", "other", T_("grocery", "general")], ["g2", "Равған ва ёғ", "Масло и жиры", "Oil & fats", "other", T_("grocery", "general")], ["g3", "Қанд, чой ва қаҳва", "Сахар, чай и кофе", "Sugar, tea & coffee", "other", T_("grocery", "general")],
      ["g4", "Шир ва тухм", "Молочные и яйца", "Dairy & eggs", "other", T_("grocery", "general")], ["g5", "Гӯшт ва мурғ", "Мясо и птица", "Meat & poultry", "other", T_("grocery", "general")], ["g6", "Сабзавот ва мева", "Овощи и фрукты", "Vegetables & fruit", "other", T_("grocery", "general")],
      ["g7", "Нон ва ширинӣ", "Хлеб и сладости", "Bread & sweets", "other", T_("grocery", "general")], ["g8", "Нӯшокиҳо", "Напитки", "Drinks", "other", T_("grocery", "general")], ["g9", "Консерва ва хушкмева", "Консервы и сухофрукты", "Canned & dried fruit", "other", T_("grocery", "general")], ["g10", "Хӯҷагӣ ва тозакунӣ", "Хозтовары и бытовая химия", "Household & cleaning", "other", T_("grocery", "home", "general")],
      ["c1", "Либоси мардона", "Мужская одежда", "Men's clothes", "clothes", T_("clothes", "general")], ["c2", "Либоси занона", "Женская одежда", "Women's clothes", "clothes", T_("clothes", "general")], ["c3", "Либоси кӯдакона", "Детская одежда", "Kids' clothes", "clothes", T_("clothes", "general")], ["c4", "Пойафзол", "Обувь", "Shoes", "clothes", T_("clothes", "general")],
      ["h1", "Зарфу асбоби ошхона", "Посуда и кухня", "Dishes & kitchen", "other", T_("home", "general")], ["h2", "Мебел ва ороиш", "Мебель и декор", "Furniture & decor", "other", T_("home", "general")], ["h3", "Асбоби сохтмон", "Стройматериалы и инструменты", "Building & tools", "other", T_("home", "general")]];
    (function shopCats() { if (!db || !db.categories) return; var ch = false; SHOP_CATS.forEach(function (c, i) { var ex = db.categories.filter(function (x) { return x.id === c[0]; })[0];
      if (!ex) { db.categories.push({ id: c[0], name: { tg: c[1], ru: c[2], en: c[3] }, icon: "box", shopIcon: c[4], shop: true, types: c[5], active: true, sort: 100 + i }); ch = true; } else if (!ex.types) { ex.types = c[5]; ch = true; } });
      (db.restaurants || []).forEach(function (r) { if (r.kind === "shop" && !r.shopType) { r.shopType = "general"; ch = true; } }); if (ch) store.save(db); })();
    function isShop(r) { return r && r.kind === "shop"; }
    var routes = [];

    function save() { db.meta.version++; store.save(db); }
    function E(status, code, extra) { throw new ApiError(status, code, extra); }
    function id(p) { db.meta.seq++; return p + db.meta.seq; }
    function find(list, v) { for (var i = 0; i < list.length; i++) if (list[i].id === v) return list[i]; return null; }
    function by(list, key, v) { return list.filter(function (x) { return x[key] === v; }); }
    function str(v, max) { v = String(v == null ? "" : v).trim(); return max ? v.slice(0, max) : v; }
    function L(v) { v = str(v, 80); return { tg: v, ru: v, en: v }; }
    function int(v) { v = Number(v); return Number.isFinite(v) && Math.floor(v) === v ? v : NaN; }
    function image(v, pfx) { v = String(v || ""); if (!/^data:image\/(jpeg|png|webp);base64,/.test(v)) E(400, "BAD_IMAGE"); if (v.length > 1500000) E(413, "IMAGE_TOO_LARGE"); return media.put(id(pfx), v); }
    /* photo field: data URL → stored, null/"" → removed, the current URL → kept */
    function photoField(v, cur, pfx) { if (v === undefined || v === cur) return cur; if (cur) media.del(cur); return v ? image(v, pfx) : null; }
    var TONES = ["#E8590C", "#0B8A5A", "#7A3E9D", "#1F6FB2", "#C2185B", "#B7791F", "#1F1A17"];
    function route(method, path, roles, fn) {
      var keys = [], re = new RegExp("^" + path.replace(/:(\w+)/g, function (_, k) { keys.push(k); return "([^/]+)"; }) + "$");
      routes.push({ method: method, re: re, keys: keys, roles: roles, fn: fn });
    }

    /* ---------- shaping ---------- */
    function pubUser(u) { if (!u) return null; var o = { id: u.id, role: u.role, name: u.name, phone: u.phone, cityId: u.cityId, active: u.active, lang: u.lang, createdAt: u.createdAt };
      if (u.mustChange) o.mustChange = true; if (u.staff) { o.staff = true; o.staffRole = ["manager", "waiter"].indexOf(u.staffRole) >= 0 ? u.staffRole : "worker"; if (u.tipCard) o.tipCard = u.tipCard; } if (u.avatar) o.avatar = u.avatar; if (u.favs) o.favs = u.favs; if (u.pwResetAt) o.pwResetAt = u.pwResetAt; if (u.phoneVerified) o.phoneVerified = u.phoneVerified;
      if (u.restaurantId) { o.restaurantId = u.restaurantId; var rk = find(db.restaurants, u.restaurantId); o.restKind = rk && rk.kind === "shop" ? "shop" : "food"; if (rk && rk.kind === "shop") o.shopType = rk.shopType || "general"; } if (u.courier) { o.courier = Object.assign({}, u.courier, courierRating(u)); if (crests(u).length) { var rr = find(db.restaurants, crests(u)[0]); o.courier.restaurantName = rr ? rr.name : null; o.courier.restaurantIds = crests(u); o.courier.restaurantNames = crests(u).map(function (x) { var q = find(db.restaurants, x); return q ? q.name : null; }).filter(Boolean); } } if (u.addresses) o.addresses = u.addresses; return o; }
    function courierRating(u) { var rs = db.orders.filter(function (o) { return o.courierId === u.id && o.review && o.review.courierRating; });
      if (!rs.length) return { rating: u.courier ? u.courier.rating : null, ratingCount: u.courier ? u.courier.ratingCount : 0 };
      var base = (u.courier.rating || 0) * (u.courier.ratingCount || 0), sum = rs.reduce(function (s, o) { return s + o.review.courierRating; }, 0);
      var n = (u.courier.ratingCount || 0) + rs.length; return { rating: Math.round((base + sum) / n * 10) / 10, ratingCount: n }; }
    function cityOf(id) { return find(db.cities, id) || db.cities[0]; }
    function cardOn() { return !PROD || !!opts.cardProvider; }
    function payOn(m) { var s = db.settings; return m === "card" ? cardOn() : m === "transfer" ? s.payTransfer !== false : m === "cash" ? s.payCash !== false : false; }
    /* subscription: a restaurant is shown to customers only while its paid period lasts (no date = no limit) */
    var DAY = 86400000;
    function setting(k) { var d = { subFee: 300, trialDays: 30, handoffMin: 7, receiptDays: 30, archiveDays: 90 }; return db.settings[k] == null ? d[k] : db.settings[k]; }
    function paid(r) { return !r.paidUntil || r.paidUntil > clock(); }
    function live(r) { return r.active && paid(r); }
    /* shown in lists only when a customer can really order: dishes on the menu and a way to pay */
    function orderable(r) { return live(r) && db.products.some(function (p) { return p.restaurantId === r.id && p.available; }) && (payOn("cash") || cardOn() || (payOn("transfer") && r.payCard && r.payCard.number)); }
    function subOf(r) { if (!r.paidUntil) return { state: "none", until: null, daysLeft: null };
      var d = Math.ceil((r.paidUntil - clock()) / DAY); return { state: d <= 0 ? "expired" : d <= 5 ? "soon" : "ok", until: r.paidUntil, daysLeft: Math.max(0, d), trial: !!r.trial }; }
    function addMonths(t, n) { var d = new Date(t); var day = d.getDate(); d.setMonth(d.getMonth() + n); if (d.getDate() < day) d.setDate(0); return d.getTime(); }
    function openNow(r) { return live(r) && r.open && Rules.isOpenAt(r.hours, new Date(clock())); }
    function pubRest(r) { var c = cityOf(r.cityId);
      return Object.assign({}, r, { tables: undefined, isOpenNow: openNow(r), deliveryFrom: Rules.deliveryFee(db.settings, Math.max(1, Rules.distanceKm(r, c) )), productCount: by(db.products, "restaurantId", r.id).length, sub: subOf(r), hasSale: db.products.some(function (p) { return p.restaurantId === r.id && p.available && p.oldPrice > p.price; }), orderCount: db.orders.filter(function (o) { return o.restaurantId === r.id && o.status === "delivered"; }).length, isNew: clock() - (r.createdAt || 0) < 30 * 864e5 }); }
    /* where the courier is: real GPS from the courier app when it is fresh, otherwise an estimate along the route */
    var SPEED = { scooter: 25, bike: 15, car: 30, foot: 5 };   // km/h inside the town
    function courierPos(o) {
      var r = find(db.restaurants, o.restaurantId), c = o.courierId && find(db.users, o.courierId); if (!c) return null;
      if (o.status === "delivered") return { lat: o.address.lat, lng: o.address.lng, progress: 1, leg: "done", km: 0, etaMin: 0 };
      var t = clock(), kmh = SPEED[c.courier.vehicle] || 25, leg = o.status === "picked_up" ? "to_customer" : "to_restaurant", to = leg === "to_customer" ? o.address : r, pos, p;
      var live = c.courier.locAt && t - c.courier.locAt < 120000;
      if (live) pos = { lat: c.courier.lat, lng: c.courier.lng };
      else {
        var from = leg === "to_customer" ? r : (o.courierFrom || c.courier), start = leg === "to_customer" ? o.pickedAt : (o.assignedAt || t);
        var mins = Math.max(1.5, Rules.distanceKm(from, to) * 1.3 / kmh * 60); p = Math.min(1, (t - start) / (mins * 60000));
        pos = { lat: from.lat + (to.lat - from.lat) * p, lng: from.lng + (to.lng - from.lng) * p };
      }
      var left = Rules.distanceKm(pos, to) * 1.3, eta = Math.max(0, Math.ceil(left / kmh * 60));
      if (leg === "to_restaurant" && left < 0.08) leg = "at_restaurant";
      return { lat: pos.lat, lng: pos.lng, progress: p == null ? null : p, leg: leg, km: Math.round(left * 10) / 10, etaMin: eta, live: !!live, at: live ? c.courier.locAt : t };
    }

    function wOf(o) { var w = o.waiterId && find(db.users, o.waiterId); return w ? { id: w.id, name: w.name, tipCard: w.tipCard || null, rating: w.wRating || null } : null; }
    function pubOrder(o, viewer) {
      var r = find(db.restaurants, o.restaurantId), cu = find(db.users, o.customerId), co = o.courierId ? find(db.users, o.courierId) : null;
      var x = Object.assign({}, o, { restaurant: r ? { id: r.id, kind: r.kind || "food", name: r.name, phone: r.phone, lat: r.lat, lng: r.lng, tone: r.tone, address: r.address } : null,
        /* a known number: how many orders this customer has already received — new or regular */
        customer: cu ? { id: cu.id, name: cu.name, phone: cu.phone, verified: !!cu.phoneVerified, orders: db.orders.filter(function (x) { return x.customerId === cu.id && x.status === "delivered" && x.id !== o.id; }).length } : null,
        courier: co ? Object.assign({ id: co.id, name: co.name, phone: co.phone, vehicle: co.courier.vehicle }, courierRating(co)) : null,
        courierPos: courierPos(o), waiter: wOf(o) });
      /* phone numbers are shared only while they are needed: during an active order, between the people working on it */
      var live = Rules.ACTIVE.indexOf(o.status) >= 0, role = viewer && viewer.role;
      if (role !== "admin") {
        var seesCustomer = live && (role === "customer" || role === "restaurant" || (role === "courier" && o.courierId === viewer.id));
        if (!seesCustomer) { if (x.customer) x.customer = { id: x.customer.id, name: x.customer.name.split(" ")[0] }; delete x.phone; }
        if (x.courier && !(live && (role === "customer" || role === "restaurant" || (role === "courier" && o.courierId === viewer.id)))) delete x.courier.phone;
      }
      if (viewer && viewer.role === "courier") { delete x.commission; delete x.restaurantPayout; delete x.platform; }
      if (viewer && viewer.role === "customer") { delete x.commission; delete x.restaurantPayout; delete x.platform; delete x.courierPay; }
      return x;
    }

    /* ---------- notifications ---------- */
    function notify(target, key, params, orderId) { if (/^u:(null|undefined)$/.test(target)) return; db.notifications.unshift({ id: id("n"), target: target, key: key, params: params || {}, orderId: orderId || null, at: clock(), readBy: {}, gone: false });
      if (db.notifications.length > 400) db.notifications.length = 400;
      try { pushTo(target, key, params || {}, orderId || null); } catch (e) {} }
    /* ---------- Web Push: the phone gets the signal even when the app is closed or the screen is off ----------
       opts.push = { publicKey, send(sub, payload) → Promise<{gone}>, text(key, params, lang) → {title, body} } (the Node API only) */
    function pushSubs() { return db.pushSubs || (db.pushSubs = []); }
    function pushUsers(target) {
      var m = /^(u|rest|own|couriers):(.*)$/.exec(target), k = m && m[1], v = m && m[2];
      if (target === "admins") return db.users.filter(function (u) { return u.role === "admin" && !u.deleted && u.active !== false; });
      if (!m) return [];
      return db.users.filter(function (u) { if (u.deleted || u.active === false) return false;
        if (k === "u") return u.id === v;
        if (k === "rest") return u.role === "restaurant" && u.restaurantId === v;
        if (u.role !== "courier" || !u.courier || !u.courier.online) return false;
        if (k === "own") return crests(u).indexOf(v) >= 0;
        return !crests(u).length && u.cityId === v; }); }
    function pushUrl(u, orderId) { return u.role === "restaurant" ? "/#/rest/orders" : u.role === "courier" ? "/#/courier" : u.role === "admin" ? "/#/admin/orders" : orderId ? "/#/o/" + orderId : "/#/orders"; }
    function pushTo(target, key, params, orderId) {
      if (!opts.push || !pushSubs().length) return;
      pushUsers(target).forEach(function (u) { var subs = pushSubs().filter(function (s) { return s.userId === u.id; }); if (!subs.length) return;
        var tx = opts.push.text(key, params, u.lang || "tg"); if (!tx) return;
        var payload = { title: tx.title, body: tx.body, tag: orderId || key, url: pushUrl(u, orderId), urgent: /^n\.(newOrder|courierNew|courierAuto|ready)$/.test(key) };
        subs.forEach(function (s) { Promise.resolve(opts.push.send(s, payload)).then(function (r) { if (r && r.gone) { db.pushSubs = pushSubs().filter(function (x) { return x !== s; }); save(); } }, function () {}); }); }); }
    /* one courier can work for several places (one phone number, ten shops): the list of places he carries for */
    function crests(u) { var c = (u && u.courier) || {}; return c.restaurantIds && c.restaurantIds.length ? c.restaurantIds : (c.restaurantId ? [c.restaurantId] : []); }
    function setCrests(u, ids) { var seen = {}; ids = (ids || []).filter(function (x) { if (!x || seen[x] || !find(db.restaurants, x)) return false; return (seen[x] = 1); }); u.courier.restaurantIds = ids; u.courier.restaurantId = ids[0] || null; }
    function targetsOf(u) { var t = ["u:" + u.id]; if (u.role === "restaurant") t.push("rest:" + u.restaurantId); if (u.role === "courier" && u.courier.online) { if (crests(u).length) crests(u).forEach(function (x) { t.push("own:" + x); }); else t.push("couriers:" + u.cityId); } if (u.role === "admin") t.push("admins"); return t; }
    function hideFor(orderId, target) { db.notifications.forEach(function (n) { if (n.orderId === orderId && (!target || n.target === target)) n.gone = true; }); }

    /* ---------- who delivers ----------
       platform: Тезкор couriers of the town · own: only the restaurant's own couriers (or the restaurant itself)
       mixed: own couriers first; if nobody takes it within `handoffMin` minutes, Тезкор couriers get it too */
    function handoffMs() { return (db.settings.handoffMin == null ? 7 : db.settings.handoffMin) * 60000; }
    function offerTarget(o) { return (o.delivery || "platform") === "platform" ? "couriers:" + o.cityId : "own:" + o.restaurantId; }
    function offerable(o, u) {
      if (o.dineIn || o.courierId || (o.status !== "cooking" && o.status !== "ready") || o.selfDelivery) return false;
      var d = o.delivery || "platform";
      if (crests(u).length) return crests(u).indexOf(o.restaurantId) >= 0;
      return o.cityId === u.cityId && (d === "platform" || (d === "mixed" && !!o.handedOff));
    }
    /* the restaurant's own couriers: the nearest free one who is online gets the order at once (no one to choose) */
    function autoAssign(o) {
      var r = find(db.restaurants, o.restaurantId); if (!r || o.courierId || o.selfDelivery || o.dineIn || o.pickup) return false;
      var best = null, bd = 1e9;
      db.users.forEach(function (u) { if (!u.courier || u.deleted || !u.active || !u.courier.online || crests(u).indexOf(o.restaurantId) < 0 || activeOf(u.id)) return;
        var d = Rules.distanceKm(r, { lat: u.courier.lat, lng: u.courier.lng }); if (d < bd) { bd = d; best = u; } });
      if (!best) return false;
      o.courierId = best.id; o.assignedAt = clock(); o.autoAssigned = true; o.courierFrom = { lat: best.courier.lat, lng: best.courier.lng }; hideFor(o.id, "couriers:" + o.cityId); hideFor(o.id, "own:" + o.restaurantId);
      notify("u:" + best.id, "n.courierAuto", { n: o.number, rest: r.name }, o.id); notify("rest:" + o.restaurantId, "n.courierAssigned", { n: o.number, name: best.name }, o.id); notify("u:" + o.customerId, "n.courierFound", { n: o.number, name: best.name }, o.id);
      return true; }
    /* mixed orders nobody of the restaurant took in time are offered to Тезкор couriers (checked on every request) */
    function tick() { var t = clock(), ms = handoffMs(), changed = false;
      db.orders.forEach(function (o) { if (o.delivery === "mixed" && !o.handedOff && !o.courierId && !o.selfDelivery && (o.status === "cooking" || o.status === "ready") && o.cookingAt && t - o.cookingAt >= ms) {
        o.handedOff = true; changed = true; var r = find(db.restaurants, o.restaurantId); notify("couriers:" + o.cityId, "n.courierNew", { n: o.number, rest: r.name, km: o.km }, o.id); } });
      /* an order nobody has accepted yet: the shop's phone is nudged again every 2 minutes (5 times) */
      if (opts.push) db.orders.forEach(function (o) { if (o.status === "pending" && (o.pushNag || 0) < 5 && t - (o.pushNagAt || o.createdAt) >= 120000) { o.pushNag = (o.pushNag || 0) + 1; o.pushNagAt = t; changed = true; pushTo("rest:" + o.restaurantId, "n.newOrder", { n: o.number, sum: o.subtotal }, o.id); } });
      db.orders.forEach(function (o) { if (o.status === "awaiting_payment" && o.payment && o.payment.method === "transfer" && t - o.createdAt > 2 * 3600000) { setStatus(o, "cancelled", null); o.cancelReason = "unpaid"; changed = true; } });
      if (changed) save();
      if (!db.meta.lastCleanup || t - db.meta.lastCleanup.at > DAY) cleanup(); }

    /* ---------- housekeeping: once a day the data stays small by itself ----------
       · payment receipt photos of finished orders — deleted after receiptDays (30)
       · finished orders — moved to the archive after archiveDays (90): the Node API writes them to compressed monthly files
       · old notifications, sessions, verification codes — dropped
       Menus, dish photos, restaurants and people are never touched. */
    function cleanup() {
      var t = clock(), rd = setting("receiptDays") * DAY, ad = setting("archiveDays") * DAY, FIN = Rules.FINAL, rep = { at: t, receipts: 0, orders: 0, notes: 0, sessions: 0 };
      var age = function (o) { return t - (o.deliveredAt || o.updatedAt || o.createdAt); };
      db.orders.forEach(function (o) { if (o.payment && o.payment.receiptId && FIN.indexOf(o.status) >= 0 && age(o) > rd) {
        try { if (files.del) files.del(o.payment.receiptId); } catch (e) {} o.payment.receiptId = null; o.payment.receiptPurgedAt = t; rep.receipts++; } });
      var old = db.orders.filter(function (o) { return FIN.indexOf(o.status) >= 0 && age(o) > ad; });
      if (old.length) {
        var ok = true; try { if (opts.archive) opts.archive(JSON.parse(JSON.stringify(old))); } catch (e) { ok = false; }
        if (ok) { var gone = {}; old.forEach(function (o) { gone[o.id] = 1; });
          var ar = db.meta.archived || (db.meta.archived = { orders: 0, delivered: 0, gmv: 0 });
          old.forEach(function (o) { ar.orders++; if (o.status === "delivered") { ar.delivered++; ar.gmv += o.subtotal || 0; } });
          db.orders = db.orders.filter(function (o) { return !gone[o.id]; }); db.payments = db.payments.filter(function (p) { return !gone[p.orderId]; });
          rep.orders = old.length; }
      }
      var n0 = db.notifications.length; db.notifications = db.notifications.filter(function (n) { return !n.gone && t - n.at < 30 * DAY; }); rep.notes = n0 - db.notifications.length;
      Object.keys(db.sessions).forEach(function (k) { if (t - (db.sessions[k].at || 0) > 180 * DAY) { delete db.sessions[k]; rep.sessions++; } });
      if (db.verifications) db.verifications = db.verifications.filter(function (v) { return t - v.createdAt < DAY; });
      db.meta.lastCleanup = rep; save(); return rep; }

    /* ---------- orders ---------- */
    function setStatus(o, to, actor) {
      var role = actor ? actor.role : "system";
      if (!Rules.canTransition(o.status, to, role)) E(409, "BAD_TRANSITION", { from: o.status, to: to });
      var t = clock(); o.status = to; o.updatedAt = t; o.history.push({ status: to, at: t, by: actor ? actor.id : "system" });
      var r = find(db.restaurants, o.restaurantId), num = o.number;
      if (to === "pending") notify("rest:" + o.restaurantId, "n.newOrder", { n: num, sum: o.subtotal }, o.id);
      if (to === "picked_up" && o.dineIn) o.pickedAt = t;
      if ((to === "cancelled" || to === "rejected") && o.stockTaken) { o.stockTaken = false; o.items.forEach(function (it) { var pr = find(db.products, it.productId); if (pr && pr.stock != null) { pr.stock += it.qty; if (pr.stock > 0) pr.available = true; } }); }
      if (to === "cooking") { hideFor(o.id, "rest:" + o.restaurantId); notify("u:" + o.customerId, "n.accepted", { n: num, min: o.prepMin }, o.id); o.cookingAt = t; if (!o.dineIn && !o.pickup) { if (!((o.delivery || "platform") !== "platform" && autoAssign(o))) notify(offerTarget(o), "n.courierNew", { n: num, rest: r.name, km: o.km }, o.id); } }
      if (to === "ready") { if (!o.selfDelivery && !o.dineIn) notify(o.courierId ? "u:" + o.courierId : offerTarget(o), "n.ready", { n: num, rest: r.name }, o.id); notify("u:" + o.customerId, "n.readyCustomer", { n: num }, o.id); }
      if (to === "picked_up") { o.pickedAt = t; notify("u:" + o.customerId, "n.onTheWay", { n: num, total: o.total, cash: o.payment.method === "cash" }, o.id); }
      if (to === "delivered") { o.deliveredAt = t; if (o.payment.method === "cash") o.payment.status = "paid";
        o.items.forEach(function (it) { var pr = find(db.products, it.productId); if (pr) pr.sold = (pr.sold || 0) + it.qty; });
        var dc = o.courierId && find(db.users, o.courierId); o.ownDelivery = !dc || !!(dc.courier && crests(dc).indexOf(o.restaurantId) >= 0); Object.assign(o, Rules.split(o, r, db.settings)); hideFor(o.id); notify("u:" + o.customerId, "n.delivered", { n: num }, o.id); }
      if (to === "rejected" || to === "cancelled") { hideFor(o.id); if (o.payment.status === "paid") { o.payment.status = "refunded"; db.payments.forEach(function (p) { if (p.orderId === o.id) p.status = "refunded"; }); }
        if (to === "rejected") notify("u:" + o.customerId, "n.rejected", { n: num }, o.id); else if (role !== "customer") notify("u:" + o.customerId, "n.cancelled", { n: num }, o.id);
        if (role === "customer") notify("rest:" + o.restaurantId, "n.customerCancelled", { n: num }, o.id); }
    }
    function orderFor(req, oid) { var o = find(db.orders, oid); if (!o) E(404, "NOT_FOUND"); var u = req.user;
      var allowed = u.role === "admin" || (u.role === "customer" && o.customerId === u.id) || (u.role === "restaurant" && o.restaurantId === u.restaurantId) || (u.role === "courier" && (o.courierId === u.id || offerable(o, u)));
      if (!allowed) E(403, "FORBIDDEN"); return o; }
    function quote(req, b) {
      var r = find(db.restaurants, b.restaurantId); if (!r || !live(r)) E(404, "RESTAURANT_NOT_FOUND");
      if (!openNow(r)) E(409, "RESTAURANT_CLOSED");
      if (!Array.isArray(b.items) || !b.items.length) E(400, "CART_EMPTY");
      var items = b.items.map(function (it) { var p = find(db.products, it.productId), q = int(it.qty);
        if (!p || p.restaurantId !== r.id) E(400, "PRODUCT_NOT_FOUND"); if (!p.available) E(409, "PRODUCT_UNAVAILABLE", { name: p.name });
        if (!(q >= 1 && q <= 50)) E(400, "BAD_QTY"); if (p.stock != null && q > p.stock) E(409, "OUT_OF_STOCK", { name: p.name, left: p.stock });
        return { productId: p.id, name: p.name, price: p.price, qty: q, kind: p.kind, photo: p.photo && p.photo.charAt(0) === "/" ? p.photo : null }; });
      var subtotal = items.reduce(function (s, x) { return s + x.price * x.qty; }, 0);
      if (!b.dineIn && subtotal < r.minOrder) E(409, "MIN_ORDER", { min: r.minOrder });
      var a = b.address || {}, km = null, fee = null;
      /* «I'll pick it up myself»: no address, no delivery fee (only where the place allows it) */
      if (b.pickup && !b.dineIn) { if (!r.pickup) E(409, "NO_PICKUP"); km = 0; fee = 0; }
      else if (typeof a.lat === "number" && typeof a.lng === "number") { var city = cityOf(r.cityId); var zk = Rules.distanceKm(city, a), zmax = db.settings.zoneKm || 5;
        /* the area the admin drew on the map; without one — a circle of zoneKm around the town centre */
        if (r.zone && r.zone.length >= 3) { if (!Rules.inPolygon(a, r.zone)) E(422, "OUT_OF_AREA"); }   // the restaurant's own area, drawn by the admin
        else if (city.zone && city.zone.length >= 3) { if (!Rules.inPolygon(a, city.zone)) E(422, "OUT_OF_AREA"); }
        else if (zk > zmax) E(422, "OUT_OF_ZONE", { km: Math.round(zk * 10) / 10, max: zmax }); km = Math.round(Rules.distanceKm(r, a) * 10) / 10; fee = Rules.deliveryFee(db.settings, km); }
      var discount = 0, promo = null;
      if (b.promoCode) { promo = db.promos.filter(function (p) { return p.code === str(b.promoCode).toUpperCase(); })[0]; var pd = Rules.promoDiscount(promo, subtotal, clock()); if (!pd.ok) E(409, pd.code, { min: pd.min }); discount = pd.discount; }
      return { restaurant: r, items: items, subtotal: subtotal, km: km, deliveryFee: fee, discount: discount, promo: promo, total: subtotal - discount + (fee || 0) };
    }

    /* ---------- auth ---------- */
    route("POST", "/auth/login", null, function (req, b) {
      var phone = Rules.normPhone(b.phone); if (!phone) E(400, "BAD_PHONE");
      var u = db.users.filter(function (x) { return x.phone === phone; })[0];
      if (!u) E(401, "PHONE_UNKNOWN"); if (!checkPw(str(b.password), u.pass)) E(401, "BAD_CREDENTIALS"); if (!u.active) E(403, "USER_BLOCKED");
      var tok = newToken(); db.sessions[tok] = { userId: u.id, at: clock() }; save();
      return { token: tok, user: pubUser(u) };
    });
    route("POST", "/auth/register", null, function (req, b) {
      var name = str(b.name, 60), phone = Rules.normPhone(b.phone), pw = str(b.password);
      if (name.length < 2) E(400, "BAD_NAME"); if (!phone) E(400, "BAD_PHONE"); if (pw.length < (PROD ? 6 : 4)) E(400, "BAD_PASSWORD");
      var ex = db.users.filter(function (x) { return x.phone === phone; })[0];
      if (ex) E(409, ex.role === "restaurant" || ex.role === "courier" ? "STAFF_PHONE" : "PHONE_TAKEN");
      var v = b.verifyId ? usableVerification(b.verifyId, "register", phone) : null;
      if (verifyRequired() && !v) E(403, "VERIFY_REQUIRED");
      var u = { id: id("u"), role: "customer", name: name, phone: phone, pass: hashPw(pw), active: true, cityId: b.cityId && find(db.cities, b.cityId) ? b.cityId : db.settings.defaultCityId, createdAt: clock(), lang: b.lang || "tg", addresses: [] };
      if (v) { v.status = "used"; u.phoneVerified = v.channel; if (v.chatId) u.tgChatId = v.chatId; }
      db.users.push(u); var tok = newToken(); db.sessions[tok] = { userId: u.id, at: clock() }; save();
      return { token: tok, user: pubUser(u) };
    });
    route("GET", "/auth/me", "*", function (req) { return pubUser(req.user); });

    /* ---------- phone verification (Telegram / WhatsApp / SMS) ----------
       1) start: the person picks a channel → a link (Telegram bot, WhatsApp) or a code sent to them (SMS)
       2) the channel confirms the number: inbound() from the bot / webhook, or the person types the code
       3) register or reset the password with the verification id (one use, 30 minutes) */
    var V_TTL = 10 * 60000, V_USE = 30 * 60000;
    function vlist() { return db.verifications || (db.verifications = []); }
    function vChannels() { try { return verify.channels() || []; } catch (e) { return []; } }
    function verifyRequired() { return vChannels().length > 0 && db.settings.verifyRequired === true; }
    function findV(vid) { return vlist().filter(function (x) { return x.id === vid; })[0] || null; }
    function usableVerification(vid, purpose, phone) { var v = findV(str(vid)); var t = clock();
      if (!v || v.status !== "verified" || v.purpose !== purpose || v.phone !== phone || t - v.verifiedAt > V_USE) E(403, "VERIFY_REQUIRED"); return v; }
    function pubV(v) { return { id: v.id, status: v.status === "pending" && clock() > v.expiresAt ? "expired" : v.status, channel: v.channel, kind: v.kind, purpose: v.purpose, expiresAt: v.expiresAt }; }
    route("GET", "/auth/verify/channels", null, function () { return { channels: vChannels().map(function (c) { return { id: c.id, kind: c.kind }; }), required: verifyRequired() }; });
    route("POST", "/auth/verify/start", null, function (req, b) {
      var phone = Rules.normPhone(b.phone); if (!phone) E(400, "BAD_PHONE");
      var purpose = b.purpose === "reset" ? "reset" : b.purpose === "confirm" ? "confirm" : "register", ch = vChannels().filter(function (c) { return c.id === b.channel; })[0]; if (!ch) E(400, "BAD_CHANNEL");
      var ex = db.users.filter(function (x) { return x.phone === phone; })[0];
      if (purpose === "register" && ex) E(409, ex.role === "restaurant" || ex.role === "courier" ? "STAFF_PHONE" : "PHONE_TAKEN");
      if (purpose === "reset") { if (!ex) E(404, "PHONE_UNKNOWN"); if (ex.role === "admin") E(409, "ADMIN_RESET_ENV"); if (!ex.active) E(403, "USER_BLOCKED"); }
      if (purpose === "confirm" && (!req.user || req.user.phone !== phone)) E(403, "FORBIDDEN");
      var t = clock(); db.verifications = vlist().filter(function (x) { return t - x.createdAt < 3600000; });
      if (vlist().filter(function (x) { return x.phone === phone && t - x.createdAt < 10 * 60000; }).length >= 5) E(429, "VERIFY_TOO_MANY");
      vlist().forEach(function (x) { if (x.phone === phone && x.purpose === purpose && x.status === "pending") x.status = "replaced"; });
      var code; do { code = String(newPassword()).replace(/\D/g, "").slice(0, 6); } while (code.length !== 6 || vlist().some(function (x) { return x.code === code && x.status === "pending"; }));
      var v = { id: "v" + String(newToken()).replace(/[^A-Za-z0-9]/g, "").slice(0, 24), phone: phone, purpose: purpose, channel: ch.id, kind: ch.kind, code: code, token: String(newToken()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40),
        status: "pending", attempts: 0, createdAt: t, expiresAt: t + V_TTL };
      var out; try { out = verify.start(v, ch) || {}; } catch (e) { E(502, "VERIFY_SEND_FAILED"); }
      if (ch.kind === "link" && !out.link) E(503, "VERIFY_UNAVAILABLE");
      vlist().push(v); save();
      return Object.assign(pubV(v), { link: out.link || null, demoCode: out.demoCode || null, phoneMasked: Rules.fmtPhone(phone) });
    });
    /* the same checks as start, before the person is sent anywhere */
    route("POST", "/auth/verify/check", null, function (req, b) { var phone = Rules.normPhone(b.phone); if (!phone) E(400, "BAD_PHONE");
      var ex = db.users.filter(function (x) { return x.phone === phone; })[0];
      if (b.purpose === "reset") { if (!ex) E(404, "PHONE_UNKNOWN"); if (ex.role === "admin") E(409, "ADMIN_RESET_ENV"); if (!ex.active) E(403, "USER_BLOCKED"); }
      else if (ex) E(409, ex.role === "restaurant" || ex.role === "courier" ? "STAFF_PHONE" : "PHONE_TAKEN");
      return { ok: true }; });
    route("GET", "/auth/verify/:id", null, function (req, b, q, p) { var v = findV(p.id); if (!v) E(404, "NOT_FOUND"); return pubV(v); });
    route("POST", "/auth/verify/:id/code", null, function (req, b, q, p) { var v = findV(p.id); if (!v) E(404, "NOT_FOUND");
      if (v.status === "verified") return pubV(v); if (v.status !== "pending") E(409, "VERIFY_EXPIRED"); if (clock() > v.expiresAt) E(410, "VERIFY_EXPIRED");
      if (v.kind !== "code") E(400, "BAD_CHANNEL");
      v.attempts++; if (v.attempts > 5) { v.status = "failed"; save(); E(429, "VERIFY_TOO_MANY"); }
      if (String(b.code || "").replace(/\D/g, "") !== v.code) { save(); E(400, "VERIFY_BAD_CODE", { left: 5 - v.attempts }); }
      v.status = "verified"; v.verifiedAt = clock(); save(); return pubV(v); });
    /* signed up without Telegram: confirm the number later from the profile */
    route("POST", "/auth/me/verify", "*", function (req, b) { var u = req.user, v = usableVerification(b.verifyId, "confirm", u.phone);
      v.status = "used"; u.phoneVerified = v.channel; if (v.chatId) u.tgChatId = v.chatId; save(); return pubUser(u); });
    /* forgot password, self-service: a verified number sets a new password and is logged in */
    route("POST", "/auth/reset", null, function (req, b) { var vv = findV(str(b.verifyId)); if (!vv) E(403, "VERIFY_REQUIRED");
      var v = usableVerification(vv.id, "reset", vv.phone), u = db.users.filter(function (x) { return x.phone === v.phone; })[0]; if (!u) E(404, "PHONE_UNKNOWN");
      var pw = str(b.password); if (pw.length < 6) E(400, "BAD_PASSWORD_6");
      u.pass = hashPw(pw); u.mustChange = false; u.pwResetAt = null; if (!u.phoneVerified) u.phoneVerified = v.channel; if (v.chatId) u.tgChatId = v.chatId; v.status = "used";
      Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].userId === u.id) delete db.sessions[k]; });
      db.notifications.forEach(function (n) { if (n.key === "n.pwReset" && n.params && Rules.normPhone(n.params.phone) === u.phone) n.gone = true; });
      if (!u.active) { save(); E(403, "USER_BLOCKED"); }
      var tok = newToken(); db.sessions[tok] = { userId: u.id, at: clock() }; save(); return { token: tok, user: pubUser(u) }; });
    /* called by the Telegram bot and the WhatsApp webhook (never over HTTP from a browser) */
    function inbound(channel, p) { p = p || {}; var t = clock(), live = function (x) { return x.status === "pending" && t <= x.expiresAt && x.channel === channel; };
      if (channel === "telegram" && p.token) { var v1 = vlist().filter(function (x) { return live(x) && x.token === p.token; })[0];
        if (!v1) return { ok: false, reason: "NO_PENDING" }; v1.chatId = String(p.chatId); save(); return { ok: true, step: "contact", purpose: v1.purpose }; }
      var ph = Rules.normPhone(p.phone); if (!ph) return { ok: false, reason: "BAD_PHONE" };
      var v;
      if (channel === "telegram") v = vlist().filter(function (x) { return live(x) && x.chatId === String(p.chatId); }).pop();
      else if (channel === "whatsapp") { var m = String(p.text || "").match(/\b(\d{6})\b/); v = m && vlist().filter(function (x) { return live(x) && x.code === m[1]; })[0]; }
      if (!v) return { ok: false, reason: "NO_PENDING" };
      if (v.phone !== ph) return { ok: false, reason: "PHONE_MISMATCH", expected: Rules.fmtPhone(v.phone).split(" ").map(function (g, i) { return i === 2 || i === 3 ? g.replace(/\d/g, "•") : g; }).join(" ") };
      v.status = "verified"; v.verifiedAt = t; save(); return { ok: true, step: "done", purpose: v.purpose }; }
    /* forgot password: there is no SMS yet, so the request goes to the admin, who calls the person and gives a one-time password */
    route("POST", "/auth/forgot", null, function (req, b) { var phone = Rules.normPhone(b.phone); if (!phone) E(400, "BAD_PHONE");
      var u = db.users.filter(function (x) { return x.phone === phone; })[0]; if (!u) E(404, "PHONE_UNKNOWN");
      if (u.role === "admin") E(409, "ADMIN_RESET_ENV");
      var t = clock(); if (!u.pwResetAt || t - u.pwResetAt > 30 * 60000) { u.pwResetAt = t; notify("admins", "n.pwReset", { name: u.name, phone: Rules.fmtPhone(phone), role: u.role }, null); save(); }
      return { sent: true }; });
    route("POST", "/auth/logout", "*", function (req) { delete db.sessions[req.token]; save(); return true; });
    route("PATCH", "/auth/me", "*", function (req, b) { var u = req.user;
      if (b.name != null) { var n = str(b.name, 60); if (n.length < 2) E(400, "BAD_NAME"); u.name = n; }
      if (b.lang && ["tg", "ru", "en"].indexOf(b.lang) >= 0) u.lang = b.lang;
      if (b.cityId && find(db.cities, b.cityId)) u.cityId = b.cityId;
      if (b.avatar !== undefined) u.avatar = photoField(b.avatar, u.avatar || null, "av");
      if (b.password != null) { if (!checkPw(str(b.oldPassword), u.pass)) E(401, "BAD_OLD_PASSWORD"); if (str(b.password).length < 6) E(400, "BAD_PASSWORD_6"); u.pass = hashPw(str(b.password)); u.mustChange = false;
        Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].userId === u.id && k !== req.token) delete db.sessions[k]; }); }
      save(); return pubUser(u); });
    /* saved addresses: home / work / other, picked on the map (max 8) */
    route("POST", "/auth/me/addresses", "*", function (req, b) { var u = req.user, lat = +b.lat, lng = +b.lng;
      if (b.lat == null || b.lng == null || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) E(400, "ADDRESS_PIN_REQUIRED");
      var kind = ["home", "work", "other"].indexOf(b.kind) >= 0 ? b.kind : "other", a = { kind: kind, text: str(b.text, 120), landmark: str(b.landmark, 120), lat: lat, lng: lng };
      u.addresses = (u.addresses || []).filter(function (x) { return kind === "other" || x.kind !== kind; });
      u.addresses.unshift(a); u.addresses.length = Math.min(u.addresses.length, 8); save(); return pubUser(u); });
    route("DELETE", "/auth/me/addresses/:i", "*", function (req, b, q, p) { var u = req.user, i = +p.i;
      if (!(u.addresses || [])[i]) E(404, "NOT_FOUND"); u.addresses.splice(i, 1); save(); return pubUser(u); });
    /* favourites: restaurants (r) and dishes (p) */
    route("POST", "/auth/me/favorites", "*", function (req, b) { var u = req.user, ty = b.type === "p" ? "p" : b.type === "a" ? "a" : "r", list = ty === "p" ? db.products : ty === "a" ? (db.ads || []) : db.restaurants;
      if (!find(list, b.id)) E(404, "NOT_FOUND"); u.favs = u.favs || { r: [], p: [] }; u.favs[ty] = (u.favs[ty] || []).filter(function (x) { return x !== b.id; });
      if (b.on !== false) u.favs[ty].unshift(b.id); u.favs[ty].length = Math.min(u.favs[ty].length, 100); save(); return pubUser(u); });
    route("GET", "/auth/me/favorites", "*", function (req) { var f = req.user.favs || { r: [], p: [] };
      return { restaurants: (f.r || []).map(function (id) { return find(db.restaurants, id); }).filter(function (r) { return r && r.active; }).map(pubRest),
        ads: (f.a || []).map(function (id) { return find(db.ads || [], id); }).filter(function (a) { return a && a.status === "active"; }).map(function (a) { return pubAd(a, req.user); }),
        products: (f.p || []).map(function (id) { return find(db.products, id); }).filter(Boolean).map(function (p) { var r = find(db.restaurants, p.restaurantId); return Object.assign({}, p, { restaurant: r ? { id: r.id, name: r.name, tone: r.tone } : null }); }) }; });

    /* ---------- catalogue (public) ---------- */
    route("GET", "/cities", null, function () { return db.cities.filter(function (c) { return c.active; }); });
    route("GET", "/categories", null, function (req, b, q) { return db.categories.filter(function (c) { return c.active && (q.shop ? !!c.shop : !c.shop); }).sort(function (a, b) { return a.sort - b.sort; }); });
    route("GET", "/banners", null, function () { return db.banners.filter(function (b) { if (!b.active || b.blocked) return false; if (!b.restaurantId) return true; var r = find(db.restaurants, b.restaurantId); return r && orderable(r); })
      .sort(function (a, b) { return (b.own ? 1 : 0) - (a.own ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0); })
      /* a restaurant's ad shows its town (and its real menu link for the QR code) */
      .map(function (b) { var r = b.restaurantId && find(db.restaurants, b.restaurantId); return r ? Object.assign({}, b, { place: (cityOf(r.cityId) || {}).name || null, restName: r.name }) : b; }); });
    route("GET", "/settings/public", null, function () { var s = db.settings; return { deliveryBase: s.deliveryBase, deliveryPerKm: s.deliveryPerKm, deliveryMin: s.deliveryMin, currency: s.currency, defaultCityId: s.defaultCityId, supportPhone: s.supportPhone, courierPct: s.courierPct, zoneKm: s.zoneKm || 5, handoffMin: setting("handoffMin"), verify: { channels: vChannels().map(function (c) { return { id: c.id, kind: c.kind }; }), required: verifyRequired() }, apk: !!(opts.apkAvailable && opts.apkAvailable()), cardEnabled: cardOn(), cashEnabled: payOn("cash"), services: svcMap(), svcPhotos: db.settings.svcPhotos || {}, adsPaid: adCfg().paid, transferEnabled: payOn("transfer"), demo: !PROD }; });
    route("GET", "/restaurants", null, function (req, b, q) {
      var wantShop = q.kind === "shop", list = db.restaurants.filter(function (r) { return orderable(r) && (!q.cityId || r.cityId === q.cityId) && isShop(r) === wantShop; });
      if (q.categoryId) list = list.filter(function (r) { return db.products.some(function (p) { return p.restaurantId === r.id && p.categoryId === q.categoryId && p.available; }); });
      return list.map(pubRest).sort(function (a, b) { return ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (b.isOpenNow - a.isOpenNow) || (b.rating - a.rating); });
    });
    route("GET", "/restaurants/:id", null, function (req, b, q, p) { var r = find(db.restaurants, p.id); if (!r || !live(r)) E(404, "NOT_FOUND");
      return Object.assign(pubRest(r), { products: by(db.products, "restaurantId", r.id) }); });
    /* every good of every shop in one feed: search, category, brand, price range, in stock, sort, pages */
    route("GET", "/shops/goods", null, function (req, b, q) { needSvc("shops", req); var s = str(q.q, 60).toLowerCase(), sm = {};
      db.restaurants.filter(function (r) { return isShop(r) && live(r) && (!q.cityId || r.cityId === q.cityId); }).forEach(function (r) { sm[r.id] = r; });
      var base = db.products.filter(function (p) { return sm[p.restaurantId] && (p.available || q.all) && (!s || (JSON.stringify(p.name) + " " + (p.brand || "") + " " + JSON.stringify(p.desc || "")).toLowerCase().indexOf(s) >= 0); });
      var cats = {}, brands = {}; base.forEach(function (p) { cats[p.categoryId] = (cats[p.categoryId] || 0) + 1; });
      var pmin = q.priceMin != null && q.priceMin !== "" ? Number(q.priceMin) : null, pmax = q.priceMax != null && q.priceMax !== "" ? Number(q.priceMax) : null;
      var inCat = base.filter(function (p) { return !q.cat || p.categoryId === q.cat; }); inCat.forEach(function (p) { if (p.brand) brands[p.brand] = (brands[p.brand] || 0) + 1; });
      var l = inCat.filter(function (p) { return (!q.brand || p.brand === q.brand) && (pmin == null || p.price >= pmin) && (pmax == null || p.price <= pmax) && (!q.sale || p.oldPrice > p.price); });
      var rank = function (p) { return (sm[p.restaurantId].pinned ? 1e13 : 0) + (p.popular ? 5e12 : 0) + (p.createdAt || 0); };
      l.sort(q.sort === "cheap" ? function (x, y) { return x.price - y.price; } : q.sort === "dear" ? function (x, y) { return y.price - x.price; } : q.sort === "new" ? function (x, y) { return (y.createdAt || 0) - (x.createdAt || 0); } : function (x, y) { return rank(y) - rank(x); });
      var off = Math.max(0, int(q.offset || 0)), lim = Math.min(48, Math.max(1, int(q.limit || 20)));
      return { total: l.length, all: base.length, cats: cats, brands: Object.keys(brands).sort(function (a, c) { return brands[c] - brands[a]; }).slice(0, 14).map(function (k) { return { b: k, n: brands[k] }; }),
        list: l.slice(off, off + lim).map(function (p) { var r = sm[p.restaurantId]; return Object.assign({}, p, { restaurant: { id: r.id, name: r.name, tone: r.tone, pinned: !!r.pinned, cityId: r.cityId } }); }) }; });
    route("GET", "/products/popular", null, function (req, b, q) { var ids = db.restaurants.filter(function (r) { return orderable(r) && !isShop(r) && (!q.cityId || r.cityId === q.cityId); }).map(function (r) { return r.id; });
      /* «Popular»: what people like (👍) and buy most, plus the dishes a restaurant marks as hits */
      var score = function (p) { return (p.likes || 0) * 3 - (p.dislikes || 0) * 2 + Math.min(p.sold || 0, 200) * 0.5 + (p.popular ? 4 : 0); };
      return db.products.filter(function (p) { return p.available && ids.indexOf(p.restaurantId) >= 0 && (p.popular || score(p) > 2); })
        .sort(function (a, c) { return score(c) - score(a); }).slice(0, 12).map(function (p) { return Object.assign({}, p, { restaurant: pubRest(find(db.restaurants, p.restaurantId)) }); }); });
    route("GET", "/products/:id", null, function (req, b, q, p) { var x = find(db.products, p.id); if (!x) E(404, "NOT_FOUND"); return Object.assign({}, x, { restaurant: pubRest(find(db.restaurants, x.restaurantId)) }); });
    route("GET", "/search", null, function (req, b, q) {
      /* forgiving match: Tajik letters = Russian ones, ё = е, and о = а (палав / палов / плов) */
      var fold = function (v) { return String(v || "").toLowerCase().replace(/[ӯ]/g, "у").replace(/[ӣ]/g, "и").replace(/[ҳ]/g, "х").replace(/[қ]/g, "к").replace(/[ғ]/g, "г").replace(/[ҷ]/g, "ч").replace(/ё/g, "е").replace(/о/g, "а").replace(/\s+/g, " "); };
      var s = fold(str(q.q)).trim(); if (s.length < 2) return { restaurants: [], products: [] };
      function hit(o) { return ["tg", "ru", "en"].some(function (l) { return fold(o[l]).indexOf(s) >= 0; }); }
      var rs = db.restaurants.filter(function (r) { return orderable(r) && (!q.cityId || r.cityId === q.cityId); });
      var ids = rs.map(function (r) { return r.id; });
      return { restaurants: rs.filter(function (r) { return hit(r.name) || hit(r.cuisine); }).map(pubRest),
        products: db.products.filter(function (p) { return ids.indexOf(p.restaurantId) >= 0 && (hit(p.name) || hit(p.desc)); }).slice(0, 20).map(function (p) { return Object.assign({}, p, { restaurant: pubRest(find(db.restaurants, p.restaurantId)) }); }) };
    });
    route("GET", "/promos/public", null, function () { var t = clock(); return db.promos.filter(function (p) { return p.active && !p.hidden && (!p.expiresAt || t <= p.expiresAt) && (!p.maxUses || p.uses < p.maxUses); })
      .map(function (p) { return { code: p.code, type: p.type, value: p.value, minOrder: p.minOrder || 0, expiresAt: p.expiresAt || null }; }); });
    route("POST", "/promos/validate", null, function (req, b) { var p = db.promos.filter(function (x) { return x.code === str(b.code).toUpperCase(); })[0];
      var r = Rules.promoDiscount(p, Number(b.subtotal) || 0, clock()); if (!r.ok) E(409, r.code, { min: r.min }); return { code: p.code, discount: r.discount, type: p.type, value: p.value }; });

    /* ---------- customer ---------- */
    route("POST", "/orders/quote", ["customer"], function (req, b) { var q = quote(req, b); return { subtotal: q.subtotal, km: q.km, deliveryFee: q.deliveryFee, discount: q.discount, total: q.total }; });
    route("POST", "/orders", ["customer"], function (req, b) {
      /* a second tap on "Order" within 20 s with the same basket returns the order already made */
      var sig = JSON.stringify([b.restaurantId, (b.items || []).map(function (i) { return [i.productId, i.qty]; }), b.paymentMethod]);
      var dup = db.orders.filter(function (o) { return o.customerId === req.user.id && o.sig === sig && clock() - o.createdAt < 20000 && ["pending", "awaiting_payment"].indexOf(o.status) >= 0; })[0]; if (dup) return pubOrder(dup, req.user);
      if (b.name != null) { var nm = str(b.name, 60); if (nm.length < 2) E(400, "BAD_NAME"); if (nm !== req.user.name) req.user.name = nm; }
      var q = quote(req, b), a = b.address || {};
      var pick = !!(b.pickup && q.restaurant.pickup); if (q.km == null) E(400, "ADDRESS_PIN_REQUIRED"); if (!pick && str(a.text).length < 3) E(400, "ADDRESS_TEXT_REQUIRED");
      var phone = Rules.normPhone(b.phone || req.user.phone); if (!phone) E(400, "BAD_PHONE");
      var method = ["card", "cash", "transfer"].indexOf(b.paymentMethod) >= 0 ? b.paymentMethod : "cash", t = clock();
      if (!payOn(method)) E(400, method === "card" ? "CARD_DISABLED" : "PAY_METHOD_OFF");
      var receiptId = null, later = false;
      if (method === "transfer") {
        if (!q.restaurant.payCard || !q.restaurant.payCard.number) E(409, "NO_PAY_CARD");
        var rc = String(b.receipt || ""); later = !rc;      /* no receipt yet: the order waits and the customer pays from the order page */
        if (!later && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(rc)) E(400, "RECEIPT_REQUIRED");
        if (rc.length > 3500000) E(413, "RECEIPT_TOO_BIG");
      }
      db.meta.seq++; var o = { id: "o" + db.meta.seq, number: db.meta.seq, customerId: req.user.id, restaurantId: q.restaurant.id, courierId: null, cityId: q.restaurant.cityId,
        items: q.items, subtotal: q.subtotal, deliveryFee: q.deliveryFee, discount: q.discount, total: q.total, km: q.km, promoCode: q.promo ? q.promo.code : null,
        address: pick ? { text: q.restaurant.address ? (q.restaurant.address.tg || "") : "", landmark: "", lat: q.restaurant.lat, lng: q.restaurant.lng } : { text: str(a.text, 120), landmark: str(a.landmark, 120), lat: a.lat, lng: a.lng }, phone: phone, comment: str(b.comment, 200),
        pickup: pick || undefined, selfDelivery: pick ? { pickup: true, name: "" } : undefined,
        payment: { method: method, status: method === "card" ? "pending" : method === "transfer" ? (later ? "waiting" : "review") : "none", provider: method === "card" ? (b.provider || "mock") : method },
        delivery: q.restaurant.delivery || "platform", sig: sig,
        status: method === "card" || later ? "awaiting_payment" : "pending", prepMin: null, createdAt: t, updatedAt: t, history: [{ status: method === "card" || later ? "awaiting_payment" : "pending", at: t, by: req.user.id }] };
      if (method === "transfer") { if (!later) { receiptId = "rc" + o.number; files.put(receiptId, String(b.receipt)); o.payment.receiptId = receiptId; } o.payment.toCard = q.restaurant.payCard.number.slice(-4); }
      db.orders.unshift(o); if (q.promo) q.promo.uses++;
      /* goods with a counted stock: take them off the shelf (given back if the order is cancelled) */
      o.items.forEach(function (it) { var pr = find(db.products, it.productId); if (pr && pr.stock != null) { pr.stock = Math.max(0, pr.stock - it.qty); if (!pr.stock) pr.available = false; o.stockTaken = true; } });
      if (method === "card") db.payments.unshift({ id: "pay" + o.number, orderId: o.id, amount: o.total, method: "card", provider: o.payment.provider, status: "pending", createdAt: t });
      else if (later) { /* the restaurant hears about it when the receipt arrives */ }
      else notify("rest:" + o.restaurantId, "n.newOrder", { n: o.number, sum: o.subtotal }, o.id);
      var u = req.user; u.addresses = u.addresses || []; if (!pick && !u.addresses.some(function (x) { return x.text === o.address.text; })) { u.addresses.unshift(o.address); u.addresses.length = Math.min(u.addresses.length, 5); }
      save(); return pubOrder(o, req.user);
    });
    route("POST", "/orders/:id/pay", ["customer"], function (req, b, q, p) {
      var o = orderFor(req, p.id); if (o.status !== "awaiting_payment") E(409, "NOT_AWAITING_PAYMENT");
      var num = String(b.cardNumber || "").replace(/\D/g, ""), exp = String(b.exp || "").replace(/\s/g, "");
      if (!luhn(num) || num.length < 16) E(400, "CARD_NUMBER"); if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp)) E(400, "CARD_EXP");
      if (!/^\d{3}$/.test(String(b.cvc || ""))) E(400, "CARD_CVC");
      if (num.slice(-4) === "0002") { db.payments.forEach(function (x) { if (x.orderId === o.id) x.status = "failed"; }); save(); E(402, "PAYMENT_DECLINED"); }
      o.payment.status = "paid"; o.payment.last4 = num.slice(-4); db.payments.forEach(function (x) { if (x.orderId === o.id) { x.status = "paid"; x.last4 = num.slice(-4); } });
      setStatus(o, "pending", null); save(); return pubOrder(o, req.user);
    });
    /* «Оплата» on the order: the customer sends the receipt of the transfer; only now the restaurant sees the order */
    route("POST", "/orders/:id/receipt", ["customer"], function (req, b, q, p) { var o = orderFor(req, p.id);
      if (o.payment.method !== "transfer" || o.status !== "awaiting_payment") E(409, "NOT_AWAITING_PAYMENT");
      var rc = String(b.receipt || ""); if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(rc)) E(400, "RECEIPT_REQUIRED"); if (rc.length > 3500000) E(413, "RECEIPT_TOO_BIG");
      var rid = "rc" + o.number; files.put(rid, rc); o.payment.receiptId = rid; o.payment.status = "review"; o.payment.sentAt = clock();
      setStatus(o, "pending", null); save(); return pubOrder(o, req.user); });
    /* the Node API reads the receipt bytes from its storage after this check */
    route("GET", "/orders/:id/receipt-ref", "*", function (req, b, q, p) { var o = orderFor(req, p.id); if (req.user.role === "courier") E(403, "FORBIDDEN"); if (!o.payment.receiptId) E(404, "NOT_FOUND"); return { receiptId: o.payment.receiptId }; });
    route("GET", "/orders/:id/receipt", "*", function (req, b, q, p) { var o = orderFor(req, p.id); if (req.user.role === "courier") E(403, "FORBIDDEN");
      var img = o.payment.receiptId ? files.get(o.payment.receiptId) : null; if (!img) E(404, "NOT_FOUND"); return { image: img }; });
    route("GET", "/orders/my", ["customer"], function (req) { return by(db.orders, "customerId", req.user.id).map(function (o) { return pubOrder(o, req.user); }); });
    route("GET", "/orders/:id", "*", function (req, b, q, p) { return pubOrder(orderFor(req, p.id), req.user); });
    route("POST", "/orders/:id/cancel", ["customer"], function (req, b, q, p) { var o = orderFor(req, p.id); setStatus(o, "cancelled", req.user); save(); return pubOrder(o, req.user); });
    route("POST", "/orders/:id/review", ["customer"], function (req, b, q, p) {
      var o = orderFor(req, p.id); applyReview(o, b); save(); return pubOrder(o, req.user); });
    /* one review: the restaurant (stars), the courier or the waiter (stars), and each dish (👍 / 👎) — liked dishes rise in «Popular» */
    function applyReview(o, b) {
      if (o.status !== "delivered") E(409, "NOT_DELIVERED"); if (o.review) E(409, "ALREADY_REVIEWED");
      var r = int(b.rating), cr = b.courierRating == null ? null : int(b.courierRating), wr = b.waiterRating == null ? null : int(b.waiterRating);
      if (!(r >= 1 && r <= 5) || (cr !== null && !(cr >= 1 && cr <= 5)) || (wr !== null && !(wr >= 1 && wr <= 5))) E(400, "BAD_RATING");
      var likes = {}, ids = o.items.map(function (i) { return i.productId; });
      Object.keys(b.likes || {}).forEach(function (k) { var v = int(b.likes[k]); if (ids.indexOf(k) >= 0 && (v === 1 || v === -1)) likes[k] = v; });
      o.review = { rating: r, courierRating: cr, waiterRating: wr, likes: likes, comment: str(b.comment, 300), at: clock() };
      var rest = find(db.restaurants, o.restaurantId); rest.rating = Math.round(((rest.rating || 0) * (rest.ratingCount || 0) + r) / ((rest.ratingCount || 0) + 1) * 10) / 10; rest.ratingCount = (rest.ratingCount || 0) + 1;
      Object.keys(likes).forEach(function (k) { var pr = find(db.products, k); if (!pr) return; if (likes[k] > 0) pr.likes = (pr.likes || 0) + 1; else pr.dislikes = (pr.dislikes || 0) + 1; });
      if (o.courierId && cr) notify("u:" + o.courierId, "n.rated", { n: o.number, r: cr }, o.id);
      var w = o.waiterId && find(db.users, o.waiterId);
      if (w && wr) { w.wRating = Math.round(((w.wRating || 0) * (w.wRatingCount || 0) + wr) / ((w.wRatingCount || 0) + 1) * 10) / 10; w.wRatingCount = (w.wRatingCount || 0) + 1; notify("u:" + w.id, "n.rated", { n: o.number, r: wr }, o.id); }
    }

    /* ---------- notifications ---------- */
    route("GET", "/notifications", "*", function (req) { var ts = targetsOf(req.user), uid = req.user.id;
      return db.notifications.filter(function (n) { return !n.gone && ts.indexOf(n.target) >= 0 && !n.readBy[uid]; }).slice(0, 20); });
    route("GET", "/push/key", null, function () { return { key: opts.push ? opts.push.publicKey : null }; });
    route("POST", "/push/subscribe", "*", function (req, b) {
      if (!opts.push) throw E(501, "PUSH_OFF");
      var ep = String(b.endpoint || ""), k = b.keys || {}; if (!/^https:\/\//.test(ep) || ep.length > 600 || !k.p256dh || !k.auth || String(k.p256dh).length > 200 || String(k.auth).length > 60) throw E(400, "BAD_SUB");
      db.pushSubs = pushSubs().filter(function (s) { return s.endpoint !== ep; });
      var mine = pushSubs().filter(function (s) { return s.userId === req.user.id; }); mine.slice(0, Math.max(0, mine.length - 4)).forEach(function (o) { db.pushSubs = pushSubs().filter(function (s) { return s !== o; }); });
      pushSubs().push({ id: id("ps"), userId: req.user.id, endpoint: ep, keys: { p256dh: String(k.p256dh), auth: String(k.auth) }, at: clock() }); save(); return true; });
    route("POST", "/push/unsubscribe", "*", function (req, b) { db.pushSubs = pushSubs().filter(function (s) { return !(s.userId === req.user.id && (!b.endpoint || s.endpoint === b.endpoint)); }); save(); return true; });
    route("POST", "/notifications/read", "*", function (req, b) { var ts = targetsOf(req.user), uid = req.user.id;
      db.notifications.forEach(function (n) { if (ts.indexOf(n.target) >= 0 && (!b.id || n.id === b.id)) n.readBy[uid] = true; }); save(); return true; });

    /* ---------- restaurant panel ---------- */
    function myRest(req) { var r = find(db.restaurants, req.user.restaurantId); if (!r) E(404, "RESTAURANT_NOT_FOUND"); return r; }
    /* who may change things: the owner, or a branch manager the owner appointed. Workers take orders and switch dishes on/off. */
    function isBoss(req, r) { return r.ownerId === req.user.id || req.user.staffRole === "manager"; }
    function boss(req) { var r = myRest(req); if (!isBoss(req, r)) E(403, "MANAGER_ONLY"); return r; }
    function onlyKeys(b, ok) { return Object.keys(b || {}).every(function (k) { return ok.indexOf(k) >= 0; }); }
    route("GET", "/restaurant/me", ["restaurant"], function (req) { var r = myRest(req); return Object.assign(pubRest(r), { hasAd: !!myAd(r), subHistory: (db.subs || []).filter(function (s) { return s.restaurantId === r.id; }).slice(0, 12).map(function (s) { return { kind: s.kind, months: s.months, days: s.days, amount: s.amount, from: s.from, until: s.until, at: s.at }; }) }); });
    route("PATCH", "/restaurant/me", ["restaurant"], function (req, b) { var r = onlyKeys(b, ["open"]) ? myRest(req) : boss(req);
      if (b.open != null) r.open = !!b.open;
      if (b.hours) { if (!/^\d{2}:\d{2}$/.test(b.hours.from) || !/^\d{2}:\d{2}$/.test(b.hours.to)) E(400, "BAD_HOURS"); r.hours = { from: b.hours.from, to: b.hours.to }; }
      if (b.eta != null) { if (!/^\d{1,3}–\d{1,3}$/.test(str(b.eta))) E(400, "BAD_ETA"); r.eta = str(b.eta); }
      if (b.minOrder != null) { var m = int(b.minOrder); if (!(m >= 0 && m <= 1000)) E(400, "BAD_PRICE"); r.minOrder = m; }
      if (b.phone != null) { var ph = Rules.normPhone(b.phone); if (!ph) E(400, "BAD_PHONE"); r.phone = ph; }
      if (b.address != null) r.address = L(b.address);
      if (b.cuisine != null) { var cu = str(b.cuisine, 60); if (cu.length < 2) E(400, "BAD_NAME"); r.cuisine = L(cu); }
      if (b.about != null) r.about = L(str(b.about, 200));
      if (b.cover !== undefined) r.cover = photoField(b.cover, r.cover || null, "cv");
      if (b.logo !== undefined) r.logo = photoField(b.logo, r.logo || null, "lg");
      if (b.pickup != null) { boss(req); r.pickup = !!b.pickup; }
      /* where guests send money: several cards / e-wallet phone numbers of different banks (only the owner) */
      if (b.payAccounts != null) { if (r.ownerId !== req.user.id) E(403, "OWNER_ONLY"); if (!Array.isArray(b.payAccounts) || b.payAccounts.length > 6) E(400, "BAD_PAY_CARD");
        r.payAccounts = b.payAccounts.map(function (x) { var kind = x.kind === "phone" ? "phone" : "card", num;
          if (kind === "card") { num = String(x.number || "").replace(/\D/g, ""); if (num.length < 16 || num.length > 19) E(400, "BAD_PAY_CARD"); }
          else { num = Rules.normPhone(x.number); if (!num) E(400, "BAD_PHONE"); }
          return { kind: kind, bank: str(x.bank, 40), number: num, holder: str(x.holder, 60) }; });
        var f = r.payAccounts[0]; r.payCard = f ? { number: f.number, holder: f.holder, bank: f.bank, kind: f.kind } : null; }
      if (b.payCard != null && r.ownerId !== req.user.id) E(403, "OWNER_ONLY");
      if (b.payCard != null) { var cn = String(b.payCard.number || "").replace(/\D/g, ""); if (cn && (cn.length < 16 || cn.length > 19)) E(400, "BAD_PAY_CARD");
        r.payCard = cn ? { number: cn, holder: str(b.payCard.holder, 60), bank: str(b.payCard.bank, 40) } : null; }
      /* the restaurant's place on the map is set only by the main admin */
      if (b.lat != null || b.lng != null) E(403, "PLACE_BY_ADMIN");
      save(); return pubRest(r); });
    route("GET", "/restaurant/orders", ["restaurant"], function (req, b, q) { var r = myRest(req), list = by(db.orders, "restaurantId", r.id).filter(function (o) { return o.status !== "awaiting_payment"; });
      if (q.scope === "new") list = list.filter(function (o) { return o.status === "pending"; });
      else if (q.scope === "active") list = list.filter(function (o) { return ["cooking", "ready", "picked_up"].indexOf(o.status) >= 0; });
      else if (q.scope === "history") list = list.filter(function (o) { return Rules.FINAL.indexOf(o.status) >= 0; }).slice(0, 60);
      return list.map(function (o) { return pubOrder(o, req.user); }); });
    route("POST", "/restaurant/orders/:id/accept", ["restaurant"], function (req, b, q, p) { var o = orderFor(req, p.id), m = int(b.prepMin);
      if ([10, 15, 20, 30, 45, 60].indexOf(m) < 0) m = 20; o.prepMin = m;
      /* per-order choice: "we deliver ourselves" or "hand to a Тезкор courier" (only for restaurants allowed to deliver) */
      if (!o.dineIn && (b.delivery === "own" || b.delivery === "platform")) { var rm = (find(db.restaurants, o.restaurantId) || {}).delivery || "platform";
        if (rm === "platform" && b.delivery === "own") E(409, "PLATFORM_DELIVERY");
        o.delivery = rm === "own" ? "own" : b.delivery === "platform" ? "platform" : (rm === "mixed" ? "mixed" : "own"); o.deliveryChosen = o.delivery === "platform" ? "platform" : "own"; }
      setStatus(o, "cooking", req.user); if (o.payment.method === "transfer") { o.payment.status = "paid"; o.payment.confirmedAt = clock(); }
      /* who took it: shown on the ticket; at a table the one who accepted is the table's waiter */
      o.acceptedBy = { id: req.user.id, name: req.user.name }; if (o.dineIn) o.waiterId = req.user.id;
      save(); return pubOrder(o, req.user); });
    route("POST", "/restaurant/orders/:id/reject", ["restaurant"], function (req, b, q, p) { var o = orderFor(req, p.id); o.rejectReason = str(b.reason, 120); setStatus(o, "rejected", req.user); if (o.payment.method === "transfer" && o.payment.status === "review") o.payment.status = "not_received"; save(); return pubOrder(o, req.user); });
    /* nobody can deliver: the restaurant cancels an order no courier has taken (the customer is told, money is given back) */
    route("POST", "/restaurant/orders/:id/cancel", ["restaurant"], function (req, b, q, p) { var o = orderFor(req, p.id);
      if (o.dineIn) E(409, "NOT_DELIVERY"); if (o.courierId || o.selfDelivery) E(409, "HAS_COURIER"); if (["cooking", "ready"].indexOf(o.status) < 0) E(409, "BAD_TRANSITION");
      o.cancelReason = str(b.reason, 120) || "nocourier"; setStatus(o, "cancelled", req.user); save(); return pubOrder(o, req.user); });
    route("POST", "/restaurant/orders/:id/ready", ["restaurant"], function (req, b, q, p) { var o = orderFor(req, p.id); setStatus(o, "ready", req.user); save(); return pubOrder(o, req.user); });
    /* the restaurant changes its mind: give an own-delivery order to Тезкор couriers right now */
    route("POST", "/restaurant/orders/:id/handoff", ["restaurant"], function (req, b, q, p) { var o = orderFor(req, p.id);
      if ((o.delivery || "platform") === "platform" && !o.selfDelivery) E(409, "PLATFORM_DELIVERY"); if (o.courierId || o.selfDelivery) E(409, "ALREADY_TAKEN");
      if (((find(db.restaurants, o.restaurantId) || {}).delivery) === "own") E(409, "OWN_ONLY");
      if (o.status !== "cooking" && o.status !== "ready") E(409, "BAD_TRANSITION");
      o.delivery = "platform"; o.handedOff = true; o.deliveryChosen = "platform"; hideFor(o.id, "own:" + o.restaurantId);
      var r = find(db.restaurants, o.restaurantId); notify("couriers:" + o.cityId, "n.courierNew", { n: o.number, rest: r.name, km: o.km }, o.id); save(); return pubOrder(o, req.user); });
    /* the restaurant takes the order out itself (own delivery, no courier in the app) */
    route("POST", "/restaurant/orders/:id/out", ["restaurant"], function (req, b, q, p) { var o = orderFor(req, p.id);
      if ((o.delivery || "platform") === "platform") E(409, "PLATFORM_DELIVERY"); if (o.courierId) E(409, "ALREADY_TAKEN");
      if (o.status === "cooking") setStatus(o, "ready", req.user);
      o.selfDelivery = { name: str(b.name, 60), phone: Rules.normPhone(b.phone) || null }; hideFor(o.id, "own:" + o.restaurantId); hideFor(o.id, "couriers:" + o.cityId);
      setStatus(o, "picked_up", req.user); save(); return pubOrder(o, req.user); });
    route("POST", "/restaurant/orders/:id/given", ["restaurant"], function (req, b, q, p) { var o = orderFor(req, p.id); if (!o.pickup) E(409, "NOT_PICKUP");
      ["ready", "picked_up", "delivered"].forEach(function (st) { if (Rules.canTransition(o.status, st, "restaurant")) setStatus(o, st, req.user); }); save(); return pubOrder(o, req.user); });
    route("POST", "/restaurant/orders/:id/delivered", ["restaurant"], function (req, b, q, p) { var o = orderFor(req, p.id); if (!o.selfDelivery) E(409, "NOT_SELF_DELIVERY");
      setStatus(o, "delivered", req.user); save(); return pubOrder(o, req.user); });
    /* ---------- tables in the hall: a QR sticker on each table → the guest orders from the menu without signing up ---------- */
    route("POST", "/restaurant/orders/:id/served", ["restaurant"], function (req, b, q, p) { var o = orderFor(req, p.id); if (!o.dineIn) E(409, "NOT_TABLE_ORDER");
      if (o.status === "cooking") setStatus(o, "ready", req.user); if (o.status === "ready") setStatus(o, "picked_up", req.user); setStatus(o, "delivered", req.user);
      if (!o.waiterId || req.user.staffRole === "waiter") o.waiterId = req.user.id; o.servedBy = { id: req.user.id, name: req.user.name }; save(); return pubOrder(o, req.user); });
    var TABLE_MAX = 100;
    function tablesOf(r) { return r.tables || (r.tables = []); }
    function tableCode() { var c; do { c = String(newToken()).replace(/[^A-Za-z0-9]/g, "").slice(1, 11); } while (c.length < 8 || db.restaurants.some(function (r) { return tablesOf(r).some(function (x) { return x.code === c; }); })); return c; }
    function pubTable(x) { return { id: x.id, name: x.name, code: x.code, active: x.active !== false, zone: x.zone || null, kind: tableKind(x.kind), seats: x.seats || null, createdAt: x.createdAt }; }
    function myTable(req, tid) { var r = boss(req), x = tablesOf(r).filter(function (y) { return y.id === tid; })[0]; if (!x) E(404, "NOT_FOUND"); return { r: r, t: x }; }
    function byCode(code) { code = str(code, 40); for (var i = 0; i < db.restaurants.length; i++) { var r = db.restaurants[i], x = tablesOf(r).filter(function (y) { return y.code === code; })[0];
        if (x) { if (x.active === false || !live(r)) E(404, "TABLE_OFF"); return { r: r, t: x }; } } E(404, "TABLE_NOT_FOUND"); }
    route("GET", "/restaurant/tables", ["restaurant"], function (req) { return tablesOf(myRest(req)).map(pubTable); });
    route("POST", "/restaurant/tables", ["restaurant"], function (req, b) { var r = boss(req), list = tablesOf(r), n = Math.max(1, Math.min(int(b.count) || 1, 50)), name = str(b.name, 30);
      if (list.length + n > TABLE_MAX) E(409, "TABLE_LIMIT", { max: TABLE_MAX });
      var zone = str(b.zone, 24) || null, kind = tableKind(b.kind), made = [];
      var nums = list.filter(function (x) { return tableKind(x.kind) === kind; }).map(function (x) { return parseInt(String(x.name).replace(/\D/g, ""), 10) || 0; }), next = Math.max.apply(null, [0].concat(nums)) + 1; if (zone && (r.zones || []).indexOf(zone) < 0) { r.zones = (r.zones || []).concat([zone]).slice(0, 12); }
      for (var i = 0; i < n; i++) { var x = { id: id("tb"), name: n === 1 && name ? name : (kind === "cabin" ? "K" : "") + String(next + i), code: tableCode(), active: true, zone: zone, kind: kind, createdAt: clock() }; list.push(x); made.push(pubTable(x)); }
      save(); return made; });
    route("PATCH", "/restaurant/tables/:id", ["restaurant"], function (req, b, q, p) { var m = myTable(req, p.id);
      if (b.name != null) { var nm = str(b.name, 30); if (!nm) E(400, "BAD_NAME"); m.t.name = nm; } if (b.active != null) m.t.active = !!b.active;
      if (b.kind != null) m.t.kind = tableKind(b.kind); if (b.seats != null) { var se = int(b.seats); m.t.seats = se >= 1 && se <= 50 ? se : null; }
      if (b.zone !== undefined) { var zn = str(b.zone, 24) || null; if (zn && (m.r.zones || []).indexOf(zn) < 0) m.r.zones = (m.r.zones || []).concat([zn]).slice(0, 12); m.t.zone = zn; } save(); return pubTable(m.t); });
    /* the sticker was copied or photographed: a new code, the old QR stops working */
    route("POST", "/restaurant/tables/:id/newcode", ["restaurant"], function (req, b, q, p) { var m = myTable(req, p.id); m.t.code = tableCode(); save(); return pubTable(m.t); });
    route("DELETE", "/restaurant/tables/:id", ["restaurant"], function (req, b, q, p) { var m = myTable(req, p.id), l = tablesOf(m.r); l.splice(l.indexOf(m.t), 1); save(); return true; });
    /* ---------- the hall: tables by floor / room, free (green) or busy (red), waiter orders, the cash desk ----------
       a table is busy while it has an open bill: orders not cancelled and not yet closed (paid);
       served orders nobody closed stop counting after 4 hours so a forgotten table does not stay red */
    var OPEN_MS = 4 * 3600000;
    function tableKind(v) { return v === "cabin" ? "cabin" : "table"; }
    function tableBill(r, x) { var t = clock();
      return db.orders.filter(function (o) { return o.dineIn && o.restaurantId === r.id && o.tableId === x.id && !o.closedAt && ["cancelled", "rejected"].indexOf(o.status) < 0 &&
        (o.status !== "delivered" || t - (o.updatedAt || o.createdAt) < OPEN_MS); }); }
    route("GET", "/restaurant/hall", ["restaurant"], function (req) { var r = myRest(req), t = clock();
      return { zones: (r.zones || []).slice(), tables: tablesOf(r).filter(function (x) { return x.active !== false; }).map(function (x) { var bill = tableBill(r, x);
        return Object.assign(pubTable(x), { busy: bill.length > 0, sum: bill.reduce(function (s, o) { return s + o.subtotal; }, 0), since: bill.length ? Math.min.apply(null, bill.map(function (o) { return o.createdAt; })) : null,
          cooking: bill.some(function (o) { return ["pending", "cooking", "ready", "picked_up"].indexOf(o.status) >= 0; }), called: !!(x.calledAt && t - x.calledAt < 10 * 60000),
          orders: bill.map(function (o) { return { id: o.id, number: o.number, status: o.status, subtotal: o.subtotal, createdAt: o.createdAt, by: o.byStaff || (o.guestName ? null : null), guestName: o.guestName || null, items: o.items.map(function (i) { return { name: i.name, qty: i.qty, price: i.price }; }) }; }) }); }) }; });
    /* floors / rooms of the hall: «1-ошёна», «2-ошёна», «Айвон»… */
    route("PATCH", "/restaurant/zones", ["restaurant"], function (req, b) { var r = boss(req); if (!Array.isArray(b.zones)) E(400, "BAD_ZONES");
      var z = []; b.zones.forEach(function (v) { v = str(v, 24); if (v && z.indexOf(v) < 0) z.push(v); }); if (z.length > 12) E(400, "BAD_ZONES"); r.zones = z;
      tablesOf(r).forEach(function (x) { if (x.zone && z.indexOf(x.zone) < 0) x.zone = z[0] || null; }); save(); return z; });
    /* the waiter writes the order of a guest without a phone; the cashier sells at the counter.
       Products in stock only; works whenever the place is open in real life (not tied to the app's opening hours) */
    function posItems(r, list) { if (!Array.isArray(list) || !list.length) E(400, "CART_EMPTY"); if (list.length > 60) E(400, "BAD_QTY");
      return list.map(function (it) { var p = find(db.products, it.productId), q = int(it.qty);
        if (!p || p.restaurantId !== r.id) E(400, "PRODUCT_NOT_FOUND"); if (!p.available) E(409, "PRODUCT_UNAVAILABLE", { name: p.name });
        if (!(q >= 1 && q <= 99)) E(400, "BAD_QTY"); return { productId: p.id, name: p.name, price: p.price, qty: q, kind: p.kind, photo: p.photo && p.photo.charAt(0) === "/" ? p.photo : null }; }); }
    route("POST", "/restaurant/pos", ["restaurant"], function (req, b) { var r = myRest(req), u = req.user, t = clock(), items = posItems(r, b.items), sub = items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
      var x = b.tableId ? tablesOf(r).filter(function (y) { return y.id === b.tableId; })[0] : null; if (b.tableId && !x) E(404, "TABLE_NOT_FOUND");
      var method = b.method === "card" ? "card" : b.method === "transfer" ? "transfer" : "cash", now = !x || !!b.payNow;
      db.meta.seq++; var o = { id: "o" + db.meta.seq, number: db.meta.seq, customerId: null, guestName: str(b.name, 40) || null, restaurantId: r.id, courierId: null, cityId: r.cityId,
        dineIn: true, tableId: x ? x.id : null, tableName: x ? x.name : null, pos: true, byStaff: { id: u.id, name: u.name }, guestKey: null,
        items: items, subtotal: sub, deliveryFee: 0, discount: 0, total: sub, km: 0, promoCode: null, address: { text: x ? x.name : "", landmark: "", lat: r.lat, lng: r.lng }, phone: null, comment: str(b.comment, 200),
        payment: { method: method, status: "none", provider: method }, delivery: x ? "table" : "counter", status: "pending", prepMin: 15, createdAt: t, updatedAt: t, history: [{ status: "pending", at: t, by: u.id }] };
      db.orders.unshift(o); setStatus(o, "cooking", u); o.acceptedBy = { id: u.id, name: u.name }; o.waiterId = u.id;
      /* a counter sale (tea, bread…) is done at once: handed over and paid */
      if (!x) { setStatus(o, "ready", u); setStatus(o, "picked_up", u); setStatus(o, "delivered", u); o.servedBy = { id: u.id, name: u.name }; }
      if (now) { o.payment.status = "paid"; o.payment.confirmedAt = t; if (!x) o.closedAt = t; }
      save(); return pubOrder(o, u); });
    /* the bill is paid, the guests left: the table turns green */
    route("POST", "/restaurant/tables/:id/close", ["restaurant"], function (req, b, q, p) { var r = myRest(req), x = tablesOf(r).filter(function (y) { return y.id === p.id; })[0]; if (!x) E(404, "NOT_FOUND");
      var bill = tableBill(r, x), t = clock(), method = b.method === "card" ? "card" : b.method === "transfer" ? "transfer" : "cash"; if (!bill.length) return { closed: 0, sum: 0 };
      if (bill.some(function (o) { return ["pending", "cooking", "ready", "picked_up"].indexOf(o.status) >= 0; }) && !b.force) E(409, "TABLE_NOT_SERVED");
      bill.forEach(function (o) { if (o.status !== "delivered") { if (o.status === "pending") setStatus(o, "cancelled", req.user); else { ["ready", "picked_up", "delivered"].forEach(function (s) { if (Rules.canTransition(o.status, s, "restaurant")) setStatus(o, s, req.user); }); } }
        o.closedAt = t; o.closedBy = { id: req.user.id, name: req.user.name }; if (o.status === "delivered") { o.payment.status = "paid"; o.payment.method = o.payment.method === "cash" ? method : o.payment.method; o.payment.confirmedAt = t; } });
      x.calledAt = null; save(); return { closed: bill.length, sum: bill.filter(function (o) { return o.status === "delivered"; }).reduce(function (s, o) { return s + o.subtotal; }, 0) }; });
    /* the guest's side (no account): the menu of this table, orders, "call the waiter" */
    function guestOrder(o) { var x = pubOrder(o, null); delete x.guestKey; delete x.sig; return x; }
    route("GET", "/dine/:key", null, function (req, b, q, p) { var k = str(p.key, 60), o = k.length >= 16 && db.orders.filter(function (x) { return x.dineIn && x.guestKey === k; })[0]; if (!o) E(404, "NOT_FOUND"); return guestOrder(o); });
    route("POST", "/dine/:key/review", null, function (req, b, q, p) { var k = str(p.key, 60), o = k.length >= 16 && db.orders.filter(function (x) { return x.dineIn && x.guestKey === k; })[0]; if (!o) E(404, "NOT_FOUND");
      applyReview(o, b); save(); return guestOrder(o); });
    route("POST", "/dine/:key/cancel", null, function (req, b, q, p) { var k = str(p.key, 60), o = k.length >= 16 && db.orders.filter(function (x) { return x.dineIn && x.guestKey === k; })[0]; if (!o) E(404, "NOT_FOUND");
      setStatus(o, "cancelled", { role: "customer", id: "guest" }); save(); return guestOrder(o); });
    route("GET", "/table/:code", null, function (req, b, q, p) { var m = byCode(p.code);
      return { table: { id: m.t.id, name: m.t.name }, open: openNow(m.r), restaurant: Object.assign(pubRest(m.r), { products: by(db.products, "restaurantId", m.r.id) }) }; });
    route("POST", "/table/:code/orders", null, function (req, b, q, p) { var m = byCode(p.code), r = m.r, t = clock();
      var sig = JSON.stringify([m.t.id, (b.items || []).map(function (i) { return [i.productId, i.qty]; }), str(b.guest, 60)]);
      var dup = db.orders.filter(function (o) { return o.dineIn && o.sig === sig && t - o.createdAt < 20000 && o.status === "pending"; })[0]; if (dup) return Object.assign(guestOrder(dup), { guestKey: dup.guestKey });
      if (db.orders.filter(function (o) { return o.dineIn && o.tableId === m.t.id && o.status === "pending"; }).length >= 6) E(429, "TABLE_TOO_MANY");
      var qq = quote(req, { restaurantId: r.id, items: b.items, dineIn: true }), name = str(b.name, 40);
      db.meta.seq++; var o = { id: "o" + db.meta.seq, number: db.meta.seq, customerId: null, guestName: name || null, restaurantId: r.id, courierId: null, cityId: r.cityId,
        dineIn: true, tableId: m.t.id, tableName: m.t.name, guestKey: String(newToken()).replace(/[^A-Za-z0-9]/g, "") + String(newToken()).replace(/[^A-Za-z0-9]/g, "").slice(0, 8),
        items: qq.items, subtotal: qq.subtotal, deliveryFee: 0, discount: 0, total: qq.subtotal, km: 0, promoCode: null,
        address: { text: m.t.name, landmark: "", lat: r.lat, lng: r.lng }, phone: null, comment: str(b.comment, 200),
        payment: { method: "cash", status: "none", provider: "cash" }, delivery: "table", sig: sig,
        status: "pending", prepMin: null, createdAt: t, updatedAt: t, history: [{ status: "pending", at: t, by: "guest" }] };
      db.orders.unshift(o); notify("rest:" + r.id, "n.newOrder", { n: o.number, sum: o.subtotal, table: m.t.name }, o.id);
      save(); return Object.assign(guestOrder(o), { guestKey: o.guestKey }); });
    route("POST", "/table/:code/call", null, function (req, b, q, p) { var m = byCode(p.code), t = clock();
      if (m.t.calledAt && t - m.t.calledAt < 60000) return { ok: true, again: Math.ceil((60000 - (t - m.t.calledAt)) / 1000) };
      m.t.calledAt = t; notify("rest:" + m.r.id, b.why === "bill" ? "n.bill" : "n.waiter", { table: m.t.name }); save(); return { ok: true }; });

    /* the restaurant's own couriers: they use the same courier app but see only this restaurant's orders */
    function pubOwn(u) { var x = pubUser(u); x.busy = !!activeOf(u.id); x.delivered = db.orders.filter(function (o) { return o.courierId === u.id && o.status === "delivered"; }).length; return x; }
    function myCourier(req, cid) { boss(req); var u = find(db.users, cid); if (!u || !u.courier || crests(u).indexOf(req.user.restaurantId) < 0) E(404, "NOT_FOUND"); if (crests(u).length > 1) E(403, "SHARED_COURIER"); return u; }
    /* staff: the owner adds workers who log in with their own phone and see the same orders (no single phone to wait on) */
    function ownerOnly(req) { var r = myRest(req); if (r.ownerId !== req.user.id) E(403, "OWNER_ONLY"); return r; }
    function myStaff(req, id) { var r = boss(req), u = find(db.users, id); if (!u || u.role !== "restaurant" || u.restaurantId !== r.id || u.id === r.ownerId) E(404, "NOT_FOUND");
      if (u.id === req.user.id) E(409, "USE_PROFILE"); if (u.staffRole === "manager" && r.ownerId !== req.user.id) E(403, "OWNER_ONLY"); return u; }
    function cardNum(v) { var d = String(v || "").replace(/\D/g, ""); if (!d) return null; if (d.length < 12 || d.length > 19) E(400, "CARD_NUMBER"); return d; }
    /* what a staff member did in the last 30 days: orders taken, money, rating from guests */
    function staffStats(u) { var m0 = clock() - 30 * DAY, l = db.orders.filter(function (o) { return o.status === "delivered" && o.createdAt >= m0 && (o.waiterId === u.id || (o.acceptedBy && o.acceptedBy.id === u.id)); });
      return { orders: l.length, sum: l.reduce(function (s, o) { return s + o.subtotal; }, 0), rating: u.wRating || null, ratingCount: u.wRatingCount || 0 }; }
    function pubStaff(u) { return { id: u.id, staffRole: ["manager", "waiter"].indexOf(u.staffRole) >= 0 ? u.staffRole : "worker", tipCard: u.tipCard || null, stats: staffStats(u), name: u.name, phone: u.phone, active: u.active, createdAt: u.createdAt, lastSeenAt: u.lastSeenAt || null, mustChange: !!u.mustChange }; }
    function dropSessions(id) { Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].userId === id) delete db.sessions[k]; }); }
    /* «Sales»: one page with the money — by day, by dish, by table, by waiter, by payment */
    route("GET", "/restaurant/sales", ["restaurant"], function (req, b, q) { var r = boss(req), t = clock(), d0 = startOfDay(t);
      var from = q.period === "week" ? d0 - 6 * DAY : q.period === "month" ? d0 - 29 * DAY : d0;
      var all = by(db.orders, "restaurantId", r.id).filter(function (o) { return o.createdAt >= from; }), del = all.filter(function (o) { return o.status === "delivered"; });
      var sum = function (l) { return l.reduce(function (s, o) { return s + o.subtotal; }, 0); }, group = function (key, name) { var m = {}; del.forEach(function (o) { var k = key(o); if (k == null) return; m[k] = m[k] || { key: k, name: name(o), orders: 0, sum: 0 }; m[k].orders++; m[k].sum += o.subtotal; }); return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, c) { return c.sum - a.sum; }); };
      var dishes = {}; del.forEach(function (o) { o.items.forEach(function (it) { var d = dishes[it.productId] = dishes[it.productId] || { name: it.name, kind: it.kind, qty: 0, sum: 0 }; d.qty += it.qty; d.sum += it.qty * it.price; }); });
      var days = []; for (var i = (q.period === "month" ? 29 : q.period === "week" ? 6 : 0); i >= 0; i--) { var a = d0 - i * DAY, l = del.filter(function (o) { return o.createdAt >= a && o.createdAt < a + DAY; }); days.push({ day: a, sum: sum(l), count: l.length }); }
      var waiters = group(function (o) { return o.waiterId || (o.acceptedBy && o.acceptedBy.id) || null; }, function (o) { var w = find(db.users, o.waiterId || o.acceptedBy.id); return w ? w.name : (o.acceptedBy ? o.acceptedBy.name : "—"); })
        .map(function (x) { var w = find(db.users, x.key); x.rating = w ? w.wRating || null : null; x.staffRole = w ? (w.id === r.ownerId ? "owner" : w.staffRole || "worker") : null; return x; });
      return { period: q.period || "today", from: from, revenue: sum(del), orders: del.length, avg: del.length ? Math.round(sum(del) / del.length) : 0,
        cancelled: all.filter(function (o) { return o.status === "cancelled" || o.status === "rejected"; }).length,
        hall: { orders: del.filter(function (o) { return o.dineIn; }).length, sum: sum(del.filter(function (o) { return o.dineIn; })) }, delivery: { orders: del.filter(function (o) { return !o.dineIn; }).length, sum: sum(del.filter(function (o) { return !o.dineIn; })) },
        pay: ["cash", "card", "transfer"].map(function (m) { var l = del.filter(function (o) { return o.payment.method === m && !o.dineIn; }); return { method: m, orders: l.length, sum: sum(l) }; }).filter(function (x) { return x.orders; }),
        days: days, dishes: Object.keys(dishes).map(function (k) { return dishes[k]; }).sort(function (a, c) { return c.sum - a.sum; }).slice(0, 15),
        tables: group(function (o) { return o.dineIn ? o.tableId : null; }, function (o) { return o.tableName; }), waiters: waiters }; });
    /* a waiter's own page: what I did, my rating, my tip card */
    route("GET", "/restaurant/my", ["restaurant"], function (req) { var u = req.user, d0 = startOfDay(clock()), mine = function (o) { return o.status === "delivered" && (o.waiterId === u.id || (o.acceptedBy && o.acceptedBy.id === u.id)); };
      var today = db.orders.filter(function (o) { return mine(o) && o.createdAt >= d0; });
      return Object.assign(staffStats(u), { todayOrders: today.length, todaySum: today.reduce(function (s, o) { return s + o.subtotal; }, 0), tipCard: u.tipCard || null, name: u.name }); });
    route("PATCH", "/restaurant/my", ["restaurant"], function (req, b) { if (b.tipCard !== undefined) req.user.tipCard = cardNum(b.tipCard); save(); return { tipCard: req.user.tipCard || null }; });
    route("GET", "/restaurant/staff", ["restaurant"], function (req) { var r = boss(req);
      return db.users.filter(function (u) { return u.role === "restaurant" && u.restaurantId === r.id && u.id !== r.ownerId; }).map(pubStaff); });
    route("POST", "/restaurant/staff", ["restaurant"], function (req, b) { var r = boss(req), sr = ["manager", "waiter"].indexOf(b.staffRole) >= 0 ? b.staffRole : "worker", name = str(b.name, 60), phone = Rules.normPhone(b.phone);
      if (name.length < 2) E(400, "BAD_NAME"); if (!phone) E(400, "BAD_PHONE"); if (db.users.some(function (u) { return u.phone === phone; })) E(409, "PHONE_TAKEN");
      if (db.users.filter(function (u) { return u.role === "restaurant" && u.restaurantId === r.id; }).length > 15) E(409, "STAFF_LIMIT");
      if (sr === "manager" && r.ownerId !== req.user.id) E(403, "OWNER_ONLY");
      var tmp = newPassword(), u = { id: id("u"), role: "restaurant", restaurantId: r.id, staff: true, staffRole: sr, tipCard: cardNum(b.tipCard), name: name, phone: phone, pass: hashPw(tmp), mustChange: true, active: true, cityId: r.cityId, createdAt: clock(), lang: "tg" };
      db.users.push(u); save(); return Object.assign(pubStaff(u), { login: { phone: phone, password: tmp } }); });
    route("PATCH", "/restaurant/staff/:id", ["restaurant"], function (req, b, q, p) { var u = myStaff(req, p.id);
      if (b.active != null) { u.active = !!b.active; if (!u.active) dropSessions(u.id); }
      if (b.staffRole != null) { if (myRest(req).ownerId !== req.user.id && (b.staffRole === "manager" || u.staffRole === "manager")) E(403, "OWNER_ONLY"); u.staffRole = ["manager", "waiter"].indexOf(b.staffRole) >= 0 ? b.staffRole : "worker"; }
      if (b.tipCard !== undefined) u.tipCard = cardNum(b.tipCard);
      save(); return pubStaff(u); });
    route("POST", "/restaurant/staff/:id/password", ["restaurant"], function (req, b, q, p) { var u = myStaff(req, p.id), tmp = newPassword(); u.pass = hashPw(tmp); u.mustChange = true; dropSessions(u.id); save(); return { phone: u.phone, password: tmp }; });
    route("DELETE", "/restaurant/staff/:id", ["restaurant"], function (req, b, q, p) { var u = myStaff(req, p.id); dropSessions(u.id); db.users.splice(db.users.indexOf(u), 1); save(); return true; });
    route("GET", "/restaurant/couriers", ["restaurant"], function (req) { return db.users.filter(function (u) { return !u.deleted && u.courier && crests(u).indexOf(req.user.restaurantId) >= 0; }).map(pubOwn); });
    route("POST", "/restaurant/couriers", ["restaurant"], function (req, b) { var r = boss(req), nc = newCourier(b, cityOf(r.cityId), r.id); save(); return Object.assign(pubOwn(nc.user), { login: nc.login }); });
    route("PATCH", "/restaurant/couriers/:id", ["restaurant"], function (req, b, q, p) { var u = myCourier(req, p.id);
      if (b.active != null) { if (!b.active && activeOf(u.id)) E(409, "HAS_ACTIVE_ORDER"); u.active = !!b.active; if (!u.active) { u.courier.online = false; Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].userId === u.id) delete db.sessions[k]; }); } }
      save(); return pubOwn(u); });
    route("POST", "/restaurant/couriers/:id/password", ["restaurant"], function (req, b, q, p) { var u = myCourier(req, p.id), tmp = newPassword(); u.pass = hashPw(tmp); u.mustChange = true;
      Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].userId === u.id) delete db.sessions[k]; }); save(); return { phone: u.phone, password: tmp }; });
    function validProduct(b, partial, rest) {
      var x = {};
      if (!partial || b.name != null) { var n = str(b.name, 60); if (n.length < 2) E(400, "BAD_NAME"); x.name = L(n); }
      if (!partial || b.price != null) { var pr = int(b.price); if (!(pr >= 1 && pr <= 500000)) E(400, "BAD_PRICE"); x.price = pr; }
      if (!partial || b.categoryId != null) { var cat = find(db.categories, b.categoryId); if (!cat) E(400, "BAD_CATEGORY");
        if (rest) { if ((rest.kind === "shop") !== !!cat.shop) E(400, "BAD_CATEGORY"); var st = rest.shopType || "general"; if (rest.kind === "shop" && st !== "general" && cat.types && cat.types.indexOf(st) < 0) E(400, "BAD_CATEGORY"); } x.categoryId = b.categoryId; }
      if (b.desc != null) x.desc = L(str(b.desc, 140)); if (b.weight != null) x.weight = str(b.weight, 20); if (b.brand != null) x.brand = str(b.brand, 40) || null;
      if (b.kind != null) x.kind = KINDS.indexOf(b.kind) >= 0 ? b.kind : "plate";
      if (b.available != null) x.available = !!b.available; if (b.popular != null) x.popular = !!b.popular;
      if (b.stock !== undefined) { if (b.stock === null || b.stock === "") x.stock = null; else { var sk = int(b.stock); if (!(sk >= 0 && sk <= 100000)) E(400, "BAD_STOCK"); x.stock = sk; if (sk === 0) x.available = false; else if (b.available == null) x.available = true; } }
      /* when the dish is shown first on the home screen: breakfast / lunch / dinner / night (empty = guessed from the dish) */
      if (b.meals != null) x.meals = (Array.isArray(b.meals) ? b.meals : []).filter(function (m, i, a) { return ["b", "l", "d", "n"].indexOf(m) >= 0 && a.indexOf(m) === i; });
      if (b.oldPrice !== undefined) { var op = b.oldPrice ? int(b.oldPrice) : null; if (op !== null && !(op >= 1 && op <= 500000)) E(400, "BAD_PRICE"); x.oldPrice = op; }
      return x;
    }
    function saveProduct(prod, b, partial) { var x = validProduct(b, partial, find(db.restaurants, prod.restaurantId)), ph = b.photo;
      Object.assign(prod, x); if (prod.oldPrice && prod.oldPrice <= prod.price) E(400, "OLD_PRICE_LOW");
      if (ph !== undefined) prod.photo = photoField(ph, prod.photo || null, "ph"); return prod;
    }
    /* fill a menu from a ready template (Tajik + Uzbek dishes); dishes with the same name are skipped, hidden categories come back */
    function fillMenu(r, key) { var tpl = (Seed.MENU_TPL || {})[key]; if (!tpl) E(400, "BAD_TEMPLATE"); var t = clock(), added = 0;
      var have = by(db.products, "restaurantId", r.id).map(function (p) { return String(p.name && p.name.tg || "").toLowerCase(); });
      tpl.forEach(function (d) { if (have.indexOf(d[1].tg.toLowerCase()) >= 0) return;
        db.products.push({ id: id(r.id + "p"), restaurantId: r.id, categoryId: d[0], name: JSON.parse(JSON.stringify(d[1])), desc: JSON.parse(JSON.stringify(d[2])), price: d[3], weight: d[4], kind: d[5], popular: !!d[6], available: true, photo: null, oldPrice: null, createdAt: t });
        var c = find(db.categories, d[0]); if (c && c.active === false) c.active = true; added++; });
      save(); return { added: added, total: by(db.products, "restaurantId", r.id).length }; }
    route("POST", "/restaurant/menu/template", ["restaurant"], function (req, b) { return fillMenu(boss(req), str(b.key) || "tj-uz"); });
    route("GET", "/restaurant/products", ["restaurant"], function (req) { return by(db.products, "restaurantId", myRest(req).id); });
    route("POST", "/restaurant/products", ["restaurant"], function (req, b) { var r = boss(req);
      var prod = saveProduct({ id: id(r.id + "p"), restaurantId: r.id, desc: L(""), weight: "", kind: "plate", available: true, popular: false, photo: null, oldPrice: null, createdAt: clock() }, b, false);
      db.products.push(prod); save(); return prod; });
    route("PATCH", "/restaurant/products/:id", ["restaurant"], function (req, b, q, p) { var r = onlyKeys(b, ["available"]) && req.user.staffRole !== "waiter" ? myRest(req) : boss(req), prod = find(db.products, p.id);
      if (!prod || prod.restaurantId !== r.id) E(404, "NOT_FOUND"); var keep = JSON.parse(JSON.stringify(prod));
      try { saveProduct(prod, b, true); } catch (e) { Object.assign(prod, keep); throw e; } save(); return prod; });
    route("DELETE", "/restaurant/products/:id", ["restaurant"], function (req, b, q, p) { var r = boss(req), prod = find(db.products, p.id);
      if (!prod || prod.restaurantId !== r.id) E(404, "NOT_FOUND"); if (prod.photo) media.del(prod.photo); db.products = db.products.filter(function (x) { return x.id !== prod.id; }); save(); return true; });
    route("GET", "/restaurant/stats", ["restaurant"], function (req) { return statsFor(by(db.orders, "restaurantId", myRest(req).id), true); });
    /* the restaurant's own ad on the customer home page: one per restaurant, live at once, the admin can switch it off */
    function myAd(r) { return db.banners.filter(function (x) { return x.own && x.restaurantId === r.id; })[0] || null; }
    route("GET", "/restaurant/ad", ["restaurant"], function (req) { return myAd(myRest(req)); });
    route("POST", "/restaurant/ad", ["restaurant"], function (req, b) { var r = boss(req), ad = myAd(r), fresh = !ad;
      var ti = str(b.title, 40), su = str(b.sub, 70); if (ti.length < 2) E(400, "BAD_AD_TITLE");
      if (fresh) ad = { id: id("b"), own: true, restaurantId: r.id, active: true, blocked: false, photo: null, createdAt: clock() };
      if (ad.blocked && b.active) E(403, "AD_BLOCKED");
      if (b.productId) { var pr = find(db.products, b.productId); if (!pr || pr.restaurantId !== r.id) E(400, "BAD_PRODUCT"); }
      var photo = photoField(b.photo, ad.photo, "ad");
      Object.assign(ad, { title: L(ti), sub: L(su), tone: TONES.indexOf(b.tone) >= 0 ? b.tone : TONES[0], art: KINDS.indexOf(b.art) >= 0 ? b.art : "plov", photo: photo, productId: b.productId || null,
        active: b.active == null ? ad.active : !!b.active, updatedAt: clock() });
      if (fresh) db.banners.unshift(ad); save(); return ad; });
    route("DELETE", "/restaurant/ad", ["restaurant"], function (req) { var r = boss(req), ad = myAd(r); if (!ad) return true; if (ad.photo) media.del(ad.photo);
      db.banners = db.banners.filter(function (x) { return x !== ad; }); save(); return true; });

    /* ---------- courier ---------- */
    function meCourier(req) { if (!req.user.courier) E(403, "FORBIDDEN"); return req.user; }
    function activeOf(uid) { return db.orders.filter(function (o) { return o.courierId === uid && ["cooking", "ready", "picked_up"].indexOf(o.status) >= 0; })[0] || null; }
    route("PATCH", "/courier/me", ["courier"], function (req, b) { var u = meCourier(req);
      if (b.online != null) { if (!b.online && activeOf(u.id)) E(409, "HAS_ACTIVE_ORDER"); u.courier.online = !!b.online; }
      if (b.vehicle && ["scooter", "bike", "car", "foot"].indexOf(b.vehicle) >= 0) u.courier.vehicle = b.vehicle;
      if (b.lat != null && b.lng != null) { var la = Number(b.lat), ln = Number(b.lng); if (isFinite(la) && isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) { u.courier.lat = la; u.courier.lng = ln; u.courier.locAt = clock(); } }
      save(); return pubUser(u); });
    route("GET", "/courier/orders/available", ["courier"], function (req) { var u = meCourier(req); if (!u.courier.online) return [];
      return db.orders.filter(function (o) { return offerable(o, u) && !(o.skips && o.skips[u.id]); }).map(function (o) { return pubOrder(o, u); }); });
    /* "skip": this courier does not see the offer again; others still do */
    route("POST", "/courier/orders/:id/skip", ["courier"], function (req, b, q, p) { var u = meCourier(req), o = find(db.orders, p.id); if (!o) E(404, "NOT_FOUND");
      o.skips = o.skips || {}; o.skips[u.id] = clock();
      db.notifications.forEach(function (n) { if (n.orderId === o.id && (n.target === "couriers:" + o.cityId || n.target === "own:" + o.restaurantId)) n.readBy[u.id] = clock(); }); save(); return true; });
    route("GET", "/courier/orders/active", ["courier"], function (req) { var o = activeOf(meCourier(req).id); return o ? pubOrder(o, req.user) : null; });
    route("POST", "/courier/orders/:id/accept", ["courier"], function (req, b, q, p) { var u = meCourier(req), o = find(db.orders, p.id);
      if (!o) E(404, "NOT_FOUND"); if (!u.courier.online) E(409, "COURIER_OFFLINE"); if (activeOf(u.id)) E(409, "HAS_ACTIVE_ORDER");
      if (o.courierId) E(409, "ALREADY_TAKEN"); if (!offerable(o, u)) E(409, "NOT_AVAILABLE");
      o.courierId = u.id; o.assignedAt = clock(); o.courierFrom = { lat: u.courier.lat, lng: u.courier.lng }; hideFor(o.id, "couriers:" + o.cityId); hideFor(o.id, "own:" + o.restaurantId);
      notify("rest:" + o.restaurantId, "n.courierAssigned", { n: o.number, name: u.name }, o.id); notify("u:" + o.customerId, "n.courierFound", { n: o.number, name: u.name }, o.id);
      save(); return pubOrder(o, u); });
    route("POST", "/courier/orders/:id/pickup", ["courier"], function (req, b, q, p) { var o = orderFor(req, p.id); if (o.courierId !== req.user.id) E(403, "FORBIDDEN"); if (o.status !== "ready") E(409, "NOT_READY"); setStatus(o, "picked_up", req.user); save(); return pubOrder(o, req.user); });
    route("POST", "/courier/orders/:id/deliver", ["courier"], function (req, b, q, p) { var o = orderFor(req, p.id); if (o.courierId !== req.user.id) E(403, "FORBIDDEN"); setStatus(o, "delivered", req.user);
      var u = req.user; u.courier.lat = o.address.lat; u.courier.lng = o.address.lng; save(); return pubOrder(o, req.user); });
    route("GET", "/courier/earnings", ["courier"], function (req) { var u = meCourier(req), t = clock(), d0 = startOfDay(t), w0 = d0 - 6 * 86400000;
      var done = db.orders.filter(function (o) { return o.courierId === u.id && o.status === "delivered"; });
      function sum(list) { return list.reduce(function (s, o) { return s + (u.courier.restaurantId ? o.deliveryFee : (o.courierPay || 0)); }, 0); }
      var today = done.filter(function (o) { return (o.deliveredAt || o.updatedAt) >= d0; }), week = done.filter(function (o) { return (o.deliveredAt || o.updatedAt) >= w0; });
      var series = []; for (var i = 6; i >= 0; i--) { var a = d0 - i * 86400000, b2 = a + 86400000; series.push({ day: a, sum: sum(done.filter(function (o) { var x = o.deliveredAt || o.updatedAt; return x >= a && x < b2; })) }); }
      return { today: sum(today), todayCount: today.length, week: sum(week), weekCount: week.length, total: sum(done), totalCount: done.length, series: series, rating: courierRating(u) }; });
    route("GET", "/courier/history", ["courier"], function (req) { return db.orders.filter(function (o) { return o.courierId === req.user.id && Rules.FINAL.indexOf(o.status) >= 0; }).slice(0, 50).map(function (o) { return pubOrder(o, req.user); }); });

    /* ---------- admin ---------- */
    /* midnight in Tajikistan (UTC+5), whatever the server clock zone is */
    function startOfDay(t) { var off = 5 * 3600000; return Math.floor((t + off) / DAY) * DAY - off; }
    function statsFor(orders, forRestaurant) {
      var t = clock(), d0 = startOfDay(t), m0 = d0 - 29 * 86400000;
      var del = orders.filter(function (o) { return o.status === "delivered"; });
      function gmv(l) { return l.reduce(function (s, o) { return s + o.subtotal; }, 0); }
      var today = del.filter(function (o) { return o.createdAt >= d0; }), month = del.filter(function (o) { return o.createdAt >= m0; });
      var series = []; for (var i = 13; i >= 0; i--) { var a = d0 - i * 86400000, z = a + 86400000, l = del.filter(function (o) { return o.createdAt >= a && o.createdAt < z; }); series.push({ day: a, sum: gmv(l), count: l.length }); }
      var tops = {}; month.forEach(function (o) { o.items.forEach(function (it) { var k = it.productId; tops[k] = tops[k] || { productId: k, name: it.name, kind: it.kind, qty: 0, sum: 0 }; tops[k].qty += it.qty; tops[k].sum += it.qty * it.price; }); });
      var rated = del.filter(function (o) { return o.review; });
      return { todaySales: gmv(today), todayCount: today.length, monthSales: gmv(month), monthCount: month.length, avgCheck: month.length ? Math.round(gmv(month) / month.length) : 0,
        active: orders.filter(function (o) { return ["pending", "cooking", "ready", "picked_up"].indexOf(o.status) >= 0; }).length,
        cancelled: orders.filter(function (o) { return (o.status === "cancelled" || o.status === "rejected") && o.createdAt >= m0; }).length,
        payout: month.reduce(function (s, o) { return s + (o.restaurantPayout || 0); }, 0), commission: month.reduce(function (s, o) { return s + (o.commission || 0); }, 0),
        rating: rated.length ? Math.round(rated.reduce(function (s, o) { return s + o.review.rating; }, 0) / rated.length * 10) / 10 : null,
        series: series, topProducts: Object.keys(tops).map(function (k) { return tops[k]; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5) };
    }
    route("GET", "/admin/dashboard", ["admin"], function (req) {
      var s = statsFor(db.orders), m0 = startOfDay(clock()) - 29 * 86400000, month = db.orders.filter(function (o) { return o.status === "delivered" && o.createdAt >= m0; });
      var d0 = startOfDay(clock()), sumOf = function (l) { return l.reduce(function (x, o) { return x + o.subtotal; }, 0); };
      /* every restaurant on its own line: today, 30 days, platform's share, open orders */
      var byRest = db.restaurants.map(function (r) { var l = month.filter(function (o) { return o.restaurantId === r.id; }), td = l.filter(function (o) { return o.createdAt >= d0; });
        return { id: r.id, name: r.name, active: r.active, count: l.length, sum: sumOf(l), today: sumOf(td), todayCount: td.length, platform: l.reduce(function (x, o) { return x + (o.platform || 0); }, 0),
          open: db.orders.filter(function (o) { return o.restaurantId === r.id && ["pending", "cooking", "ready", "picked_up"].indexOf(o.status) >= 0; }).length, rating: r.rating, ratingCount: r.ratingCount || 0 }; }).sort(function (a, b) { return b.sum - a.sum; });
      var byCity = db.cities.map(function (c) { var l = month.filter(function (o) { return o.cityId === c.id; }); return { id: c.id, name: c.name, count: l.length, sum: l.reduce(function (x, o) { return x + o.subtotal; }, 0) }; });
      var byStatus = {}; db.orders.forEach(function (o) { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
      return Object.assign(s, { platformMonth: month.reduce(function (x, o) { return x + (o.platform || 0); }, 0), courierMonth: month.reduce(function (x, o) { return x + (o.courierPay || 0); }, 0),
        statsResetAt: db.meta.statsResetAt || null, isMain: isMain(req.user),
        customers: by(db.users, "role", "customer").length, couriersOnline: db.users.filter(function (u) { return u.role === "courier" && u.active && u.courier.online; }).length,
        couriers: by(db.users, "role", "courier").length, restaurants: db.restaurants.filter(function (r) { return r.active; }).length, byRest: byRest, byCity: byCity, byStatus: byStatus,
        subs: (function () { var m0s = clock() - 30 * DAY, l = (db.subs || []).filter(function (s) { return s.kind === "paid" && s.at >= m0s; });
          return { month: l.reduce(function (x, s) { return x + s.amount; }, 0), count: l.length, soon: db.restaurants.filter(function (r) { return r.active && subOf(r).state === "soon"; }).length, expired: db.restaurants.filter(function (r) { return r.active && subOf(r).state === "expired"; }).length }; })(),
        payMix: { card: month.filter(function (o) { return o.payment.method === "card"; }).length, cash: month.filter(function (o) { return o.payment.method === "cash"; }).length } });
    });
    route("GET", "/admin/orders", ["admin"], function (req, b, q) { var l = db.orders;
      if (q.status) l = l.filter(function (o) { return q.status === "active" ? Rules.ACTIVE.indexOf(o.status) >= 0 : o.status === q.status; });
      if (q.q) { var s = str(q.q).toLowerCase(); l = l.filter(function (o) { var c = find(db.users, o.customerId); return String(o.number).indexOf(s) >= 0 || (c && c.name.toLowerCase().indexOf(s) >= 0); }); }
      return l.slice(0, 100).map(function (o) { return pubOrder(o, req.user); }); });
    route("POST", "/admin/orders/:id/status", ["admin"], function (req, b, q, p) { var o = find(db.orders, p.id); if (!o) E(404, "NOT_FOUND");
      if ((b.status === "picked_up") && !o.courierId) E(409, "NO_COURIER"); if (b.status === "cooking" && !o.prepMin) o.prepMin = 20;
      setStatus(o, b.status, req.user); save(); return pubOrder(o, req.user); });
    route("GET", "/admin/restaurants", ["admin"], function () { return db.restaurants.map(function (r) { var o = by(db.orders, "restaurantId", r.id); return Object.assign(pubRest(r), { orderCount: o.length, owner: pubUser(find(db.users, r.ownerId)) }); }); });
    /* the owner paid (cash, by hand): extend the period by N months from today or from the current end, whichever is later */
    route("POST", "/admin/restaurants/:id/subscription", ["admin"], function (req, b, q, p) { var r = find(db.restaurants, p.id); if (!r) E(404, "NOT_FOUND");
      var m = int(b.months), amt = int(b.amount == null ? 0 : b.amount); if (!(m >= 1 && m <= 24)) E(400, "BAD_MONTHS"); if (!(amt >= 0 && amt <= 1000000)) E(400, "BAD_PRICE");
      var from = Math.max(clock(), r.paidUntil || 0), until = addMonths(from, m);
      r.paidUntil = until; r.trial = false;
      db.subs = db.subs || []; var x = { id: id("s"), restaurantId: r.id, kind: "paid", months: m, amount: amt, note: str(b.note, 120), from: from, until: until, at: clock(), by: req.user.id };
      db.subs.unshift(x); notify("rest:" + r.id, "n.subPaid", { m: m, date: new Date(until + 5 * 3600000).toISOString().slice(0, 10).split("-").reverse().join(".") }); save();
      return Object.assign(pubRest(r), { payment: x }); });
    /* a mistake can be undone: the last payment of a restaurant is removed and the end date goes back */
    route("DELETE", "/admin/subscriptions/:id", ["admin"], function (req, b, q, p) { var x = find(db.subs || [], p.id); if (!x || x.kind !== "paid") E(404, "NOT_FOUND");
      var last = (db.subs || []).filter(function (s) { return s.restaurantId === x.restaurantId; })[0]; if (last !== x) E(409, "NOT_LAST_PAYMENT");
      var r = find(db.restaurants, x.restaurantId); if (r) r.paidUntil = x.from; db.subs = db.subs.filter(function (s) { return s !== x; }); save(); return true; });
    route("GET", "/admin/subscriptions", ["admin"], function (req, b, q) { var l = db.subs || []; if (q.restaurantId) l = l.filter(function (s) { return s.restaurantId === q.restaurantId; });
      return l.slice(0, 200).map(function (s) { var r = find(db.restaurants, s.restaurantId); return Object.assign({}, s, { restaurantName: r ? r.name : null }); }); });
    route("POST", "/admin/restaurants", ["admin"], function (req, b) {
      var name = str(b.name, 60), city = find(db.cities, b.cityId), phone = Rules.normPhone(b.ownerPhone), com = int(b.commissionPct == null ? 15 : b.commissionPct);
      if (name.length < 2) E(400, "BAD_NAME"); if (!city) E(400, "BAD_CITY"); if (!phone) E(400, "BAD_PHONE"); if (!(com >= 0 && com <= 50)) E(400, "BAD_COMMISSION");
      if (db.users.some(function (u) { return u.phone === phone; })) E(409, "PHONE_TAKEN");
      var tmp, rid = id("r"), owner = { id: id("u"), role: "restaurant", name: str(b.ownerName, 60) || name, phone: phone, pass: hashPw(tmp = newPassword()), mustChange: true, active: true, cityId: city.id, restaurantId: rid, createdAt: clock(), lang: "tg" };
      var la = Number(b.lat), ln = Number(b.lng), hasPin = isFinite(la) && isFinite(ln) && b.lat != null && Rules.distanceKm(city, { lat: la, lng: ln }) <= 60;
      var r = { id: rid, kind: b.kind === "shop" ? "shop" : "food", shopType: b.kind === "shop" ? (SHOP_TYPES.indexOf(b.shopType) >= 0 ? b.shopType : "general") : undefined, pinned: !!b.pinned, pickup: b.kind === "shop" ? b.pickup !== false : !!b.pickup, name: L(name), cityId: city.id, ownerId: owner.id, cuisine: L(str(b.cuisine, 60) || "—"), tone: "#FFE3CC", eta: "30–45", rating: null, ratingCount: 0, hours: { from: "09:00", to: "22:00" }, open: false, active: true, commissionPct: com, minOrder: 20, lat: hasPin ? la : city.lat + 0.004, lng: hasPin ? ln : city.lng - 0.004, address: L(str(b.address, 80)), phone: phone, createdAt: clock() };
      if (["platform", "own", "mixed"].indexOf(b.delivery) >= 0) r.delivery = b.delivery;
      /* where the restaurant delivers — drawn by the admin on the map (optional) */
      if (Array.isArray(b.zone) && b.zone.length) { if (b.zone.length < 3 || b.zone.length > 200) E(400, "BAD_ZONE"); r.zone = b.zone.map(function (x) { var a1 = Number(x.lat), a2 = Number(x.lng); if (!(isFinite(a1) && isFinite(a2)) || Rules.distanceKm(city, { lat: a1, lng: a2 }) > 60) E(400, "BAD_ZONE"); return { lat: Math.round(a1 * 1e6) / 1e6, lng: Math.round(a2 * 1e6) / 1e6 }; }); }
      /* access: a free trial of N days, or N paid months (1–12) */
      db.subs = db.subs || [];
      if (b.months != null && int(b.months) > 0) { var mo = int(b.months), amt0 = int(b.amount || 0); if (!(mo >= 1 && mo <= 24)) E(400, "BAD_MONTHS"); if (!(amt0 >= 0 && amt0 <= 1000000)) E(400, "BAD_PRICE");
        r.paidUntil = addMonths(clock(), mo); r.trial = false; db.subs.unshift({ id: id("s"), restaurantId: rid, kind: "paid", months: mo, amount: amt0, note: str(b.note, 120), from: clock(), until: r.paidUntil, at: clock(), by: req.user.id }); }
      else { var td = b.trialDays == null ? setting("trialDays") : int(b.trialDays); if (!(td >= 0 && td <= 365)) E(400, "BAD_TRIAL");
        r.paidUntil = clock() + td * DAY; r.trial = td > 0;
        db.subs.unshift({ id: id("s"), restaurantId: rid, kind: "trial", months: 0, days: td, amount: 0, note: "", from: clock(), until: r.paidUntil, at: clock(), by: req.user.id }); }
      db.users.push(owner); db.restaurants.push(r); save(); return Object.assign(pubRest(r), { login: { phone: phone, password: tmp } }); });
    /* delete a place for good: its goods, tables, staff, own couriers, orders, receipts, access history — nothing is left behind */
    function wipeRestaurant(r) { var oids = {}, n = { orders: 0, products: 0, people: 0 };
      db.orders = db.orders.filter(function (o) { if (o.restaurantId !== r.id) return true; oids[o.id] = 1; n.orders++; if (o.payment && o.payment.receiptId) { try { if (files.del) files.del(o.payment.receiptId); } catch (e) {} } return false; });
      db.payments = (db.payments || []).filter(function (x) { return !oids[x.orderId]; });
      db.notifications = db.notifications.filter(function (x) { return !oids[x.orderId] && x.target !== "rest:" + r.id && x.target !== "own:" + r.id; });
      var pids = {}; db.products = db.products.filter(function (p) { if (p.restaurantId !== r.id) return true; pids[p.id] = 1; n.products++; if (p.photo) { try { media.del(p.photo); } catch (e) {} } return false; });
      var gone = {}; db.users = db.users.filter(function (u) { if (u.courier && crests(u).indexOf(r.id) >= 0 && crests(u).length > 1) { setCrests(u, crests(u).filter(function (x) { return x !== r.id; })); return true; } if (u.restaurantId === r.id || (u.courier && crests(u).indexOf(r.id) >= 0)) { gone[u.id] = 1; n.people++; return false; } return true; });
      Object.keys(db.sessions).forEach(function (k) { if (gone[db.sessions[k].userId]) delete db.sessions[k]; });
      db.users.forEach(function (u) { if (u.favs) Object.keys(u.favs).forEach(function (k) { if (Array.isArray(u.favs[k])) u.favs[k] = u.favs[k].filter(function (x) { return x !== r.id && !pids[x]; }); }); });
      db.subs = (db.subs || []).filter(function (s) { return s.restaurantId !== r.id; }); db.banners = (db.banners || []).filter(function (x) { return x.restaurantId !== r.id; }); db.promos = (db.promos || []).filter(function (x) { return x.restaurantId !== r.id; });
      [r.logo, r.cover].forEach(function (u) { if (u) { try { media.del(u); } catch (e) {} } }); db.restaurants = db.restaurants.filter(function (x) { return x !== r; }); return n; }
    route("POST", "/admin/restaurants/:id/delete", ["admin"], function (req, b, q, p) { mainOnly(req); var r = find(db.restaurants, p.id); if (!r) E(404, "NOT_FOUND"); if (b.confirm !== true) E(400, "CONFIRM_REQUIRED");
      var n = wipeRestaurant(r); save(); return n; });
    /* empty a whole service: every restaurant (food) / every shop / every listing of a listing service — main admin, after a confirm */
    function svcCount(k) { if (k === "food") return db.restaurants.filter(function (r) { return r.kind !== "shop"; }).length; if (k === "shops") return db.restaurants.filter(function (r) { return r.kind === "shop"; }).length; return LIST_SVC[k] ? adList().filter(function (a) { return svcOfAd(a) === k; }).length : 0; }
    route("POST", "/admin/services/:key/clear", ["admin"], function (req, b, q, p) { mainOnly(req); var k = p.key; if (!SERVICES.some(function (s) { return s[0] === k; })) E(404, "NOT_FOUND"); if (b.confirm !== true) E(400, "CONFIRM_REQUIRED");
      var n = { items: 0, orders: 0, products: 0, people: 0 };
      if (k === "food" || k === "shops") { db.restaurants.filter(function (r) { return (r.kind === "shop") === (k === "shops"); }).forEach(function (r) { var x = wipeRestaurant(r); n.items++; n.orders += x.orders; n.products += x.products; n.people += x.people; }); }
      else if (LIST_SVC[k]) { var del = adList().filter(function (a) { return svcOfAd(a) === k; }), ids = {}; del.forEach(function (a) { ids[a.id] = 1; (a.photos || []).forEach(function (u) { try { media.del(u); } catch (e) {} }); }); n.items = del.length;
        db.ads = adList().filter(function (a) { return !ids[a.id]; }); db.adPays = adPays().filter(function (x) { return !ids[x.adId]; }); }
      save(); return n; });
    route("POST", "/admin/restaurants/:id/template", ["admin"], function (req, b, q, p) { var r = find(db.restaurants, p.id); if (!r) E(404, "NOT_FOUND"); return fillMenu(r, str(b.key) || "tj-uz"); });
    route("PATCH", "/admin/restaurants/:id", ["admin"], function (req, b, q, p) { var r = find(db.restaurants, p.id); if (!r) E(404, "NOT_FOUND");
      if (b.delivery != null) { if (["platform", "own", "mixed"].indexOf(b.delivery) < 0) E(400, "BAD_DELIVERY"); r.delivery = b.delivery; }
      if (b.shopType != null && r.kind === "shop") { if (SHOP_TYPES.indexOf(b.shopType) < 0) E(400, "BAD_SHOP_TYPE"); r.shopType = b.shopType; }
      if (b.logo !== undefined) r.logo = photoField(b.logo, r.logo || null, "lg"); if (b.cover !== undefined) r.cover = photoField(b.cover, r.cover || null, "cv");
      /* the admin corrects what was typed when the restaurant was added: name, kitchen, city, address, phones, the owner's name and login number */
      if (b.name != null) { var nm = str(b.name, 60); if (nm.length < 2) E(400, "BAD_NAME"); r.name = L(nm); }
      if (b.cuisine != null) r.cuisine = L(str(b.cuisine, 60) || "—"); if (b.address != null) r.address = L(str(b.address, 80));
      if (b.cityId != null) { var cc = find(db.cities, b.cityId); if (!cc) E(400, "BAD_CITY"); if (cc.id !== r.cityId) { r.cityId = cc.id; r.lat = cc.lat + 0.004; r.lng = cc.lng - 0.004; } }
      if (b.phone != null) { var rp = Rules.normPhone(b.phone); if (!rp) E(400, "BAD_PHONE"); r.phone = rp; }
      if (b.lat != null && b.lng != null) { var pl = { lat: Number(b.lat), lng: Number(b.lng) }; if (!isFinite(pl.lat) || !isFinite(pl.lng) || Rules.distanceKm(cityOf(r.cityId), pl) > 60) E(400, "BAD_LOCATION"); r.lat = pl.lat; r.lng = pl.lng; }
      var ow = find(db.users, r.ownerId);
      if (ow && b.ownerName != null) { var on = str(b.ownerName, 60); if (on.length < 2) E(400, "BAD_NAME"); ow.name = on; }
      if (ow && b.ownerPhone != null) { var op = Rules.normPhone(b.ownerPhone); if (!op) E(400, "BAD_PHONE");
        if (op !== ow.phone) { if (db.users.some(function (u) { return u.phone === op; })) E(409, "PHONE_TAKEN"); ow.phone = op; ow.phoneVerified = null; } }
      if (b.kind != null) r.kind = b.kind === "shop" ? "shop" : "food"; if (b.pinned != null) r.pinned = !!b.pinned; if (b.pickup != null) r.pickup = !!b.pickup;
      if (b.active != null) r.active = !!b.active; if (b.commissionPct != null) { var c = int(b.commissionPct); if (!(c >= 0 && c <= 50)) E(400, "BAD_COMMISSION"); r.commissionPct = c; } save(); return pubRest(r); });
    /* ---------- admins: one main admin (the one set on the server) and up to two helpers he adds himself ----------
       helpers run everything day to day; only the main admin adds or removes admins, and nobody else can block him or reset his password */
    var ADMIN_MAX = 3;
    function mainAdmin() { var a = db.meta.mainAdminId && find(db.users, db.meta.mainAdminId);
      if (a && a.role === "admin") return a;
      var envPh = opts.admin && Rules.normPhone(opts.admin.phone), all = db.users.filter(function (u) { return u.role === "admin"; });
      a = (envPh && all.filter(function (u) { return u.phone === envPh; })[0]) || all.slice().sort(function (x, y) { return (x.createdAt || 0) - (y.createdAt || 0); })[0];
      if (a) db.meta.mainAdminId = a.id; return a || null; }
    function isMain(u) { var m = mainAdmin(); return !!(m && u && m.id === u.id); }
    function mainOnly(req) { if (!isMain(req.user)) E(403, "MAIN_ADMIN_ONLY"); }
    function pubAdmin(u) { return { id: u.id, name: u.name, phone: u.phone, active: u.active, main: isMain(u), mustChange: !!u.mustChange, createdAt: u.createdAt, lastSeenAt: u.lastSeenAt || null }; }
    /* launch day: wipe the test orders so every number starts from 0. Restaurants, menus, couriers, staff and settings stay.
       Only the main admin; he types 0 to confirm. Optionally also test customer accounts and ratings. */
    route("POST", "/admin/reset-stats", ["admin"], function (req, b) { mainOnly(req); if (String(b.confirm) !== "0") E(400, "CONFIRM_ZERO");
      var n = { orders: db.orders.length, customers: 0, ratings: false }, gone = {};
      db.orders = []; db.payments = []; db.notifications = db.notifications.filter(function (x) { return !x.orderId; });
      db.products.forEach(function (p) { p.sold = 0; }); db.restaurants.forEach(function (r) { tablesOf(r).forEach(function (x) { x.calledAt = null; }); });
      if (b.ratings) { n.ratings = true; db.restaurants.forEach(function (r) { r.rating = null; r.ratingCount = 0; }); db.products.forEach(function (p) { p.likes = 0; p.dislikes = 0; });
        db.users.forEach(function (u) { if (u.courier) { u.courier.rating = null; u.courier.ratingCount = 0; } if (u.wRating) { u.wRating = null; u.wRatingCount = 0; } }); }
      if (b.customers) { db.users = db.users.filter(function (u) { if (u.role !== "customer") return true; gone[u.id] = 1; n.customers++; return false; });
        Object.keys(db.sessions).forEach(function (k) { if (gone[db.sessions[k].userId]) delete db.sessions[k]; });
        if (db.ads) db.ads = db.ads.filter(function (a) { if (!gone[a.userId]) return true; (a.photos || []).forEach(function (u) { media.del(u); }); return false; });
        if (db.adPays) db.adPays = db.adPays.filter(function (x) { return !gone[x.userId]; }); db.notifications = db.notifications.filter(function (x) { return !/^u:/.test(x.target) || !gone[x.target.slice(2)]; }); }
      db.meta.statsResetAt = clock(); save(); return n; });
    route("GET", "/admin/admins", ["admin"], function (req) { return { me: isMain(req.user), max: ADMIN_MAX, list: db.users.filter(function (u) { return u.role === "admin"; }).map(pubAdmin) }; });
    route("POST", "/admin/admins", ["admin"], function (req, b) { mainOnly(req); var name = str(b.name, 60), phone = Rules.normPhone(b.phone);
      if (name.length < 2) E(400, "BAD_NAME"); if (!phone) E(400, "BAD_PHONE"); if (db.users.some(function (u) { return u.phone === phone; })) E(409, "PHONE_TAKEN");
      if (db.users.filter(function (u) { return u.role === "admin"; }).length >= ADMIN_MAX) E(409, "ADMIN_LIMIT", { max: ADMIN_MAX });
      var tmp = newPassword(), u = { id: id("u"), role: "admin", name: name, phone: phone, pass: hashPw(tmp), mustChange: true, active: true, cityId: db.settings.defaultCityId, createdAt: clock(), lang: "tg" };
      db.users.push(u); save(); return Object.assign(pubAdmin(u), { login: { phone: phone, password: tmp } }); });
    route("DELETE", "/admin/admins/:id", ["admin"], function (req, b, q, p) { mainOnly(req); var u = find(db.users, p.id); if (!u || u.role !== "admin") E(404, "NOT_FOUND"); if (isMain(u)) E(409, "CANNOT_BLOCK_SELF");
      Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].userId === u.id) delete db.sessions[k]; }); db.users.splice(db.users.indexOf(u), 1); save(); return true; });
    route("GET", "/admin/users", ["admin"], function (req, b, q) { var l = db.users.filter(function (u) { return !u.deleted; }); if (q.role) l = l.filter(function (u) { return u.role === q.role; });
      if (q.q) { var s = str(q.q).toLowerCase(); l = l.filter(function (u) { return u.name.toLowerCase().indexOf(s) >= 0 || u.phone.indexOf(s.replace(/\D/g, "") || "~") >= 0; }); }
      return l.map(function (u) { var x = pubUser(u); x.orderCount = db.orders.filter(function (o) { return o.customerId === u.id || o.courierId === u.id; }).length; return x; }); });
    route("PATCH", "/admin/users/:id", ["admin"], function (req, b, q, p) { var u = find(db.users, p.id); if (!u) E(404, "NOT_FOUND"); if (u.role === "admin" && u.id !== req.user.id) mainOnly(req);
      if (b.active != null) { if (u.id === req.user.id) E(409, "CANNOT_BLOCK_SELF"); if (!b.active && u.role === "courier" && activeOf(u.id)) E(409, "HAS_ACTIVE_ORDER");
        u.active = !!b.active; if (!u.active) { if (u.courier) u.courier.online = false; Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].userId === u.id) delete db.sessions[k]; }); } }
      /* there is one main admin (set on the server); nobody can be made an admin from the app */
      save(); return pubUser(u); });
    route("DELETE", "/admin/users/:id", ["admin"], function (req, b, q, p) { var u = find(db.users, p.id); if (!u || u.deleted) E(404, "NOT_FOUND");
      if (u.role === "admin") E(409, "CANNOT_BLOCK_SELF"); if (u.id === req.user.id) E(409, "CANNOT_BLOCK_SELF");
      if (u.role === "restaurant" && !u.staff && find(db.restaurants, u.restaurantId)) E(409, "IS_OWNER");
      if (u.courier && activeOf(u.id)) E(409, "HAS_ACTIVE_ORDER");
      if (u.role === "customer" && db.orders.some(function (o) { return o.customerId === u.id && Rules.ACTIVE.indexOf(o.status) >= 0; })) E(409, "HAS_ACTIVE_ORDER");
      Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].userId === u.id) delete db.sessions[k]; });
      var used = db.orders.some(function (o) { return o.customerId === u.id || o.courierId === u.id; });
      if (!used) { db.users.splice(db.users.indexOf(u), 1); }
      else { u.deleted = true; u.active = false; u.phone = "x" + u.phone + "_" + u.id; u.name = u.name; u.addresses = []; u.favs = []; u.avatar = null; if (u.courier) u.courier.online = false; }
      save(); return true; });
    function newCourier(b, city, restaurantId) { var name = str(b.name, 60), phone = Rules.normPhone(b.phone);
      if (name.length < 2) E(400, "BAD_NAME"); if (!phone) E(400, "BAD_PHONE"); if (db.users.some(function (u) { return u.phone === phone; })) E(409, "PHONE_TAKEN");
      var tmp = newPassword(), u = { id: id("u"), role: "courier", name: name, phone: phone, pass: hashPw(tmp), mustChange: true, active: true, cityId: city.id, createdAt: clock(), lang: "tg",
        courier: { online: false, vehicle: ["scooter", "bike", "car", "foot"].indexOf(b.vehicle) >= 0 ? b.vehicle : "scooter", carNumber: str(b.carNumber, 20).toUpperCase() || null, passport: str(b.passport, 30).toUpperCase() || null, rating: null, ratingCount: 0, lat: city.lat, lng: city.lng, restaurantId: restaurantId || null, restaurantIds: restaurantId ? [restaurantId] : [] } };
      db.users.push(u); return { user: u, login: { phone: phone, password: tmp } }; }
    /* the admin corrects a courier's card: vehicle, car / moto number, passport, town, name */
    route("PATCH", "/admin/couriers/:id", ["admin"], function (req, b, q, p) { var u = find(db.users, p.id); if (!u || !u.courier) E(404, "NOT_FOUND");
      if (b.name != null) { var nm = str(b.name, 60); if (nm.length < 2) E(400, "BAD_NAME"); u.name = nm; }
      if (b.vehicle != null && ["scooter", "bike", "car", "foot"].indexOf(b.vehicle) >= 0) u.courier.vehicle = b.vehicle;
      if (b.carNumber != null) u.courier.carNumber = str(b.carNumber, 20).toUpperCase() || null; if (b.passport != null) u.courier.passport = str(b.passport, 30).toUpperCase() || null;
      if (b.cityId != null) { if (!find(db.cities, b.cityId)) E(400, "BAD_CITY"); u.cityId = b.cityId; }
      /* attach to one restaurant (its own courier) or back to all Тезкор orders */
      if (b.restaurantIds !== undefined) { if (!Array.isArray(b.restaurantIds) || b.restaurantIds.length > 30) E(400, "BAD_RESTAURANT"); b.restaurantIds.forEach(function (x) { if (!find(db.restaurants, x)) E(400, "BAD_RESTAURANT"); }); if (activeOf(u.id)) E(409, "HAS_ACTIVE_ORDER"); setCrests(u, b.restaurantIds); }
      else if (b.restaurantId !== undefined) { if (b.restaurantId && !find(db.restaurants, b.restaurantId)) E(400, "BAD_RESTAURANT"); if (activeOf(u.id)) E(409, "HAS_ACTIVE_ORDER"); setCrests(u, b.restaurantId ? [b.restaurantId] : []); }
      save(); return pubUser(u); });
    route("POST", "/admin/couriers", ["admin"], function (req, b) { var rr = b.restaurantId ? find(db.restaurants, b.restaurantId) : null; if (b.restaurantId && !rr) E(400, "BAD_RESTAURANT");
      /* the same phone again for another place: the courier is added to that place too (no second account) */
      var ph0 = Rules.normPhone(b.phone), ex = ph0 && rr ? db.users.filter(function (u) { return u.phone === ph0 && u.courier && !u.deleted; })[0] : null;
      if (ex) { if (!crests(ex).length) E(409, "PHONE_TAKEN"); if (crests(ex).indexOf(rr.id) < 0) setCrests(ex, crests(ex).concat([rr.id])); save(); return Object.assign(pubUser(ex), { linked: true }); }
      var nc = newCourier(b, rr ? cityOf(rr.cityId) : (find(db.cities, b.cityId) || db.cities[0]), rr ? rr.id : null); save(); return Object.assign(pubUser(nc.user), { login: nc.login }); });
    route("POST", "/admin/users/:id/password", ["admin"], function (req, b, q, p) { var u = find(db.users, p.id); if (!u) E(404, "NOT_FOUND"); if (u.id === req.user.id) E(409, "USE_PROFILE"); if (u.role === "admin") mainOnly(req);
      var tmp = newPassword(); u.pass = hashPw(tmp); u.mustChange = true; u.pwResetAt = null; Object.keys(db.sessions).forEach(function (k) { if (db.sessions[k].userId === u.id) delete db.sessions[k]; });
      db.notifications.forEach(function (n) { if (n.key === "n.pwReset" && n.params && Rules.normPhone(n.params.phone) === u.phone) n.gone = true; }); save();
      return { phone: u.phone, password: tmp }; });
    route("GET", "/admin/categories", ["admin"], function () { return db.categories.map(function (c) { return Object.assign({}, c, { productCount: by(db.products, "categoryId", c.id).length }); }); });
    route("POST", "/admin/categories", ["admin"], function (req, b) { var n = str(b.name, 40); if (n.length < 2) E(400, "BAD_NAME"); var c = { id: id("k"), name: L(n), icon: KINDS.indexOf(b.icon) >= 0 ? b.icon : "plate", sort: db.categories.length + 1, active: true, photo: null }; if (b.photo) c.photo = photoField(b.photo, null, "cat"); db.categories.push(c); save(); return c; });
    route("PATCH", "/admin/categories/:id", ["admin"], function (req, b, q, p) { var c = find(db.categories, p.id); if (!c) E(404, "NOT_FOUND"); if (b.active != null) c.active = !!b.active; if (b.name != null) { var n = str(b.name, 40); if (n.length < 2) E(400, "BAD_NAME"); c.name = L(n); } if (b.icon != null && KINDS.indexOf(b.icon) >= 0) c.icon = b.icon; if (b.photo !== undefined) c.photo = photoField(b.photo, c.photo || null, "cat"); if (b.sort != null) c.sort = int(b.sort); save(); return c; });
    route("DELETE", "/admin/categories/:id", ["admin"], function (req, b, q, p) { if (by(db.products, "categoryId", p.id).length) E(409, "CATEGORY_IN_USE"); var dc = find(db.categories, p.id); if (dc && dc.photo) media.del(dc.photo); db.categories = db.categories.filter(function (c) { return c.id !== p.id; }); save(); return true; });
    route("GET", "/admin/products", ["admin"], function (req, b, q) { return db.products.filter(function (x) { return !q.restaurantId || x.restaurantId === q.restaurantId; }).map(function (x) { var r = find(db.restaurants, x.restaurantId); return Object.assign({}, x, { restaurantName: r ? r.name : null }); }); });
    route("PATCH", "/admin/products/:id", ["admin"], function (req, b, q, p) { var x = find(db.products, p.id); if (!x) E(404, "NOT_FOUND"); Object.assign(x, validProduct(b, true, find(db.restaurants, x.restaurantId))); save(); return x; });
    route("GET", "/admin/promos", ["admin"], function () { return db.promos; });
    route("POST", "/admin/promos", ["admin"], function (req, b) { var code = str(b.code).toUpperCase(), v = int(b.value), mo = int(b.minOrder || 0), mu = int(b.maxUses || 0);
      if (!/^[A-Z0-9]{3,16}$/.test(code)) E(400, "BAD_PROMO_CODE"); if (db.promos.some(function (x) { return x.code === code; })) E(409, "PROMO_EXISTS");
      var type = b.type === "fixed" ? "fixed" : "percent"; if (!(v >= 1 && v <= (type === "percent" ? 90 : 1000))) E(400, "BAD_PROMO_VALUE"); if (!(mo >= 0) || !(mu >= 0)) E(400, "BAD_PROMO_VALUE");
      var x = { id: id("pr"), code: code, type: type, value: v, minOrder: mo, maxUses: mu, uses: 0, active: true, expiresAt: null }; db.promos.unshift(x); save(); return x; });
    route("PATCH", "/admin/promos/:id", ["admin"], function (req, b, q, p) { var x = find(db.promos, p.id); if (!x) E(404, "NOT_FOUND"); if (b.active != null) x.active = !!b.active; save(); return x; });
    route("GET", "/admin/banners", ["admin"], function () { return db.banners.map(function (x) { var r = x.restaurantId && find(db.restaurants, x.restaurantId); return Object.assign({}, x, { restaurantName: r ? r.name : null }); }); });
    /* the admin's own ads (any business): picture or drawing, a link to a restaurant, a phone or a site */
    function adminAd(x, b) {
      if (b.title !== undefined) { var ti = str(b.title, 40); if (ti.length < 2) E(400, "BAD_AD_TITLE"); x.title = L(ti); }
      if (b.sub !== undefined) x.sub = L(str(b.sub, 70));
      if (b.tone !== undefined) x.tone = TONES.indexOf(b.tone) >= 0 ? b.tone : TONES[0];
      if (b.art !== undefined) x.art = KINDS.indexOf(b.art) >= 0 ? b.art : "plov";
      if (b.photo !== undefined) x.photo = photoField(b.photo, x.photo, "ad");
      if (b.link !== undefined) { var lk = b.link || {}; x.restaurantId = null; x.phone = null; x.url = null;
        if (lk.type === "rest") { if (!find(db.restaurants, lk.value)) E(400, "BAD_RESTAURANT"); x.restaurantId = lk.value; }
        else if (lk.type === "phone") { var raw = str(lk.value).replace(/[\s()-]/g, ""), ph = /^\+?\d{6,15}$/.test(raw) ? (/^0/.test(raw) ? raw : Rules.normPhone(raw) || raw) : null; if (!ph) E(400, "BAD_PHONE"); x.phone = ph; }
        else if (lk.type === "url") { var u = str(lk.value, 300); if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(u)) E(400, "BAD_URL"); x.url = u; } }
      if (b.active != null) { x.active = !!b.active; if (x.own) x.blocked = !x.active; }
      x.updatedAt = clock(); return x; }
    route("POST", "/admin/banners", ["admin"], function (req, b) { var x = { id: id("b"), own: false, active: true, blocked: false, photo: null, restaurantId: null, tone: TONES[0], art: "plov", sub: L(""), createdAt: clock() };
      if (!b.title) E(400, "BAD_AD_TITLE"); adminAd(x, b); db.banners.unshift(x); save(); return x; });
    route("PATCH", "/admin/banners/:id", ["admin"], function (req, b, q, p) { var x = find(db.banners, p.id); if (!x) E(404, "NOT_FOUND");
      if (x.own) { if (b.active != null) { x.active = !!b.active; x.blocked = !x.active; } save(); return x; }
      adminAd(x, b); save(); return x; });
    route("DELETE", "/admin/banners/:id", ["admin"], function (req, b, q, p) { var x = find(db.banners, p.id); if (!x) E(404, "NOT_FOUND"); if (x.own) E(409, "AD_OWN");
      if (x.photo) media.del(x.photo); db.banners.splice(db.banners.indexOf(x), 1); save(); return true; });
    route("GET", "/admin/cities", ["admin"], function () { return db.cities.map(function (c) { return Object.assign({}, c, { restaurants: by(db.restaurants, "cityId", c.id).length, couriers: db.users.filter(function (u) { return u.role === "courier" && u.cityId === c.id; }).length }); }); });
    route("POST", "/admin/cities", ["admin"], function (req, b) { var n = str(b.name, 40), la = Number(b.lat), ln = Number(b.lng); if (n.length < 2) E(400, "BAD_NAME");
      if (!(la > 36 && la < 41.5 && ln > 67 && ln < 75.5)) E(400, "BAD_COORDS"); var c = { id: id("c"), name: L(n), lat: la, lng: ln, active: true }; db.cities.push(c); save(); return c; });
    /* the delivery area of a town: points the admin taps on the map (3–200); an empty list goes back to the circle */
    function setZone(o, b) { var pts = Array.isArray(b.zone) ? b.zone : [];
      if (!pts.length) { delete o.zone; save(); return; }
      if (pts.length < 3 || pts.length > 200) E(400, "BAD_ZONE");
      o.zone = pts.map(function (x) { var la = Number(x.lat), ln = Number(x.lng); if (!(isFinite(la) && isFinite(ln) && Math.abs(la) < 90 && Math.abs(ln) < 180) || Rules.distanceKm(o, { lat: la, lng: ln }) > 60) E(400, "BAD_ZONE"); return { lat: Math.round(la * 1e6) / 1e6, lng: Math.round(ln * 1e6) / 1e6 }; });
      save(); }
    route("POST", "/admin/cities/:id/zone", ["admin"], function (req, b, q, p) { var c = find(db.cities, p.id); if (!c) E(404, "NOT_FOUND"); setZone(c, b); return c; });
    /* each restaurant can have its own delivery area: "this kitchen delivers up to here" */
    route("POST", "/admin/restaurants/:id/zone", ["admin"], function (req, b, q, p) { var r = find(db.restaurants, p.id); if (!r) E(404, "NOT_FOUND"); setZone(r, b); return pubRest(r); });
    route("PATCH", "/admin/cities/:id", ["admin"], function (req, b, q, p) { var c = find(db.cities, p.id); if (!c) E(404, "NOT_FOUND"); if (b.active != null) c.active = !!b.active; save(); return c; });
    route("GET", "/admin/payments", ["admin"], function () { return db.payments.slice(0, 120).map(function (x) { var o = find(db.orders, x.orderId); return Object.assign({}, x, { number: o ? o.number : null }); }); });
    /* storage: how much the data takes, the last cleanup, run it now */
    route("GET", "/admin/storage", ["admin"], function () { return { info: opts.storageInfo ? opts.storageInfo() : null, lastCleanup: db.meta.lastCleanup || null, archived: db.meta.archived || null,
      receiptDays: setting("receiptDays"), archiveDays: setting("archiveDays"), orders: db.orders.length }; });
    route("POST", "/admin/cleanup", ["admin"], function () { var r = cleanup(); if (opts.afterCleanup) try { r.media = opts.afterCleanup(db); } catch (e) {} return r; });
    route("GET", "/admin/settings", ["admin"], function () { return Object.assign({ verifyStatus: opts.verifyStatus ? opts.verifyStatus() : null, verifyChannels: vChannels().map(function (c) { return c.id; }), verifyActive: verifyRequired(),  subFee: setting("subFee"), trialDays: setting("trialDays"), handoffMin: setting("handoffMin"), receiptDays: setting("receiptDays"), archiveDays: setting("archiveDays") }, db.settings); });
    route("PATCH", "/admin/settings", ["admin"], function (req, b) { var s = db.settings, keys = ["deliveryBase", "deliveryPerKm", "deliveryMin", "courierPct", "zoneKm", "subFee", "trialDays", "handoffMin", "receiptDays", "archiveDays"];
      if (b.payCash != null) s.payCash = !!b.payCash; if (b.payTransfer != null) s.payTransfer = !!b.payTransfer; if (b.verifyRequired != null) s.verifyRequired = !!b.verifyRequired;
      if (s.payCash === false && s.payTransfer === false && !cardOn()) E(400, "NO_PAY_METHOD");
      var next = {}; keys.forEach(function (k) { var v = b[k] == null ? (s[k] == null ? setting(k) : s[k]) : int(b[k]); if (!(v >= (k === "zoneKm" || k === "handoffMin" ? 1 : k === "receiptDays" ? 7 : k === "archiveDays" ? 30 : 0) && v <= (k === "courierPct" ? 100 : k === "zoneKm" ? 30 : k === "subFee" ? 100000 : k === "trialDays" ? 365 : k === "handoffMin" ? 60 : k === "receiptDays" ? 3650 : k === "archiveDays" ? 3650 : 500))) E(400, "BAD_SETTINGS", { field: k }); next[k] = v; });
      if (b.supportPhone != null) { if (!Rules.normPhone(b.supportPhone)) E(400, "BAD_PHONE"); next.supportPhone = Rules.fmtPhone(Rules.normPhone(b.supportPhone)); }
      Object.assign(s, next); save(); return s; });
    /* ---------- Tezkor services: one account, many services. Only the ones with a ready module can be switched on;
       the admin switches them on and off himself, the apps read the switches from /settings/public ---------- */
    var SERVICES = [["food", true], ["taxi"], ["shops", true], ["ads", true], ["masters", true], ["jobs", true], ["grocery"], ["pharmacy"], ["realty", true]];
    function svcMap() { var s = db.settings.services || {}, o = {}; SERVICES.forEach(function (x) { o[x[0]] = x[0] === "food" ? s.food !== false : !!(x[1] && s[x[0]]); }); return o; }
    function svcOn(k) { return !!svcMap()[k]; }
    function needSvc(k, req) { if (!svcOn(k) && !(req && req.user && req.user.role === "admin")) E(403, "SERVICE_OFF", { service: k }); }
    route("GET", "/admin/services", ["admin"], function () { var m = svcMap(), ph = db.settings.svcPhotos || {}; return SERVICES.map(function (x) { return { key: x[0], ready: !!x[1], on: m[x[0]], core: x[0] === "food", photo: ph[x[0]] || null, count: svcCount(x[0]) }; }); });
    /* the admin's own photo for a service tile (a real taxi, a real shop…) */
    route("POST", "/admin/services/:key/photo", ["admin"], function (req, b, q, p) { if (!SERVICES.some(function (s) { return s[0] === p.key; })) E(404, "NOT_FOUND");
      var ph = db.settings.svcPhotos = db.settings.svcPhotos || {}; ph[p.key] = photoField(b.photo, ph[p.key] || null, "sv"); if (!ph[p.key]) delete ph[p.key]; save(); return ph; });
    route("PATCH", "/admin/services/:key", ["admin"], function (req, b, q, p) { var x = SERVICES.filter(function (s) { return s[0] === p.key; })[0]; if (!x) E(404, "NOT_FOUND");
      if (x[0] === "food") E(409, "SERVICE_CORE"); if (!x[1] && b.on) E(409, "SERVICE_NOT_READY");
      db.settings.services = db.settings.services || {}; db.settings.services[x[0]] = !!b.on; save(); return svcMap(); });

    /* ---------- classifieds (эълонҳо) ----------
       draft → pending (the admin checks) → active (30 days) → archived; the admin may reject (with a reason) or block.
       Free at launch: no prices are shown anywhere. The admin turns on «paid» later with one switch: then a placement fee
       and promotions (top / colour / VIP) appear. Money is never taken here — the customer pays the admin,
       the admin confirms the payment in his panel, only then the ad or promotion goes live. */
    var AD_CATS = ["auto", "realty", "phones", "electronics", "furniture", "clothes", "jobs", "services", "other"];
    /* the same listing engine runs four services: classifieds, pros & services, jobs, real estate — each with its own categories */
    var LIST_SVC = { ads: AD_CATS, masters: ["m_repair", "m_plumb", "m_electric", "m_clean", "m_beauty", "m_auto", "m_tutor", "m_move", "m_it", "m_other"],
      jobs: ["j_sales", "j_food", "j_driver", "j_build", "j_office", "j_it", "j_edu", "j_med", "j_other"], realty: ["r_flatsale", "r_flatrent", "r_housesale", "r_houserent", "r_land", "r_commerce", "r_other"] };
    function svcOfAd(a) { return a.svc || "ads"; }
    function listSvc(v) { return LIST_SVC[v] ? v : "ads"; }
    var AD_ST = ["draft", "pending", "active", "rejected", "archived", "blocked"], DAY_MS = 86400000;
    function adCfg() { var a = db.settings.ads || {}; return { paid: !!a.paid, moderation: a.moderation !== false, days: a.days || 30, fee: a.fee || 0, top: a.top == null ? 5 : a.top, color: a.color == null ? 10 : a.color, vip: a.vip == null ? 20 : a.vip }; }
    function adList() { return db.ads || (db.ads = []); }
    function adPays() { return db.adPays || (db.adPays = []); }
    function adSweep() { var t = clock(), ch = false; adList().forEach(function (a) { if (a.status === "active" && a.until && a.until < t) { a.status = "archived"; a.archivedAt = t; ch = true; } }); if (ch) save(); }
    function adRank(a) { var t = clock(); return (a.vipUntil > t ? 2e13 : 0) + Math.max(a.bumpAt && a.topUntil > t ? a.bumpAt : 0, a.bumpedAt || 0, a.publishedAt || a.createdAt); }
    function pubAd(a, viewer) { var c = cityOf(a.cityId), u = find(db.users, a.userId), t = clock(), own = viewer && (viewer.id === a.userId || viewer.role === "admin");
      var o = { id: a.id, svc: svcOfAd(a), cat: a.cat, title: a.title, desc: a.desc, price: a.price, cityId: a.cityId, city: c ? c.name : null, phone: a.phone, photos: a.photos || [], status: a.status, views: a.views || 0, cond: a.cond || null, addr: a.addr || "", lat: a.lat == null ? null : a.lat, lng: a.lng == null ? null : a.lng, sold: !!a.sold, bumpedAt: a.bumpedAt || null, userKey: a.userId ? a.userId.slice(-6) : null,
        createdAt: a.createdAt, publishedAt: a.publishedAt || null, until: a.until || null, seller: u ? u.name : "", vip: a.vipUntil > t, color: a.colorUntil > t, top: a.topUntil > t };
      if (own) { o.reason = a.reason || null; o.mine = viewer.id === a.userId; o.updatedAt = a.updatedAt; var pp = adPays().filter(function (x) { return x.adId === a.id && x.status === "awaiting"; }); if (pp.length) o.awaiting = pp.map(function (x) { return { id: x.id, kind: x.kind, amount: x.amount }; });
        if (viewer.role === "admin") { o.userId = a.userId; o.userPhone = u ? u.phone : null; o.feeDue = !!a.feeDue; } }
      return o; }
    function adOf(req, id) { var a = find(adList(), id); if (!a || (a.userId !== req.user.id && req.user.role !== "admin")) E(404, "NOT_FOUND"); return a; }
    function adPhotos(v, cur) { if (!Array.isArray(v)) E(400, "BAD_PHOTOS"); if (v.length > 10) E(400, "TOO_MANY_PHOTOS");
      var keep = (cur || []).filter(function (u) { return v.indexOf(u) >= 0; }); (cur || []).forEach(function (u) { if (keep.indexOf(u) < 0) media.del(u); });
      return v.map(function (x) { return (cur || []).indexOf(x) >= 0 ? x : image(x, "ad"); }); }
    function adFields(a, b) {
      if (b.cat !== undefined) { if (LIST_SVC[svcOfAd(a)].indexOf(b.cat) < 0) E(400, "BAD_AD_CAT"); a.cat = b.cat; }
      if (b.title !== undefined) { var ti = str(b.title, 80); if (ti.length < 3) E(400, "BAD_AD_TITLE"); a.title = ti; }
      if (b.desc !== undefined) a.desc = str(b.desc, 3000);
      if (b.price !== undefined) { var pr = b.price === "" || b.price == null ? null : Number(b.price); if (pr != null && !(pr >= 0 && pr <= 1e8)) E(400, "BAD_PRICE"); a.price = pr == null ? null : Math.round(pr); }
      if (b.cityId !== undefined) { if (!find(db.cities, b.cityId)) E(400, "BAD_CITY"); a.cityId = b.cityId; }
      if (b.phone !== undefined) { var ph = Rules.normPhone(b.phone); if (!ph) E(400, "BAD_PHONE"); a.phone = ph; }
      if (b.addr !== undefined) a.addr = str(b.addr, 140);
      if (b.lat !== undefined || b.lng !== undefined) { var la = b.lat == null || b.lat === "" ? null : Number(b.lat), lo = b.lng == null || b.lng === "" ? null : Number(b.lng);
        if (la == null || lo == null) { a.lat = null; a.lng = null; } else { if (!(la >= -90 && la <= 90 && lo >= -180 && lo <= 180)) E(400, "BAD_PIN"); a.lat = Math.round(la * 1e6) / 1e6; a.lng = Math.round(lo * 1e6) / 1e6; } }
      if (b.cond !== undefined) { if (["", "new", "used"].indexOf(b.cond || "") < 0) E(400, "BAD_COND"); a.cond = b.cond || null; }
      if (b.photos !== undefined) a.photos = adPhotos(b.photos, a.photos); }
    /* send to the admin (or straight live when the admin switched checking off) */
    function adSubmit(a) { var cfg = adCfg(), t = clock(); a.reason = null;
      if (cfg.paid && cfg.fee > 0 && !a.feePaid && !adPays().some(function (x) { return x.adId === a.id && x.kind === "place" && x.status === "awaiting"; })) {
        a.feeDue = true; adPays().unshift({ id: id("ap"), adId: a.id, userId: a.userId, kind: "place", amount: cfg.fee, status: "awaiting", at: t }); }
      if (!cfg.moderation && !a.feeDue) { a.status = "active"; a.publishedAt = t; a.until = t + cfg.days * DAY_MS; }
      else { a.status = "pending"; notify("admins", "n.adNew", { title: a.title }); } }
    route("GET", "/ads", null, function (req, b, q) { var sv = listSvc(q.svc); needSvc(sv, req); adSweep(); var s = str(q.q, 60).toLowerCase();
      var l = adList().filter(function (a) { return a.status === "active" && svcOfAd(a) === sv && (!q.cat || a.cat === q.cat) && (!q.cityId || a.cityId === q.cityId) && (!s || (a.title + " " + a.desc).toLowerCase().indexOf(s) >= 0); });
      l.sort(q.sort === "cheap" ? function (x, y) { return (x.price == null ? 1e9 : x.price) - (y.price == null ? 1e9 : y.price); } : q.sort === "dear" ? function (x, y) { return (y.price || 0) - (x.price || 0); } : function (x, y) { return adRank(y) - adRank(x); });
      return l.slice(0, 200).map(function (a) { return pubAd(a, req.user); }); });
    route("GET", "/ads/my", ["customer"], function (req, b, q) { adSweep(); return adList().filter(function (a) { return a.userId === req.user.id && (!q.svc || svcOfAd(a) === q.svc); }).sort(function (x, y) { return (y.updatedAt || y.createdAt) - (x.updatedAt || x.createdAt); }).map(function (a) { return pubAd(a, req.user); }); });
    /* browse with filters, price range, sort and pages — and how many listings each category has */
    route("GET", "/ads/search", null, function (req, b, q) { var sv = listSvc(q.svc); needSvc(sv, req); adSweep(); var s = str(q.q, 60).toLowerCase();
      var base = adList().filter(function (a) { return a.status === "active" && svcOfAd(a) === sv && (!q.cityId || a.cityId === q.cityId) && (!s || (a.title + " " + a.desc).toLowerCase().indexOf(s) >= 0); });
      var counts = {}; base.forEach(function (a) { counts[a.cat] = (counts[a.cat] || 0) + 1; });
      var pmin = q.priceMin != null && q.priceMin !== "" ? Number(q.priceMin) : null, pmax = q.priceMax != null && q.priceMax !== "" ? Number(q.priceMax) : null;
      var l = base.filter(function (a) { return (!q.cat || a.cat === q.cat) && (!q.cond || a.cond === q.cond) && (!q.photo || (a.photos || []).length) && (pmin == null || (a.price != null && a.price >= pmin)) && (pmax == null || (a.price != null && a.price <= pmax)); });
      l.sort(q.sort === "cheap" ? function (x, y) { return (x.price == null ? 1e9 : x.price) - (y.price == null ? 1e9 : y.price); } : q.sort === "dear" ? function (x, y) { return (y.price || 0) - (x.price || 0); } : q.sort === "new" ? function (x, y) { return (y.publishedAt || y.createdAt) - (x.publishedAt || x.createdAt); } : function (x, y) { return adRank(y) - adRank(x); });
      var off = Math.max(0, int(q.offset || 0)), lim = Math.min(50, Math.max(1, int(q.limit || 20)));
      return { total: l.length, all: base.length, counts: counts, list: l.slice(off, off + lim).map(function (a) { return pubAd(a, req.user); }) }; });
    route("GET", "/ads/:id/more", null, function (req, b, q, p) { adSweep(); var a = find(adList(), p.id); if (!a || a.status !== "active") E(404, "NOT_FOUND"); var sv = svcOfAd(a);
      var rk = function (x, y) { return adRank(y) - adRank(x); }, u = find(db.users, a.userId);
      var mine = adList().filter(function (x) { return x.userId === a.userId && x.id !== a.id && x.status === "active"; });
      return { seller: mine.filter(function (x) { return svcOfAd(x) === sv; }).sort(rk).slice(0, 8).map(function (x) { return pubAd(x, req.user); }),
        similar: adList().filter(function (x) { return x.status === "active" && svcOfAd(x) === sv && x.cat === a.cat && x.userId !== a.userId && x.cityId === a.cityId; }).sort(rk).slice(0, 8).map(function (x) { return pubAd(x, req.user); }),
        sellerInfo: { name: u ? u.name : "", since: u ? u.createdAt : null, active: mine.length + 1, verified: !!(u && u.phoneVerified) } }; });
    /* lift my listing to the top once a day (free); mark it sold */
    route("POST", "/ads/:id/bump", ["customer"], function (req, b, q, p) { var a = adOf(req, p.id), t = clock(); if (a.status !== "active") E(409, "BAD_STATUS");
      if (a.bumpedAt && t - a.bumpedAt < DAY_MS) E(429, "BUMP_WAIT", { hours: Math.ceil((DAY_MS - (t - a.bumpedAt)) / 3600000) }); a.bumpedAt = t; a.updatedAt = t; save(); return pubAd(a, req.user); });
    route("POST", "/ads/:id/sold", ["customer"], function (req, b, q, p) { var a = adOf(req, p.id); if (a.status !== "active") E(409, "BAD_STATUS"); a.sold = true; a.status = "archived"; a.archivedAt = clock(); a.updatedAt = clock(); save(); return pubAd(a, req.user); });
    /* «report»: three different people → the listing goes back to the admin's queue; the admin decides */
    route("POST", "/ads/:id/report", ["customer"], function (req, b, q, p) { var a = find(adList(), p.id); if (!a || a.status !== "active") E(404, "NOT_FOUND"); if (a.userId === req.user.id) E(409, "OWN_AD");
      var why = ["spam", "fraud", "wrong", "sold", "other"].indexOf(b.reason) >= 0 ? b.reason : "other"; db.complaints = db.complaints || [];
      if (db.complaints.some(function (x) { return x.adId === a.id && x.userId === req.user.id; })) E(409, "ALREADY_REPORTED");
      var c = { id: id("cp"), adId: a.id, userId: req.user.id, reason: why, text: str(b.text, 300), status: "new", at: clock() }; db.complaints.unshift(c);
      var n = db.complaints.filter(function (x) { return x.adId === a.id && x.status === "new"; }).length; notify("admins", "n.adReport", { title: a.title });
      if (n >= 3) { a.status = "pending"; a.reason = null; a.updatedAt = clock(); }
      save(); return { ok: true }; });
    route("GET", "/admin/complaints", ["admin"], function (req, b, q) { var l = (db.complaints || []).filter(function (c) { return !q.status || c.status === q.status; });
      return { new: (db.complaints || []).filter(function (c) { return c.status === "new"; }).length, list: l.slice(0, 200).map(function (c) { var a = find(adList(), c.adId), u = find(db.users, c.userId), s = a && find(db.users, a.userId);
        return { id: c.id, adId: c.adId, title: a ? a.title : "—", adStatus: a ? a.status : "deleted", svc: a ? svcOfAd(a) : null, reason: c.reason, text: c.text, status: c.status, at: c.at, from: u ? u.name : "—", fromPhone: u ? u.phone : "", seller: s ? s.name : "", sellerPhone: s ? s.phone : "" }; }) }; });
    route("POST", "/admin/complaints/:id", ["admin"], function (req, b, q, p) { var c = find(db.complaints || [], p.id); if (!c) E(404, "NOT_FOUND"); var a = find(adList(), c.adId), t = clock();
      if (b.action === "block") { if (a) { a.status = "blocked"; a.reason = str(b.reason, 300) || "Шикоят тасдиқ шуд"; a.updatedAt = t; notify("u:" + a.userId, "n.adBlocked", { title: a.title, reason: a.reason }); } (db.complaints || []).forEach(function (x) { if (x.adId === c.adId) { x.status = "done"; x.by = req.user.id; x.doneAt = t; } }); }
      else if (b.action === "dismiss") { (db.complaints || []).forEach(function (x) { if (x.adId === c.adId && x.status === "new") { x.status = "dismissed"; x.by = req.user.id; x.doneAt = t; } }); if (a && a.status === "pending" && !a.feeDue) { a.status = "active"; a.updatedAt = t; } }
      else E(400, "BAD_ACTION"); save(); return true; });
    route("POST", "/admin/ads/approve-all", ["admin"], function (req, b) { var t = clock(), cfg = adCfg(), n = 0;
      adList().forEach(function (a) { if (a.status === "pending" && !a.feeDue && (!b.svc || svcOfAd(a) === b.svc)) { a.status = "active"; a.reason = null; if (!a.publishedAt || a.until == null || a.until < t) { a.publishedAt = t; a.until = t + cfg.days * DAY_MS; } a.checkedBy = req.user.id; a.updatedAt = t; notify("u:" + a.userId, "n.adOk", { title: a.title }); n++; } });
      save(); return { n: n }; });
    route("GET", "/ads/config", null, function () { var c = adCfg(); return c.paid ? c : { paid: false, days: c.days, moderation: c.moderation }; });
    route("GET", "/ads/:id", null, function (req, b, q, p) { adSweep(); var a = find(adList(), p.id), me = req.user;
      if (!a || (a.status !== "active" && !(me && (me.id === a.userId || me.role === "admin")))) E(404, "NOT_FOUND");
      if (a.status === "active") needSvc(svcOfAd(a), req); if (!me || me.id !== a.userId) { a.views = (a.views || 0) + 1; save(); } return pubAd(a, me); });
    route("POST", "/ads", ["customer"], function (req, b) { var sv = listSvc(b.svc); needSvc(sv, req); var u = req.user, t = clock();
      if (adList().filter(function (a) { return a.userId === u.id && a.status !== "archived"; }).length >= 50) E(409, "AD_LIMIT");
      if (adList().filter(function (a) { return a.userId === u.id && t - a.createdAt < DAY_MS; }).length >= 10) E(429, "AD_DAY_LIMIT");
      if (b.cat !== undefined && LIST_SVC[sv].indexOf(b.cat) < 0) E(400, "BAD_AD_CAT");
      var a = { id: id("ad"), svc: sv, userId: u.id, cat: LIST_SVC[sv][LIST_SVC[sv].length - 1], title: "", desc: "", price: null, cityId: u.cityId || db.settings.defaultCityId, phone: u.phone, photos: [], status: "draft", views: 0, createdAt: t, updatedAt: t };
      adFields(a, Object.assign({ cat: b.cat, title: b.title }, b)); if (!a.title) E(400, "BAD_AD_TITLE");
      var ttl = String(a.title || "").toLowerCase(); if (ttl && adList().some(function (a) { return a.userId === u.id && a.title.toLowerCase() === ttl && ["pending", "active", "draft"].indexOf(a.status) >= 0 && t - a.createdAt < 7 * DAY_MS; })) E(409, "AD_DUP");
      adList().unshift(a); if (!b.draft) adSubmit(a); save(); return pubAd(a, u); });
    route("PATCH", "/ads/:id", ["customer"], function (req, b, q, p) { var a = adOf(req, p.id); if (a.status === "blocked") E(409, "AD_BLOCKED");
      adFields(a, b); a.updatedAt = clock();
      /* a changed live ad is checked again; a draft stays a draft until it is sent */
      if (!b.draft && a.status !== "draft" && a.status !== "archived") { if (a.status !== "pending") adSubmit(a); }
      else if (!b.draft && a.status === "draft") adSubmit(a);
      save(); return pubAd(a, req.user); });
    route("POST", "/ads/:id/archive", ["customer"], function (req, b, q, p) { var a = adOf(req, p.id); if (a.status === "blocked") E(409, "AD_BLOCKED"); a.status = "archived"; a.archivedAt = clock(); a.updatedAt = clock(); save(); return pubAd(a, req.user); });
    route("POST", "/ads/:id/restore", ["customer"], function (req, b, q, p) { var a = adOf(req, p.id); needSvc(svcOfAd(a), req); if (a.status !== "archived") E(409, "BAD_STATUS"); a.updatedAt = clock(); a.until = null; adSubmit(a); save(); return pubAd(a, req.user); });
    route("DELETE", "/ads/:id", ["customer"], function (req, b, q, p) { var a = adOf(req, p.id); (a.photos || []).forEach(function (u) { media.del(u); });
      db.ads = adList().filter(function (x) { return x !== a; }); db.adPays = adPays().filter(function (x) { return x.adId !== a.id || x.status !== "awaiting"; }); save(); return true; });
    /* promotion — only when the admin switched paid ads on; waits for the admin to confirm the payment */
    route("POST", "/ads/:id/promote", ["customer"], function (req, b, q, p) { var a = adOf(req, p.id), cfg = adCfg(); if (!cfg.paid) E(409, "ADS_FREE");
      if (["top", "color", "vip"].indexOf(b.kind) < 0) E(400, "BAD_KIND"); if (["active", "pending"].indexOf(a.status) < 0) E(409, "BAD_STATUS");
      if (adPays().some(function (x) { return x.adId === a.id && x.kind === b.kind && x.status === "awaiting"; })) E(409, "ALREADY_ASKED");
      var x = { id: id("ap"), adId: a.id, userId: req.user.id, kind: b.kind, amount: cfg[b.kind], status: "awaiting", at: clock() }; adPays().unshift(x);
      notify("admins", "n.adPay", { title: a.title, sum: x.amount }); save(); return x; });
    /* admin: check, block, confirm payments, settings */
    route("GET", "/admin/ads", ["admin"], function (req, b, q) { adSweep(); var s = str(q.q, 60).toLowerCase(), all = adList().filter(function (a) { return !q.svc || svcOfAd(a) === q.svc; }), cnt = { all: all.length };
      AD_ST.forEach(function (k) { cnt[k] = 0; }); all.forEach(function (a) { cnt[a.status]++; });
      var l = all.filter(function (a) { return (!q.status || a.status === q.status) && (!q.cat || a.cat === q.cat) && (!q.cityId || a.cityId === q.cityId) && (!s || (a.title + " " + a.desc + " " + a.phone).toLowerCase().indexOf(s) >= 0); });
      l.sort(function (x, y) { return (y.status === "pending") - (x.status === "pending") || (y.updatedAt || y.createdAt) - (x.updatedAt || x.createdAt); });
      return { counts: cnt, list: l.slice(0, 300).map(function (a) { return pubAd(a, req.user); }), pays: adPays().filter(function (x) { return x.status === "awaiting"; }).map(function (x) { var a = find(adList(), x.adId), u = find(db.users, x.userId); return Object.assign({}, x, { title: a ? a.title : "", userName: u ? u.name : "", userPhone: u ? u.phone : "" }); }) }; });
    route("POST", "/admin/ads/:id/status", ["admin"], function (req, b, q, p) { var a = find(adList(), p.id), t = clock(), cfg = adCfg(); if (!a) E(404, "NOT_FOUND");
      var st = b.status; if (["active", "rejected", "blocked", "archived"].indexOf(st) < 0) E(400, "BAD_STATUS");
      if (st === "active") { if (a.feeDue && !b.paid) E(409, "AD_UNPAID"); if (a.feeDue) payDone(adPays().filter(function (x) { return x.adId === a.id && x.kind === "place" && x.status === "awaiting"; })[0], req);
        a.status = "active"; a.reason = null; if (!a.publishedAt || a.until == null || a.until < t) { a.publishedAt = t; a.until = t + cfg.days * DAY_MS; } notify("u:" + a.userId, "n.adOk", { title: a.title }); }
      else { var why = str(b.reason, 300); if (st !== "archived" && why.length < 3) E(400, "REASON_REQUIRED"); a.status = st; a.reason = why || null; if (st !== "archived") notify("u:" + a.userId, st === "blocked" ? "n.adBlocked" : "n.adNo", { title: a.title, reason: why }); }
      a.updatedAt = t; a.checkedBy = req.user.id; save(); return pubAd(a, req.user); });
    route("DELETE", "/admin/ads/:id", ["admin"], function (req, b, q, p) { var a = find(adList(), p.id); if (!a) E(404, "NOT_FOUND"); (a.photos || []).forEach(function (u) { media.del(u); }); db.ads = adList().filter(function (x) { return x !== a; }); save(); return true; });
    function payDone(x, req) { if (!x) return; var a = find(adList(), x.adId), t = clock(); x.status = "paid"; x.paidAt = t; x.by = req.user.id; if (!a) return;
      if (x.kind === "place") { a.feeDue = false; a.feePaid = true; }
      if (x.kind === "top") { a.bumpAt = t; a.topUntil = t + 7 * DAY_MS; } if (x.kind === "color") a.colorUntil = t + 7 * DAY_MS; if (x.kind === "vip") a.vipUntil = t + 7 * DAY_MS;
      notify("u:" + x.userId, "n.adPaid", { title: a.title }); }
    route("POST", "/admin/ad-pays/:id", ["admin"], function (req, b, q, p) { var x = find(adPays(), p.id); if (!x || x.status !== "awaiting") E(404, "NOT_FOUND");
      if (b.ok === false) { x.status = "declined"; x.by = req.user.id; var a0 = find(adList(), x.adId); if (a0 && x.kind === "place") a0.feeDue = true; } else payDone(x, req); save(); return x; });
    route("GET", "/admin/ads-settings", ["admin"], function () { return adCfg(); });
    route("PATCH", "/admin/ads-settings", ["admin"], function (req, b) { var a = db.settings.ads = Object.assign({}, adCfg());
      if (b.paid != null) a.paid = !!b.paid; if (b.moderation != null) a.moderation = !!b.moderation;
      ["fee", "top", "color", "vip", "days"].forEach(function (k) { if (b[k] == null) return; var v = int(b[k]); if (!(v >= (k === "days" ? 1 : 0) && v <= (k === "days" ? 365 : 100000))) E(400, "BAD_SETTINGS", { field: k }); a[k] = v; });
      save(); return adCfg(); });
    route("POST", "/admin/reset-demo", ["admin"], function () { if (PROD) E(404, "NOT_FOUND"); var keep = db.sessions; db = Seed.build(clock()); db.sessions = keep; save(); return true; });

    function luhn(n) { if (!/^\d{12,19}$/.test(n)) return false; var s = 0, alt = false; for (var i = n.length - 1; i >= 0; i--) { var d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return s % 10 === 0; }

    /* ---------- dispatcher ---------- */
    function handle(method, url, body, token) {
      var parts = String(url).split("?"), path = parts[0], query = {};
      (parts[1] || "").split("&").forEach(function (kv) { if (!kv) return; var i = kv.indexOf("="); query[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? "" : decodeURIComponent(kv.slice(i + 1)); });
      try {
        for (var i = 0; i < routes.length; i++) {
          var rt = routes[i]; if (rt.method !== method) continue; var m = path.match(rt.re); if (!m) continue;
          var params = {}; rt.keys.forEach(function (k, j) { params[k] = decodeURIComponent(m[j + 1]); });
          var req = { token: token, user: null };
          if (token && db.sessions[token]) { var u = find(db.users, db.sessions[token].userId); if (u && u.active) { req.user = u; if (u.staff) u.lastSeenAt = clock(); } }
          tick();
          if (rt.roles) { if (!req.user) E(401, "UNAUTHORIZED"); if (rt.roles !== "*" && rt.roles.indexOf(req.user.role) < 0) E(403, "FORBIDDEN"); }
          var data = rt.fn(req, body || {}, query, params);
          return { status: 200, body: { ok: true, data: JSON.parse(JSON.stringify(data)) } };
        }
        return { status: 404, body: { ok: false, error: { code: "NO_ROUTE" } } };
      } catch (e) {
        if (e instanceof ApiError) return { status: e.status, body: { ok: false, error: Object.assign({ code: e.code }, e.extra) } };
        if (typeof console !== "undefined") console.error(e);
        return { status: 500, body: { ok: false, error: { code: "SERVER_ERROR" } } };
      }
    }
    return { tick: tick, handle: handle, inbound: inbound, cleanup: cleanup, version: function () { return db.meta.version; }, reload: function () { var d = store.load(); if (d) db = d; }, _db: function () { return db; } };
  }
  var KINDS = ["plov", "qurutob", "lagman", "mantu", "soup", "tea", "burger", "fries", "drink", "pizza", "salad", "juice", "shashlik", "kebab", "bread", "samsa", "dessert", "cake", "icecream", "coffee", "shawarma", "ayran", "sushi", "grocery", "box", "plate"];
  return { createServer: createServer, KINDS: KINDS };
});
