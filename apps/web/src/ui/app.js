/* SOMON FOOD — boot, global events, live updates */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon;
  var cfg = window.SOMON_CONFIG || {};
  var store = { load: function () { return SF.ls.get("db", null); }, save: function (db) { SF.ls.set("db", db); } };
  var server = cfg.api ? null : SomonServer.createServer({ store: store });
  SF.server = server;
  SF.api = SomonClient.createClient(cfg.api ? { transport: "http", baseUrl: cfg.api } : { transport: "local", server: server });

  SF.state.lang = SF.ls.get("lang", null) || "ru";   // Russian first: everyone understands it; Тоҷикӣ and English are one tap away   // Tajik by default; English only when chosen
  SF.state.cart = SF.ls.get("cart", { restaurantId: null, items: {} });
  SF.state.notes = []; SF.state.seen = {};
  document.documentElement.lang = SF.state.lang === "tg" ? "tg" : SF.state.lang;

  /* ---------- global events ---------- */
  function busy(el, on) { if (!el) return; el.classList.toggle("busy", on); if (el.tagName === "BUTTON") el.disabled = on; }
  function run(p, el) { if (!p || !p.then) return; busy(el, true); p.catch(function (e) { SF.toast(SF.err(e), "err"); }).then(function () { busy(el, false); }); }
  document.addEventListener("click", function (e) {
    var go = e.target.closest("[data-go]"); if (go) { e.preventDefault(); SF.go(go.dataset.go); return; }
    var a = e.target.closest("[data-act]"); if (!a || a.disabled) return;
    var fn = SF.actions[a.dataset.act]; if (!fn) return; e.preventDefault(); run(fn(a, e), a.tagName === "BUTTON" ? a : null);
  });
  document.addEventListener("submit", function (e) {
    var f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
    var fd = {}; new FormData(f).forEach(function (v, k) { fd[k] = typeof v === "string" ? v.trim() : v; });
    f.querySelectorAll("input[type=checkbox]").forEach(function (c) { fd[c.name] = c.checked; });
    var fn = SF.forms[f.dataset.form]; if (fn) run(fn(fd, f), f.querySelector("button:not([type=button])"));
  });
  function onInput(e) { var el = e.target, k = el.dataset && el.dataset.input; if (k && SF.inputs[k]) SF.inputs[k](el.value, el, e); }
  document.addEventListener("input", function (e) { if (e.target.tagName !== "SELECT") onInput(e); });
  document.addEventListener("change", function (e) { if (e.target.tagName === "SELECT") onInput(e); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !document.getElementById("modal").hidden) SF.closeModal(); });
  window.addEventListener("hashchange", function () { SF.state.drawer = false; SF.closeModal(); SF.render(); });
  window.addEventListener("storage", function (e) { if (e.key === "somon.db" && server) { server.reload(); refresh(); } });

  SF.forms.search = function (fd) { SF.state.q = fd.q || ""; if (SF.addRecent) SF.addRecent(fd.q); SF.go("/search?q=" + encodeURIComponent(fd.q || "")); };
  SF.inputs.lang = function (v) { SF.state.lang = v; SF.ls.set("lang", v); document.documentElement.lang = v; if (SF.state.user) SF.api.patch("/auth/me", { lang: v }).catch(function () {}); SF.render({ quiet: true }); };
  SF.actions.drawer = function () { SF.state.drawer = !SF.state.drawer; var p = document.querySelector(".panel"); if (p) p.classList.toggle("open", SF.state.drawer); };
  /* where I am looking: the whole town (everything in it) or one village of it */
  SF.areaQ = function () { return ""; };   // no villages: lists are never narrowed by place
  SF.actions.city = function () {
    var ar = (SF.state.areas || []).filter(function (x) { return x.cityId === SF.state.cityId; }), cur = SF.areaQ() ? SF.state.areaId : "";
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><h2 class="h2">' + t("profile.city") + '</h2><div class="citylist">' + SF.state.cities.map(function (c) {
      return '<button class="cityopt' + (c.id === SF.state.cityId && !cur ? " on" : "") + '" data-act="setcity" data-id="' + c.id + '">' + I("pin", 18) + "<b>" + esc(SF.tx(c.name)) + (c.id === SF.state.cityId && ar.length ? ' <small class="muted">· ' + t("ar.all") + "</small>" : "") + "</b>" + (c.id === SF.state.cityId && !cur ? I("check", 18) : "") + "</button>" +
        (c.id === SF.state.cityId ? ar.map(function (x) { return '<button class="cityopt sub' + (x.id === cur ? " on" : "") + '" data-act="setarea" data-id="' + x.id + '"><b>' + esc(SF.tx(x.name)) + "</b>" + (x.id === cur ? I("check", 18) : "") + "</button>"; }).join("") : ""); }).join("") + "</div>" + (ar.length ? '<p class="fine">' + t("ar.pickHint") + "</p>" : ""));
  };
  SF.actions.setarea = function (el) { SF.state.areaId = el.dataset.id; SF.ls.set("area", el.dataset.id); SF.closeModal(); SF.go("/"); };
  SF.actions.setcity = function (el) { SF.state.areaId = ""; SF.ls.set("area", ""); SF.state.cityId = el.dataset.id; SF.ls.set("city", el.dataset.id); SF.closeModal(); if (SF.state.user && SF.state.user.role === "customer") SF.api.patch("/auth/me", { cityId: el.dataset.id }).catch(function () {}); SF.go("/"); };
  SF.actions.notes = function () {
    var list = SF.state.notes || [];
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><h2 class="h2">' + t("n.title") + "</h2>" + (list.length ? '<div class="nlist">' + list.map(function (n) {
      return '<button class="nitem" data-act="noteopen" data-id="' + n.id + '" data-o="' + (n.orderId || "") + '" data-k="' + esc(n.key) + '" data-ph="' + esc(String((n.params || {}).phone || "").replace(/\D/g, "").slice(-9)) + '"><span class="nic">' + I(noteIcon(n.key), 18) + '</span><span class="grow"><b>' + t(n.key + ".t") + "</b><span>" + esc(t(n.key, n.params)) + '</span></span><small class="muted num">' + SF.time(n.at) + "</small></button>"; }).join("") + '</div><button class="btn ghost block" data-act="notesread">' + t("n.readAll") + "</button>" : SF.empty("bell", t("n.none"))));
  };
  function noteIcon(k) { return { "n.adNew": "megaphone", "n.adPay": "wallet", "n.adOk": "check", "n.adNo": "info", "n.adBlocked": "x", "n.adPaid": "wallet", "n.newOrder": "bell", "n.waiter": "bell", "n.bill": "receipt", "n.accepted": "fire", "n.courierNew": "box", "n.ready": "bag", "n.readyCustomer": "bag", "n.onTheWay": "scooter", "n.delivered": "check", "n.rejected": "x", "n.cancelled": "x", "n.customerCancelled": "x", "n.courierAssigned": "scooter", "n.courierFound": "scooter", "n.rated": "star", "n.pwReset": "shield", "n.subPaid": "wallet" }[k] || "bell"; }
  SF.actions.notesread = function () { return SF.api.post("/notifications/read").then(function () { SF.state.notes = []; SF.closeModal(); SF.render({ quiet: true }); }); };
  SF.actions.noteopen = function (el) { var u = SF.state.user, o = el.dataset.o; SF.api.post("/notifications/read", { id: el.dataset.id }).catch(function () {}); SF.state.notes = SF.state.notes.filter(function (n) { return n.id !== el.dataset.id; }); SF.closeModal();
    if (/^n\.ad/.test(el.dataset.k)) { SF.go(u.role === "admin" ? "/admin/ads" : "/ads/my"); return; }
    if (el.dataset.k === "n.pwReset") { SF.go("/admin/users?q=" + encodeURIComponent(el.dataset.ph || "")); return; }
    SF.go(u.role === "customer" && o ? "/o/" + o : u.role === "restaurant" ? "/rest/orders" : u.role === "courier" ? "/courier" : u.role === "admin" && o ? "/admin/orders" : SF.homeOf(u)); };
  SF.actions.demo = function () { SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><h2 class="h2">' + t("demo.title") + '</h2><p class="muted">' + t("demo.sub") + "</p>" + SF.demoBlock() + '<button class="btn ghost block" data-act="demoreset">' + I("route", 16) + t("adm.resetDemo") + "</button>"); };
  SF.actions.demoreset = function () { SF.ls.set("db", null); SF.ls.set("token", null); SF.ls.set("cart", null); location.hash = "/"; location.reload(); };

  /* ---------- live updates: notifications + data changes ---------- */
  var lastVer = server ? server.version() : 0;
  function refresh() {
    if (!SF.live) return; var a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT")) return;
    if (!document.getElementById("modal").hidden) return;
    SF.render({ quiet: true });
  }
  SF.poll = function (force) {
    if (!SF.state.user) return Promise.resolve();
    return SF.api.get("/notifications").then(function (list) {
      var fresh = list.filter(function (n) { return !SF.state.seen[n.id]; }); list.forEach(function (n) { SF.state.seen[n.id] = 1; });
      var changed = list.length !== SF.state.notes.length; SF.state.notes = list; if (SF.alarmCheck) SF.alarmCheck(list);
      if (fresh.length && !force) { SF.beep(); fresh.slice(0, 2).forEach(function (n) { SF.toast(t(n.key, n.params), "info"); }); }
      if (changed || fresh.length) { var b = document.querySelector("[data-act=notes]"); if (b) { var d = b.querySelector(".dot"); if (list.length) { if (!d) { d = document.createElement("span"); d.className = "dot"; b.appendChild(d); } d.textContent = list.length; } else if (d) d.remove(); } }
      if (server && server.version() !== lastVer) { lastVer = server.version(); refresh(); }
      else if (!server && fresh.length && !force) refresh();
    }).catch(function (e) { if (e && e.status === 401) SF.logout(true); });
  };
  /* how often to ask the server: shops, couriers and admins every 2.5 s (new orders ring at once);
     customers every 4 s while looking at an order, otherwise every 10 s — far fewer requests when many people are on the site */
  function pollEvery() { var u = SF.state.user; if (server) return 2500; if (!u) return 10000; if (u.role !== "customer") return 2500; return /^\/o\//.test(SF.path ? SF.path() : "") ? 4000 : 10000; }
  (function loop() { setTimeout(function () { if (!document.hidden) { SF.poll(); if (server && server.version() !== lastVer) { lastVer = server.version(); refresh(); } } loop(); }, pollEvery()); })();
  document.addEventListener("visibilitychange", function () { if (!document.hidden && SF.state.user) SF.poll(); });
  setInterval(function () { if (!document.hidden && SF.live && /^\/o\/|^\/courier$|^\/rest\/orders/.test(SF.path())) refresh(); }, 5000);

  /* ---------- boot ---------- */
  var tok = SF.ls.get("token", null);
  if (tok) SF.api.setToken(tok);
  /* fast start: the answers of the last visit are drawn at once, the fresh ones replace them a moment later
     (on a slow or just-woken server the app does not sit on a blank screen) */
  function applyBoot(a) {
    SF.state.cities = a[0]; SF.state.categories = a[1]; SF.state.pub = a[2]; SF.state.shopCats = a[3]; SF.state.user = a[4]; SF.state.areas = a[5] || []; SF.state.areaId = SF.ls.get("area", "") || "";
    var saved = SF.ls.get("city", null); SF.state.cityId = a[0].some(function (c) { return c.id === saved; }) ? saved : a[2].defaultCityId; }
  var cachedBoot = cfg.api ? SF.ls.get("boot", null) : null, early = false;
  if (cachedBoot && cachedBoot.v === 2 && cachedBoot.a && cachedBoot.a[2]) { try { if (!tok) cachedBoot.a[4] = null; applyBoot(cachedBoot.a); early = true; SF.render(); } catch (e) { early = false; } }
  Promise.all([SF.api.get("/cities"), SF.api.get("/categories"), SF.api.get("/settings/public"), SF.api.get("/categories?shop=1").catch(function () { return []; }), tok ? SF.api.get("/auth/me").catch(function () { SF.api.setToken(null); SF.ls.set("token", null); return null; }) : null, SF.api.get("/areas").catch(function () { return []; })]).then(function (a) {
    applyBoot(a); if (cfg.api) SF.ls.set("boot", { v: 2, a: a });
    if (SF.state.user) { SF.poll(true); }
    if (SF.state.pub.demo && !document.querySelector(".demofab")) { var fab = document.createElement("button"); fab.className = "demofab"; fab.setAttribute("data-act", "demo"); fab.innerHTML = I("users", 18) + "<span>Demo</span>"; document.body.appendChild(fab); }
    return SF.render(early ? { quiet: true } : undefined);
  }).catch(function (e) { if (!early) document.getElementById("app").innerHTML = '<div class="empty">' + esc(SF.err(e)) + "</div>"; });
})();
