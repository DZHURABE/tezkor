/* SOMON FOOD — courier app: Online → New order → Restaurant → Pick up → Customer → Delivered → Earnings */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, tx = SF.tx, money = SF.money, api = function () { return SF.api; };
  var P = { roles: ["courier"], shell: function (h) { return SF.shells.courier(h); } };
  function R(path, o) { SF.route(path, Object.assign({}, P, o)); }
  function cityOf(id) { return (SF.state.cities || []).filter(function (c) { return c.id === id; })[0]; }
  function payEst(o) { return o.courierPay != null ? o.courierPay : Math.round(o.deliveryFee * (SF.state.pub.courierPct || 80) / 100); }
  function navBlock(p, name, label) { var n = SF.geo.nav(p);
    return '<div class="navblock"><b class="navto">' + I("navarrow", 16) + esc(t("cour.navTo", { name: name })) + '</b><div class="navbtns"><a class="btn primary" href="' + esc(n.google) + '" target="_blank" rel="noopener">' + t("cour.navG") + '</a><a class="btn ghost" href="' + esc(n.yandex) + '" target="_blank" rel="noopener">' + t("cour.navY") + "</a></div>" +
      '<div class="coords"><small>' + label + '</small><code class="num" id="coords-text">' + n.text + '</code><button type="button" class="btn sm ghost" data-act="copycoords" data-v="' + n.text + '">' + I("copy", 14) + t("cour.copy") + "</button></div></div>"; }
  SF.actions.copycoords = function (el) { var v = el.dataset.v, done = function () { SF.toast(t("cour.copied")); };
    try { navigator.clipboard.writeText(v).then(done, function () { sel(); }); } catch (e) { sel(); }
    function sel() { var c = document.getElementById("coords-text"); if (c) { var r = document.createRange(); r.selectNodeContents(c); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } } };

  /* the courier's main screen, made simple: one big «start / finish work» button, then either the current order
     (one step at a time, one big button) or the list of new orders (each with one big «take» button). The map is folded away. */
  R("/courier", { title: "cour.orders", live: true, render: function () {
    return Promise.all([api().get("/auth/me"), api().get("/courier/orders/active"), api().get("/courier/orders/available"), api().get("/courier/earnings")]).then(function (a) {
      var me = a[0], act = a[1], open = a[2], e = a[3], c = me.courier; SF.state.user = me;
      var head = '<section class="cv-head' + (c.online ? " on" : "") + '"><div class="cv-me"><span class="avatar">' + esc(me.name.charAt(0)) + '</span><div class="grow"><b>' + esc(me.name) + '</b><small>' + (c.online ? (act ? t("cour.st.busy") : t("cv.onShift")) : t("cv.offShift")) + '</small></div>' +
          '<div class="cv-today"><b class="num">' + money(e.today) + '</b><small>' + t("cv.todayN", { n: e.todayCount }) + "</small></div></div>" +
        (act ? "" : '<button class="cv-shift' + (c.online ? " stop" : "") + '" data-act="online">' + I(c.online ? "x" : "scooter", 22) + t(c.online ? "cv.stop" : "cv.start") + "</button>") + "</section>";
      head = head + (SF.pushCard ? SF.pushCard() : "") + SF.soundBar();
      if (act) return head + activeCard(act);
      if (!c.online) return head + '<div class="cv-empty">' + I("scooter", 46) + "<b>" + t("cour.offTitle") + "</b><p>" + t("cv.offHint") + "</p></div>";
      if (!open.length) return head + '<div class="cv-empty wait"><span class="cv-radar"></span><b>' + t("cv.waitT") + "</b><p>" + t("cv.waitS") + "</p></div>";
      return head + '<h2 class="cv-h">' + t("cv.newN", { n: open.length }) + "</h2>" + open.map(function (o) {
        return '<article class="cv-offer"><div class="cv-ofhead"><span class="num">№' + o.number + '</span><b class="num">+' + money(payEst(o)) + "</b></div>" + legs(o) +
          '<div class="cv-chips"><span>' + I("route", 14) + o.km + " " + t("u.km") + "</span>" + (o.payment.method === "cash" ? '<span class="cash">' + I("cash", 14) + t("cv.collectS", { sum: money(o.total) }) + "</span>" : '<span class="paid">' + I("check", 14) + t("cv.paidS") + "</span>") + "</div>" +
          '<button class="cv-big" data-act="take" data-id="' + o.id + '">' + I("check", 20) + t("cv.take") + "</button></article>"; }).join("");
    });
  } });
  function legs(o) {
    return '<div class="cv-legs"><div class="cv-leg"><i class="dot a"></i><div><small>' + t("cv.from") + "</small><b>" + esc(tx(o.restaurant.name)) + "</b></div></div>" +
      '<div class="cv-leg"><i class="dot b"></i><div><small>' + t("cv.to") + "</small><b>" + esc(o.address.text) + "</b>" + (o.address.landmark ? "<span>" + esc(o.address.landmark) + "</span>" : "") + "</div></div></div>"; }
  function route(o) { return legs(o); }
  /* the current order: where to go now, how to get there, who to call, how much to take — and one button */
  function activeCard(o) {
    var stage = o.status === "picked_up" ? 2 : o.status === "ready" ? 1 : 0, toClient = stage === 2, target = toClient ? o.address : o.restaurant, n = SF.geo.nav(target);
    var who = toClient ? o.customer.name : tx(o.restaurant.name), phone = toClient ? (o.phone || o.customer.phone) : o.restaurant.phone, cash = o.payment.method === "cash";
    var action = stage === 0 ? '<div class="cv-wait">' + I("clock", 18) + t("cour.cooking", { min: o.prepMin || 20 }) + "</div>"
      : stage === 1 ? '<button class="cv-big" data-act="pickup" data-id="' + o.id + '">' + I("bag", 22) + t("cour.picked") + "</button>"
      : '<button class="cv-big ok" data-act="deliver" data-id="' + o.id + '">' + I("check", 22) + (cash ? t("cour.deliveredCash", { sum: money(o.total) }) : t("cour.deliveredBtn")) + "</button>";
    return '<section class="cv-active">' +
      '<div class="cv-steps">' + [t("cv.s1"), t("cv.s2")].map(function (x, i) { var st = (toClient ? 1 : 0); return '<span class="' + (i < st ? "done" : i === st ? "now" : "") + '">' + (i < st ? I("check", 14) : i + 1) + " " + x + "</span>"; }).join("") + "</div>" +
      '<div class="cv-target"><small>' + t(toClient ? "cv.goClient" : "cv.goShop") + '</small><b>' + esc(toClient ? o.address.text : tx(o.restaurant.name)) + "</b>" +
        (toClient && o.address.landmark ? "<span>" + esc(o.address.landmark) + "</span>" : !toClient && tx(o.restaurant.address) && tx(o.restaurant.address) !== "—" ? "<span>" + esc(tx(o.restaurant.address)) + "</span>" : "") +
        '<div class="cv-btns"><a class="cv-nav" href="' + esc(n.google) + '" target="_blank" rel="noopener">' + I("navarrow", 18) + t("cv.navG") + '</a><a class="cv-nav y" href="' + esc(n.yandex) + '" target="_blank" rel="noopener">' + I("map", 18) + t("cv.navY") + "</a>" +
        (phone ? SF.callBtn(who, phone, toClient ? t("role.customer") : tx(o.restaurant.name), t("cour.call")) : "") + "</div></div>" +
      '<div class="cv-money' + (cash ? " cash" : "") + '"><span>' + t(cash ? "cv.collect" : "cv.paid") + '</span><b class="num">' + (cash ? money(o.total) : "0") + "</b></div>" +
      '<div class="cv-info"><div class="cv-row"><span class="avatar sm">' + esc(o.customer.name.charAt(0)) + '</span><div class="grow"><b>' + esc(o.customer.name) + '</b><small class="num">' + esc(SF.phone(o.phone || o.customer.phone)) + "</small></div><span class=\"num\">№" + o.number + "</span></div>" +
        (o.comment ? '<div class="note">' + I("info", 14) + esc(o.comment) + "</div>" : "") +
        '<details class="items"><summary>' + t("cour.itemsN", { n: o.items.reduce(function (x, i) { return x + i.qty; }, 0) }) + "</summary>" + o.items.map(function (i) { return '<div class="line"><span>' + esc(tx(i.name)) + '</span><b class="num">×' + i.qty + "</b></div>"; }).join("") + "</details>" +
        '<details class="cv-map"><summary>' + I("map", 16) + t("cv.showMap") + "</summary>" + SF.tmap({ key: "cv-" + o.id + "-" + stage, center: target, zoom: 16, free: true, markers: [{ lat: o.restaurant.lat, lng: o.restaurant.lng, type: "rest", label: "R" }, { lat: o.address.lat, lng: o.address.lng, type: "home", label: "" }], label: t("cour.map") }) + "</details></div>" +
      '<div class="cv-bottom">' + action + "</div></section>";
  }
  SF.actions.online = function (el) { var on = !SF.state.user.courier.online; return api().patch("/courier/me", { online: on }).then(function (u) { SF.state.user = u; SF.toast(t(on ? "cour.st.online" : "cour.st.offline"), "info"); SF.render({ quiet: true }); }); };
  SF.actions.take = function (el) { return api().post("/courier/orders/" + el.dataset.id + "/accept").then(function () { SF.toast(t("cour.taken")); SF.render({ quiet: true }); }); };
  SF.actions.pickup = function (el) { return api().post("/courier/orders/" + el.dataset.id + "/pickup").then(function () { SF.toast(t("cour.toCustomer")); SF.render({ quiet: true }); }); };
  SF.actions.deliver = function (el) { return api().post("/courier/orders/" + el.dataset.id + "/deliver").then(function (o) { SF.toast(t("cour.done", { sum: money(o.courierPay) })); SF.render({ quiet: true }); }); };

  R("/courier/earnings", { title: "cour.earnings", render: function () {
    return api().get("/courier/earnings").then(function (e) {
      return '<h1 class="h2 pt">' + t("cour.earnings") + '</h1><div class="kpis k3">' + SF.kpi("wallet", t("cour.today"), money(e.today), t("k.orders", { n: e.todayCount })) + SF.kpi("chart", t("cour.week"), money(e.week), t("k.orders", { n: e.weekCount })) + SF.kpi("box", t("cour.total"), money(e.total), t("k.orders", { n: e.totalCount })) + "</div>" +
        '<section class="card"><h3>' + t("cour.week7") + "</h3>" + SF.bars(e.series, money, t("cour.week7")) + '<p class="fine">' + (SF.state.user.courier && SF.state.user.courier.restaurantName ? t("dl.ownPayNote") : t("cour.payNote", { p: SF.state.pub.courierPct })) + "</p></section>";
    });
  } });
  R("/courier/history", { title: "cour.history", render: function () {
    return api().get("/courier/history").then(function (list) {
      return '<h1 class="h2 pt">' + t("cour.history") + "</h1>" + (list.length ? '<div class="olist">' + list.map(function (o) {
        return '<div class="ocard"><span class="cim" style="--tone:' + esc(o.restaurant.tone) + '">' + SF.art(o.items[0].kind, 46) + '</span><div class="grow"><div class="rrow"><b>' + esc(tx(o.restaurant.name)) + "</b>" + SF.statusPill(o.status) + '</div><span class="muted num">' + SF.dt(o.createdAt) + " · " + o.km + " " + t("u.km") + "</span>" + (o.review && o.review.courierRating ? SF.stars(o.review.courierRating) : "") + '</div><b class="num">' + (o.status === "delivered" ? "+" + money(o.courierPay) : "—") + "</b></div>"; }).join("") + "</div>" : SF.empty("list", t("cour.noHistory")));
    });
  } });
  R("/courier/profile", { title: "nav.profile", render: function () {
    return api().get("/auth/me").then(function (u) { SF.state.user = u; var c = u.courier;
      return '<div class="profile">' + SF.installCard() + '<section class="card phead"><span class="avatar xl">' + esc(u.name.charAt(0)) + '</span><div><h1 class="h2">' + esc(u.name) + '</h1><span class="muted num">' + esc(SF.phone(u.phone)) + "</span>" + SF.stars(c.rating) + "</div></section>" +
        '<section class="card menu"><div class="mrow"><span>' + t("cour.vehicle") + '</span><div class="seg">' + ["scooter", "bike", "car", "foot"].map(function (v) { return '<button class="' + (c.vehicle === v ? "on" : "") + '" aria-pressed="' + (c.vehicle === v) + '" data-act="vehicle" data-v="' + v + '">' + t("veh." + v) + "</button>"; }).join("") + "</div></div>" +
        '<div class="mrow"><span>' + t("profile.lang") + "</span>" + SF.langSel() + '</div><div class="mrow"><span>' + t("foot.support") + '</span><b class="num">' + esc(SF.state.pub.supportPhone) + "</b></div></section>" +
        SF.pwForm() + '<button class="btn ghost block" data-act="logout">' + I("logout", 18) + t("auth.logout") + "</button></div>";
    });
  } });
  SF.actions.vehicle = function (el) { return api().patch("/courier/me", { vehicle: el.dataset.v }).then(function () { SF.render({ quiet: true }); }); };
  /* real GPS while online: the customer sees the courier move (needs HTTPS and the courier's permission) */
  var watch = null, lastSent = 0;
  SF.after.push(function () {
    var u = SF.state.user, on = u && u.role === "courier" && u.courier && u.courier.online && navigator.geolocation;
    if (on && watch == null) {
      try { watch = navigator.geolocation.watchPosition(function (pos) {
        if (Date.now() - lastSent < 10000) return; lastSent = Date.now();
        api().patch("/courier/me", { lat: pos.coords.latitude, lng: pos.coords.longitude }).catch(function () {});
      }, function () {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }); } catch (e) { watch = -1; }
    } else if (!on && watch != null && watch !== -1) { navigator.geolocation.clearWatch(watch); watch = null; }
  });
})();
