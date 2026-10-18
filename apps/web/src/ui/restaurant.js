/* SOMON FOOD — restaurant panel: Dashboard → Orders → Menu → History → Settings */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, tx = SF.tx, money = SF.money, api = function () { return SF.api; };
  var P = { roles: ["restaurant"], shell: function (h, r, m) { return SF.shells.panel(h, r, m); } };
  function R(path, o) { SF.route(path, Object.assign({}, P, o)); }

  /* chart: bars drawn to one scale */
  SF.bars = function (series, fmt, label) {
    var W = 560, H = 190, pad = 26, max = Math.max.apply(null, series.map(function (s) { return s.sum; }).concat([1])), bw = (W - pad * 2) / series.length;
    var nice = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / nice) * nice, g = "";
    [0, 0.5, 1].forEach(function (f) { var y = H - pad - f * (H - pad * 2); g += '<line x1="' + pad + '" x2="' + (W - 4) + '" y1="' + y + '" y2="' + y + '" class="gl"/><text x="2" y="' + (y + 4) + '" class="gt">' + (f ? esc(fmt(top * f)) : "0") + "</text>"; });
    series.forEach(function (s, i) { var h = s.sum / top * (H - pad * 2), x = pad + i * bw + bw * 0.18, y = H - pad - h, last = i === series.length - 1;
      g += '<rect class="cbar' + (last ? " last" : "") + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" rx="5"><title>' + SF.date(s.day) + ": " + esc(fmt(s.sum)) + "</title></rect>";
      if (i % 2 === series.length % 2 || last) g += '<text x="' + (x + bw * 0.32).toFixed(1) + '" y="' + (H - 8) + '" class="gx">' + new Date(s.day).getDate() + "</text>"; });
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(label) + '">' + g + "</svg>";
  };
  SF.kpi = function (icon, label, value, sub, tone) { return '<div class="kpi' + (tone ? " " + tone : "") + '"><span class="kic">' + I(icon, 18) + "</span><small>" + label + '</small><b class="num">' + value + "</b>" + (sub ? '<span class="ksub">' + sub + "</span>" : "") + "</div>"; };

  /* ---------- Dashboard ---------- */
  R("/rest", { title: "rest.dash", live: true, render: function () {
    return Promise.all([api().get("/restaurant/me"), api().get("/restaurant/stats"), api().get("/restaurant/orders?scope=new")]).then(function (a) {
      var r = a[0], s = a[1], fresh = a[2]; SF.state.newCount = fresh.length;
      /* big buttons for the things the owner does every day */
      var quick = worker() ? "" : '<nav class="quick">' + [["/rest/orders", "receipt", "rest.orders", SF.state.newCount], ["/rest/sales", "wallet", "sl.nav"], ["/rest/menu", "grid", "rest.menu"], ["/rest/tables", "grid", "tb.nav"], ["/rest/staff", "users", "sf.nav"]].map(function (x) {
        return '<a href="#' + x[0] + '">' + I(x[1], 22) + "<span>" + t(x[2]) + "</span>" + (x[3] ? '<i class="badge">' + x[3] + "</i>" : "") + "</a>"; }).join("") + "</nav>";
      return quick + '<section class="banner-rest" style="--tone:' + esc(r.tone) + '"><div><span class="eyebrow">' + t("rest.yourPlace") + "</span><h2 class=\"h1\">" + esc(tx(r.name)) + '</h2><span class="muted">' + esc(r.hours.from) + "–" + esc(r.hours.to) + " · " + (r.isOpenNow ? t("rest.openNow") : t("rest.closedShort")) + "</span></div>" +
        '<label class="switchrow"><span>' + t("rest.accepting") + '</span><button class="switch' + (r.open ? " on" : "") + '" role="switch" aria-checked="' + r.open + '" data-act="ropen" aria-label="' + t("rest.accepting") + '"></button></label></section>' +
        subBanner(r) + startList(r) +
        (fresh.length ? '<a class="alert" href="#/rest/orders">' + I("bell", 18) + "<b>" + t("rest.newWaiting", { n: fresh.length }) + "</b>" + I("chevR", 18) + "</a>" : "") +
        '<div class="kpis k4">' + SF.kpi("wallet", t("k.todaySales"), money(s.todaySales), t("k.orders", { n: s.todayCount })) + SF.kpi("chart", t("k.monthSales"), money(s.monthSales), t("k.orders", { n: s.monthCount })) +
        SF.kpi("receipt", t("k.avgCheck"), money(s.avgCheck)) + SF.kpi("star", t("k.rating"), s.rating == null ? "—" : s.rating.toFixed(1), t("k.active", { n: s.active })) + "</div>" +
        '<div class="two"><section class="card"><div class="rowhead"><h3>' + t("k.sales14") + "</h3></div>" + SF.bars(s.series, money, t("k.sales14")) + "</section>" +
        '<section class="card"><h3>' + t("k.top") + "</h3>" + (s.topProducts.length ? s.topProducts.map(function (p, i) { return '<div class="topi"><span class="num rank">' + (i + 1) + '</span><span class="cim">' + SF.art(p.kind, 40) + '</span><div class="grow"><b>' + esc(tx(p.name)) + '</b><small class="muted num">' + t("k.sold", { n: p.qty }) + '</small></div><b class="num">' + money(p.sum) + "</b></div>"; }).join("") : '<p class="muted">' + t("k.noData") + "</p>") +
        '<div class="line"><span>' + t("k.payout") + '</span><b class="num">' + money(s.payout) + '</b></div><div class="line muted"><span>' + t("k.commission", { p: r.commissionPct }) + '</span><span class="num">' + money(s.commission) + "</span></div></section></div>";
    });
  } });
  /* subscription: the owner sees how long the place stays visible, and is warned before the end */
  function subBanner(r) { var sb = r.sub; if (!sb || sb.state === "none" || sb.state === "ok") return "";
    var exp = sb.state === "expired", ph = SF.state.pub && SF.state.pub.supportPhone;
    return '<section class="subwarn' + (exp ? " bad" : "") + '">' + I(exp ? "shield" : "clock", 22) + '<div class="grow"><b>' + t(exp ? "sub.restExpired" : "sub.restSoon", { n: sb.daysLeft, d: SF.fullDate(sb.until) }) + "</b><span>" + t(exp ? "sub.restExpiredSub" : "sub.restSoonSub") + "</span></div>" +
      (ph ? '<a class="btn sm ' + (exp ? "danger" : "primary") + '" href="tel:' + esc(String(ph).replace(/\s/g, "")) + '">' + I("phone", 14) + t("sub.call") + "</a>" : "") + "</section>"; }
  SF.restSubBanner = subBanner;
  function subCard(r) { var sb = r.sub, h = r.subHistory || [];
    return '<section class="card stack"><h3>' + I("wallet", 18) + t("sub.title") + '</h3><div class="line"><span>' + t("sub.status") + "</span>" + SF.subPill(sb) + "</div>" +
      (h.length ? '<div class="subhist">' + h.map(function (x) { return '<div class="line"><span class="num">' + SF.fullDate(x.at) + "</span><span>" + (x.kind === "trial" ? t("sub.trialRow", { n: x.days }) : t(x.months === 12 ? "sub.year" : "sub.months", { n: x.months })) + '</span><b class="num">' + (x.amount ? money(x.amount) : "—") + "</b></div>"; }).join("") + "</div>" : "") +
      '<p class="fine">' + t("sub.restNote") + "</p></section>"; }
  /* first days: what the owner still has to do before customers can order */
  function startList(r) {
    var steps = [[r.productCount > 0, "start.menu", "/rest/menu"], [!!r.payCard, "start.card", "/rest/settings"], [!!(r.cover || r.hasAd), "start.promo", "/rest/promo"], [r.open, "start.open", null]];
    if (steps.every(function (x) { return x[0]; })) return "";
    var done = steps.filter(function (x) { return x[0]; }).length;
    return '<section class="card startlist"><div class="rowhead"><h3>' + I("bolt", 18) + t("start.title") + '</h3><span class="muted num">' + done + "/" + steps.length + '</span></div><span class="bar"><i style="width:' + Math.round(done / steps.length * 100) + '%"></i></span><ol>' +
      steps.map(function (x) { return '<li class="' + (x[0] ? "ok" : "") + '">' + I(x[0] ? "check" : "info", 16) + (x[2] && !x[0] ? '<a href="#' + x[2] + '">' + t(x[1]) + "</a>" : "<span>" + t(x[1]) + "</span>") + "</li>"; }).join("") + "</ol></section>";
  }
  SF.actions.ropen = function (el) { return api().patch("/restaurant/me", { open: el.getAttribute("aria-checked") !== "true" }).then(function () { SF.render({ quiet: true }); }); };

  /* ---------- Orders board ---------- */
  function ago(ms) { var m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? t("u.now") : t("u.ago", { n: m }); }
  /* own delivery: who is told about the order, and the "we take it ourselves" button */
  function dlNote(o) { var d = o.delivery || "platform"; if (d === "platform" || o.courier || o.selfDelivery || (o.status !== "cooking" && o.status !== "ready")) return "";
    var k = d === "own" ? "dl.noteOwn" : o.handedOff ? "dl.noteHanded" : "dl.noteMixed"; return '<p class="dlnote">' + I(d === "own" || !o.handedOff ? "store" : "scooter", 14) + t(k, { n: ((SF.state.pub && SF.state.pub.handoffMin) || 7) }) + "</p>"; }
  /* two big choices for an incoming order of a restaurant that may deliver itself */
  SF.dlChoice = function (cur, act, id) { return [["own", "store", "dl.chOwn", "dl.chOwnSub"], ["platform", "scooter", "dl.chTez", "dl.chTezSub"]].map(function (c) {
    var on = cur === c[0]; return '<button type="button" class="dlch' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-act="' + act + '" data-v="' + c[0] + '"' + (id ? ' data-id="' + id + '"' : "") + ">" + I(c[1], 20) + "<b>" + t(c[2]) + "</b><small>" + t(c[3]) + "</small></button>"; }).join(""); };
  SF.actions.tdeliv = function (el) { SF.state.tDeliv = SF.state.tDeliv || {}; SF.state.tDeliv[el.dataset.id] = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.handoff = function (el) { return api().post("/restaurant/orders/" + el.dataset.id + "/handoff").then(function () { SF.toast(t("dl.handedToast")); SF.render({ quiet: true }); }); };
  function selfBtn(o) { return (o.delivery || "platform") !== "platform" && !o.courier && (o.status === "cooking" || o.status === "ready") ? '<div class="row2 selfrow"><button class="btn ghost" data-act="selfout" data-id="' + o.id + '">' + I("store", 16) + t("dl.selfBtn") + '</button><button class="btn ghost" data-act="handoff" data-id="' + o.id + '">' + I("scooter", 16) + t("dl.toTez") + "</button></div>" : ""; }
  SF.actions.selfout = function (el) { return api().get("/restaurant/couriers").then(function (cs) {
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="selfout" data-id="' + el.dataset.id + '"><h2 class="h2">' + t("dl.selfBtn") + '</h2><p class="muted">' + t("dl.selfSub") + "</p>" +
      (cs.length ? '<div class="tags">' + cs.filter(function (c) { return c.active; }).map(function (c) { return '<button type="button" class="chip" data-act="selfpick" data-n="' + esc(c.name) + '" data-p="' + esc(c.phone.replace(/^\+992/, "")) + '">' + esc(c.name) + "</button>"; }).join("") + "</div>" : "") +
      '<label class="f">' + t("dl.who2") + '<input name="name" id="so-n" maxlength="60" placeholder="' + t("dl.who2Ph") + '"></label><label class="f">' + t("auth.phone") + '<span class="phonein"><i>+992</i><input name="phone" id="so-p" inputmode="tel"></span></label>' +
      '<button class="btn primary block lg">' + I("scooter", 18) + t("dl.selfGo") + "</button></form>"); }); };
  SF.actions.selfpick = function (el) { document.getElementById("so-n").value = el.dataset.n; document.getElementById("so-p").value = el.dataset.p; };
  SF.forms.selfout = function (fd, f) { return api().post("/restaurant/orders/" + f.dataset.id + "/out", { name: fd.name, phone: fd.phone }).then(function () { SF.closeModal(); SF.toast(t("dl.selfToast")); SF.render({ quiet: true }); }); };
  SF.actions.selfdone = function (el) { return api().post("/restaurant/orders/" + el.dataset.id + "/delivered").then(function () { SF.toast(t("dl.doneToast")); SF.render({ quiet: true }); }); };

  /* ---------- Our couriers ---------- */
  R("/rest/couriers", { title: "dl.couriers", live: true, render: function () {
    return Promise.all([api().get("/restaurant/me"), api().get("/restaurant/couriers")]).then(function (a) {
      var r = a[0], list = a[1], d = r.delivery || "platform";
      return '<section class="card dlmode d-' + d + '"><span class="kic">' + I(d === "platform" ? "scooter" : "store", 20) + '</span><div class="grow"><small class="muted">' + t("dl.who") + "</small><b>" + t("dl.m." + d) + "</b><p>" + t("dl.desc." + d, { n: (SF.state.pub && SF.state.pub.handoffMin) || 7 }) + '</p><p class="fine">' + t("dl.adminSets") + "</p></div></section>" +
        '<div class="toolbar"><p class="muted">' + t("dl.count", { n: list.length, on: list.filter(function (c) { return c.courier.online; }).length }) + '</p><button class="btn primary" data-act="ocnew">' + I("plus", 18) + t("dl.add") + "</button></div>" +
        (list.length ? '<div class="stack">' + list.map(function (c) {
          var st = !c.active ? '<span class="pill p-bad">' + t("dl.blocked") + "</span>" : c.busy ? '<span class="pill p-warn">' + t("dl.busy") + "</span>" : c.courier.online ? '<span class="pill p-ok">' + t("cour.onlineL") + "</span>" : '<span class="pill p-mut">' + t("cour.offlineL") + "</span>";
          return '<div class="card ocrow' + (c.active ? "" : " off") + '"><span class="avatar">' + esc(c.name.charAt(0)) + '</span><div class="grow"><b>' + esc(c.name) + '</b><small class="muted num">' + esc(SF.phone(c.phone)) + " · " + t("veh." + c.courier.vehicle) + " · " + t("dl.deliveredN", { n: c.delivered }) + "</small>" + st + "</div>" +
            '<button class="iconbtn" data-act="ocpass" data-id="' + c.id + '" data-name="' + esc(c.name) + '" aria-label="' + t("dl.newPass") + '" title="' + t("dl.newPass") + '">' + I("shield", 18) + "</button>" +
            '<button class="switch' + (c.active ? " on" : "") + '" role="switch" aria-checked="' + c.active + '" data-act="ocact" data-id="' + c.id + '" aria-label="' + t("adm.activeL") + '"></button></div>'; }).join("") + "</div>"
          : SF.empty("scooter", t("dl.none"), t("dl.noneSub")));
    });
  } });
  function ocCreds(name, login) {
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="stack"><h2 class="h2">' + t("adm.credsTitle") + '</h2><p class="muted">' + t("dl.credsSub", { name: name }) + "</p>" +
      '<div class="creds"><span>' + t("auth.phone") + '</span><code class="num">' + esc(SF.phone(login.phone)) + "</code><span>" + t("auth.password") + '</span><code class="num">' + esc(login.password) + "</code></div>" +
      '<button type="button" class="btn ghost block" data-act="copynum" data-v="' + esc(SF.phone(login.phone) + " / " + login.password) + '">' + I("copy", 16) + t("adm.credsCopy") + '</button><p class="fine">' + t("adm.credsNote") + "</p></div>"); }
  SF.actions.ocnew = function () {
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="ocnew"><h2 class="h2">' + t("dl.add") + '</h2><label class="f">' + t("profile.name") + '<input name="name" required maxlength="60"></label>' +
      '<label class="f">' + t("auth.phone") + '<span class="phonein"><i>+992</i><input name="phone" inputmode="tel" required></span></label><label class="f">' + t("cour.vehicle") + '<select name="vehicle">' + ["scooter", "bike", "car", "foot"].map(function (v) { return '<option value="' + v + '">' + t("veh." + v) + "</option>"; }).join("") + "</select></label>" +
      '<p class="fine">' + t("dl.addNote") + '</p><button class="btn primary block">' + t("btn.create") + "</button></form>"); };
  SF.forms.ocnew = function (fd) { return api().post("/restaurant/couriers", fd).then(function (c) { SF.render({ quiet: true }); ocCreds(c.name, c.login); }); };
  SF.actions.ocact = function (el) { return api().patch("/restaurant/couriers/" + el.dataset.id, { active: el.getAttribute("aria-checked") !== "true" }).then(function () { SF.render({ quiet: true }); }); };
  SF.actions.ocpass = function (el) { return api().post("/restaurant/couriers/" + el.dataset.id + "/password").then(function (l) { ocCreds(el.dataset.name, l); }); };

  /* ---------- Staff: workers with their own login ---------- */
  R("/rest/staff", { title: "sf.nav", render: function () {
    var me = SF.state.user; if (me.staff && me.staffRole !== "manager") { SF.go("/rest/orders"); return ""; }
    return api().get("/restaurant/staff").then(function (list) { SF.state.staffList = list;
      return '<section class="card sfhero"><span class="kic">' + I("users", 22) + '</span><div class="grow"><b>' + t("sf.title") + "</b><p>" + t("sf.sub") + "</p></div></section>" +
        '<div class="toolbar"><p class="muted">' + t("sf.count", { n: list.length, on: list.filter(function (x) { return x.active; }).length }) + '</p><button class="btn primary" data-act="sfnew">' + I("plus", 18) + t("sf.add") + "</button></div>" +
        (list.length ? '<div class="stack">' + list.map(function (u) {
          var st = !u.active ? '<span class="pill p-bad">' + t("dl.blocked") + "</span>" : u.mustChange ? '<span class="pill p-warn">' + t("sf.notYet") + "</span>" : '<span class="pill p-ok">' + t("sf.activeP") + "</span>";
          return '<div class="card ocrow' + (u.active ? "" : " off") + '"><span class="avatar">' + esc(u.name.charAt(0)) + '</span><div class="grow"><b>' + esc(u.name) + ' <span class="pill ' + (u.staffRole === "manager" ? "p-brand" : u.staffRole === "waiter" ? "p-info" : "p-mut") + '">' + t("sf." + u.staffRole) + "</span>" + '</b><small class="muted num">' + esc(SF.phone(u.phone)) + (u.lastSeenAt ? " · " + t("sf.seen", { t: SF.dt(u.lastSeenAt) }) : "") + "</small>" +
            (u.stats && (u.stats.orders || u.stats.rating) ? '<small class="sfstat num">' + t("sf.stat", { n: u.stats.orders, sum: SF.money(u.stats.sum) }) + (u.stats.rating ? " · ★ " + u.stats.rating + " (" + u.stats.ratingCount + ")" : "") + "</small>" : "") +
            (u.tipCard ? '<small class="muted num">' + I("card", 12) + " " + t("sf.tipShort") + " ··" + esc(u.tipCard.slice(-4)) + "</small>" : "") + st + "</div>" +
            (me.staff && u.staffRole === "manager" ? "</div>" : '<button class="iconbtn" data-act="sfedit" data-id="' + u.id + '" aria-label="' + t("sf.changeRole") + '" title="' + t("sf.changeRole") + '">' + I("edit", 18) + "</button>" +
            '<button class="iconbtn" data-act="sfpass" data-id="' + u.id + '" data-name="' + esc(u.name) + '" aria-label="' + t("dl.newPass") + '" title="' + t("dl.newPass") + '">' + I("shield", 18) + "</button>" +
            '<button class="iconbtn" data-act="sfdel" data-id="' + u.id + '" data-name="' + esc(u.name) + '" aria-label="' + t("sf.del") + '" title="' + t("sf.del") + '">' + I("trash", 18) + "</button>" +
            '<button class="switch' + (u.active ? " on" : "") + '" role="switch" aria-checked="' + u.active + '" data-act="sfact" data-id="' + u.id + '" aria-label="' + t("adm.activeL") + '"></button></div>'); }).join("") + "</div>"
          : SF.empty("users", t("sf.none"), t("sf.noneSub")));
    });
  } });
  function sfCreds(name, login) {
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="stack"><h2 class="h2">' + t("adm.credsTitle") + '</h2><p class="muted">' + t("sf.credsSub", { name: esc(name) }) + "</p>" +
      '<div class="creds"><span>' + t("auth.phone") + '</span><code class="num">' + esc(SF.phone(login.phone)) + "</code><span>" + t("auth.password") + '</span><code class="num">' + esc(login.password) + "</code></div>" +
      '<button type="button" class="btn ghost block" data-act="copynum" data-v="' + esc("tezkor.pro · " + SF.phone(login.phone) + " / " + login.password) + '">' + I("copy", 16) + t("adm.credsCopy") + '</button><p class="fine">' + t("sf.credsNote") + "</p></div>"); }
  SF.actions.sfnew = function () {
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="sfnew"><h2 class="h2">' + t("sf.add") + '</h2><label class="f">' + t("profile.name") + '<input name="name" required maxlength="60" placeholder="' + t("sf.namePh") + '"></label>' +
      '<label class="f">' + t("auth.phone") + '<span class="phonein"><i>+992</i><input name="phone" inputmode="tel" required></span></label>' +
      rolePick("worker") + '<label class="f">' + t("sf.tipL") + '<input name="tipCard" inputmode="numeric" placeholder="0000 0000 0000 0000"><small class="hint">' + t("sf.tipHint") + "</small></label>" +
      '<p class="fine">' + t("sf.addNote") + '</p><button class="btn primary block">' + t("btn.create") + "</button></form>"); };
  SF.forms.sfnew = function (fd) { return api().post("/restaurant/staff", fd).then(function (u) { SF.render({ quiet: true }); sfCreds(u.name, u.login); }); };
  SF.actions.sfact = function (el) { return api().patch("/restaurant/staff/" + el.dataset.id, { active: el.getAttribute("aria-checked") !== "true" }).then(function () { SF.render({ quiet: true }); }); };
  /* three kinds of staff: waiter (only orders), worker (orders + dishes in stock), branch manager (everything; only the owner appoints) */
  function rolePick(cur) { var roles = SF.state.user.staff ? ["waiter", "worker"] : ["waiter", "worker", "manager"];
    return '<p class="lbl">' + t("sf.roleL") + '</p><div class="rolepick">' + roles.map(function (r) { return '<label><input type="radio" name="staffRole" value="' + r + '"' + (r === cur ? " checked" : "") + "><span><b>" + t("sf." + r) + "</b><small>" + t("sf." + r + "Sub") + "</small></span></label>"; }).join("") + "</div>"; }
  SF.actions.sfedit = function (el) { var u = (SF.state.staffList || []).filter(function (x) { return x.id === el.dataset.id; })[0]; if (!u) return;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="sfedit" data-id="' + u.id + '"><h2 class="h2">' + esc(u.name) + "</h2>" + rolePick(u.staffRole) +
      '<label class="f">' + t("sf.tipL") + '<input name="tipCard" inputmode="numeric" value="' + esc((u.tipCard || "").replace(/(\d{4})(?=\d)/g, "$1 ")) + '" placeholder="0000 0000 0000 0000"><small class="hint">' + t("sf.tipHint") + "</small></label>" +
      '<button class="btn primary block">' + t("btn.save") + "</button></form>"); };
  SF.forms.sfedit = function (fd, f) { return api().patch("/restaurant/staff/" + f.dataset.id, { staffRole: fd.staffRole, tipCard: fd.tipCard || "" }).then(function () { SF.closeModal(); SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.sfrole = function (el) { return api().patch("/restaurant/staff/" + el.dataset.id, { staffRole: el.dataset.r }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.sfpass = function (el) { return api().post("/restaurant/staff/" + el.dataset.id + "/password").then(function (l) { sfCreds(el.dataset.name, l); }); };
  SF.actions.sfdel = function (el) {
    SF.modal('<div class="confirm"><span class="cic">' + I("trash", 26) + '</span><h2 class="h2">' + t("sf.delQ", { name: esc(el.dataset.name) }) + '</h2><p class="muted">' + t("sf.delSub") + '</p><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn primary" data-act="sfdelok" data-id="' + el.dataset.id + '">' + t("sf.del") + "</button></div></div>"); };
  SF.actions.sfdelok = function (el) { return api().del("/restaurant/staff/" + el.dataset.id).then(function () { SF.closeModal(); SF.toast(t("sf.deleted")); SF.render({ quiet: true }); }); };

  /* ---------- «Sales»: the owner's money page ---------- */
  function bar(v, max) { return '<i class="slbar"><b style="width:' + (max ? Math.max(3, Math.round(v / max * 100)) : 0) + '%"></b></i>'; }
  R("/rest/sales", { title: "sl.nav", render: function (p, q) {
    if (worker()) { SF.go("/rest/orders"); return ""; }
    var per = (q && q.p) || SF.state.slp || "today";
    return api().get("/restaurant/sales?period=" + per).then(function (s) { var mx = Math.max.apply(null, [1].concat(s.days.map(function (d) { return d.sum; })));
      return '<div class="seg slseg" role="group">' + ["today", "week", "month"].map(function (k) { return '<button class="' + (k === per ? "on" : "") + '" aria-pressed="' + (k === per) + '" data-act="slper" data-v="' + k + '">' + t("sl." + k) + "</button>"; }).join("") + "</div>" +
        '<section class="slbig"><div><small>' + t("sl.revenue") + '</small><b class="num">' + money(s.revenue) + '</b></div><div><small>' + t("sl.orders") + '</small><b class="num">' + s.orders + '</b></div><div><small>' + t("sl.avg") + '</small><b class="num">' + money(s.avg) + "</b></div>" +
          '<div><small>' + t("sl.hall") + '</small><b class="num">' + money(s.hall.sum) + "</b><em>" + t("sl.n", { n: s.hall.orders }) + '</em></div><div><small>' + t("sl.delivery") + '</small><b class="num">' + money(s.delivery.sum) + "</b><em>" + t("sl.n", { n: s.delivery.orders }) + "</em></div>" +
          (s.cancelled ? '<div class="bad"><small>' + t("sl.cancelled") + '</small><b class="num">' + s.cancelled + "</b></div>" : "") + "</section>" +
        (s.days.length > 1 ? '<section class="card"><h3>' + t("sl.byDay") + '</h3><div class="sldays">' + s.days.map(function (d) { return '<div title="' + SF.date(d.day) + " · " + money(d.sum) + '"><i style="height:' + Math.max(2, Math.round(d.sum / mx * 100)) + '%"></i><small>' + new Date(d.day + 5 * 3600000).getUTCDate() + "</small></div>"; }).join("") + "</div></section>" : "") +
        '<div class="two">' +
        '<section class="card"><h3>' + I("user", 18) + " " + t("sl.waiters") + "</h3>" + (s.waiters.length ? s.waiters.map(function (w, i) { return '<div class="slrow"><span class="slnum">' + (i + 1) + '</span><div class="grow"><b>' + esc(w.name) + (w.rating ? ' <span class="likec">★ ' + w.rating + "</span>" : "") + "</b>" + bar(w.sum, s.waiters[0].sum) + '<small class="muted">' + t("sl.n", { n: w.orders }) + '</small></div><b class="num">' + money(w.sum) + "</b></div>"; }).join("") : '<p class="muted">' + t("sl.none") + "</p>") + "</section>" +
        '<section class="card"><h3>' + I("grid", 18) + " " + t("sl.tables") + "</h3>" + (s.tables.length ? s.tables.map(function (x) { return '<div class="slrow"><span class="slnum">' + esc(x.name) + '</span><div class="grow"><b>' + t("tb.table", { n: esc(x.name) }) + "</b>" + bar(x.sum, s.tables[0].sum) + '<small class="muted">' + t("sl.n", { n: x.orders }) + '</small></div><b class="num">' + money(x.sum) + "</b></div>"; }).join("") : '<p class="muted">' + t("sl.none") + "</p>") + "</section>" +
        "</div>" +
        '<section class="card"><h3>' + I("fire", 18) + " " + t("sl.dishes") + "</h3>" + (s.dishes.length ? s.dishes.map(function (d, i) { return '<div class="slrow"><span class="slnum">' + (i + 1) + '</span><div class="grow"><b>' + esc(tx(d.name)) + "</b>" + bar(d.sum, s.dishes[0].sum) + '<small class="muted">' + t("sl.qty", { n: d.qty }) + '</small></div><b class="num">' + money(d.sum) + "</b></div>"; }).join("") : '<p class="muted">' + t("sl.none") + "</p>") + "</section>" +
        (s.pay.length ? '<section class="card"><h3>' + I("wallet", 18) + " " + t("sl.pay") + "</h3>" + s.pay.map(function (x) { return '<div class="line"><span>' + t("pay." + x.method) + " · " + t("sl.n", { n: x.orders }) + '</span><b class="num">' + money(x.sum) + "</b></div>"; }).join("") + "</section>" : "");
    });
  } });
  SF.actions.slper = function (el) { SF.state.slp = el.dataset.v; SF.render({ quiet: true }); };
  /* ---------- a staff member's own page: today, 30 days, rating, tip card ---------- */
  R("/rest/me", { title: "my.nav", render: function () {
    return api().get("/restaurant/my").then(function (m) {
      return '<section class="slbig"><div><small>' + t("my.today") + '</small><b class="num">' + m.todayOrders + "</b><em>" + money(m.todaySum) + '</em></div><div><small>' + t("my.month") + '</small><b class="num">' + m.orders + "</b><em>" + money(m.sum) + '</em></div><div><small>' + t("my.rating") + '</small><b class="num">' + (m.rating ? "★ " + m.rating : "—") + "</b><em>" + t("my.votes", { n: m.ratingCount }) + "</em></div></section>" +
        '<form class="card stack" data-form="mytip"><h3>' + I("card", 18) + " " + t("sf.tipL") + '</h3><p class="fine">' + t("my.tipSub") + '</p><input name="tipCard" inputmode="numeric" value="' + esc((m.tipCard || "").replace(/(\d{4})(?=\d)/g, "$1 ")) + '" placeholder="0000 0000 0000 0000"><button class="btn primary">' + t("btn.save") + "</button></form>" + SF.pwForm();
    });
  } });
  SF.forms.mytip = function (fd) { return api().patch("/restaurant/my", { tipCard: fd.tipCard || "" }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.served = function (el) { return api().post("/restaurant/orders/" + el.dataset.id + "/served").then(function () { SF.toast(t("tb.servedOk")); SF.render({ quiet: true }); }); };

  /* ---------- tables in the hall: QR stickers, the guest orders without signing up ---------- */
  function tableUrl(code) { var o = location.protocol.indexOf("http") === 0 ? location.origin : "https://tezkor.pro"; return o + "/t/" + code; }
  function tableCard(x) {
    return '<article class="card tbcard' + (x.active ? "" : " off") + '"><div class="tbqr">' + SF.qrSvg(tableUrl(x.code)) + '</div><div class="tbinfo"><b>' + t(x.kind === "cabin" ? "hl.cabin" : "tb.table", { n: esc(x.name) }) + "</b>" + (x.zone ? '<small class="pill p-mut">' + esc(x.zone) + "</small>" : "") +
      '<small class="muted tburl">' + esc(tableUrl(x.code).replace(/^https?:\/\//, "")) + "</small>" + (x.active ? "" : '<span class="pill p-mut">' + t("tb.offP") + "</span>") +
      '<div class="tbacts"><button type="button" class="btn sm ghost" data-act="tbprint" data-id="' + x.id + '">' + I("download", 14) + t("tb.print") + '</button>' +
      '<a class="btn sm ghost" href="#/t/' + esc(x.code) + '">' + I("eye", 14) + t("tb.try") + "</a>" +
      '<button type="button" class="iconbtn sm" data-act="tbmenu" data-id="' + x.id + '" aria-label="' + t("tb.more") + '">' + I("cog", 16) + "</button></div></div></article>";
  }
  R("/rest/tables", { title: "tb.nav", render: function () {
    return Promise.all([api().get("/restaurant/tables"), api().get("/restaurant/hall")]).then(function (rr) { var list = rr[0]; SF.state.tables = list; SF.state.zones = rr[1].zones;
      return '<section class="card sfhero"><span class="kic">' + I("grid", 22) + '</span><div class="grow"><b>' + t("tb.hT") + "</b><p>" + t("tb.hS") + "</p></div></section>" +
        '<form class="card stack tbzones" data-form="tbzones"><h3>' + I("grid", 18) + " " + t("hl.zonesT") + '</h3><p class="muted sm">' + t("hl.zonesS") + '</p><div class="tbaddin"><input name="zones" value="' + esc((SF.state.zones || []).join(", ")) + '" placeholder="' + t("hl.zonesPh") + '" aria-label="' + t("hl.zonesT") + '"><button class="btn ghost">' + t("btn.save") + "</button></div></form>" +
        '<form class="toolbar tbadd" data-form="tbadd"><p class="muted">' + t("tb.count", { n: list.length }) + '</p><div class="tbaddin"><input name="count" type="number" min="1" max="50" value="' + (list.length ? 1 : 10) + '" aria-label="' + t("tb.howMany") + '">' +
          ((SF.state.zones || []).length ? '<select name="zone" aria-label="' + t("hl.zone") + '">' + SF.state.zones.map(function (z) { return '<option value="' + esc(z) + '">' + esc(z) + "</option>"; }).join("") + "</select>" : "") +
          '<select name="kind" aria-label="' + t("hl.kind") + '"><option value="table">' + t("hl.kTable") + '</option><option value="cabin">' + t("hl.kCabin") + "</option></select>" +
          '<button class="btn primary">' + I("plus", 18) + t("tb.addN") + "</button></div></form>" +
        (list.length ? '<div class="toolbar"><span></span><button type="button" class="btn ghost" data-act="tbprint">' + I("download", 16) + t("tb.printAll") + "</button></div>" +
          '<div class="tbgrid">' + list.map(tableCard).join("") + "</div>"
          : SF.empty(SF.art("plate", 90), t("tb.emptyT"), t("tb.emptyS"))) +
        '<section class="card tbhow"><h3>' + t("tb.howT") + "</h3><ol><li>" + t("tb.how1") + "</li><li>" + t("tb.how2") + "</li><li>" + t("tb.how3") + "</li><li>" + t("tb.how4") + "</li></ol></section>";
    });
  } });
  SF.forms.tbzones = function (fd) { return api().patch("/restaurant/zones", { zones: String(fd.zones || "").split(",").map(function (z) { return z.trim(); }).filter(Boolean) }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.forms.tbadd = function (fd) { return api().post("/restaurant/tables", { count: +fd.count || 1, zone: fd.zone || "", kind: fd.kind || "table" }).then(function (m) { SF.toast(t("tb.added", { n: m.length })); SF.render({ quiet: true }); }); };
  function tbById(id) { return (SF.state.tables || []).filter(function (x) { return x.id === id; })[0]; }
  SF.actions.tbmenu = function (el) { var x = tbById(el.dataset.id); if (!x) return;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="tbname"><h2 class="h2">' + t("tb.table", { n: esc(x.name) }) + "</h2>" +
      '<input type="hidden" name="id" value="' + x.id + '"><label class="f">' + t("tb.nameL") + '<input name="name" maxlength="30" value="' + esc(x.name) + '" required></label>' +
      '<div class="grid2"><label class="f">' + t("hl.zone") + '<select name="zone"><option value="">' + t("hl.noZone") + "</option>" + (SF.state.zones || []).map(function (z) { return '<option' + (z === x.zone ? " selected" : "") + ">" + esc(z) + "</option>"; }).join("") + "</select></label>" +
      '<label class="f">' + t("hl.kind") + '<select name="kind"><option value="table">' + t("hl.kTable") + '</option><option value="cabin"' + (x.kind === "cabin" ? " selected" : "") + ">" + t("hl.kCabin") + "</option></select></label></div>" +
      '<button class="btn primary block">' + t("btn.save") + "</button></form>" +
      '<div class="stack tbmore"><button type="button" class="btn ghost block" data-act="tbtoggle" data-id="' + x.id + '">' + t(x.active ? "tb.turnOff" : "tb.turnOn") + "</button>" +
      '<button type="button" class="btn ghost block" data-act="tbcode" data-id="' + x.id + '">' + t("tb.newCode") + '</button><p class="fine">' + t("tb.newCodeHint") + "</p>" +
      '<button type="button" class="btn ghost block danger" data-act="tbdel" data-id="' + x.id + '">' + I("trash", 16) + t("tb.del") + "</button></div>"); };
  SF.forms.tbname = function (fd) { return api().patch("/restaurant/tables/" + fd.id, { name: fd.name, zone: fd.zone || "", kind: fd.kind }).then(function () { SF.closeModal(); SF.render({ quiet: true }); }); };
  SF.actions.tbtoggle = function (el) { var x = tbById(el.dataset.id); return api().patch("/restaurant/tables/" + x.id, { active: !x.active }).then(function () { SF.closeModal(); SF.render({ quiet: true }); }); };
  SF.actions.tbcode = function (el) { return api().post("/restaurant/tables/" + el.dataset.id + "/newcode").then(function () { SF.closeModal(); SF.toast(t("tb.codeDone")); SF.render({ quiet: true }); }); };
  SF.actions.tbdel = function (el) { return api().del("/restaurant/tables/" + el.dataset.id).then(function () { SF.closeModal(); SF.render({ quiet: true }); }); };
  /* print: one sticker per table (A6-ish cards, 4 on an A4 page) — cut and stick on the tables */
  SF.actions.tbprint = function (el) { var list = (SF.state.tables || []).filter(function (x) { return x.active && (!el.dataset.id || x.id === el.dataset.id); }); if (!list.length) return;
    return api().get("/restaurant/me").then(function (r) {
      var box = document.getElementById("tbprint") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "tbprint" }));
      box.innerHTML = list.map(function (x) { return '<div class="stk"><div class="stk-top">' + SF.mark(34) + "<b>" + esc(tx(r.name)) + '</b></div><div class="stk-t">' + t("tb.table", { n: esc(x.name) }) + '</div><div class="stk-qr">' + SF.qrSvg(tableUrl(x.code)) + '</div><div class="stk-s">' + t("tb.stk1") + "</div><small>" + t("tb.stk2") + "</small></div>"; }).join("");
      document.body.classList.add("printing"); setTimeout(function () { window.print(); setTimeout(function () { document.body.classList.remove("printing"); }, 500); }, 150);
    }); };

  SF.actions.rtpl = function () { SF.modal('<div class="confirm"><span class="cic">' + I("grid", 26) + '</span><h2 class="h2">' + t("tpl.q") + '</h2><p class="muted">' + t("tpl.sub") + '</p><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn primary" data-act="rtplok">' + t("tpl.go") + "</button></div></div>"); };
  SF.actions.rtplok = function () { return api().post("/restaurant/menu/template", { key: "tj-uz" }).then(function (r) { SF.closeModal(); SF.toast(t("tpl.done", { n: r.added })); SF.render({ quiet: true }); }); };
  function worker() { var u = SF.state.user; return !!(u && u.staff && u.staffRole !== "manager"); }
  function ticket(o) {
    var acts = "";
    if (o.dineIn && (o.status === "cooking" || o.status === "ready")) acts = '<button class="btn ok block" data-act="served" data-id="' + o.id + '">' + I("check", 16) + t("tb.served") + "</button>";
    else if (o.status === "pending") acts = (!o.dineIn && (o.delivery || "platform") !== "platform" ? '<p class="lbl">' + t("dl.who") + '</p><div class="ic-dl">' + SF.dlChoice((SF.state.tDeliv || {})[o.id] || "own", "tdeliv", o.id) + "</div>" : "") + '<div class="seg" role="group" aria-label="' + t("rest.prep") + '">' + [10, 15, 20, 30, 45].map(function (m) { var on = (SF.state.prep[o.id] || 20) === m; return '<button class="' + (on ? "on" : "") + '" aria-pressed="' + on + '" data-act="prep" data-id="' + o.id + '" data-v="' + m + '">' + m + "</button>"; }).join("") + "</div>" +
      '<div class="row2"><button class="btn ghost" data-act="reject" data-id="' + o.id + '">' + t("rest.reject") + '</button><button class="btn primary" data-act="accept" data-id="' + o.id + '">' + I("check", 16) + t(o.payment.method === "transfer" ? "tr.acceptPaid" : "rest.accept") + "</button></div>";
    else if (o.status === "cooking") acts = '<button class="btn ok block" data-act="ready" data-id="' + o.id + '">' + I("bag", 16) + t("rest.markReady") + "</button>" + selfBtn(o);
    else if (o.selfDelivery) acts = '<div class="msg ok">' + I("store", 16) + t("dl.selfIs", { name: o.selfDelivery.name || t("dl.selfTitle") }) + "</div>" + (o.status === "picked_up" ? '<button class="btn ok block" data-act="selfdone" data-id="' + o.id + '">' + I("check", 16) + t("dl.delivered") + "</button>" : "");
    else acts = '<div class="msg ' + (o.status === "ready" ? "info" : "ok") + '">' + I("scooter", 16) + (o.courier ? t("rest.courierIs", { name: o.courier.name }) : t("rest.waitCourier")) + "</div>" + selfBtn(o);
    if (o.status !== "pending" && !o.dineIn) acts = dlNote(o) + acts;
    return '<article class="ticket t-' + o.status + '"><header><b class="num">№' + o.number + "</b>" + SF.statusPill(o.status) + '<small class="muted">' + ago(o.history[o.history.length - 1].at) + "</small></header>" +
      '<ul class="items">' + o.items.map(function (it) { return '<li><b class="num">' + it.qty + "×</b><span>" + esc(tx(it.name)) + "</span></li>"; }).join("") + "</ul>" +
      (o.comment ? '<div class="note">' + I("info", 14) + esc(o.comment) + "</div>" : "") +
      (o.acceptedBy && o.status !== "pending" ? '<div class="tacc">' + I("check", 12) + t("sl.acceptedBy", { name: esc(o.acceptedBy.name) }) + "</div>" : "") +
      (o.dineIn ? '<div class="tcust tdine">' + I("grid", 14) + "<b>" + t("tb.table", { n: esc(o.tableName) }) + "</b>" + (o.guestName ? '<span class="grow muted">' + esc(o.guestName) + "</span>" : '<span class="grow"></span>') + '<span class="cmark new">' + t("tb.inHall") + "</span></div>" : "") +
      (o.customer ? '<div class="tcust">' + I("user", 14) + '<b class="grow">' + esc(o.customer.name) + "</b>" + SF.custMark(o.customer) + "</div>" : "") +
      '<div class="tmeta"><span>' + I(o.payment.method === "cash" ? "cash" : "card", 14) + (o.dineIn ? t("tb.payTable") : t("pay." + o.payment.method)) + '</span><b class="num">' + money(o.subtotal) + "</b></div>" +
      (o.payment.method === "transfer" ? '<div class="paycheck' + (o.payment.status === "review" ? " review" : "") + '"><span>' + (o.payment.status === "review" ? t("tr.restCheck", { sum: money(o.total), card: o.payment.toCard }) : t("ps." + o.payment.status)) + '</span><button type="button" class="btn sm ghost" data-act="rcpt" data-id="' + o.id + '">' + I("receipt", 14) + t("tr.receipt") + "</button></div>" : "") +
      (o.prepMin && o.status === "cooking" ? '<div class="timer"><i style="--p:' + Math.min(100, Math.round((Date.now() - o.history[o.history.length - 1].at) / (o.prepMin * 600))) + '%"></i><span class="num">' + t("rest.prepLeft", { n: Math.max(0, o.prepMin - Math.round((Date.now() - o.history[o.history.length - 1].at) / 60000)) }) + "</span></div>" : "") + acts + "</article>";
  }
  R("/rest/orders", { title: "rest.orders", live: true, render: function () {
    SF.state.prep = SF.state.prep || {};
    return Promise.all([api().get("/restaurant/orders?scope=new"), api().get("/restaurant/orders?scope=active"), api().get("/restaurant/me")]).then(function (a) {
      var fresh = a[0], act = a[1], cook = act.filter(function (o) { return o.status === "cooking"; }), out = act.filter(function (o) { return o.status !== "cooking"; }); SF.state.newCount = fresh.length;
      function col(key, list, icon) { return '<section class="col"><h3>' + I(icon, 18) + t(key) + '<span class="cnt num">' + list.length + "</span></h3>" + (list.length ? list.map(ticket).join("") : '<div class="colempty">' + t("rest.none") + "</div>") + "</section>"; }
      return subBanner(a[2]) + SF.soundBar() + '<div class="board">' + col("rest.colNew", fresh, "bell") + col("rest.colCooking", cook, "fire") + col("rest.colOut", out, "scooter") + "</div>";
    });
  } });
  SF.actions.prep = function (el) { SF.state.prep[el.dataset.id] = +el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.accept = function (el) { return api().post("/restaurant/orders/" + el.dataset.id + "/accept", { prepMin: SF.state.prep[el.dataset.id] || 20, delivery: el.closest(".ticket").querySelector(".ic-dl") ? ((SF.state.tDeliv || {})[el.dataset.id] || "own") : undefined }).then(function (o) { SF.toast(t(o && o.dineIn ? "tb.accepted" : "rest.accepted")); SF.render({ quiet: true }); }); };
  SF.actions.ready = function (el) { return api().post("/restaurant/orders/" + el.dataset.id + "/ready").then(function () { SF.toast(t("rest.readyToast")); SF.render({ quiet: true }); }); };
  SF.actions.reject = function (el) {
    SF.modal('<div class="confirm"><span class="cic bad">' + I("x", 28) + '</span><h2 class="h2">' + t("rest.rejectTitle") + '</h2><form class="stack" data-form="reject" data-id="' + el.dataset.id + '"><div class="tags">' + ["tr.notReceived", "rest.r1", "rest.r2", "rest.r3"].map(function (k) { return '<button type="button" class="chip" data-act="rreason" data-v="' + esc(t(k)) + '">' + t(k) + "</button>"; }).join("") +
      '</div><label class="f">' + t("rest.reason") + '<input name="reason" id="rreason" required></label><div class="row2"><button type="button" class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn danger">' + t("rest.reject") + "</button></div></form></div>");
  };
  SF.actions.rreason = function (el) { document.getElementById("rreason").value = el.dataset.v; };
  SF.forms.reject = function (fd, f) { return api().post("/restaurant/orders/" + f.dataset.id + "/reject", fd).then(function () { SF.closeModal(); SF.toast(t("rest.rejected"), "info"); SF.render({ quiet: true }); }); };

  /* ---------- Menu ---------- */
  R("/rest/menu", { title: "rest.menu", render: function () {
    return Promise.all([api().get("/restaurant/products"), api().get("/restaurant/me")]).then(function (a) {
      var list = a[0], r = a[1]; SF.state.myProducts = list; SF.state.tone = r.tone;
      var cats = SF.state.categories.filter(function (c) { return list.some(function (p) { return p.categoryId === c.id; }); });
      return '<div class="toolbar"><p class="muted">' + t("menu.count", { n: list.length, off: list.filter(function (p) { return !p.available; }).length }) + '</p>' + (worker() ? "" : '<button class="btn primary" data-act="prodnew">' + I("plus", 18) + t("menu.add") + "</button>") + "</div>" +
        (list.length ? cats.map(function (c) { return '<section class="msec"><h2>' + esc(tx(c.name)) + '</h2><div class="mtable">' + list.filter(function (p) { return p.categoryId === c.id; }).map(function (p) {
          return '<div class="mrowp' + (p.available ? "" : " off") + '"><span class="cim" style="--tone:' + esc(r.tone) + '">' + SF.pic(p, 48) + '</span><div class="grow"><b>' + esc(tx(p.name)) + (SF.sale(p) ? ' <span class="chip sale">−' + SF.sale(p) + "%</span>" : "") + (p.popular ? ' <span class="chip hot">' + I("fire", 12) + t("prod.hit") + "</span>" : "") + '</b><small class="muted">' + esc(tx(p.desc)) + (p.weight ? " · " + esc(p.weight) : "") + '</small></div><b class="num price">' + money(p.price) + (SF.sale(p) ? "<s>" + money(p.oldPrice) + "</s>" : "") + "</b>" +
            '<button class="switch' + (p.available ? " on" : "") + '" role="switch" aria-checked="' + p.available + '" aria-label="' + t("menu.inStock") + '" data-act="pavail" data-id="' + p.id + '"></button>' +
            (worker() ? "</div>" : '<button class="iconbtn" data-act="prodedit" data-id="' + p.id + '" aria-label="' + t("btn.edit") + '">' + I("edit", 18) + '</button><button class="iconbtn" data-act="proddel" data-id="' + p.id + '" aria-label="' + t("btn.delete") + '">' + I("trash", 18) + "</button></div>"); }).join("") + "</div></section>"; }).join("")
          : SF.empty("grid", t("menu.empty"), t("menu.emptySub"))) +
        (worker() ? "" : '<section class="card tplcard"><span class="kic">' + I("grid", 22) + '</span><div class="grow"><b>' + t("tpl.btn") + "</b><p>" + t("tpl.sub") + '</p></div><button class="btn ghost" data-act="rtpl">' + t("tpl.go") + "</button></section>");
    });
  } });
  function prodForm(p) {
    p = p || { name: { tg: "" }, desc: { tg: "" }, price: "", weight: "", categoryId: SF.state.categories[0].id, kind: "plate", popular: false, photo: null, oldPrice: null };
    SF.state.pk = p.kind; SF.state.pphoto = p.photo || null;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack pform' + (p.photo ? " hasphoto" : "") + '" data-form="prod" data-id="' + (p.id || "") + '"><h2 class="h2">' + t(p.id ? "menu.edit" : "menu.add") + "</h2>" +
      '<div class="photoup">' + photoBox() + '</div><p class="fine pkfine">' + t("menu.photoOr") + "</p>" +
      '<div class="pkind"><span class="pkprev" id="pkprev" style="--tone:' + esc(SF.state.tone) + '">' + SF.art(p.kind, 96) + '</span><div class="pkgrid" role="radiogroup" aria-label="' + t("menu.picture") + '">' + SF.KINDS.map(function (k) { return '<button type="button" role="radio" aria-checked="' + (k === p.kind) + '" class="' + (k === p.kind ? "on" : "") + '" data-act="pkind" data-v="' + k + '" aria-label="' + k + '">' + SF.art(k, 30) + "</button>"; }).join("") + "</div></div>" +
      '<label class="f">' + t("menu.name") + '<input name="name" required maxlength="60" value="' + esc(tx(p.name)) + '"></label><label class="f">' + t("menu.desc") + '<input name="desc" maxlength="140" value="' + esc(tx(p.desc)) + '"></label>' +
      '<div class="grid3"><label class="f">' + t("menu.price") + '<input name="price" inputmode="numeric" required value="' + esc(p.price) + '"></label><label class="f">' + t("menu.oldPrice") + '<input name="oldPrice" inputmode="numeric" placeholder="' + t("menu.oldPriceHint") + '" value="' + esc(p.oldPrice || "") + '"></label><label class="f">' + t("menu.weight") + '<input name="weight" maxlength="20" value="' + esc(p.weight) + '" placeholder="350 г"></label>' +
      '<label class="f">' + t("menu.category") + '<select name="categoryId">' + SF.state.categories.map(function (c) { return '<option value="' + c.id + '"' + (c.id === p.categoryId ? " selected" : "") + ">" + esc(tx(c.name)) + "</option>"; }).join("") + "</select></label></div>" +
      '<p class="lbl">' + t("ml.label") + '</p><div class="mealpick">' + ["b", "l", "d", "n"].map(function (m) { return '<label><input type="checkbox" name="meal_' + m + '"' + ((p.meals || []).indexOf(m) >= 0 ? " checked" : "") + "><span>" + t("ml." + m) + "</span></label>"; }).join("") + '</div><p class="fine">' + t("ml.hint") + "</p>" +
      '<label class="check"><input type="checkbox" name="popular"' + (p.popular ? " checked" : "") + "><span>" + t("menu.popular") + '</span></label><input type="hidden" name="kind" id="pkind" value="' + esc(p.kind) + '"><button class="btn primary block lg">' + t("btn.save") + "</button></form>", "wide");
  }
  function photoBox() { var ph = SF.state.pphoto;
    return '<label class="upload ph' + (ph ? " done" : "") + '">' + (ph ? '<img src="' + esc(ph) + '" alt="">' + "<span>" + I("check", 16) + t("menu.photoSet") + "</span><small>" + t("tr.change") + "</small>" : I("plus", 22) + "<b>" + t("menu.photo") + "</b><small>" + t("menu.photoSub") + "</small>") +
      '<input type="file" accept="image/*" data-input="pphoto"></label>' + (ph ? '<button type="button" class="btn sm ghost" data-act="pphotodel">' + I("trash", 14) + t("btn.remove") + "</button>" : ""); }
  function pickPhoto(el, max, done) { var f = el.files && el.files[0]; if (!f) return;
    SF.shrinkImage(f, max, 0.8).then(done, function () { SF.toast(t("tr.notImage"), "err"); }); }
  SF.inputs.pphoto = function (v, el) { pickPhoto(el, 900, function (d) { SF.state.pphoto = d; var f = el.closest("form"); f.classList.add("hasphoto"); f.querySelector(".photoup").innerHTML = photoBox(); }); };
  SF.actions.pphotodel = function (el) { SF.state.pphoto = null; var f = el.closest("form"); f.classList.remove("hasphoto"); f.querySelector(".photoup").innerHTML = photoBox(); };
  SF.actions.prodnew = function () { prodForm(null); };
  SF.actions.prodedit = function (el) { prodForm(SF.state.myProducts.filter(function (p) { return p.id === el.dataset.id; })[0]); };
  SF.actions.pkind = function (el) { document.getElementById("pkind").value = el.dataset.v; document.getElementById("pkprev").innerHTML = SF.art(el.dataset.v, 96);
    Array.prototype.forEach.call(el.parentNode.children, function (b) { var on = b === el; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }); };
  SF.forms.prod = function (fd, f) { var body = { name: fd.name, desc: fd.desc, price: Number(fd.price), weight: fd.weight, categoryId: fd.categoryId, kind: fd.kind, popular: !!fd.popular,
      oldPrice: fd.oldPrice ? Number(fd.oldPrice) : null, photo: SF.state.pphoto || null, meals: ["b", "l", "d", "n"].filter(function (m) { return fd["meal_" + m]; }) };
    var req = f.dataset.id ? api().patch("/restaurant/products/" + f.dataset.id, body) : api().post("/restaurant/products", body);
    return req.then(function () { SF.closeModal(); SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.pavail = function (el) { return api().patch("/restaurant/products/" + el.dataset.id, { available: el.getAttribute("aria-checked") !== "true" }).then(function () { SF.render({ quiet: true }); }); };
  SF.actions.proddel = function (el) { var p = SF.state.myProducts.filter(function (x) { return x.id === el.dataset.id; })[0];
    SF.modal('<div class="confirm"><span class="cic bad">' + I("trash", 26) + '</span><h2 class="h2">' + t("menu.delTitle") + '</h2><p class="muted">' + esc(tx(p.name)) + '</p><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn danger" data-act="proddelok" data-id="' + p.id + '">' + t("btn.delete") + "</button></div></div>"); };
  SF.actions.proddelok = function (el) { return api().del("/restaurant/products/" + el.dataset.id).then(function () { SF.closeModal(); SF.toast(t("menu.deleted"), "info"); SF.render({ quiet: true }); }); };

  /* ---------- History ---------- */
  R("/rest/history", { title: "rest.history", render: function () {
    return api().get("/restaurant/orders?scope=history").then(function (list) {
      return list.length ? '<div class="card tablecard"><div class="tscroll"><table class="tbl cardtbl"><thead><tr><th>№</th><th>' + t("tb.time") + "</th><th>" + t("tb.items") + "</th><th>" + t("tb.pay") + "</th><th>" + t("tb.sum") + "</th><th>" + t("tb.status") + "</th><th>" + t("tb.review") + "</th></tr></thead><tbody>" +
        list.map(function (o) { return SF.labelCells(["№", t("tb.time"), t("tb.items"), t("tb.pay"), t("tb.sum"), t("tb.status"), t("tb.review")], '<tr><td class="num">' + o.number + '</td><td class="num">' + SF.dt(o.createdAt) + "</td><td>" + o.items.map(function (i) { return esc(tx(i.name)) + " ×" + i.qty; }).join(", ") + "</td><td>" + t("pay." + o.payment.method) + '</td><td class="num">' + money(o.subtotal) + "</td><td>" + SF.statusPill(o.status) + "</td><td>" + (o.review ? SF.stars(o.review.rating) : "—") + "</td></tr>"); }).join("") + "</tbody></table></div></div>"
        : SF.empty("list", t("rest.noHistory"));
    });
  } });

  /* ---------- Promotion: the owner advertises the place himself ---------- */
  var TONES = ["#E8590C", "#0B8A5A", "#7A3E9D", "#1F6FB2", "#C2185B", "#B7791F", "#1F1A17"];
  function adDraft() { return SF.state.adDraft; }
  function adPreview() { var d = adDraft(); return SF.bannerHtml({ title: { tg: d.title || t("ad.titleHint") }, sub: { tg: d.sub }, tone: d.tone, art: d.art, photo: d.photo, own: true }, "div"); }
  function coverBox(r) { var c = SF.state.coverDraft;
    return '<label class="upload cover' + (c ? " done" : "") + '" style="--tone:' + esc(r.tone) + '">' + (c ? '<img src="' + esc(c) + '" alt="">' + "<span>" + I("check", 16) + t("menu.photoSet") + "</span><small>" + t("tr.change") + "</small>" : I("plus", 22) + "<b>" + t("promo.cover") + "</b><small>" + t("promo.coverSub") + "</small>") +
      '<input type="file" accept="image/*" data-input="cover"></label>'; }
  function logoBox(r) { var l = SF.state.logoDraft;
    return '<label class="upload logoup' + (l ? " done" : "") + '" style="--tone:' + esc(r.tone) + '">' + (l ? '<img src="' + esc(l) + '" alt="">' : '<b class="lgletter">' + esc(tx(r.name).charAt(0)) + "</b>") + "<span>" + t(l ? "tr.change" : "promo.logo") + '</span><input type="file" accept="image/*" data-input="rlogo"></label>'; }
  R("/rest/promo", { title: "rest.promo", render: function () {
    return Promise.all([api().get("/restaurant/me"), api().get("/restaurant/ad"), api().get("/restaurant/products")]).then(function (a) {
      var r = a[0], ad = a[1], prods = a[2]; SF.state.promoRest = r;
      if (SF.state.adFor !== r.id) { SF.state.adFor = r.id; SF.state.coverDraft = r.cover || null; SF.state.logoDraft = r.logo || null;
        SF.state.adDraft = ad ? { title: tx(ad.title), sub: tx(ad.sub), tone: ad.tone, art: ad.art, photo: ad.photo, active: ad.active, productId: ad.productId }
          : { title: tx(r.name), sub: "", tone: TONES.indexOf(r.tone) >= 0 ? r.tone : TONES[0], art: (prods[0] || {}).kind || "plov", photo: null, active: true, productId: null }; }
      var d = adDraft(), sale = prods.filter(function (p) { return SF.sale(p); });
      var status = !ad ? '<div class="msg info">' + I("info", 16) + t("ad.none") + "</div>" : ad.blocked ? '<div class="msg err">' + I("shield", 16) + t("ad.blocked") + "</div>"
        : ad.active ? '<div class="msg ok">' + I("check", 16) + t("ad.live") + "</div>" : '<div class="msg warn">' + I("clock", 16) + t("ad.paused") + "</div>";
      return '<p class="muted">' + t("promo.sub") + '</p><div class="two">' +
        '<form class="card stack" data-form="adsave"><h3>' + I("gift", 18) + t("ad.title") + "</h3>" + status +
          '<div id="adprev" class="adprev">' + adPreview() + "</div>" +
          '<label class="f">' + t("ad.head") + '<input name="title" maxlength="40" required data-input="adtitle" value="' + esc(d.title) + '"></label>' +
          '<label class="f">' + t("ad.text") + '<input name="sub" maxlength="70" data-input="adsub" placeholder="' + t("ad.textHint") + '" value="' + esc(d.sub) + '"></label>' +
          '<div class="f"><span>' + t("ad.color") + '</span><div class="tones" role="radiogroup" aria-label="' + t("ad.color") + '">' + TONES.map(function (c) { return '<button type="button" role="radio" aria-checked="' + (c === d.tone) + '" class="tone' + (c === d.tone ? " on" : "") + '" style="--c:' + c + '" data-act="adtone" data-v="' + c + '" aria-label="' + c + '"></button>'; }).join("") + "</div></div>" +
          '<div class="f"><span>' + t("ad.pic") + '</span><div class="adpics">' +
            '<label class="upload sm' + (d.photo ? " done" : "") + '">' + (d.photo ? '<img src="' + esc(d.photo) + '" alt="">' : I("plus", 18)) + "<b>" + t(d.photo ? "tr.change" : "ad.photo") + '</b><input type="file" accept="image/*" data-input="adphoto"></label>' +
            (d.photo ? '<button type="button" class="btn sm ghost" data-act="adphotodel">' + I("trash", 14) + t("btn.remove") + "</button>" : '<div class="pkgrid">' + ["plov", "shashlik", "burger", "pizza", "samsa", "dessert", "lagman", "coffee"].map(function (k) { return '<button type="button" class="' + (k === d.art ? "on" : "") + '" aria-pressed="' + (k === d.art) + '" data-act="adart" data-v="' + k + '" aria-label="' + k + '">' + SF.art(k, 28) + "</button>"; }).join("") + "</div>") + "</div></div>" +
          '<label class="switchrow"><span>' + t("ad.show") + '</span><button type="button" class="switch' + (d.active ? " on" : "") + '" role="switch" aria-checked="' + !!d.active + '" data-act="adactive" aria-label="' + t("ad.show") + '"' + (ad && ad.blocked ? " disabled" : "") + "></button></label>" +
          '<div class="row2 adbtns">' + (ad ? '<button type="button" class="btn ghost" data-act="addel">' + I("trash", 16) + t("btn.delete") + "</button>" : "") + '<button class="btn primary">' + I("check", 16) + t(ad ? "btn.save" : "ad.publish") + "</button></div></form>" +
        '<div class="stack">' +
          '<form class="card stack" data-form="rprofile"><h3>' + I("store", 18) + t("promo.page") + "</h3>" + '<div class="coverup">' + coverBox(r) + '</div><div class="logorow"><div class="logoslot">' + logoBox(r) + '</div><p class="muted sm">' + t("promo.logoSub") + "</p></div>" +
            '<label class="f">' + t("promo.cuisine") + '<input name="cuisine" maxlength="60" required value="' + esc(tx(r.cuisine)) + '" placeholder="' + t("promo.cuisineHint") + '"></label>' +
            '<label class="f">' + t("promo.about") + '<textarea name="about" maxlength="200" rows="3" placeholder="' + t("promo.aboutHint") + '">' + esc(tx(r.about || "")) + "</textarea></label>" +
            '<button class="btn primary">' + t("btn.save") + "</button>" +
            '<div class="f"><span>' + I("eye", 14) + t("promo.look") + '</span><div class="rcprev">' + SF.restCard(Object.assign({}, r, { cover: SF.state.coverDraft, logo: SF.state.logoDraft, art1: (prods[0] || {}).kind, art2: (prods[1] || {}).kind })).replace(/^<a /, '<div ').replace(/<\/a>$/, "</div>") + "</div></div></form>" +
          '<section class="card stack"><h3>' + I("percent", 18) + t("promo.sale") + '</h3><p class="muted sm">' + t("promo.saleSub") + "</p>" +
            (sale.length ? sale.map(function (p) { return '<div class="topi"><span class="cim" style="--tone:' + esc(r.tone) + '">' + SF.pic(p, 40) + '</span><div class="grow"><b>' + esc(tx(p.name)) + '</b><small class="muted num"><s>' + money(p.oldPrice) + "</s> → " + money(p.price) + '</small></div><span class="chip sale">−' + SF.sale(p) + "%</span></div>"; }).join("") : "") +
            '<a class="btn ghost" href="#/rest/menu">' + I("edit", 16) + t("promo.toMenu") + "</a></section>" +
          '<section class="card stack tips"><h3>' + I("info", 18) + t("promo.tips") + "</h3><ul><li>" + t("promo.tip1") + "</li><li>" + t("promo.tip2") + "</li><li>" + t("promo.tip3") + "</li></ul></section>" +
        "</div></div>";
    });
  } });
  function redrawAd() { var el = document.getElementById("adprev"); if (el) el.innerHTML = adPreview(); }
  SF.inputs.adtitle = function (v) { adDraft().title = v; redrawAd(); };
  SF.inputs.adsub = function (v) { adDraft().sub = v; redrawAd(); };
  function keepText() { var f = document.querySelector("[data-form=adsave]"); if (f) { adDraft().title = f.title.value; adDraft().sub = f.sub.value; } }
  SF.actions.adtone = function (el) { keepText(); adDraft().tone = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.adart = function (el) { keepText(); adDraft().art = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.adactive = function () { keepText(); adDraft().active = !adDraft().active; SF.render({ quiet: true }); };
  SF.actions.adphotodel = function () { keepText(); adDraft().photo = null; SF.render({ quiet: true }); };
  SF.inputs.adphoto = function (v, el) { keepText(); pickPhoto(el, 1200, function (d) { adDraft().photo = d; SF.render({ quiet: true }); }); };
  SF.inputs.rlogo = function (v, el) { pickPhoto(el, 400, function (d) { SF.state.logoDraft = d; el.closest(".logoslot").innerHTML = logoBox(SF.state.promoRest); }); };
  SF.inputs.cover = function (v, el) { pickPhoto(el, 1400, function (d) { SF.state.coverDraft = d; el.closest(".coverup").innerHTML = coverBox(SF.state.promoRest); }); };
  SF.forms.adsave = function (fd) { var d = adDraft();
    return api().post("/restaurant/ad", { title: fd.title, sub: fd.sub, tone: d.tone, art: d.art, photo: d.photo || null, active: d.active, productId: d.productId }).then(function () { SF.state.adFor = null; SF.toast(t(d.active ? "ad.published" : "btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.addel = function () { return api().del("/restaurant/ad").then(function () { SF.state.adFor = null; SF.toast(t("ad.deleted"), "info"); SF.render({ quiet: true }); }); };
  SF.forms.rprofile = function (fd) { return api().patch("/restaurant/me", { cuisine: fd.cuisine, about: fd.about, cover: SF.state.coverDraft || null, logo: SF.state.logoDraft || null }).then(function () { SF.state.adFor = null; SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  /* ---------- Settings ---------- */
  R("/rest/settings", { title: "rest.settings", render: function () {
    return api().get("/restaurant/me").then(function (r) {
      return SF.installCard() + '<div class="two"><form class="card stack" data-form="rset"><h3>' + t("rest.hours") + '</h3><div class="grid2"><label class="f">' + t("rest.from") + '<input type="time" name="from" value="' + esc(r.hours.from) + '" required></label><label class="f">' + t("rest.to") + '<input type="time" name="to" value="' + esc(r.hours.to) + '" required></label></div>' +
        '<div class="grid2"><label class="f">' + t("rest.eta") + '<input name="eta" value="' + esc(r.eta) + '" placeholder="25–35"></label><label class="f">' + t("rest.minOrderL") + '<input name="minOrder" inputmode="numeric" value="' + r.minOrder + '"></label></div>' +
        '<label class="f">' + t("auth.phone") + '<input name="phone" inputmode="tel" value="' + esc(SF.phone(r.phone)) + '"></label><label class="f">' + t("rest.addressL") + '<input name="address" value="' + esc(tx(r.address)) + '"></label><button class="btn primary">' + t("btn.save") + "</button></form>" +
        (SF.state.user.staff ? "" : '<form class="card stack" data-form="rcard"><h3>' + t("tr.cardTitle") + '</h3><p class="muted sm">' + t("tr.cardSub") + '</p><label class="f">' + t("tr.cardNum") + '<input name="number" id="rc-num" inputmode="numeric" autocomplete="off" placeholder="0000 0000 0000 0000" value="' + esc(r.payCard ? r.payCard.number.replace(/(\d{4})(?=\d)/g, "$1 ") : "") + '"></label>' +
        '<div class="grid2"><label class="f">' + t("tr.holder") + '<input name="holder" id="rc-holder" value="' + esc(r.payCard ? r.payCard.holder : "") + '"></label><label class="f">' + t("tr.bank") + '<input name="bank" id="rc-bank" placeholder="Алиф, Эсхата, Амонатбонк…" value="' + esc(r.payCard ? r.payCard.bank : "") + '"></label></div><button class="btn primary">' + t("btn.save") + "</button></form>") +
        '<section class="card stack"><h3>' + t("rest.where") + '</h3><p class="muted sm">' + t("rest.whereSub") + "</p>" + SF.tmap({ key: "rloc", center: { lat: r.lat, lng: r.lng }, zoom: 15, zone: SF.restZone(r), markers: [{ lat: r.lat, lng: r.lng, type: "rest", label: "R" }], label: t("rest.where") }) +
        '<p class="fine">' + I("info", 14) + " " + t("rest.placeAdmin") + "</p></section>" + SF.pwForm() +
        subCard(r) + '<section class="card stack"><h3>' + t("rest.profile") + '</h3><div class="rprof" style="--tone:' + esc(r.tone) + '">' + SF.art("plov", 72) + "<div><b class=\"h2\">" + esc(tx(r.name)) + '</b><span class="muted">' + esc(tx(r.cuisine)) + "</span></div></div>" +
        '<div class="line"><span>' + t("k.rating") + "</span>" + SF.stars(r.rating) + '</div><div class="line"><span>' + t("adm.commission") + '</span><b class="num">' + r.commissionPct + '%</b></div><div class="line"><span>' + t("rest.products") + '</span><b class="num">' + r.productCount + "</b></div><p class=\"fine\">" + t("rest.profileNote") + "</p></section></div>";
    });
  } });
  SF.forms.rset = function (fd) { var ph = String(fd.phone || "").replace(/\D/g, "");
    return api().patch("/restaurant/me", { hours: { from: fd.from, to: fd.to }, eta: String(fd.eta).replace("-", "–"), minOrder: Number(fd.minOrder), phone: ph, address: fd.address }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  /* receipt photo: restaurant (and admin) check it against their bank app before accepting */
  SF.actions.rcpt = function (el) { return api().get("/orders/" + el.dataset.id + "/receipt").then(function (r) {
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="stack"><h2 class="h2">' + t("tr.receipt") + '</h2><img class="rcptimg" src="' + r.image + '" alt="' + t("tr.receipt") + '"><p class="fine">' + t("tr.verify") + "</p></div>", "wide"); }); };
  SF.forms.rcard = function (fd) { return api().patch("/restaurant/me", { payCard: { number: fd.number, holder: fd.holder, bank: fd.bank } }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };

  /* ---------- Hall: floors / rooms, every table a square — green free, red busy, orange «waiter called» ---------- */
  function mins(ms) { return Math.max(1, Math.round((Date.now() - ms) / 60000)); }
  R("/rest/hall", { title: "hl.nav", live: true, render: function (p, q) {
    return api().get("/restaurant/hall").then(function (h) { SF.state.hall = h; var u = SF.state.user, boss = !u.staff || u.staffRole === "manager";
      var zones = h.zones.slice(); if (h.tables.some(function (x) { return !x.zone || zones.indexOf(x.zone) < 0; })) zones.push("");
      var z = q.z != null ? q.z : (SF.state.hallZ != null ? SF.state.hallZ : (zones.length > 1 ? zones[0] : "*")); SF.state.hallZ = z;
      var list = h.tables.filter(function (x) { return z === "*" || (z === "" ? !x.zone || h.zones.indexOf(x.zone) < 0 : x.zone === z); });
      var busy = h.tables.filter(function (x) { return x.busy; }).length;
      return '<div class="hlbar"><div class="hlstat"><span class="hlk free"></span>' + t("hl.free") + ' <b class="num">' + (h.tables.length - busy) + '</b><span class="hlk busy"></span>' + t("hl.busy") + ' <b class="num">' + busy + "</b></div>" +
          '<a class="btn primary" href="#/rest/pos">' + I("cash", 18) + t("pos.nav") + "</a></div>" +
        (zones.length > 1 ? '<div class="chips hlzones" role="tablist">' + zones.map(function (zz) { var n = h.tables.filter(function (x) { return zz === "" ? !x.zone || h.zones.indexOf(x.zone) < 0 : x.zone === zz; }), nb = n.filter(function (x) { return x.busy; }).length;
            return '<a role="tab" class="chip' + (zz === z ? " on" : "") + '" href="#/rest/hall?z=' + encodeURIComponent(zz) + '">' + esc(zz || t("hl.noZone")) + ' <i class="num">' + nb + "/" + n.length + "</i></a>"; }).join("") +
            '<a role="tab" class="chip' + (z === "*" ? " on" : "") + '" href="#/rest/hall?z=*">' + t("home.all") + "</a></div>" : "") +
        (list.length ? '<div class="hlgrid">' + list.map(function (x) {
            return '<button type="button" class="hlt ' + (x.called ? "hcall" : x.busy ? "hbusy" : "hfree") + (x.kind === "cabin" ? " cabin" : "") + '" data-act="hlopen" data-id="' + x.id + '"><span class="hlic">' + I(x.kind === "cabin" ? "store" : "grid", 16) + "</span><b>" + esc(x.name) + "</b>" +
              (x.busy ? '<span class="num">' + money(x.sum) + "</span><small>" + (x.cooking ? I("fire", 12) : I("check", 12)) + t("hl.min", { n: mins(x.since) }) + "</small>" : "<small>" + t(x.called ? "hl.called" : "hl.freeS") + "</small>") + (x.called && x.busy ? '<em class="hlbell">' + I("bell", 12) + "</em>" : "") + "</button>"; }).join("") + "</div>"
          : SF.empty("grid", t("hl.none"), boss ? t("hl.noneSub") : "", boss ? '<a class="btn primary" href="#/rest/tables">' + I("plus", 16) + t("hl.setup") + "</a>" : "")) +
        (boss && h.tables.length ? '<p class="fine">' + I("info", 14) + t("hl.hint") + ' <a class="link" href="#/rest/tables">' + t("hl.setup") + "</a></p>" : "");
    });
  } });
  function hlt(id) { return ((SF.state.hall || {}).tables || []).filter(function (x) { return x.id === id; })[0]; }
  SF.actions.hlopen = function (el) { var x = hlt(el.dataset.id); if (!x) return;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="stack"><h2 class="h2">' + t(x.kind === "cabin" ? "hl.cabin" : "tb.table", { n: esc(x.name) }) + (x.zone ? ' <small class="muted">· ' + esc(x.zone) + "</small>" : "") + "</h2>" +
      (x.busy ? '<div class="hlorders">' + x.orders.map(function (o) { return '<div class="hlo"><div class="row between"><b>№' + o.number + "</b>" + SF.statusPill(o.status === "delivered" ? "delivered" : o.status) + "</div>" +
          '<ul class="hlitems">' + o.items.map(function (i) { return "<li><span>" + i.qty + " × " + esc(tx(i.name)) + '</span><b class="num">' + money(i.price * i.qty) + "</b></li>"; }).join("") + "</ul></div>"; }).join("") +
        '<div class="hltotal"><span>' + t("hl.total") + '</span><b class="num">' + money(x.sum) + "</b></div></div>" : '<p class="muted">' + t("hl.freeLong") + "</p>") +
      '<a class="btn primary block lg" href="#/rest/pos?table=' + x.id + '" data-act="closemodal">' + I("plus", 18) + t("hl.add") + "</a>" +
      (x.busy ? '<div class="row2"><button class="btn ok" data-act="hlclose" data-id="' + x.id + '" data-m="cash">' + I("cash", 16) + t("hl.paidCash") + '</button><button class="btn ghost" data-act="hlclose" data-id="' + x.id + '" data-m="card">' + I("card", 16) + t("hl.paidCard") + "</button></div>" : "") + "</div>"); };
  SF.actions.hlclose = function (el) { var force = !!el.dataset.force;
    return api().post("/restaurant/tables/" + el.dataset.id + "/close", { method: el.dataset.m, force: force }).then(function (r) { SF.closeModal(); SF.toast(t("hl.closed", { sum: money(r.sum) })); SF.render({ quiet: true }); }, function (e) {
      if (e && e.code === "TABLE_NOT_SERVED") { SF.modal('<div class="confirm"><span class="cic">' + I("fire", 26) + '</span><h2 class="h2">' + t("hl.notServedT") + '</h2><p class="muted">' + t("hl.notServed") + '</p><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn ok" data-act="hlclose" data-force="1" data-id="' + el.dataset.id + '" data-m="' + el.dataset.m + '">' + t("hl.closeAnyway") + "</button></div></div>"); return; }
      throw e; }); };

  /* ---------- Cash desk / waiter order: type «чой» → it shows, tap to add; to a table (goes to the kitchen) or a counter sale (paid now) ---------- */
  function pos() { return SF.state.pos || (SF.state.pos = { items: {}, method: "cash", q: "" }); }
  R("/rest/pos", { title: "pos.nav", render: function (p, q) {
    return Promise.all([api().get("/restaurant/products"), api().get("/restaurant/hall")]).then(function (r) { var prods = r[0].filter(function (x) { return x.available; }), h = r[1], st = pos();
      if (q.table !== undefined) st.table = q.table || ""; SF.state.posProds = prods; SF.state.hall = h;
      var tb = (h.tables.filter(function (x) { return x.id === st.table; })[0]) || null; if (!tb) st.table = "";
      return '<div class="posw"><section class="card posl"><label class="posfind">' + I("search", 20) + '<input id="posq" data-input="posq" value="' + esc(st.q) + '" placeholder="' + t("pos.findPh") + '" aria-label="' + t("pos.findPh") + '" autocomplete="off" enterkeyhint="search"></label>' +
          '<div class="poslist" id="poslist">' + posList(prods, st.q) + "</div></section>" +
        '<section class="card posr"><label class="f">' + t("pos.where") + '<select data-input="postable"><option value="">' + t("pos.counter") + "</option>" +
          h.tables.map(function (x) { return '<option value="' + x.id + '"' + (x.id === st.table ? " selected" : "") + ">" + esc((x.zone ? x.zone + " · " : "") + t(x.kind === "cabin" ? "hl.cabin" : "tb.table", { n: x.name })) + (x.busy ? " ● " + money(x.sum) : "") + "</option>"; }).join("") + "</select></label>" +
          '<div id="posticket">' + posTicket() + "</div></section></div>";
    });
  } });
  function posList(prods, s) { s = String(s || "").trim().toLowerCase();
    var l = prods.filter(function (x) { return !s || [x.name.tg, x.name.ru, x.name.en].join(" ").toLowerCase().indexOf(s) >= 0; }).slice(0, 60);
    return l.length ? l.map(function (x) { var n = pos().items[x.id] || 0;
      return '<button type="button" class="posp' + (n ? " in" : "") + '" data-act="posadd" data-id="' + x.id + '">' + (x.photo ? '<img src="' + esc(x.photo) + '" alt="">' : '<span class="pospa">' + SF.art(x.kind, 34) + "</span>") + '<span class="grow"><b>' + esc(tx(x.name)) + '</b><small class="num">' + money(x.price) + "</small></span>" + (n ? '<i class="num">' + n + "</i>" : I("plus", 18)) + "</button>"; }).join("")
      : '<p class="muted">' + t("pos.none") + "</p>"; }
  function posTicket() { var st = pos(), prods = SF.state.posProds || [], ids = Object.keys(st.items).filter(function (k) { return st.items[k] > 0; }), sum = 0;
    var rows = ids.map(function (k) { var x = prods.filter(function (y) { return y.id === k; })[0]; if (!x) return ""; sum += x.price * st.items[k];
      return '<li><span class="grow">' + esc(tx(x.name)) + '</span><span class="stepper"><button type="button" data-act="posdec" data-id="' + k + '" aria-label="' + t("a.less") + '">' + I("minus", 14) + '</button><b class="num">' + st.items[k] + '</b><button type="button" data-act="posadd" data-id="' + k + '" aria-label="' + t("a.more") + '">' + I("plus", 14) + '</button></span><b class="num">' + money(x.price * st.items[k]) + "</b></li>"; }).join("");
    return (ids.length ? '<ul class="postk">' + rows + "</ul>" : '<p class="muted postk0">' + t("pos.empty") + "</p>") +
      '<div class="hltotal"><span>' + t("hl.total") + '</span><b class="num">' + money(sum) + "</b></div>" +
      (st.table ? '<button type="button" class="btn primary block lg" data-act="possend"' + (ids.length ? "" : " disabled") + ">" + I("fire", 18) + t("pos.toKitchen") + "</button>"
        : '<div class="seg posm">' + ["cash", "card"].map(function (m) { return '<button type="button" class="' + (st.method === m ? "on" : "") + '" data-act="posm" data-v="' + m + '">' + I(m, 16) + t("pos." + m) + "</button>"; }).join("") + "</div>" +
          '<button type="button" class="btn ok block lg" data-act="possend"' + (ids.length ? "" : " disabled") + ">" + I("check", 18) + t("pos.sell", { sum: money(sum) }) + "</button>"); }
  function posRefresh() { var a = document.getElementById("posticket"), b = document.getElementById("poslist"); if (a) a.innerHTML = posTicket(); if (b) b.innerHTML = posList(SF.state.posProds || [], pos().q); }
  SF.inputs.posq = function (v) { pos().q = v; var b = document.getElementById("poslist"); if (b) b.innerHTML = posList(SF.state.posProds || [], v); };
  SF.inputs.postable = function (v) { pos().table = v; posRefresh(); };
  SF.actions.posadd = function (el) { var st = pos(); st.items[el.dataset.id] = (st.items[el.dataset.id] || 0) + 1; posRefresh(); };
  SF.actions.posdec = function (el) { var st = pos(); st.items[el.dataset.id] = Math.max(0, (st.items[el.dataset.id] || 0) - 1); posRefresh(); };
  SF.actions.posm = function (el) { pos().method = el.dataset.v; posRefresh(); };
  SF.actions.possend = function () { var st = pos(), items = Object.keys(st.items).filter(function (k) { return st.items[k] > 0; }).map(function (k) { return { productId: k, qty: st.items[k] }; }); if (!items.length) return;
    return api().post("/restaurant/pos", { items: items, tableId: st.table || null, method: st.method }).then(function (o) { var tbl = st.table; SF.state.pos = { items: {}, method: st.method, q: "", table: "" };
      SF.toast(tbl ? t("pos.sent", { n: o.number }) : t("pos.sold", { sum: money(o.subtotal) })); if (tbl) SF.go("/rest/hall"); else SF.render({ quiet: true }); }); };
})();
