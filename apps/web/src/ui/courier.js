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

  R("/courier", { title: "cour.orders", live: true, render: function () {
    return Promise.all([api().get("/auth/me"), api().get("/courier/orders/active"), api().get("/courier/orders/available"), api().get("/courier/earnings")]).then(function (a) {
      var me = a[0], act = a[1], open = a[2], e = a[3], c = me.courier; SF.state.user = me;
      var head = '<section class="chero' + (c.online ? " on" : "") + '"><span class="avatar">' + esc(me.name.charAt(0)) + '</span><div class="grow"><b>' + esc(me.name) + "</b><span>" + SF.stars(c.rating) + ' <small class="num">(' + (c.ratingCount || 0) + ")</small> · " + t("veh." + c.vehicle) + "</span></div>" +
        '<button class="switch big' + (c.online ? " on" : "") + '" role="switch" aria-checked="' + c.online + '" data-act="online" aria-label="' + t("cour.online") + '"></button><p class="cstate">' + (c.online ? (act ? t("cour.st.busy") : t("cour.st.online")) : t("cour.st.offline")) + "</p></section>" +
        '<div class="kpis k3">' + SF.kpi("wallet", t("cour.today"), money(e.today)) + SF.kpi("box", t("cour.delivered"), e.todayCount) + SF.kpi("star", t("k.rating"), c.rating == null ? "—" : Number(c.rating).toFixed(1)) + "</div>";
      head = (SF.pushCard ? SF.pushCard() : "") + SF.soundBar() + head;
      if (act) return head + activeCard(act);
      if (!c.online) return head + SF.empty("scooter", t("cour.offTitle"), t("cour.offSub"), '<button class="btn primary" data-act="online">' + t("cour.goOnline") + "</button>");
      return head + '<div class="sect"><h2>' + t("cour.available") + '</h2><span class="muted num">' + open.length + "</span></div>" + (open.length ? '<div class="stack">' + open.map(function (o) {
        return '<article class="card offer"><div class="rowhead"><b class="num">№' + o.number + '</b><span class="pill p-ok num">+' + money(payEst(o)) + "</span></div>" + route(o, false) +
          '<div class="tmeta"><span>' + SF.statusPill(o.status) + '</span><span class="num">' + o.km + " " + t("u.km") + " · " + (o.payment.method === "cash" ? t("cour.collect", { sum: money(o.total) }) : t("cour.paidOnline")) + "</span></div>" +
          '<button class="btn primary block" data-act="take" data-id="' + o.id + '">' + t("cour.take") + "</button></article>"; }).join("") + "</div>" : SF.empty("box", t("cour.noneTitle"), t("cour.noneSub")));
    });
  } });
  function route(o, full) {
    return '<div class="route"><div class="rdots"><i></i><s></s><i class="b"></i></div><div class="rpts"><div><small>' + t("cour.pickup") + "</small><b>" + esc(tx(o.restaurant.name)) + "</b>" + (full && tx(o.restaurant.address) && tx(o.restaurant.address) !== "—" ? '<span class="muted">' + esc(tx(o.restaurant.address)) + "</span>" : "") + "</div>" +
      "<div><small>" + t("cour.dropoff") + "</small><b>" + esc(o.address.text) + "</b>" + (o.address.landmark ? '<span class="muted">' + esc(o.address.landmark) + "</span>" : "") + "</div></div></div>";
  }
  function activeCard(o) {
    var stage = o.status === "picked_up" ? 2 : o.status === "ready" ? 1 : 0, city = cityOf(o.cityId) || o.restaurant, cp = o.courierPos || { lat: SF.state.user.courier.lat, lng: SF.state.user.courier.lng };
    var target = stage === 2 ? o.address : o.restaurant, far = cp.lat == null || SF.geo.km(cp, target) > 30;   /* GPS is old or wrong (a PC, no signal): do not stretch the map over half the country — show the place itself */
    var steps = [t("cour.s1"), t("cour.s2"), t("cour.s3")];
    var action = stage === 0 ? '<div class="msg info">' + I("fire", 16) + t("cour.cooking", { min: o.prepMin || 20 }) + '</div><button class="btn block" disabled>' + t("cour.picked") + "</button>"
      : stage === 1 ? '<button class="btn primary block lg" data-act="pickup" data-id="' + o.id + '">' + I("bag", 18) + t("cour.picked") + "</button>"
      : '<button class="btn ok block lg" data-act="deliver" data-id="' + o.id + '">' + I("check", 18) + (o.payment.method === "cash" ? t("cour.deliveredCash", { sum: money(o.total) }) : t("cour.deliveredBtn")) + "</button>";
    return '<section class="card active"><div class="rowhead"><b class="num">№' + o.number + "</b>" + SF.statusPill(o.status) + "</div>" +
      '<ol class="steps three">' + steps.map(function (s, i) { var st = i < stage ? "done" : i === stage ? "now" : ""; return '<li class="' + st + '"><span>' + I(st === "done" ? "check" : ["store", "bag", "home"][i], 16) + "</span><small>" + s + "</small></li>"; }).join("") + "</ol>" +
      '<div class="mapcard">' + SF.tmap({ key: "c-" + o.id + "-" + stage + (far ? "f" : ""), center: target, zoom: far ? 16 : undefined, free: true, zone: far ? undefined : SF.zone(o.cityId), fit: far ? undefined : [cp, target], markers: [{ lat: o.restaurant.lat, lng: o.restaurant.lng, type: "rest", label: "R" }, { lat: o.address.lat, lng: o.address.lng, type: "home", label: "" }].concat(far ? [] : [{ lat: cp.lat, lng: cp.lng, type: "courier" }]), route: far ? undefined : [cp, target], label: t("cour.map") }) + "</div>" +
      (far ? '<div class="msg warn">' + I("info", 16) + "<span>" + t("cour.gpsFar") + "</span></div>" : '<p class="fine mapdist">' + I("route", 14) + t("cour.dist", { km: SF.geo.km(cp, target).toFixed(1) }) + "</p>") +
      navBlock(target, stage === 2 ? t("cour.client") : tx(o.restaurant.name), stage === 2 ? t("cour.coords") : t("cour.coordsR")) + route(o, true) +
      '<div class="contact"><span class="avatar sm">' + esc(o.customer.name.charAt(0)) + '</span><div class="grow"><b>' + esc(o.customer.name) + '</b><span class="muted num">' + esc(SF.phone(o.phone || o.customer.phone)) + '</span>' + SF.custMark(o.customer) + '</div>' + SF.callBtn(o.customer.name, o.phone || o.customer.phone, t("role.customer"), t("cour.call")) + "</div>" +
      (o.comment ? '<div class="note">' + I("info", 14) + esc(o.comment) + "</div>" : "") +
      '<details class="items"><summary>' + t("cour.itemsN", { n: o.items.reduce(function (s, i) { return s + i.qty; }, 0) }) + "</summary>" + o.items.map(function (i) { return '<div class="line"><span>' + esc(tx(i.name)) + '</span><b class="num">×' + i.qty + "</b></div>"; }).join("") + "</details>" +
      '<div class="line tot"><span>' + (o.payment.method === "cash" ? t("cour.collectL") : t("cour.paidOnline")) + '</span><b class="num">' + money(o.payment.method === "cash" ? o.total : 0) + "</b></div>" + action + "</section>";
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
        '<div class="mrow"><span>' + t("profile.city") + "</span><b>" + esc(tx((cityOf(u.cityId) || {}).name)) + '</b></div><div class="mrow"><span>' + t("profile.lang") + "</span>" + SF.langSel() + '</div><div class="mrow"><span>' + t("foot.support") + '</span><b class="num">' + esc(SF.state.pub.supportPhone) + "</b></div></section>" +
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
