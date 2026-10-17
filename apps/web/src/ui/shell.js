/* SOMON FOOD — layouts: customer web app, partner dashboards, courier app, auth */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon;

  function langSel() {
    return '<label class="lang"><span class="sr">' + t("profile.lang") + '</span><span class="flag" aria-hidden="true">' + ({ tg: "🇹🇯", ru: "🇷🇺", en: "🇬🇧" }[SF.state.lang] || "🌐") + '</span><select data-input="lang" aria-label="' + t("profile.lang") + '">' +
      [["tg", "Тоҷ"], ["ru", "Рус"], ["en", "Eng"]].map(function (l) { return '<option value="' + l[0] + '"' + (SF.state.lang === l[0] ? " selected" : "") + ">" + l[1] + "</option>"; }).join("") + "</select></label>";
  }
  function bell() { if (!SF.state.user) return ""; var n = (SF.state.notes || []).length;
    return '<button class="iconbtn" data-act="notes" aria-label="' + t("n.title") + '">' + I("bell") + (n ? '<span class="dot">' + n + "</span>" : "") + "</button>"; }
  function cityName() { var c = (SF.state.cities || []).filter(function (x) { return x.id === SF.state.cityId; })[0]; return c ? SF.tx(c.name) : ""; }
  SF.langSel = langSel; SF.bell = bell;

  /* customer web app */
  SF.shells.customer = function (html, r) {
    var u = SF.state.user, n = SF.cart.count(), path = SF.path().split("?")[0];
    function tab(p, icon, key, badge) { var on = p === "/" ? path === "/" : path.indexOf(p) === 0; return '<a href="#' + p + '" class="' + (on ? "on" : "") + '"' + (on ? ' aria-current="page"' : "") + ">" + I(icon, 22) + "<span>" + t(key) + "</span>" + (badge ? '<i class="badge">' + badge + "</i>" : "") + "</a>"; }
    return '<div class="flag-line" aria-hidden="true"></div>' +
      '<header class="top' + (u ? " u" : "") + (path === "/" ? " athome" : "") + '"><div class="wrap topin">' +
        '<a href="#/" class="brandlink" aria-label="' + esc(SF.brand()) + '">' + SF.logo() + "</a>" +
        '<button class="citybtn" data-act="city" aria-label="' + t("profile.city") + ": " + esc(cityName()) + '">' + I("pin", 16) + "<span>" + esc(cityName()) + "</span>" + I("chevD", 14) + "</button>" +
        '<form class="topsearch" data-form="search" role="search"><span>' + I("search", 18) + '</span><input name="q" placeholder="' + t("home.search") + '" aria-label="' + t("home.search") + '" value="' + esc(SF.state.q || "") + '"></form>' +
        '<div class="topact">' + langSel() + bell() +
          '<a href="#/cart" class="cartbtn' + (n ? " has" : "") + '">' + I("cart", 20) + "<span>" + (n ? SF.money(SF.state.cartSum || 0) : t("nav.cart")) + "</span>" + (n ? '<i class="badge" id="cartBadge">' + n + "</i>" : "") + "</a>" +
          (u ? '<a href="#/profile" class="avatar" aria-label="' + t("nav.profile") + '">' + esc(u.name.charAt(0)) + "</a>" : '<a href="#/login" class="btn sm primary toplogin">' + t("auth.login") + "</a>") +
        "</div></div></header>" +
      '<main class="wrap main page">' + html + "</main>" +
      '<footer class="foot"><div class="wrap footin">' + SF.logo() + '<p>' + t("foot.about") + '</p><div class="footlinks"><a href="#/login">' + t("foot.partners") + '</a><span>' + t("foot.support") + ': <b class="num">' + esc(SF.state.pub ? SF.state.pub.supportPhone : "") + "</b></span></div></div></footer>" +
      '<nav class="tabbar" aria-label="' + t("nav.main") + '">' + tab("/", "home", "nav.home") + tab("/search", "search", "nav.search") + tab("/cart", "cart", "nav.cart", n) + tab("/orders", "receipt", "nav.orders") + tab(u ? "/profile" : "/login", "user", u ? "nav.profile" : "auth.login") + "</nav>";
  };

  /* partner dashboards (restaurant, admin) */
  SF.panelNav = {
    restaurant: [["/rest", "chart", "rest.dash"], ["/rest/orders", "receipt", "rest.orders"], ["/rest/sales", "wallet", "sl.nav"], ["/rest/me", "user", "my.nav"], ["/rest/menu", "grid", "rest.menu"], ["/rest/promo", "gift", "rest.promo"], ["/rest/tables", "grid", "tb.nav"], ["/rest/history", "list", "rest.history"], ["/rest/staff", "users", "sf.nav"], ["/rest/settings", "store", "rest.settings"]],
    admin: [["/admin", "chart", "adm.dash"], ["/admin/orders", "receipt", "adm.orders"], ["/admin/restaurants", "store", "adm.restaurants"], ["/admin/couriers", "scooter", "adm.couriers"], ["/admin/users", "users", "adm.users"],
      ["/admin/banners", "gift", "adm.banners"], ["/admin/promos", "percent", "adm.promos"], ["/admin/cities", "city", "adm.cities"], ["/admin/settings", "cog", "adm.settings"]]
  };
  SF.shells.panel = function (html, r) {
    /* a worker of the restaurant: orders, menu (in stock / out of stock), history. A branch manager sees everything. */
    var u = SF.state.user, path = SF.path().split("?")[0], worker = u.staff && u.staffRole !== "manager";
    /* waiter: orders + his own page; worker: + menu (in stock) and history; owner / manager: everything (his own page only for staff) */
    var WORK = u.staffRole === "waiter" ? ["/rest/orders", "/rest/me"] : ["/rest", "/rest/orders", "/rest/menu", "/rest/history", "/rest/me"];
    var nav = (SF.panelNav[u.role] || []).filter(function (n) { if (n[0] === "/rest/me") return !!u.staff; return !worker || WORK.indexOf(n[0]) >= 0; });
    if (worker && u.role === "restaurant" && WORK.indexOf(path) < 0) setTimeout(function () { SF.go("/rest/orders"); }, 0);
    var cur = nav.filter(function (n) { return n[0] === path; })[0] || nav.filter(function (n) { return path.indexOf(n[0]) === 0 && n[0] !== "/rest" && n[0] !== "/admin"; })[0] || nav[0];
    return '<div class="panel' + (SF.state.drawer ? " open" : "") + '"><aside class="side"><div class="sidehead">' + SF.logo() + '<span class="rolebadge">' + t("role." + u.role) + "</span></div>" +
      '<nav class="sidenav">' + nav.map(function (n) { var on = n === cur; return '<a href="#' + n[0] + '" class="' + (on ? "on" : "") + '"' + (on ? ' aria-current="page"' : "") + ">" + I(n[1], 18) + "<span>" + t(n[2]) + "</span>" + (n[0] === "/rest/orders" && SF.state.newCount ? '<i class="badge">' + SF.state.newCount + "</i>" : "") + "</a>"; }).join("") + "</nav>" +
      '<div class="sideuser"><span class="avatar sm">' + esc(u.name.charAt(0)) + '</span><div><b>' + esc(u.name) + "</b><small>" + esc(SF.phone(u.phone)) + '</small></div><button class="iconbtn" data-act="logout" aria-label="' + t("auth.logout") + '">' + I("logout", 18) + "</button></div></aside>" +
      '<div class="scrim" data-act="drawer"></div><div class="pmain"><header class="ptop"><button class="iconbtn menubtn" data-act="drawer" aria-label="' + t("nav.menu") + '">' + I("menu") + '</button><h1>' + t(cur ? cur[2] : "adm.dash") + '</h1><div class="topact">' + langSel() + bell() + "</div></header>" +
      '<div class="pcontent page">' + html + "</div></div></div>";
  };

  /* courier app */
  SF.shells.courier = function (html) {
    var path = SF.path().split("?")[0];
    function tab(p, icon, key) { var on = path === p; return '<a href="#' + p + '" class="' + (on ? "on" : "") + '"' + (on ? ' aria-current="page"' : "") + ">" + I(icon, 22) + "<span>" + t(key) + "</span></a>"; }
    var cu = SF.state.user, own = cu && cu.courier && cu.courier.restaurantName;
    return '<div class="flag-line" aria-hidden="true"></div><div class="capp"><header class="ctop">' + SF.logo() + '<div class="topact">' + langSel() + bell() + "</div></header>" +
      '<main class="cmain page">' + (own ? '<div class="ownstrip">' + I("store", 16) + "<span>" + t("dl.youAre", { name: esc(SF.tx(own)) }) + "</span></div>" : "") + html + '</main><nav class="tabbar show" aria-label="' + t("nav.main") + '">' + tab("/courier", "box", "cour.orders") + tab("/courier/earnings", "wallet", "cour.earnings") + tab("/courier/history", "list", "cour.history") + tab("/courier/profile", "user", "nav.profile") + "</nav></div>";
  };

  SF.shells.bare = function (html) { return '<div class="flag-line" aria-hidden="true"></div>' + html; };

  /* ---------- phone call sheet: number big + copy + call (tel: links do not open in every browser/app) ---------- */
  SF.callBtn = function (name, phone, sub, label) {
    if (!phone) return "";
    return '<button type="button" class="iconbtn call" data-act="call" data-name="' + esc(name) + '" data-phone="' + esc(phone) + '" data-sub="' + esc(sub || "") + '" aria-label="' + esc(label || t("call.title")) + '">' + I("phone", 20) + "</button>";
  };
  SF.actions.call = function (el) {
    var ph = el.dataset.phone, digits = ph.replace(/[^+\d]/g, "");
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="callsheet"><span class="avatar xl">' + esc((el.dataset.name || "?").charAt(0)) + "</span><b>" + esc(el.dataset.name) + "</b>" +
      (el.dataset.sub ? '<span class="muted">' + esc(el.dataset.sub) + "</span>" : "") + '<code class="callnum num" id="callnum">' + esc(SF.phone(ph)) + "</code>" +
      '<a class="btn ok block lg" href="tel:' + esc(digits) + '">' + I("phone", 18) + t("call.now") + '</a><button type="button" class="btn ghost block" data-act="copynum" data-v="' + esc(digits) + '">' + I("copy", 16) + t("call.copy") + "</button>" +
      '<p class="fine">' + t("call.hint") + "</p></div>");
  };
  SF.actions.copynum = function (el) {
    var v = el.dataset.v, ok = function () { SF.toast(t("cour.copied")); };
    function sel() { var c = document.getElementById("callnum"); if (c) { var r = document.createRange(); r.selectNodeContents(c); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } SF.toast(t("call.selected"), "info"); }
    try { navigator.clipboard.writeText(v).then(ok, sel); } catch (e) { sel(); }
  };

  /* ---------- a known number: regular customer (orders received before) or a new one ---------- */
  SF.custMark = function (c) { if (!c || c.orders == null) return "";
    return c.orders > 0 ? '<span class="cmark known">' + I("check", 12) + t("cm.known", { n: c.orders }) + "</span>" : '<span class="cmark new">' + t("cm.new") + "</span>"; };

  /* ---------- change own password ---------- */
  SF.pwForm = function () {
    return '<form class="card stack pwform" data-form="pw"><h3>' + t("pw.title") + '</h3><div class="grid2"><label class="f">' + t("pw.old") + '' + SF.pwInput("oldPassword", "current-password", ' id="pw-old" required') + "</label>" +
      '<label class="f">' + t("pw.new") + SF.pwInput("password", "new-password", ' id="pw-new" minlength="6" required') + "</label></div>" + '<button class="btn ghost">' + t("pw.save") + "</button></form>";
  };
  SF.forms.pw = function (fd, f) { return SF.api.patch("/auth/me", { oldPassword: fd.oldPassword, password: fd.password }).then(function () { f.reset(); SF.toast(t("pw.done")); }); };
})();
