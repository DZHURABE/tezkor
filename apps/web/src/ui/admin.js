/* SOMON FOOD — super admin panel */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, tx = SF.tx, money = SF.money, api = function () { return SF.api; };
  var P = { roles: ["admin"], shell: function (h, r, m) { return SF.shells.panel(h, r, m); } };
  function R(path, o) { SF.route(path, Object.assign({}, P, o)); } SF.adminRoute = R;
  /* on phones each row becomes a card: every cell carries its column name (data-l) */
  SF.labelCells = function (head, row) { var i = 0; return row.replace(/<td(?=[\s>])/g, function () { var h = String(head[i++] || "").replace(/<[^>]*>/g, "").replace(/"/g, "&quot;"); return '<td data-l="' + h + '"'; }); };
  function table(head, rows) { return '<div class="card tablecard"><div class="tscroll"><table class="tbl cardtbl"><thead><tr>' + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.map(function (r) { return SF.labelCells(head, r); }).join("") + "</tbody></table></div></div>"; }
  function areaSel() { return ""; }   // villages removed
  function areaSelOld(cityId, cur) { var ar = (SF.state.areas || []).filter(function (a) { return a.cityId === cityId; }); return ar.length ? '<label class="f">' + t("ar.village") + '<select name="areaId"><option value="">' + t("ar.none") + "</option>" + ar.map(function (a) { return '<option value="' + a.id + '"' + (a.id === cur ? " selected" : "") + ">" + esc(tx(a.name)) + "</option>"; }).join("") + "</select></label>" : ""; }
  function shopTypeSel(cur) { return '<label class="f">' + t("sht.label") + '<select name="shopType">' + ["tech", "grocery", "clothes", "home", "general"].map(function (k) { return '<option value="' + k + '"' + (k === (cur || "general") ? " selected" : "") + ">" + t("sht." + k) + "</option>"; }).join("") + "</select><small class=\"muted\">" + t("sht.hint") + "</small></label>"; }
  function sw(on, act, id, label) { return '<button class="switch' + (on ? " on" : "") + '" role="switch" aria-checked="' + on + '" data-act="' + act + '" data-id="' + id + '" aria-label="' + esc(label) + '"></button>'; }
  function hbars(list, fmt) { var max = Math.max.apply(null, list.map(function (x) { return x.v; }).concat([1]));
    return '<div class="hbars">' + list.map(function (x) { return '<div class="hb"><span class="hl">' + x.l + '</span><span class="ht"><i style="width:' + (x.v / max * 100).toFixed(1) + '%"></i></span><b class="num">' + fmt(x.v) + "</b></div>"; }).join("") + "</div>"; }
  function cityName(id) { return tx(((SF.state.allCities || SF.state.cities || []).filter(function (c) { return c.id === id; })[0] || {}).name); }

  /* no dashboard: the admin lands on «Services», where everything is switched on and off */
  R("/admin", { title: "adm.services", render: function () { setTimeout(function () { SF.go("/admin/my"); }, 0); return ""; } });

  /* ---------- Orders ---------- */
  /* «all orders to me» button with a timer, the closed-shop switch and the admin's own warehouse-shop */
  function leftTxt(ms) { var m = Math.max(1, Math.round(ms / 60000)), h = Math.floor(m / 60); return h ? h + " " + t("u.h") + " " + (m % 60) + " " + t("u.min") : m + " " + t("u.min"); }
  /* one simple control on the orders page: the daily break (no orders between two times) */
  function dctl(d) { var p = d.pause || { on: false, from: "13:00", to: "14:00" }, on = !!p.on;
    return '<form class="card pausecard' + (on ? " on" : "") + '" data-form="apause"><span class="bic">' + I("clock", 20) + '</span><div class="grow"><b>' + t("ps.title") + "</b><small>" + (on ? t("ps.onNow", { from: p.from, to: p.to }) : t("ps.offNow")) + "</small></div>" +
      '<label class="tin"><input type="time" name="from" required value="' + esc(p.from || "13:00") + '" aria-label="' + t("ps.from") + '"></label><span class="tlbl">—</span><label class="tin"><input type="time" name="to" required value="' + esc(p.to || "14:00") + '" aria-label="' + t("ps.to") + '"></label>' +
      '<input type="hidden" name="on" value="' + (on ? "1" : "") + '"><button type="button" class="switch' + (on ? " on" : "") + '" role="switch" aria-checked="' + on + '" data-act="apausesw" aria-label="' + t("ps.title") + '"></button><button class="btn sm primary">' + t("btn.save") + "</button></form>"; }
  SF.actions.apausesw = function (el) { var on = el.getAttribute("aria-checked") !== "true"; el.setAttribute("aria-checked", on); el.classList.toggle("on", on); el.closest("form").querySelector("[name=on]").value = on ? "1" : ""; };
  SF.actions.adirect = function (el) { var m = el.dataset.m, body;
    if (m === "off") body = { on: false }; else if (m === "22") { var e = new Date(); e.setHours(22, 0, 0, 0); if (e <= new Date()) e.setDate(e.getDate() + 1); body = { on: true, minutes: Math.max(1, Math.round((e - new Date()) / 60000)) }; } else body = { on: true, minutes: m ? Number(m) : null };
    return api().post("/admin/direct", body).then(function () { SF.toast(t(body.on ? "dc.started" : "dc.stopped")); SF.render({ quiet: true }); }, function (e) { SF.toast(SF.err(e), "err"); }); };
  SF.forms.apause = function (fd) { return api().post("/admin/direct", { pause: { on: !!fd.on, from: fd.from, to: fd.to } }).then(function () { return api().get("/settings/public"); }).then(function (p) { SF.state.pub = p; SF.toast(t("btn.saved")); SF.render({ quiet: true }); }, function (e) { SF.toast(SF.err(e), "err"); }); };
  SF.actions.aclosed = function (el) { return api().post("/admin/direct", { closedToMe: el.checked }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.aown = function () { return api().post("/admin/own-shop", {}).then(function () { return api().get("/auth/me"); }).then(function (u) { SF.state.user = u; SF.toast(t("own.created")); SF.render({ quiet: true }); }, function (e) { SF.toast(SF.err(e), "err"); }); };
  R("/admin/orders", { title: "adm.orders", live: true, render: function (p, q) {
    var f = q.status || "", s = q.q || "";
    return Promise.all([api().get("/admin/orders?status=" + f + "&q=" + encodeURIComponent(s)), api().get("/admin/direct")]).then(function (a) { var list = a[0], dc = a[1];
      SF.state.aorders = list;
      var help = list.filter(function (o) { return o.escalated && !o.byAdmin && (o.status === "pending" || o.status === "cooking"); });
      return dctl(dc) + (help.length ? '<section class="card stack helpbox"><h3>' + I("bell", 18) + " " + t("esc.title", { n: help.length }) + "</h3>" + help.map(function (o) {
        return '<div class="payrow"><span class="grow"><b>№' + o.number + " · " + esc(tx(o.restaurant.name)) + "</b><small>" + t(o.escalWhy === "nostock" ? "esc.nostock" : o.escalWhy === "direct" ? "esc.direct" : o.escalWhy === "closed" ? "esc.closed" : "esc.late") + " · " + esc(o.address.text || "") + '</small></span><b class="num">' + money(o.total) + '</b><button class="btn sm ok" data-act="atakeopen" data-id="' + o.id + '">' + t("esc.take") + "</button></div>"; }).join("") + "</section>" : "") +
      '<div class="toolbar"><div class="chips">' + [["", "adm.all"], ["active", "adm.active"], ["pending", "st.pending"], ["cooking", "st.cooking"], ["ready", "st.ready"], ["picked_up", "st.picked_up"], ["delivered", "st.delivered"], ["cancelled", "st.cancelled"], ["rejected", "st.rejected"]].map(function (x) {
        return '<a class="chip' + (f === x[0] ? " on" : "") + '" href="#/admin/orders?status=' + x[0] + '">' + t(x[1]) + "</a>"; }).join("") + '</div><form class="minisearch" data-form="aosearch">' + I("search", 16) + '<input name="q" value="' + esc(s) + '" placeholder="' + t("adm.searchOrders") + '" aria-label="' + t("adm.searchOrders") + '"></form></div>' +
        (list.length ? table(["№", t("tb.time"), t("adm.restaurant"), t("role.customer"), t("role.courier"), t("tb.sum"), t("tb.pay"), t("tb.status"), ""], list.map(function (o) {
          return '<tr><td class="num">' + o.number + '</td><td class="num">' + SF.dt(o.createdAt) + "</td><td>" + esc(tx(o.restaurant.name)) + "</td><td>" + esc(o.customer ? o.customer.name : o.dineIn ? t("tb.table", { n: o.tableName }) : "—") + "</td><td>" + esc(o.courier ? o.courier.name : "—") + '</td><td class="num">' + money(o.total) + "</td><td>" + t("pay." + o.payment.method) + "<small class=\"muted\"> · " + t("ps." + o.payment.status) + "</small></td><td>" + SF.statusPill(o.status) + '</td><td><button class="btn sm ghost" data-act="aorder" data-id="' + o.id + '">' + I("eye", 14) + t("btn.open") + "</button></td></tr>"; })) : SF.empty("receipt", t("adm.noOrders")));
    });
  } });
  SF.forms.aosearch = function (fd) { var q = SF.match(SF.path()).query; SF.go("/admin/orders?status=" + (q.status || "") + "&q=" + encodeURIComponent(fd.q || "")); };
  SF.actions.aorder = function (el) { var o = SF.state.aorders.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!o) return;
    var next = Object.keys(SomonRules.ORDER_FLOW[o.status] || {}).filter(function (s) { return SomonRules.canTransition(o.status, s, "admin") && !(s === "picked_up" && !o.courierId && !o.selfDelivery); });
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="stack"><h2 class="h2">№' + o.number + " " + SF.statusPill(o.status) + "</h2>" +
      '<div class="line"><span>' + t("adm.restaurant") + "</span><b>" + esc(tx(o.restaurant.name)) + '</b></div><div class="line"><span>' + t("role.customer") + "</span><span>" + (o.customer ? esc(o.customer.name) + ' · <span class="num">' + esc(SF.phone(o.phone || o.customer.phone)) + "</span>" : esc(t("tb.table", { n: o.tableName || "" }) + (o.guestName ? " · " + o.guestName : ""))) + '</span></div><div class="line"><span>' + t("co.address") + '</span><span class="right">' + esc(o.address.text) + "</span></div>" +
      o.items.map(function (i) { return '<div class="line muted"><span>' + esc(tx(i.name)) + " ×" + i.qty + '</span><span class="num">' + money(i.qty * i.price) + "</span></div>"; }).join("") +
      '<div class="line"><span>' + t("co.payment") + "</span><span>" + t("pay." + o.payment.method) + " · " + t("ps." + o.payment.status) + (o.payment.receiptId ? ' <button type="button" class="btn sm ghost" data-act="rcpt" data-id="' + o.id + '">' + t("tr.receipt") + "</button>" : "") + "</span></div>" +
      '<div class="line"><span>' + t("cart.delivery") + '</span><span class="num">' + money(o.deliveryFee) + '</span></div><div class="line tot"><span>' + t("cart.total") + '</span><b class="num">' + money(o.total) + "</b></div>" +
      (o.commission != null ? '<div class="line muted"><span>' + t("adm.commission") + " / " + t("k.platform") + '</span><span class="num">' + money(o.commission) + " / " + money(o.platform) + "</span></div>" : "") +
      (o.byAdmin ? '<p class="note ok">' + I("check", 16) + "<span>" + t("esc.byAdmin") + (o.sourceNote ? " · " + esc(o.sourceNote) : "") + "</span></p>" : "") +
      ((o.status === "pending" || (o.escalated && !o.byAdmin && o.status === "cooking")) ? '<button type="button" class="btn ok block" data-act="atakeopen" data-id="' + o.id + '">' + I("check", 16) + t("esc.take") + "</button>" : "") +
      '<p class="lbl">' + t("adm.history") + '</p><ol class="hist">' + o.history.map(function (h) { return '<li><span class="num">' + SF.dt(h.at) + "</span>" + SF.statusPill(h.status) + "</li>"; }).join("") + "</ol>" +
      (next.length ? '<p class="lbl">' + t("adm.changeStatus") + '</p><div class="tags">' + next.map(function (s) { return '<button class="btn sm ' + (s === "cancelled" || s === "rejected" ? "danger" : "ghost") + '" data-act="aset" data-id="' + o.id + '" data-v="' + s + '">' + t("st." + s) + "</button>"; }).join("") + "</div>" : "") + "</div>", "wide"); };
  /* take the order over for the shop: where I buy it, and I deliver it myself */
  SF.actions.atakeopen = function (el) { var o = (SF.state.aorders || []).filter(function (x) { return x.id === el.dataset.id; })[0]; if (!o) return;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="atake" data-id="' + o.id + '"><h2 class="h2">№' + o.number + " · " + esc(tx(o.restaurant.name)) + "</h2>" +
      o.items.map(function (i) { return '<div class="line muted"><span>' + esc(tx(i.name)) + " ×" + i.qty + '</span><span class="num">' + money(i.qty * i.price) + "</span></div>"; }).join("") +
      '<div class="line"><span>' + t("co.address") + '</span><span class="right">' + esc(o.address.text) + "</span></div>" +
      '<label class="f">' + t("esc.source") + '<input name="source" placeholder="' + t("esc.sourcePh") + '" maxlength="120"></label>' +
      '<label class="checkrow"><input type="checkbox" name="self" checked><span>' + t("esc.self") + '<small class="muted">' + t("esc.selfHint") + "</small></span></label>" +
      '<button class="btn primary block lg">' + I("check", 18) + t("esc.takeBtn") + "</button></form>"); };
  SF.forms.atake = function (fd, f) { return api().post("/admin/orders/" + f.dataset.id + "/takeover", { source: fd.source || "", self: !!fd.self }).then(function () { SF.closeModal(); SF.toast(t("esc.taken")); SF.render({ quiet: true }); }, function (e) { SF.toast(SF.err(e), "err"); }); };
  SF.actions.aset = function (el) { return api().post("/admin/orders/" + el.dataset.id + "/status", { status: el.dataset.v }).then(function () { SF.closeModal(); SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };

  /* ---------- Restaurants ---------- */
  R("/admin/restaurants", { title: "adm.restaurants", render: function () {
    return api().get("/admin/restaurants").then(function (list) {
      SF.state.arests = list;
      var due = [];   // no subscriptions
      return '<div class="toolbar"><p class="muted">' + t("adm.restCount", { n: list.length }) + '</p><button class="btn primary" data-act="arestnew">' + I("plus", 18) + t("adm.addRest") + "</button></div>" +
        (due.length ? '<section class="card subdue"><h3>' + I("clock", 18) + t("sub.dueTitle", { n: due.length }) + "</h3>" + due.map(function (r) { return '<div class="line"><span><b>' + esc(tx(r.name)) + "</b> " + subPill(r.sub) + '</span><button class="btn sm primary" data-act="asub" data-id="' + r.id + '">' + I("wallet", 14) + t("sub.extend") + "</button></div>"; }).join("") + "</section>" : "") +
        table([t("adm.restaurant"), t("dl.who"), t("k.rating"), t("adm.ordersN"), t("adm.status"), t("adm.activeL")], list.map(function (r) {
          return '<tr><td><div class="tcell"><span class="cim" style="--tone:' + esc(r.tone) + '">' + SF.art(r.kind === "shop" ? "box" : "plate", 30) + "</span><div><b>" + esc(tx(r.name)) + "</b>" + (r.kind === "shop" ? ' <span class="pill p-info">' + t("sh.kShop") + "</span>" : "") +
            '<label class="pinsw"><span>' + t("sh.first") + "</span>" + sw(!!r.pinned, "apin", r.id, t("sh.pinned")) + "</label>" + '<small class="muted num">' + esc(r.owner ? SF.phone(r.owner.phone) : "") + '</small><button type="button" class="link sm" data-act="arestedit" data-id="' + r.id + '">' + I("edit", 14) + " " + t("btn.edit") + '</button> <button type="button" class="link sm dgh" data-act="arestdel" data-id="' + r.id + '" data-name="' + esc(tx(r.name)) + '">' + I("trash", 14) + " " + t("ud.btn") + "</button></div></div></td><td>" + '<select class="dsel" data-input="adeliv" data-id="' + r.id + '" aria-label="' + t("dl.who") + '">' + ["platform", "own", "mixed"].map(function (m) { return '<option value="' + m + '"' + ((r.delivery || "platform") === m ? " selected" : "") + ">" + t("dl.m." + m) + "</option>"; }).join("") + "</select></td><td>" + SF.stars(r.rating) + '</td><td class="num">' + r.orderCount + "</td>" +
            "<td>" + (r.isOpenNow ? '<span class="pill p-ok">' + t("rest.openNow") + "</span>" : '<span class="pill p-mut">' + t("rest.closedShort") + "</span>") + "</td><td>" + sw(r.active, "arest", r.id, t("adm.activeL")) + "</td></tr>"; }));
    });
  } });
  /* delete a place completely (main admin) */
  SF.actions.arestdel = function (el) { SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="confirm"><span class="cic">' + I("trash", 26) + '</span><h2 class="h2">' + t("rd.t", { name: esc(el.dataset.name) }) + '</h2><p class="muted">' + t("rd.p") + '</p><button class="btn danger block" data-act="arestdelgo" data-id="' + el.dataset.id + '">' + t("rd.go") + '</button><button class="btn ghost block" data-act="closemodal">' + t("btn.cancel") + "</button></div>"); };
  SF.actions.arestdelgo = function (el) { return api().post("/admin/restaurants/" + el.dataset.id + "/delete", { confirm: true }).then(function (n) { SF.closeModal(); SF.toast(t("rd.done", { o: n.orders, p: n.products })); SF.render({ quiet: true }); }); };
  /* empty a whole service */
  SF.actions.asvclear = function (el) { SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="confirm"><span class="cic">' + I("trash", 26) + '</span><h2 class="h2">' + t("sc.t", { name: t("sv." + el.dataset.k) }) + '</h2><p class="muted">' + t("sc.p", { n: el.dataset.n }) + '</p><button class="btn danger block" data-act="asvcleargo" data-k="' + el.dataset.k + '">' + t("sc.go") + '</button><button class="btn ghost block" data-act="closemodal">' + t("btn.cancel") + "</button></div>"); };
  SF.actions.asvcleargo = function (el) { return api().post("/admin/services/" + el.dataset.k + "/clear", { confirm: true }).then(function (n) { SF.closeModal(); SF.toast(t("sc.done", { n: n.items })); SF.render({ quiet: true }); }); };
  /* ---------- Subscription: the owner pays you monthly (cash), you extend his access ---------- */
  function subPill(sb) { if (!sb || sb.state === "none") return '<span class="pill p-mut">' + t("sub.unlimited") + "</span>";
    if (sb.state === "expired") return '<span class="pill p-bad">' + t("sub.expired") + "</span>";
    return '<span class="pill ' + (sb.state === "soon" ? "p-warn" : "p-ok") + '">' + (sb.trial ? t("sub.trial") + " · " : "") + t("sub.until", { d: SF.fullDate(sb.until) }) + '</span><small class="muted num subleft">' + t("sub.left", { n: sb.daysLeft }) + "</small>"; }
  SF.subPill = subPill;
  SF.fullDate = function (ms) { var d = new Date(ms); return SF.date(ms) + "." + d.getFullYear(); };
  function addMonths(tm, n) { var d = new Date(tm), day = d.getDate(); d.setMonth(d.getMonth() + n); if (d.getDate() < day) d.setDate(0); return d.getTime(); }
  SF.actions.asub = function (el) { var r = SF.state.arests.filter(function (x) { return x.id === el.dataset.id; })[0];
    return Promise.all([api().get("/admin/settings"), api().get("/admin/subscriptions?restaurantId=" + r.id)]).then(function (a) {
      var fee = a[0].subFee, hist = a[1]; SF.state.subFee = fee; SF.state.subR = r; SF.state.subM = 1;
      SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="asub" data-id="' + r.id + '"><h2 class="h2">' + t("sub.extend") + ": " + esc(tx(r.name)) + "</h2>" +
        '<div class="line"><span>' + t("sub.now") + "</span>" + subPill(r.sub) + "</div>" +
        '<div class="f"><span>' + t("sub.howLong") + '</span><div class="seg wide" role="group">' + [1, 3, 6, 12].map(function (m) { return '<button type="button" class="' + (m === 1 ? "on" : "") + '" aria-pressed="' + (m === 1) + '" data-act="asubm" data-v="' + m + '">' + t(m === 12 ? "sub.year" : "sub.months", { n: m }) + "</button>"; }).join("") + "</div></div>" +
        '<label class="f">' + t("sub.amount") + '<input name="amount" id="subamt" inputmode="numeric" required value="' + fee + '"></label>' +
        '<label class="f">' + t("sub.note") + '<input name="note" maxlength="120" placeholder="' + t("sub.notePh") + '"></label>' +
        '<div class="msg ok" id="subnew">' + subNew() + "</div>" +
        '<button class="btn primary block lg">' + I("check", 18) + t("sub.confirm") + "</button>" +
        (hist.length ? '<p class="lbl">' + t("sub.history") + '</p><div class="subhist">' + hist.map(function (h, i) { return '<div class="line"><span class="num">' + SF.fullDate(h.at) + "</span><span>" + (h.kind === "trial" ? t("sub.trialRow", { n: h.days }) : t(h.months === 12 ? "sub.year" : "sub.months", { n: h.months })) + " → " + SF.fullDate(h.until) + '</span><b class="num">' + (h.amount ? money(h.amount) : "—") + "</b>" + (i === 0 && h.kind === "paid" ? '<button type="button" class="iconbtn" data-act="asubdel" data-id="' + h.id + '" aria-label="' + t("sub.undo") + '" title="' + t("sub.undo") + '">' + I("trash", 16) + "</button>" : "") + "</div>"; }).join("") + "</div>" : "") +
        "</form>", "wide"); }); };
  function subNew() { var r = SF.state.subR, from = Math.max(Date.now(), r.sub.until || 0); return I("clock", 16) + t("sub.newUntil", { d: SF.fullDate(addMonths(from, SF.state.subM)) }); }
  SF.actions.asubm = function (el) { var m = +el.dataset.v; SF.state.subM = m;
    Array.prototype.forEach.call(el.parentNode.children, function (b) { var on = b === el; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    document.getElementById("subamt").value = SF.state.subFee * m; document.getElementById("subnew").innerHTML = subNew(); };
  SF.forms.asub = function (fd, f) { return api().post("/admin/restaurants/" + f.dataset.id + "/subscription", { months: SF.state.subM, amount: Number(fd.amount), note: fd.note }).then(function (r) {
    SF.closeModal(); SF.toast(t("sub.done", { name: tx(r.name), d: SF.fullDate(r.sub.until) })); SF.render({ quiet: true }); }); };
  SF.actions.asubdel = function (el) { return api().del("/admin/subscriptions/" + el.dataset.id).then(function () { SF.closeModal(); SF.toast(t("sub.undone"), "info"); SF.render({ quiet: true }); }); };
  /* storage: how full the disk is and the daily cleanup */
  function mb(n) { return n == null ? "—" : n < 1048576 ? Math.max(1, Math.round(n / 1024)) + " KB" : (n / 1048576).toFixed(n < 104857600 ? 1 : 0) + " MB"; }
  function storageCard(st) {
    var i = st.info, lc = st.lastCleanup, cap = i && i.disk ? i.disk : 1073741824, used = i ? (i.disk && i.free != null ? i.disk - i.free : i.total) : null, pct = used != null ? Math.min(100, Math.round(used / cap * 100)) : null;
    var row = function (k, v) { return '<div class="line"><span>' + t(k) + '</span><b class="num">' + mb(v) + "</b></div>"; };
    return '<form class="card stack" data-form="aclean"><h3>' + I("box", 18) + t("st.title") + '</h3><p class="fine">' + t("st.sub") + "</p>" +
      (i ? '<div class="stbar' + (pct > 80 ? " hot" : "") + '"><i style="width:' + pct + '%"></i></div><div class="line"><span>' + t("st.used") + '</span><b class="num">' + mb(used) + " / " + mb(cap) + " · " + pct + "%</b></div>" +
        row("st.db", i.db) + row("st.receipts", i.receipts) + row("st.media", i.media) + row("st.archive", i.archive) + row("st.backups", i.backups)
        : '<div class="msg info">' + I("info", 16) + t("st.demo") + "</div>") +
      '<div class="line"><span>' + t("st.orders") + '</span><b class="num">' + st.orders + (st.archived ? " + " + t("st.inArchive", { n: st.archived.orders }) : "") + "</b></div>" +
      '<p class="fine">' + (lc ? t("st.last", { d: SF.dt(lc.at), r: lc.receipts, o: lc.orders }) : t("st.never")) + "</p>" +
      '<div class="grid2"><label class="f">' + t("st.receiptDays") + '<input name="receiptDays" inputmode="numeric" value="' + st.receiptDays + '"></label><label class="f">' + t("st.archiveDays") + '<input name="archiveDays" inputmode="numeric" value="' + st.archiveDays + '"></label></div>' +
      '<div class="row2"><button class="btn ghost">' + t("btn.save") + '</button><button type="button" class="btn primary" data-act="acleannow">' + I("trash", 16) + t("st.now") + "</button></div></form>";
  }
  SF.forms.aclean = function (fd) { return api().patch("/admin/settings", { receiptDays: Number(fd.receiptDays), archiveDays: Number(fd.archiveDays) }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.acleannow = function () { return api().post("/admin/cleanup").then(function (r) { SF.toast(t("st.done", { r: r.receipts, o: r.orders })); SF.render({ quiet: true }); }); };
  /* phone verification: which channels are on (they turn on from the server settings) and whether sign-up requires it */
  function verifyCard(s) {
    var st = s.verifyStatus, row = function (icon, name, val) { var on = val && val !== "off" && val !== "error";
      return '<div class="line"><span>' + I(icon, 16) + " " + name + "</span>" + '<span class="pill ' + (on ? "p-ok" : val === "error" ? "p-bad" : "p-mut") + '">' + (on ? (val === "on" ? t("vfa.on") : esc(val)) : t(val === "error" ? "vfa.error" : "vfa.off")) + "</span></div>"; };
    return '<section class="card stack"><h3>' + I("shield", 18) + t("vfa.title") + '</h3><p class="fine">' + t("vfa.sub") + "</p>" +
      (st ? row("send", "Telegram " + t("vfa.bot"), st.telegramBot) + (st.telegramBot === "off" ? row("send", "Telegram Gateway", st.telegramGateway) : "") + (st.whatsapp && st.whatsapp !== "off" ? row("chat", "WhatsApp", st.whatsapp) : "") + (st.sms && st.sms !== "off" ? row("sms", "SMS", st.sms) : "")
        : '<div class="line"><span>' + I("shield", 16) + " " + t("vf.demo") + '</span><span class="pill p-ok">' + t("vfa.on") + "</span></div>") +
      (s.verifyChannels && s.verifyChannels.length ? '<label class="checkrow"><input type="checkbox" data-input="averify"' + (s.verifyRequired === true ? " checked" : "") + "><span>" + t("vfa.required") + '<small class="muted">' + t("vfa.requiredHint") + "</small></span></label>"
        : '<div class="msg info">' + I("info", 16) + t("vfa.none") + "</div>") +
      '<p class="fine">' + t("vfa.how") + "</p></section>";
  }
  SF.inputs.averify = function (v, el) { return SF.api.patch("/admin/settings", { verifyRequired: el.checked }).then(function () { return SF.api.get("/settings/public"); }).then(function (p) { SF.state.pub = p; SF.toast(t("btn.saved")); }); };
  SF.forms.asubset = function (fd) { return api().patch("/admin/settings", { subFee: Number(fd.subFee), trialDays: Number(fd.trialDays) }).then(function () { SF.toast(t("btn.saved")); }); };
  SF.inputs.adeliv = function (v, el) { return api().patch("/admin/restaurants/" + el.dataset.id, { delivery: v }).then(function () { SF.toast(t("dl.saved", { m: t("dl.m." + v) })); }, function (e) { SF.toast(SF.err(e), "err"); }); };
  SF.forms.acom = function (fd, f) { return api().patch("/admin/restaurants/" + f.dataset.id, { commissionPct: Number(fd.v) }).then(function () { SF.toast(t("btn.saved")); }); };
  SF.actions.arest = function (el) { return api().patch("/admin/restaurants/" + el.dataset.id, { active: el.getAttribute("aria-checked") !== "true" }).then(function () { SF.render({ quiet: true }); }); };
  /* ---------- new restaurant: one page — name, town, manager, place on the map, delivery area, access ---------- */
  var ACCESS = [["t7", 7, 0], ["t14", 14, 0], ["m1", 0, 1], ["m2", 0, 2], ["m3", 0, 3], ["m6", 0, 6], ["m12", 0, 12]];
  function nr() { return SF.state.nr || (SF.state.nr = { mode: "pin", kind: "food", pin: null, pts: [], marks: [], access: "m1", cityId: SF.state.cityId || ((SF.state.cities || [])[0] || {}).id, f: {} }); }
  R("/admin/restaurants/new", { title: "adm.addRest", render: function () {
    var x = nr(), c = (SF.state.cities || []).filter(function (y) { return y.id === x.cityId; })[0] || (SF.state.cities || [])[0], f = x.f, acc = ACCESS.filter(function (a) { return a[0] === x.access; })[0];
    x.marks.length = 0; if (x.pin) x.marks.push({ lat: x.pin.lat, lng: x.pin.lng, type: "rest", label: "R" });
    var inp = function (n, label, extra) { return '<label class="f">' + label + '<input name="' + n + '" data-input="nrf" value="' + esc(f[n] || "") + '"' + (extra || "") + "></label>"; };
    return '<a class="backlink" href="#/admin/restaurants">' + I("chevL", 18) + t("adm.restaurants") + "</a>" +
      '<form class="nrform stack" data-form="nrsave">' +
      '<section class="card stack"><h3><span class="num stepn">1</span>' + t("nr.place") + "</h3>" +
        '<div class="seg nrkind" role="group">' + [["food", "store", "sh.kFood"], ["shop", "bag", "sh.kShop"]].map(function (k) { return '<button type="button" class="' + (x.kind === k[0] ? "on" : "") + '" aria-pressed="' + (x.kind === k[0]) + '" data-act="nrkind" data-v="' + k[0] + '">' + I(k[1], 16) + " " + t(k[2]) + "</button>"; }).join("") + "</div>" +
        inp("name", t(x.kind === "shop" ? "sh.name" : "adm.restName"), " required") +
        inp("cuisine", t("adm.cuisine"), ' placeholder="' + t("adm.cuisinePh") + '"') +
        (x.kind === "shop" ? shopTypeSel(x.f.shopType) : "") + areaSel(x.cityId, x.f.areaId) +
        inp("address", t("adm.addrL"), ' data-geo="nrmap" placeholder="' + t("nr.addrPh") + '"') +
        '<div class="lbl">' + t("dl.who") + '</div><div class="nrdel">' + [["platform", "scooter"], ["own", "store"], ["mixed", "route"]].map(function (m) { var on = (x.f.delivery || "platform") === m[0]; return '<label class="nrdl' + (on ? " on" : "") + '"><input type="radio" name="delivery" value="' + m[0] + '" data-input="nrf"' + (on ? " checked" : "") + ">" + I(m[1], 20) + "<b>" + t("dl.m." + m[0]) + "</b><small>" + t("dl.desc." + m[0], { n: (SF.state.pub && SF.state.pub.handoffMin) || 7 }) + "</small></label>"; }).join("") + "</div>" +
        '<label class="checkrow"><input type="checkbox" name="pinned"' + (x.f.pinned ? " checked" : "") + "><span>" + t("sh.pinned") + '<small class="muted">' + t("sh.pinnedHint") + "</small></span></label>" +
        '<label class="checkrow"><input type="checkbox" name="pickup"' + (x.f.pickup != null ? (x.f.pickup ? " checked" : "") : x.kind === "shop" ? " checked" : "") + "><span>" + t("sh.pickupSet") + '<small class="muted">' + t("sh.pickupSetSub") + "</small></span></label></section>" +
      '<section class="card stack"><h3><span class="num stepn">2</span>' + t("nr.manager") + '</h3><div class="grid2">' + inp("ownerName", t("nr.mName")) +
        '<label class="f">' + t("nr.mPhone") + '<span class="phonein"><i>+992</i><input name="ownerPhone" data-input="nrf" inputmode="tel" value="' + esc(f.ownerPhone || "") + '" required></span></label></div><p class="fine">' + t("nr.mNote") + "</p></section>" +
      '<section class="card stack"><h3><span class="num stepn">3</span>' + t("nr.map") + "</h3>" +
        '<div class="seg nrmode" role="group">' + [["pin", "pin", "nr.modePin"], ["zone", "edit", "nr.modeZone"]].map(function (m) { return '<button type="button" class="' + (x.mode === m[0] ? "on" : "") + '" aria-pressed="' + (x.mode === m[0]) + '" data-act="nrmode" data-v="' + m[0] + '">' + I(m[1], 16) + " " + t(m[2]) + "</button>"; }).join("") + "</div>" +
        '<p class="fine">' + t(x.mode === "pin" ? "nr.pinHow" : "nr.zoneHow") + "</p>" +
        SF.mapFind("nrmap") + '<div class="zmap">' + SF.tmap({ key: "nrmap", center: x.pin || { lat: c.lat, lng: c.lng }, zoom: 14, free: true, label: t("nr.map"), markers: x.marks, edit: function () { return nr().pts; },
          onTap: function (pt) { var s = nr(); if (s.mode === "pin") { s.pin = pt; s.marks.length = 0; s.marks.push({ lat: pt.lat, lng: pt.lng, type: "rest", label: "R" }); } else if (s.pts.length < 200) s.pts.push(pt); nrInfo(); } }) + "</div>" +
        '<p class="zcount" id="nrinfo"></p>' +
        (x.mode === "zone" ? '<div class="zbtns"><button type="button" class="btn ghost" data-act="nrundo">' + I("chevL", 16) + t("zn.undo") + '</button><button type="button" class="btn ghost" data-act="nrclear">' + I("trash", 16) + t("zn.clear") + "</button></div>" : "") + "</section>" +
      '<button class="btn primary block lg">' + I("check", 18) + t("nr.create") + "</button></form>";
  } });
  function nrInfo() { var s = nr(), el = document.getElementById("nrinfo"); if (!el) return;
    el.innerHTML = (s.pin ? I("check", 14) + " " + t("nr.pinOk") : I("info", 14) + " " + t("nr.pinNo")) + " · " + (s.pts.length >= 3 ? t("zn.ok", { n: s.pts.length }) : s.pts.length ? t("zn.need", { n: s.pts.length }) : t("nr.zoneNo")); }
  SF.after.push(function () { if (document.getElementById("nrinfo")) nrInfo(); });
  SF.inputs.nrf = function (v, el) { nr().f[el.name] = v; if (el.name === "delivery") SF.render({ quiet: true }); };
  /* a found place: the pin goes there; if no town of ours is near, the town is added by itself (the app works town by town) */
  SF.mapPick = SF.mapPick || {};
  SF.mapPick.nrmap = function (pt, name) { var s = nr(); s.mode = "pin"; s.pin = pt; s.marks.length = 0; s.marks.push({ lat: pt.lat, lng: pt.lng, type: "rest", label: "R" }); SF.redrawMap("nrmap"); nrInfo(); return;
    var near = (SF.state.cities || []).filter(function (c) { return SF.geo.km(c, pt) <= 40; }).sort(function (a, b) { return SF.geo.km(a, pt) - SF.geo.km(b, pt); })[0];
    if (near) { if (near.id !== s.cityId) { s.cityId = near.id; SF.toast(t("mf.townIs", { name: tx(near.name) })); SF.render({ quiet: true }); } SF.redrawMap("nrmap"); nrInfo(); return; }
    var nm = String(name || "").trim(); if (nm.length < 2) { SF.redrawMap("nrmap"); nrInfo(); return; }
    return api().post("/admin/cities", { name: nm, lat: pt.lat, lng: pt.lng }).then(function (c) { return api().get("/cities").then(function (cs) { SF.state.cities = cs; s.cityId = c.id; s.pts = []; SF.toast(t("mf.townAdded", { name: nm })); SF.render({ quiet: true }); }); }, function (e) { SF.toast(SF.err(e), "err"); }); };
  SF.inputs.nrcity = function (v) { var s = nr(); s.cityId = v; s.pin = null; s.pts = []; var c = (SF.state.cities || []).filter(function (y) { return y.id === v; })[0]; if (c) SF.tmapCenter("nrmap", { lat: c.lat, lng: c.lng }, 14); SF.render({ quiet: true }); };
  SF.actions.nrmode = function (el) { nr().mode = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.nracc = function (el) { nr().access = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.nrundo = function () { var s = nr(); s.pts.pop(); SF.redrawMap("nrmap"); nrInfo(); };
  SF.actions.nrclear = function () { nr().pts = []; SF.redrawMap("nrmap"); nrInfo(); };
  SF.actions.apin = function (el) { var on = el.getAttribute("aria-checked") !== "true"; return api().patch("/admin/restaurants/" + el.dataset.id, { pinned: on }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.nrkind = function (el) { nr().kind = el.dataset.v; SF.render({ quiet: true }); };
  SF.forms.nrsave = function (fd) { var s = nr(), a = ACCESS.filter(function (x) { return x[0] === s.access; })[0];
    if (s.pts.length && s.pts.length < 3) { SF.toast(t("zn.need", { n: s.pts.length }), "err"); return; }
    var body = { delivery: s.f.delivery || "platform", kind: s.kind || "food", shopType: s.kind === "shop" ? (fd.shopType || "general") : undefined, pinned: !!fd.pinned, pickup: !!fd.pickup, name: fd.name, cuisine: fd.cuisine, address: fd.address, ownerName: fd.ownerName, ownerPhone: fd.ownerPhone, commissionPct: 0,
      lat: s.pin ? s.pin.lat : null, lng: s.pin ? s.pin.lng : null, zone: s.pts.length >= 3 ? s.pts : [] };
    return api().post("/admin/restaurants", body).then(function (r) { SF.state.nr = null; SF.go("/admin/restaurants"); setTimeout(function () { creds(tx(r.name), r.login); }, 300); }); };
  SF.actions.arestnew = function () { SF.state.nr = null; SF.go("/admin/restaurants/new"); return; api().get("/admin/settings").then(function (s) { var el = document.getElementById("trialdays"); if (el) el.value = s.trialDays; });
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="arestnew"><h2 class="h2">' + t("adm.addRest") + '</h2><label class="f">' + t("adm.restName") + '<input name="name" required></label>' +
      '<div class="grid2"><label class="f">' + t("profile.city") + '<select name="cityId">' + (SF.state.cities || []).map(function (c) { return '<option value="' + c.id + '">' + esc(tx(c.name)) + "</option>"; }).join("") + '</select></label><label class="f">' + t("adm.cuisine") + '<input name="cuisine" placeholder="' + t("adm.cuisinePh") + '"></label></div>' +
      '<div class="grid2"><label class="f">' + t("adm.ownerName") + '<input name="ownerName"></label><label class="f">' + t("adm.ownerPhone") + '<span class="phonein"><i>+992</i><input name="ownerPhone" inputmode="tel" required></span></label></div>' +
      '<div class="grid2"><label class="f">' + t("adm.commission") + ', %<input name="commissionPct" inputmode="numeric" value="15"></label><label class="f">' + t("sub.trialDays") + '<input name="trialDays" id="trialdays" inputmode="numeric" value="30"></label></div><p class="fine">' + t("adm.ownerNote") + '</p><button class="btn primary block">' + t("btn.create") + "</button></form>", "wide"); };
  SF.actions.arestedit = function (el) { var r = SF.state.arests.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!r) return; var o = r.owner || {};
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="arestedit" data-id="' + r.id + '"><h2 class="h2">' + esc(tx(r.name)) + '</h2>' +
      '<label class="f">' + t("adm.restName") + '<input name="name" value="' + esc(tx(r.name)) + '" required></label>' +
      '<label class="f">' + t("adm.cuisine") + '<input name="cuisine" value="' + esc(tx(r.cuisine) === "—" ? "" : tx(r.cuisine)) + '"></label>' +
      (r.kind === "shop" ? shopTypeSel(r.shopType) : "") + areaSel(r.cityId, r.areaId) +
      '<div class="grid2"><label class="f">' + t("adm.addrL") + '<input name="address" value="' + esc(tx(r.address) || "") + '"></label><label class="f">' + t("adm.restPhone") + '<span class="phonein"><i>+992</i><input name="phone" inputmode="tel" value="' + esc(String(r.phone || "").replace(/^\+992/, "")) + '"></span></label></div>' +
      '<h3 class="h3">' + t("adm.ownerT") + '</h3><div class="grid2"><label class="f">' + t("adm.ownerName") + '<input name="ownerName" value="' + esc(o.name || "") + '"></label><label class="f">' + t("adm.ownerPhone") + '<span class="phonein"><i>+992</i><input name="ownerPhone" inputmode="tel" value="' + esc(String(o.phone || "").replace(/^\+992/, "")) + '"></span></label></div>' +
      '<p class="fine">' + t("adm.ownerPhoneNote") + '</p><button class="btn primary block">' + t("btn.save") + "</button>" +
      '<a class="btn ghost block" href="#/admin/rzone/' + r.id + '" data-act="closemodal" data-go="/admin/rzone/' + r.id + '">' + I("pin", 16) + t(r.zone && r.zone.length > 2 ? "zn.redit" : "zn.rdraw") + "</a>" +
      '<button type="button" class="btn ghost block" data-act="atpl" data-id="' + r.id + '">' + I("grid", 16) + t("tpl.btn") + "</button>" +
      (o.id ? '<button type="button" class="btn ghost block" data-act="aownerpass" data-id="' + o.id + '" data-name="' + esc(tx(r.name)) + '">' + I("shield", 16) + t("adm.ownerNewPass") + "</button>" : "") + "</form>", "wide"); };
  SF.forms.arestedit = function (fd, f) { return api().patch("/admin/restaurants/" + f.dataset.id, fd).then(function () { SF.closeModal(); SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.atpl = function (el) { SF.modal('<div class="confirm"><span class="cic">' + I("grid", 26) + '</span><h2 class="h2">' + t("tpl.q") + '</h2><p class="muted">' + t("tpl.sub") + '</p><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn primary" data-act="atplok" data-id="' + el.dataset.id + '">' + t("tpl.go") + "</button></div></div>"); };
  SF.actions.atplok = function (el) { var id = el.dataset.id; return api().post("/admin/restaurants/" + id + "/template", { key: "tj-uz" }).then(function (r) { SF.closeModal(); SF.toast(t("tpl.done", { n: r.added })); SF.go("/admin/products?r=" + id); }); };
  SF.actions.aownerpass = function (el) { return api().post("/admin/users/" + el.dataset.id + "/password").then(function (l) { creds(el.dataset.name, l); }); };
  SF.forms.arestnew = function (fd) { fd.trialDays = Number(fd.trialDays); return api().post("/admin/restaurants", fd).then(function (r) { SF.render({ quiet: true }); creds(tx(r.name), r.login); }); };
  /* one-time login shown once: the admin passes it to the partner, who changes it in settings */
  function creds(name, login) {
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="stack"><h2 class="h2">' + t("adm.credsTitle") + '</h2><p class="muted">' + t("adm.credsSub", { name: name }) + "</p>" +
      '<div class="creds"><span>' + t("auth.phone") + '</span><code class="num">' + esc(SF.phone(login.phone)) + "</code><span>" + t("auth.password") + '</span><code class="num" id="callnum">' + esc(login.password) + "</code></div>" +
      '<button type="button" class="btn ghost block" data-act="copynum" data-v="' + esc(SF.phone(login.phone) + " / " + login.password) + '">' + I("copy", 16) + t("adm.credsCopy") + '</button><p class="fine">' + t("adm.credsNote") + "</p></div>");
  }
  SF.actions.apass = function (el) { return api().post("/admin/users/" + el.dataset.id + "/password").then(function (r) { creds(el.dataset.name, r); }); };

  /* ---------- Couriers & users ---------- */
  R("/admin/couriers", { title: "adm.couriers", live: true, render: function () {
    return api().get("/admin/users?role=courier").then(function (list) {
      return '<div class="toolbar"><p class="muted">' + t("adm.courOnline", { n: list.filter(function (u) { return u.courier.online; }).length, all: list.length }) + '</p><button class="btn primary" data-act="acournew">' + I("plus", 18) + t("adm.addCourier") + "</button></div>" +
        table([t("role.courier"), t("adm.status"), t("k.rating"), t("adm.ordersN"), t("cour.vehicle"), t("adm.activeL")], list.map(function (u) {
          return '<tr><td><div class="tcell"><span class="avatar sm">' + esc(u.name.charAt(0)) + "</span><div><b>" + esc(u.name) + '</b>' + (u.courier.restaurantName ? '<small class="ownlbl">' + I("store", 12) + esc((u.courier.restaurantNames || [u.courier.restaurantName]).map(tx).join(", ")) + '</small>' : '') + '<small class="muted num">' + esc(SF.phone(u.phone)) + "</small></div></div></td><td>" + (u.courier.online ? '<span class="pill p-ok">' + t("cour.onlineL") + "</span>" : '<span class="pill p-mut">' + t("cour.offlineL") + "</span>") + "</td><td>" + SF.stars(u.courier.rating) + '</td><td class="num">' + u.orderCount + "</td><td>" + t("veh." + u.courier.vehicle) + (u.courier.carNumber ? '<br><small class="num code">' + esc(u.courier.carNumber) + "</small>" : "") + (u.courier.passport ? '<br><small class="muted num">' + I("user", 12) + " " + esc(u.courier.passport) + "</small>" : "") + '<br><button type="button" class="link sm" data-act="acouredit" data-id="' + u.id + '">' + I("edit", 12) + " " + t("btn.edit") + "</button></td><td>" + sw(u.active, "auser", u.id, t("adm.activeL")) + "</td></tr>"; }));
    });
  } });
  /* new courier: name, phone, town, vehicle (car / moto with its number, bike, on foot), passport */
  function courForm(u) { u = u || { courier: { vehicle: "car" } }; var c = u.courier, v = SF.state.cveh || c.vehicle || "car";
    return '<label class="f">' + t("profile.name") + '<input name="name" required value="' + esc(u.name || "") + '"></label>' +
      (u.id ? "" : '<label class="f">' + t("auth.phone") + '<span class="phonein"><i>+992</i><input name="phone" inputmode="tel" required></span></label>') +
      /* the vehicle is typed by the admin («Скутер», «Мошини Нексия», «Велосипед»…), with suggestions */
      '<div class="grid2"><label class="f">' + t("cour.vehicle") + '<input name="vehicle" list="vehlist" maxlength="30" value="' + esc(SF.vehName(v)) + '" placeholder="' + t("veh.scooter") + '"><datalist id="vehlist">' + ["scooter", "car", "bike", "foot"].map(function (k) { return '<option value="' + esc(t("veh." + k)) + '">'; }).join("") + "</datalist></label>" +
      '<label class="f">' + t("cr.carNum") + '<input name="carNumber" value="' + esc(c.carNumber || "") + '" placeholder="01 TJ 1234 AA" autocapitalize="characters"></label></div>' +
      '<div class="f"><span>' + t("cr.rests") + '</span><div class="chklist" role="group" aria-label="' + t("cr.rests") + '">' + ((SF.state.arests || []).length ? (SF.state.arests || []).map(function (r) { var on = (c.restaurantIds || (c.restaurantId ? [c.restaurantId] : [])).indexOf(r.id) >= 0; return '<label class="checkrow"><input type="checkbox" name="rid" value="' + r.id + '"' + (on ? " checked" : "") + "><span>" + esc(tx(r.name)) + ' <small class="muted">' + t(r.kind === "shop" ? "sh.kShop" : "sh.kFood") + "</small></span></label>"; }).join("") : '<p class="muted">' + t("cr.noRests") + "</p>") + '</div><small class="hint">' + t("cr.restsHint") + "</small></div>" +
      '<label class="f">' + t("cr.passport") + '<input name="passport" value="' + esc(c.passport || "") + '" placeholder="A 1234567" autocapitalize="characters"><small class="hint">' + t("cr.passportHint") + "</small></label>"; }
  SF.actions.cveh = function (el) { SF.state.cveh = el.dataset.v; document.getElementById("cvehv").value = el.dataset.v; el.parentNode.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b === el); b.setAttribute("aria-pressed", b === el); });
    var cn = document.getElementById("carnum"); if (cn) cn.hidden = !(el.dataset.v === "car" || el.dataset.v === "scooter"); };
  SF.actions.acournew = function () { SF.state.cveh = null; return api().get("/admin/restaurants").then(function (l) { SF.state.arests = l; SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="acournew"><h2 class="h2">' + t("adm.addCourier") + "</h2>" + courForm() +
    '<p class="fine">' + t("adm.ownerNote") + '</p><button class="btn primary block">' + t("btn.create") + "</button></form>", "wide"); }); };
  SF.actions.acouredit = function (el) { return Promise.all([api().get("/admin/users?role=courier"), api().get("/admin/restaurants")]).then(function (a2) { var l = a2[0]; SF.state.arests = a2[1]; var u = l.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!u) return; SF.state.cveh = null;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="acouredit" data-id="' + u.id + '"><h2 class="h2">' + esc(u.name) + "</h2>" + courForm(u) + '<button class="btn primary block">' + t("btn.save") + "</button></form>", "wide"); }); };
  function ridsOf(f) { return [].slice.call(f.querySelectorAll("input[name=rid]:checked")).map(function (x) { return x.value; }); }
  SF.forms.acouredit = function (fd, f) { var body = Object.assign({}, fd); delete body.rid; body.restaurantIds = ridsOf(f); return api().patch("/admin/couriers/" + f.dataset.id, body).then(function () { SF.closeModal(); SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.forms.acournew = function (fd, f) { var ids = ridsOf(f), body = Object.assign({}, fd); delete body.rid; if (ids[0]) body.restaurantId = ids[0];
    return api().post("/admin/couriers", body).then(function (u) { var more = ids.length > 1 ? api().patch("/admin/couriers/" + u.id, { restaurantIds: ids }) : Promise.resolve();
      return more.then(function () { SF.render({ quiet: true }); if (u.linked) { SF.closeModal(); SF.toast(t("cr.linked")); } else creds(u.name, u.login); }); }); };
  R("/admin/users", { title: "adm.users", render: function (p, q) {
    var role = q.role || "", s = q.q || "";
    return api().get("/admin/users?role=" + role + "&q=" + encodeURIComponent(s)).then(function (list) {
      return '<div class="toolbar"><div class="chips">' + [["", "adm.all"], ["customer", "role.customer"], ["restaurant", "role.restaurant"], ["courier", "role.courier"], ["admin", "role.admin"]].map(function (x) { return '<a class="chip' + (role === x[0] ? " on" : "") + '" href="#/admin/users?role=' + x[0] + '">' + t(x[1]) + "</a>"; }).join("") +
        '</div><form class="minisearch" data-form="ausearch">' + I("search", 16) + '<input name="q" value="' + esc(s) + '" placeholder="' + t("adm.searchUsers") + '" aria-label="' + t("adm.searchUsers") + '"></form></div>' +
        table([t("profile.name"), t("auth.phone"), t("adm.role"), t("adm.ordersN"), t("adm.since"), t("adm.activeL")], list.map(function (u) {
          return '<tr><td><div class="tcell"><span class="avatar sm">' + esc(u.name.charAt(0)) + "</span><b>" + esc(u.name) + "</b>" + (u.phoneVerified ? '<span class="vok" title="' + t("vfa.verified") + '">' + I("check", 12) + "</span>" : "") + (u.pwResetAt ? '<span class="pill p-warn pwreq">' + I("shield", 12) + t("pw.asked") + "</span>" : "") + '</div></td><td class="num">' + esc(SF.phone(u.phone)) + '</td><td><span class="pill p-' + ({ admin: "brand", restaurant: "warn", courier: "info", customer: "mut" }[u.role]) + '">' + t("role." + u.role) + "</span></td><td class=\"num\">" + u.orderCount + '</td><td class="num">' + SF.date(u.createdAt) + "</td><td>" + (u.id === SF.state.user.id ? "—" : '<div class="tact">' + sw(u.active, "auser", u.id, t("adm.activeL")) + '<button class="btn sm ghost" data-act="apass" data-id="' + u.id + '" data-name="' + esc(u.name) + '">' + t("adm.newPass") + '</button>' + (u.role === "admin" ? "" : '<button class="btn sm ghost dgh" data-act="udel" data-id="' + u.id + '" data-name="' + esc(u.name) + '" aria-label="' + t("ud.btn") + '" title="' + t("ud.btn") + '">' + I("trash", 14) + "</button>") + "</div>") + "</td></tr>"; }));
    });
  } });
  SF.forms.ausearch = function (fd) { var q = SF.match(SF.path()).query; SF.go("/admin/users?role=" + (q.role || "") + "&q=" + encodeURIComponent(fd.q || "")); };
  SF.actions.udel = function (el) { SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="confirm"><span class="cic">' + I("trash", 26) + '</span><h2 class="h2">' + t("ud.t", { name: esc(el.dataset.name) }) + '</h2><p class="muted">' + t("ud.p") + '</p><button class="btn danger block" data-act="udelgo" data-id="' + el.dataset.id + '">' + t("ud.go") + '</button><button class="btn ghost block" data-act="closemodal">' + t("btn.cancel") + "</button></div>"); };
  SF.actions.udelgo = function (el) { return api().del("/admin/users/" + el.dataset.id).then(function () { SF.closeModal(); SF.toast(t("ud.done")); SF.render({ quiet: true }); }); };
  SF.actions.auser = function (el) { return api().patch("/admin/users/" + el.dataset.id, { active: el.getAttribute("aria-checked") !== "true" }).then(function () { SF.render({ quiet: true }); }); };

  /* ---------- Products, categories ---------- */
  R("/admin/products", { title: "adm.products", render: function (p, q) {
    return Promise.all([api().get("/admin/products?restaurantId=" + (q.r || "")), api().get("/admin/restaurants")]).then(function (a) {
      var list = a[0], rs = a[1];
      return '<div class="toolbar"><label class="f inline">' + t("adm.restaurant") + '<select data-input="aprodr"><option value="">' + t("adm.all") + "</option>" + rs.map(function (r) { return '<option value="' + r.id + '"' + (q.r === r.id ? " selected" : "") + ">" + esc(tx(r.name)) + "</option>"; }).join("") + '</select></label><p class="muted">' + t("adm.prodCount", { n: list.length }) + "</p></div>" +
        table([t("menu.name"), t("adm.restaurant"), t("menu.category"), t("menu.price"), t("menu.inStock")], list.map(function (x) {
          return '<tr><td><div class="tcell"><span class="cim">' + SF.art(x.kind, 30) + "</span><b>" + esc(tx(x.name)) + "</b></div></td><td>" + esc(tx(x.restaurantName)) + "</td><td>" + esc(tx(((SF.state.categories || []).filter(function (c) { return c.id === x.categoryId; })[0] || {}).name)) + "</td>" +
            '<td><form class="inl" data-form="aprice" data-id="' + x.id + '"><input name="v" inputmode="numeric" value="' + x.price + '" aria-label="' + t("menu.price") + '"><button class="iconbtn" aria-label="' + t("btn.save") + '">' + I("check", 16) + "</button></form></td><td>" + sw(x.available, "aprodav", x.id, t("menu.inStock")) + "</td></tr>"; }));
    });
  } });
  SF.inputs.aprodr = function (v) { SF.go("/admin/products?r=" + v); };
  SF.forms.aprice = function (fd, f) { return api().patch("/admin/products/" + f.dataset.id, { price: Number(fd.v) }).then(function () { SF.toast(t("btn.saved")); }); };
  SF.actions.aprodav = function (el) { return api().patch("/admin/products/" + el.dataset.id, { available: el.getAttribute("aria-checked") !== "true" }).then(function () { SF.render({ quiet: true }); }); };
  R("/admin/categories", { title: "adm.categories", render: function () {
    return api().get("/admin/categories").then(function (list) {
      return '<form class="card inlineform" data-form="acat"><label class="f grow">' + t("adm.newCat") + '<input name="name" required></label><label class="f">' + t("menu.picture") + '<select name="icon">' + SF.KINDS.map(function (k) { return '<option value="' + k + '">' + k + "</option>"; }).join("") + '</select></label><button class="btn primary">' + I("plus", 18) + t("btn.create") + "</button></form>" +
        '<p class="muted">' + t("cat.sub") + '</p><div class="catgrid">' + list.map(function (c) { return '<div class="card catcard' + (c.active ? "" : " off") + '"><label class="ci catpic' + (c.photo ? " hasph" : "") + '" title="' + t("cat.photo") + '">' + (c.photo ? '<img src="' + esc(c.photo) + '" alt="">' : SF.art(c.icon, 46)) + '<i class="catcam">' + I("camera", 12) + '</i><input type="file" accept="image/*" data-input="acatphoto" data-id="' + c.id + '" aria-label="' + t("cat.photo") + '"></label>' + (c.photo ? '<button class="link sm" data-act="acatphotodel" data-id="' + c.id + '">' + t("cat.photoDel") + "</button>" : "") + '<div class="grow"><b>' + esc(tx(c.name)) + '</b><small class="muted num">' + t("adm.prodCount", { n: c.productCount }) + "</small></div>" + sw(c.active, "acatt", c.id, t("adm.activeL")) + (c.productCount ? "" : '<button class="iconbtn" data-act="acatdel" data-id="' + c.id + '" aria-label="' + t("btn.delete") + '">' + I("trash", 16) + "</button>") + "</div>"; }).join("") + "</div>";
    });
  } });
  SF.forms.acat = function (fd) { return api().post("/admin/categories", fd).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); return reloadCats(); }); };
  SF.actions.acatt = function (el) { return api().patch("/admin/categories/" + el.dataset.id, { active: el.getAttribute("aria-checked") !== "true" }).then(reloadCats).then(function () { SF.render({ quiet: true }); }); };
  SF.actions.acatdel = function (el) { return api().del("/admin/categories/" + el.dataset.id).then(reloadCats).then(function () { SF.render({ quiet: true }); }); };
  SF.inputs.acatphoto = function (v, el) { var f = el.files && el.files[0]; if (!f) return;
    SF.shrinkImage(f, 600, 0.82).then(function (d) { return api().patch("/admin/categories/" + el.dataset.id, { photo: d }); }, function () { SF.toast(t("tr.notImage"), "err"); })
      .then(function (r) { if (r) { SF.toast(t("btn.saved")); return reloadCats().then(function () { SF.render({ quiet: true }); }); } }); };
  SF.actions.acatphotodel = function (el) { return api().patch("/admin/categories/" + el.dataset.id, { photo: null }).then(reloadCats).then(function () { SF.render({ quiet: true }); }); };
  function reloadCats() { return api().get("/categories").then(function (c) { SF.state.categories = c; }); }

  /* ---------- Payments, promos, banners, cities ---------- */
  R("/admin/payments", { title: "adm.payments", render: function () {
    return api().get("/admin/payments").then(function (list) {
      var paid = list.filter(function (p) { return p.status === "paid"; }).reduce(function (s, p) { return s + p.amount; }, 0);
      return '<div class="kpis k3">' + SF.kpi("card", t("adm.paidOnline"), money(paid)) + SF.kpi("route", t("adm.refunded"), list.filter(function (p) { return p.status === "refunded"; }).length) + SF.kpi("info", t("adm.failed"), list.filter(function (p) { return p.status === "failed"; }).length) + "</div>" +
        '<div class="msg info">' + I("shield", 16) + t("adm.payNote") + "</div>" +
        table(["ID", "№", t("tb.time"), t("adm.provider"), t("tb.sum"), t("tb.status")], list.map(function (p) { return '<tr><td class="num">' + esc(p.id) + '</td><td class="num">' + (p.number || "—") + '</td><td class="num">' + SF.dt(p.createdAt) + "</td><td>" + esc(p.provider) + (p.last4 ? ' <small class="muted num">•' + esc(p.last4) + "</small>" : "") + '</td><td class="num">' + money(p.amount) + "</td><td>" + '<span class="pill p-' + ({ paid: "ok", pending: "warn", refunded: "info", failed: "bad" }[p.status] || "mut") + '">' + t("ps." + p.status) + "</span></td></tr>"; }));
    });
  } });
  R("/admin/promos", { title: "adm.promos", render: function () {
    return api().get("/admin/promos").then(function (list) {
      return '<form class="card inlineform" data-form="apromo"><label class="f">' + t("adm.code") + '<input name="code" required placeholder="SUMMER15" style="text-transform:uppercase"></label><label class="f">' + t("adm.type") + '<select name="type"><option value="percent">%</option><option value="fixed">' + t("cur") + '</option></select></label><label class="f">' + t("adm.value") + '<input name="value" inputmode="numeric" required></label><label class="f">' + t("adm.minOrder") + '<input name="minOrder" inputmode="numeric" value="0"></label><label class="f">' + t("adm.maxUses") + '<input name="maxUses" inputmode="numeric" value="0"></label><button class="btn primary">' + I("plus", 18) + t("btn.create") + "</button></form>" +
        table([t("adm.code"), t("adm.value"), t("adm.minOrder"), t("adm.used"), t("adm.activeL")], list.map(function (p) { return '<tr><td><b class="code">' + esc(p.code) + '</b></td><td class="num">' + (p.type === "percent" ? p.value + "%" : money(p.value)) + '</td><td class="num">' + money(p.minOrder) + '</td><td class="num">' + p.uses + (p.maxUses ? " / " + p.maxUses : "") + "</td><td>" + sw(p.active, "apromot", p.id, t("adm.activeL")) + "</td></tr>"; }));
    });
  } });
  SF.forms.apromo = function (fd) { return api().post("/admin/promos", fd).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.apromot = function (el) { return api().patch("/admin/promos/" + el.dataset.id, { active: el.getAttribute("aria-checked") !== "true" }).then(function () { SF.render({ quiet: true }); }); };
  /* ---------- ads on the home page: restaurants' own + the admin's (any business) ---------- */
  var BTONES = ["#E8590C", "#0B8A5A", "#7A3E9D", "#1F6FB2", "#C2185B", "#B7791F", "#1F1A17"];
  R("/admin/banners", { title: "adm.banners", render: function () {
    return Promise.all([api().get("/admin/banners"), api().get("/admin/restaurants")]).then(function (a) {
      var list = a[0]; SF.state.bnRests = a[1]; SF.state.bnList = list;
      return '<div class="bnhead"><p class="muted">' + t("bn.sub") + '</p><button class="btn primary" data-act="bnnew">' + I("plus", 18) + t("bn.new") + "</button></div>" +
        '<div class="bgrid">' + list.map(function (b) {
          return '<div class="card bncard">' + SF.bannerHtml(b, "div", "small") +
            '<div class="line"><span class="muted">' + (b.own ? t("bn.own") : t("bn.mine")) + "</span><b>" + (b.restaurantName ? esc(tx(b.restaurantName)) : b.phone ? '<span class="num">' + esc(b.phone) + "</span>" : b.url ? esc(b.url.replace(/^https?:\/\//, "").slice(0, 28)) : "") + "</b></div>" +
            '<div class="line"><span>' + t("adm.activeL") + "</span>" + sw(b.active, "abanner", b.id, t("adm.activeL")) + "</div>" +
            (b.own ? "" : '<div class="row2"><button class="btn sm ghost" data-act="bnedit" data-id="' + b.id + '">' + I("edit", 14) + t("btn.edit") + '</button><button class="btn sm ghost" data-act="bndel" data-id="' + b.id + '">' + I("trash", 14) + t("btn.delete") + "</button></div>") + "</div>"; }).join("") + "</div>";
    });
  } });
  SF.actions.abanner = function (el) { return api().patch("/admin/banners/" + el.dataset.id, { active: el.getAttribute("aria-checked") !== "true" }).then(function () { SF.render({ quiet: true }); }); };
  function bnDraft() { return SF.state.bn; }
  function bnModal() { var d = bnDraft(), rests = SF.state.bnRests || [];
    var prev = SF.bannerHtml({ title: { tg: d.title || t("ad.titleHint") }, sub: { tg: d.sub }, tone: d.tone, art: d.art, photo: d.photo }, "div");
    var lt = d.linkType;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="bnsave"><h2 class="h2">' + t(d.id ? "bn.edit" : "bn.new") + "</h2>" +
      '<div class="adprev" id="bnprev">' + prev + "</div>" +
      '<label class="f">' + t("ad.head") + '<input name="title" maxlength="40" required data-input="bntitle" value="' + esc(d.title) + '"></label>' +
      '<label class="f">' + t("ad.text") + '<input name="sub" maxlength="70" data-input="bnsub" placeholder="' + t("ad.textHint") + '" value="' + esc(d.sub) + '"></label>' +
      '<div class="f"><span>' + t("ad.pic") + ' <small class="muted">' + t("bn.photoTip") + '</small></span><div class="adpics"><label class="upload sm' + (d.photo ? " done" : "") + '">' + (d.photo ? '<img src="' + esc(d.photo) + '" alt="">' : I("plus", 18)) + "<b>" + t(d.photo ? "tr.change" : "ad.photo") + '</b><input type="file" accept="image/*" data-input="bnphoto"></label>' +
        (d.photo ? '<button type="button" class="btn sm ghost" data-act="bnphotodel">' + I("trash", 14) + t("btn.remove") + "</button>" : '<div class="pkgrid">' + ["plov", "shashlik", "burger", "pizza", "samsa", "dessert", "lagman", "coffee"].map(function (k) { return '<button type="button" class="' + (k === d.art ? "on" : "") + '" aria-pressed="' + (k === d.art) + '" data-act="bnart" data-v="' + k + '" aria-label="' + k + '">' + SF.art(k, 28) + "</button>"; }).join("") + "</div>") + "</div></div>" +
      '<div class="f"><span>' + t("ad.color") + '</span><div class="tones" role="radiogroup" aria-label="' + t("ad.color") + '">' + BTONES.map(function (c) { return '<button type="button" role="radio" aria-checked="' + (c === d.tone) + '" class="tone' + (c === d.tone ? " on" : "") + '" style="--c:' + c + '" data-act="bntone" data-v="' + c + '" aria-label="' + c + '"></button>'; }).join("") + "</div></div>" +
      '<div class="f"><span>' + t("bn.link") + '</span><div class="seg">' + [["none", "bn.lnone"], ["rest", "bn.lrest"], ["phone", "bn.lphone"], ["url", "bn.lurl"]].map(function (x) { return '<button type="button" class="' + (lt === x[0] ? "on" : "") + '" aria-pressed="' + (lt === x[0]) + '" data-act="bnlink" data-v="' + x[0] + '">' + t(x[1]) + "</button>"; }).join("") + "</div></div>" +
      (lt === "rest" ? '<label class="f">' + t("bn.lrest") + '<select data-input="bnval">' + rests.map(function (r) { return '<option value="' + r.id + '"' + (d.linkValue === r.id ? " selected" : "") + ">" + esc(tx(r.name)) + "</option>"; }).join("") + "</select></label>" : "") +
      (lt === "phone" ? '<label class="f">' + t("bn.lphone") + '<input data-input="bnval" inputmode="tel" value="' + esc(d.linkValue) + '" placeholder="' + t("bn.phonePh") + '"></label>' : "") +
      (lt === "url" ? '<label class="f">' + t("bn.lurl") + '<input data-input="bnval" inputmode="url" value="' + esc(d.linkValue) + '" placeholder="' + t("bn.urlPh") + '"></label>' : "") +
      '<button class="btn primary block lg">' + I("check", 16) + t(d.id ? "btn.save" : "ad.publish") + "</button></form>");
  }
  function bnKeep() { var f = document.querySelector("[data-form=bnsave]"); if (f) { bnDraft().title = f.title.value; bnDraft().sub = f.sub.value; } }
  SF.actions.bnnew = function () { var rs = SF.state.bnRests || []; SF.state.bn = { id: null, title: "", sub: "", tone: BTONES[0], art: "plov", photo: null, photoChanged: false, linkType: "none", linkValue: rs[0] ? rs[0].id : "" }; bnModal(); };
  SF.actions.bnedit = function (el) { var b = (SF.state.bnList || []).filter(function (x) { return x.id === el.dataset.id; })[0]; if (!b) return;
    SF.state.bn = { id: b.id, title: tx(b.title), sub: tx(b.sub), tone: b.tone, art: b.art || "plov", photo: b.photo || null, photoChanged: false, linkType: b.restaurantId ? "rest" : b.phone ? "phone" : b.url ? "url" : "none", linkValue: b.restaurantId || b.phone || b.url || ((SF.state.bnRests || [])[0] || {}).id || "" }; bnModal(); };
  SF.actions.bntone = function (el) { bnKeep(); bnDraft().tone = el.dataset.v; bnModal(); };
  SF.actions.bnart = function (el) { bnKeep(); bnDraft().art = el.dataset.v; bnModal(); };
  SF.actions.bnlink = function (el) { bnKeep(); var d = bnDraft(); d.linkType = el.dataset.v; d.linkValue = d.linkType === "rest" ? (((SF.state.bnRests || [])[0] || {}).id || "") : ""; bnModal(); };
  SF.actions.bnphotodel = function () { bnKeep(); bnDraft().photo = null; bnDraft().photoChanged = true; bnModal(); };
  SF.inputs.bnphoto = function (v, el) { bnKeep(); var f = el.files && el.files[0]; if (!f) return; SF.shrinkImage(f, 1400, 0.8).then(function (d) { bnDraft().photo = d; bnDraft().photoChanged = true; bnModal(); }, function () { SF.toast(t("tr.notImage"), "err"); }); };
  SF.inputs.bnval = function (v) { bnDraft().linkValue = v; };
  function bnRedraw() { var el = document.getElementById("bnprev"), d = bnDraft(); if (el) el.innerHTML = SF.bannerHtml({ title: { tg: d.title || t("ad.titleHint") }, sub: { tg: d.sub }, tone: d.tone, art: d.art, photo: d.photo }, "div"); }
  SF.inputs.bntitle = function (v) { bnDraft().title = v; bnRedraw(); };
  SF.inputs.bnsub = function (v) { bnDraft().sub = v; bnRedraw(); };
  SF.forms.bnsave = function (fd) { var d = bnDraft(), sel = document.querySelector("[data-input=bnval]"); if (sel) d.linkValue = sel.value;
    var body = { title: fd.title, sub: fd.sub, tone: d.tone, art: d.art, link: { type: d.linkType, value: d.linkValue } }; if (d.photoChanged || !d.id) body.photo = d.photo || null;
    return (d.id ? api().patch("/admin/banners/" + d.id, body) : api().post("/admin/banners", body)).then(function () { SF.state.bn = null; SF.closeModal(); SF.toast(t("bn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.bndel = function (el) { if (!confirm(t("bn.deleteQ"))) return; return api().del("/admin/banners/" + el.dataset.id).then(function () { SF.toast(t("bn.deleted"), "info"); SF.render({ quiet: true }); }); };
  R("/admin/cities", { title: "adm.cities", render: function () {
    return api().get("/admin/cities").then(function (list) { SF.state.allCities = list;
      return '<form class="card inlineform" data-form="acity"><label class="f grow">' + t("adm.cityName") + '<input name="name" required></label><label class="f">' + t("adm.lat") + '<input name="lat" inputmode="decimal" required placeholder="38.56"></label><label class="f">' + t("adm.lng") + '<input name="lng" inputmode="decimal" required placeholder="68.79"></label><button class="btn primary">' + I("plus", 18) + t("btn.create") + "</button></form>" +
        table([t("profile.city"), t("adm.restaurants"), t("adm.couriers"), t("adm.coords"), t("adm.activeL")], list.map(function (c) { return "<tr><td><b>" + esc(tx(c.name)) + '</b><br><a class="link sm" href="#/admin/zone/' + c.id + '">' + I("pin", 14) + " " + t(c.zone && c.zone.length > 2 ? "zn.edit" : "zn.draw") + '</a></td><td class="num">' + c.restaurants + '</td><td class="num">' + c.couriers + '</td><td class="num">' + c.lat.toFixed(3) + ", " + c.lng.toFixed(3) + "</td><td>" + sw(c.active, "acityt", c.id, t("adm.activeL")) + "</td></tr>"; }));
    });
  } });
  /* ---------- delivery area: the admin taps the corners of the area on the map ---------- */
  /* one editor for both: a town's area and a restaurant's own area */
  function zoneEditor(o) {
    var Z = SF.state.zoneEdit; if (!Z || Z.key !== o.key) Z = SF.state.zoneEdit = { key: o.key, url: o.url, pinUrl: o.pinUrl, back: o.back, mode: "zone", pin: o.pinUrl ? { lat: o.center.lat, lng: o.center.lng } : null, moved: false, marks: [], pts: (o.zone || []).map(function (x) { return x.cut ? { lat: x.lat, lng: x.lng, cut: 1 } : { lat: x.lat, lng: x.lng }; }) };
    var has = o.zone && o.zone.length > 2; Z.marks.length = 0; Z.marks.push(Z.pin ? { lat: Z.pin.lat, lng: Z.pin.lng, type: "rest", label: o.mark } : { lat: o.center.lat, lng: o.center.lng, type: "rest", label: o.mark });
    return '<a class="backlink" href="#' + o.back + '">' + I("chevL", 18) + esc(o.backLabel) + '</a><section class="card stack"><h3>' + t("zn.title") + " · " + esc(o.name) + '</h3><p class="fine">' + t(o.how) + "</p>" +
      /* a restaurant: two modes — move its place («R»), or draw its area */
      (o.pinUrl ? '<div class="seg nrmode" role="group">' + [["pin", "pin", "nr.modePin"], ["zone", "edit", "nr.modeZone"]].map(function (m) { return '<button type="button" class="' + (Z.mode === m[0] ? "on" : "") + '" aria-pressed="' + (Z.mode === m[0]) + '" data-act="zmode" data-v="' + m[0] + '">' + I(m[1], 16) + " " + t(m[2]) + "</button>"; }).join("") + '</div><p class="fine">' + t(Z.mode === "pin" ? "nr.pinHow" : "nr.zoneHow") + "</p>" : "") +
      SF.mapFind(o.key) + '<div class="zmap">' + SF.tmap({ key: o.key, center: o.center, zoom: 14, free: true, label: t("zn.title"), markers: Z.marks, edit: function () { return SF.state.zoneEdit ? SF.state.zoneEdit.pts : []; },
        onTap: function (pt) { var z = SF.state.zoneEdit; if (!z) return; if (z.mode === "pin" && z.pinUrl) { z.pin = pt; z.moved = true; z.marks.length = 0; z.marks.push({ lat: pt.lat, lng: pt.lng, type: "rest", label: o.mark }); return; } if (z.pts.length >= 600) return; if (z.cutNext && z.pts.length) { pt.cut = 1; z.cutNext = false; } z.pts.push(pt); zcount(); } }) + "</div>" +
      '<p class="zcount" id="zcount"></p>' +
      (Z.mode === "zone" ? '<button type="button" class="btn ghost block zpart" data-act="zpart">' + I("plus", 16) + t("zn.part") + '</button><p class="fine">' + t("zn.partHow") + "</p>" : "") +
      '<div class="zbtns"><button type="button" class="btn ghost" data-act="zundo">' + I("chevL", 16) + t("zn.undo") + '</button><button type="button" class="btn ghost" data-act="zclear">' + I("trash", 16) + t("zn.clear") + "</button></div>" +
      '<button type="button" class="btn primary block lg" data-act="zsave">' + I("check", 18) + t("zn.save") + "</button>" +
      (has ? '<button type="button" class="link center" data-act="zcircle">' + t(o.offKey, { km: (SF.state.pub || {}).zoneKm || 5 }) + "</button>" : '<p class="fine center">' + t(o.nowKey, { km: (SF.state.pub || {}).zoneKm || 5 }) + "</p>") + "</section>";
  }
  R("/admin/zone/:id", { title: "zn.title", render: function (p) {
    return api().get("/admin/cities").then(function (list) { var c = list.filter(function (x) { return x.id === p.id; })[0]; if (!c) { SF.go("/admin/cities"); return ""; }
      return zoneEditor({ key: "zed-" + c.id, url: "/admin/cities/" + c.id + "/zone", back: "/admin/cities", backLabel: t("adm.cities"), name: tx(c.name), center: { lat: c.lat, lng: c.lng }, zone: c.zone, mark: "★", how: "zn.how", offKey: "zn.circle", nowKey: "zn.nowCircle" });
    });
  } });
  R("/admin/rzone/:id", { title: "zn.title", render: function (p) {
    return Promise.all([api().get("/admin/restaurants"), api().get("/admin/cities")]).then(function (a) { var r = a[0].filter(function (x) { return x.id === p.id; })[0]; if (!r) { SF.go("/admin/restaurants"); return ""; }
      var c = a[1].filter(function (x) { return x.id === r.cityId; })[0], cz = c && c.zone && c.zone.length > 2;
      return zoneEditor({ key: "rzed-" + r.id, url: "/admin/restaurants/" + r.id + "/zone", pinUrl: "/admin/restaurants/" + r.id, back: "/admin/restaurants", backLabel: t("adm.restaurants"), name: tx(r.name), center: { lat: r.lat, lng: r.lng }, zone: r.zone, mark: "R", how: "zn.rhow", offKey: "zn.roff", nowKey: cz ? "zn.rnowCity" : "zn.nowCircle" });
    });
  } });
  function zparts(z) { return window.SomonRules.zoneParts(z.pts); }
  function zcount() { var el = document.getElementById("zcount"), z = SF.state.zoneEdit; if (!el || !z) return; var ps = zparts(z), last = ps.length ? ps[ps.length - 1].length : 0;
    if (z.cutNext) { el.innerHTML = I("plus", 14) + " " + t("zn.partNext", { n: ps.length + 1 }); return; }
    el.innerHTML = ps.length > 1 ? (last < 3 ? t("zn.partNeed", { k: ps.length, n: last }) : I("check", 14) + " " + t("zn.partsOk", { k: ps.length, n: z.pts.length })) : last < 3 ? t("zn.need", { n: last }) : I("check", 14) + " " + t("zn.ok", { n: last }); }
  SF.actions.zpart = function () { var z = SF.state.zoneEdit; if (!z) return; var ps = zparts(z);
    if (!ps.length || ps[ps.length - 1].length < 3) { SF.toast(t("zn.need", { n: ps.length ? ps[ps.length - 1].length : 0 }), "err"); return; }
    if (ps.length >= 12) return; z.cutNext = true; zcount(); SF.toast(t("zn.partNext", { n: ps.length + 1 })); };
  SF.after.push(function () { if (document.getElementById("zcount")) zcount(); });
  function zredraw() { var z = SF.state.zoneEdit; if (z) SF.redrawMap(z.key); zcount(); }
  SF.actions.zundo = function () { var z = SF.state.zoneEdit; if (!z) return; if (z.cutNext) z.cutNext = false; else if (z.pts.length) z.pts.pop(); zredraw(); };
  SF.actions.zclear = function () { var z = SF.state.zoneEdit; if (z) { z.pts = []; z.cutNext = false; } zredraw(); };
  function zdone(z) { return api().get("/cities").then(function (cs) { SF.state.cities = cs; SF.state.zoneEdit = null; SF.toast(t("zn.saved")); SF.go(z.back); }); }
  SF.actions.zmode = function (el) { var z = SF.state.zoneEdit; if (z) { z.mode = el.dataset.v; SF.render({ quiet: true }); } };
  SF.actions.zsave = function () { var z = SF.state.zoneEdit; if (!z) return;
    var pin = z.pinUrl && z.moved ? api().patch(z.pinUrl, { lat: z.pin.lat, lng: z.pin.lng }) : Promise.resolve();
    var bad = zparts(z).filter(function (x) { return x.length < 3; })[0]; z.cutNext = false;
    if (bad) { SF.toast(t("zn.need", { n: bad.length }), "err"); return; }
    if (!z.pts.length && !z.moved) { SF.toast(t("zn.need", { n: 0 }), "err"); return; }
    return pin.then(function () { return z.pts.length ? api().post(z.url, { zone: z.pts }) : null; }).then(function () { return zdone(z); }); };
  SF.actions.zcircle = function () { var z = SF.state.zoneEdit; if (!z) return; return api().post(z.url, { zone: [] }).then(function () { return zdone(z); }); };
  SF.forms.acity = function (fd) { return api().post("/admin/cities", fd).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.acityt = function (el) { return api().patch("/admin/cities/" + el.dataset.id, { active: el.getAttribute("aria-checked") !== "true" }).then(function () { return api().get("/cities"); }).then(function (c) { SF.state.cities = c; SF.render({ quiet: true }); }); };

  /* ---------- Statistics & revenue ---------- */
  R("/admin/stats", { title: "adm.stats", render: function () {
    return api().get("/admin/dashboard").then(function (d) {
      var fees = d.platformMonth - d.byRest.reduce(function () { return 0; }, 0), canc = d.cancelled, rate = d.monthCount ? Math.round(canc / (d.monthCount + canc) * 100) : 0;
      return '<div class="kpis k4">' + SF.kpi("chart", t("k.monthGmv"), money(d.monthSales), t("k.orders", { n: d.monthCount }), "brand") + SF.kpi("percent", t("adm.commission"), money(d.commission)) + SF.kpi("scooter", t("k.courierPay"), money(d.courierMonth)) + SF.kpi("wallet", t("k.platform"), money(d.platformMonth)) + "</div>" +
        '<div class="two"><section class="card"><h3>' + t("k.revenueSplit") + "</h3>" + hbars([{ l: t("k.restPayout"), v: d.payout }, { l: t("adm.commission"), v: d.commission }, { l: t("k.courierPay"), v: d.courierMonth }, { l: t("k.platform"), v: d.platformMonth }], money) +
        '<p class="fine">' + t("k.splitNote") + '</p></section><section class="card"><h3>' + t("k.quality") + '</h3><div class="line"><span>' + t("k.rating") + "</span>" + SF.stars(d.rating) + '</div><div class="line"><span>' + t("k.cancelRate") + '</span><b class="num">' + rate + '%</b></div><div class="line"><span>' + t("k.avgCheck") + '</span><b class="num">' + money(d.avgCheck) + "</b></div>" +
        '<div class="line"><span>' + t("pay.card") + " / " + t("pay.cash") + '</span><b class="num">' + d.payMix.card + " / " + d.payMix.cash + "</b></div></section></div>" +
        '<section class="card"><h3>' + t("k.gmv14") + "</h3>" + SF.bars(d.series, money, t("k.gmv14")) + "</section>" +
        table([t("adm.restaurant"), t("adm.ordersN"), t("k.monthGmv"), t("k.rating")], d.byRest.map(function (r) { return "<tr><td><b>" + esc(tx(r.name)) + '</b></td><td class="num">' + r.count + '</td><td class="num">' + money(r.sum) + "</td><td>" + SF.stars(r.rating) + "</td></tr>"; }));
    });
  } });

  /* ---------- Settings ---------- */
  R("/admin/settings", { title: "adm.settings", render: function () {
    return Promise.all([api().get("/admin/settings"), api().get("/admin/storage"), api().get("/admin/admins"), api().get("/admin/loyalty").catch(function () { return null; })]).then(function (a) { var s = a[0]; SF.state.storage = a[1];
      var num = function (n, label, v, hint) { return '<label class="f">' + label + '<input name="' + n + '" inputmode="numeric" value="' + esc(v) + '">' + (hint ? '<small class="hint">' + hint + "</small>" : "") + "</label>"; };
      /* only what the owner really changes: courier share, the delivery circle, payment ways, the support phone; prices are on their own page */
      return '<div class="two"><div class="stack"><form class="card stack" data-form="aset"><h3>' + I("cog", 18) + " " + t("set.main") + "</h3>" +
        '<div class="grid2">' + num("courierPct", t("adm.courierPct"), s.courierPct) + num("zoneKm", t("adm.zoneKm"), s.zoneKm || 5, t("set.zoneHint")) + "</div>" +
        /* each way to pay has its own switch */
        '<label class="f">' + t("adm.payWays") + "</label>" + [["payWallet", "wallet", "pay.wallet", "pay.walletSub", s.payTransfer !== false && s.payWallet !== false], ["payCardTr", "card", "pay.toCard", "pay.toCardSub", s.payTransfer !== false && s.payCardTr !== false], ["payCash", "cash", "pay.cash", "pay.cashSub", s.payCash !== false]].map(function (x) {
          return '<div class="payway"><span class="bic">' + I(x[1], 18) + '</span><div class="grow"><b>' + t(x[2]) + "</b><small>" + t(x[3]) + '</small></div><input type="hidden" name="' + x[0] + '" value="' + (x[4] ? "1" : "") + '"><button type="button" class="switch' + (x[4] ? " on" : "") + '" role="switch" aria-checked="' + !!x[4] + '" data-act="payway" aria-label="' + esc(t(x[2])) + '"></button></div>'; }).join("") + '<p class="fine">' + t("set.payHint") + "</p>" +
        '<label class="checkrow"><input type="checkbox" name="smsAlerts"' + (s.smsAlerts ? " checked" : "") + (s.smsReady ? "" : " disabled") + "><span>" + t("sa2.sms") + '<small class="muted">' + t(s.smsReady ? "sa2.smsOn" : "sa2.smsOff") + "</small></span></label>" +
        '<label class="f">' + t("foot.support") + '<input name="supportPhone" value="' + esc(s.supportPhone) + '"></label><button class="btn primary">' + t("btn.save") + "</button></form>" +
        '<a class="card setlink" href="#/admin/prices"><span class="kic">' + I("scooter", 20) + '</span><span class="grow"><b>' + t("pr.nav") + "</b><small>" + t("set.pricesSub") + "</small></span>" + I("chevR", 18) + "</a>" +
        '<a class="card setlink" href="#/admin/categories"><span class="kic">' + I("tag", 20) + '</span><span class="grow"><b>' + t("adm.categories") + "</b><small>" + t("set.catSub") + "</small></span>" + I("chevR", 18) + "</a>" +
        (SF.schedCard ? SF.schedCard(a[3]) : "") + "</div>" +
        '<div class="stack">' + adminsCard(a[2]) + SF.pwForm() +
        '<details class="card more"><summary><b>' + I("box", 18) + " " + t("set.more") + "</b>" + I("chevD", 16) + "</summary>" + storageCard(a[1]) + "</details>" +
        (SF.state.pub.demo ? '<section class="card"><h3>' + t("adm.demo") + '</h3><p class="fine">' + t("adm.demoNote") + '</p><button class="btn ghost" data-act="areset">' + I("route", 16) + t("adm.resetDemo") + "</button></section>" : "") + "</div></div>";
    });
  } });
  SF.actions.payway = function (el) { var on = el.getAttribute("aria-checked") !== "true"; el.setAttribute("aria-checked", on); el.classList.toggle("on", on); el.parentNode.querySelector("input[type=hidden]").value = on ? "1" : ""; };
  SF.forms.aset = function (fd) { fd.payCash = !!fd.payCash; fd.payWallet = !!fd.payWallet; fd.payCardTr = !!fd.payCardTr; fd.smsAlerts = !!fd.smsAlerts;
    return api().patch("/admin/settings", fd).then(function () { return api().get("/settings/public"); }).then(function (p) { SF.state.pub = p; SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  function adminsCard(d) {
    return '<section class="card stack"><h3>' + I("shield", 18) + " " + t("aa.title") + '</h3><p class="fine">' + t("aa.sub", { n: d.max }) + "</p>" +
      d.list.map(function (u) { return '<div class="line"><span><b>' + esc(u.name) + "</b> " + (u.main ? '<span class="pill p-brand">' + t("aa.main") + "</span>" : '<span class="pill p-mut">' + t("aa.helper") + "</span>") + (u.mustChange ? ' <span class="pill p-warn">' + t("sf.notYet") + "</span>" : "") + '<br><small class="muted num">' + esc(SF.phone(u.phone)) + "</small></span>" +
        (d.me && !u.main ? '<span class="row"><button type="button" class="iconbtn" data-act="aapass" data-id="' + u.id + '" data-name="' + esc(u.name) + '" aria-label="' + t("dl.newPass") + '">' + I("shield", 16) + '</button><button type="button" class="iconbtn" data-act="aadel" data-id="' + u.id + '" data-name="' + esc(u.name) + '" aria-label="' + t("sf.del") + '">' + I("trash", 16) + "</button></span>" : "") + "</div>"; }).join("") +
      (d.me && d.list.length < d.max ? '<button type="button" class="btn ghost" data-act="aanew">' + I("plus", 16) + t("aa.add") + "</button>" : "") + "</section>";
  }
  SF.actions.aanew = function () { SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="aanew"><h2 class="h2">' + t("aa.add") + '</h2><label class="f">' + t("profile.name") + '<input name="name" required maxlength="60"></label>' +
    '<label class="f">' + t("auth.phone") + '<span class="phonein"><i>+992</i><input name="phone" inputmode="tel" required></span></label><p class="fine">' + t("aa.addNote") + '</p><button class="btn primary block">' + t("btn.create") + "</button></form>"); };
  SF.forms.aanew = function (fd) { return api().post("/admin/admins", fd).then(function (u) { SF.render({ quiet: true }); creds(u.name, u.login); }); };
  SF.actions.aapass = function (el) { return api().post("/admin/users/" + el.dataset.id + "/password").then(function (l) { creds(el.dataset.name, l); }); };
  SF.actions.aadel = function (el) { SF.modal('<div class="confirm"><span class="cic">' + I("trash", 26) + '</span><h2 class="h2">' + t("aa.delQ", { name: esc(el.dataset.name) }) + '</h2><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn primary" data-act="aadelok" data-id="' + el.dataset.id + '">' + t("sf.del") + "</button></div></div>"); };
  SF.actions.aadelok = function (el) { return api().del("/admin/admins/" + el.dataset.id).then(function () { SF.closeModal(); SF.render({ quiet: true }); }); };
  SF.actions.areset = function () { return api().post("/admin/reset-demo").then(function () { SF.toast(t("adm.resetDone"), "info"); SF.render(); }); };

  /* ---------- Tezkor services: switch a ready service on, the apps show it at once ---------- */
  R("/admin/services", { title: "adm.services", render: function () {
    return Promise.all([api().get("/admin/services"), api().get("/admin/ads-settings"), api().get("/admin/areas"), api().get("/admin/pay-cards")]).then(function (r) { var list = r[0], cfg = r[1], areas = r[2], cards = r[3];
      var em = {}; (SF.SERVICES || []).forEach(function (x) { em[x[0]] = x; });
      return '<p class="muted">' + t("asv.lead") + '</p><div class="card svadm">' + list.map(function (x) { var e = em[x.key] || ["", "", "#F2F4F3"];
          return '<div class="svarow"><label class="svup" aria-label="' + t("asv.photo") + '">' + SF.svVis(x.key) + '<i class="avcam">' + I("camera", 13) + '</i><input type="file" accept="image/*" data-input="svphoto" data-k="' + x.key + '"></label><span class="grow"><b>' + t("sv." + x.key) + ' <span class="pill ' + (x.on ? "p-ok" : x.ready ? "p-brand" : "p-mut") + '">' + t(x.on ? "sa.works" : x.ready ? "asv.ready" : "asv.soon") + "</span></b><small>" + t("svd." + x.key) + "</small>" + (x.count ? '<button type="button" class="link sm dgh" data-act="asvclear" data-k="' + x.key + '" data-n="' + x.count + '">' + I("trash", 13) + " " + t("sc.btn", { n: x.count }) + "</button>" : "") + (x.photo ? '<button type="button" class="link sm" data-act="asvphdel" data-k="' + x.key + '">' + t("asv.photoDel") + "</button>" : '<small class="muted">' + t("asv.photoHint") + "</small>") +
            (x.core ? '<small class="muted">' + t("asv.core") + "</small>" : !x.ready ? '<small class="muted">' + t("asv.notReady") + "</small>" : "") + "</span>" +
            (x.core || !x.ready ? '<button class="switch' + (x.on ? " on" : "") + '" role="switch" aria-checked="' + x.on + '" disabled aria-label="' + esc(t("sv." + x.key)) + '"></button>' : sw(x.on, "asvc", x.key, t("sv." + x.key))) + "</div>"; }).join("") + "</div>" +
        adsCfgCard(cfg) + payCardsCard(cards);
    }); } });
  /* receiving cards: payments are shared between them, a client keeps one card while a request is open */
  function payCardsCard(list) {
    var inp = function (n, label, ph, extra) { return '<label class="f">' + label + '<input name="' + n + '" placeholder="' + (ph || "") + '"' + (extra || "") + "></label>"; };
    return '<section class="card stack"><h3>' + I("wallet", 20) + " " + t("pc.title") + '</h3><p class="muted sm">' + t("pc.lead") + "</p>" +
      (list.length ? list.map(function (c) { return '<div class="pcrow' + (c.active === false ? " off" : "") + '"><span class="grow"><b class="num">' + esc(c.number ? c.number.replace(/(.{4})/g, "$1 ").trim() : SF.phone(c.phone)) + "</b><small>" + esc([c.label, c.bank, c.holder].filter(Boolean).join(" · ")) + (c.phone ? " · " + esc(SF.phone(c.phone)) : "") + "</small><small class=\"muted\">" + t("pc.today", { n: c.todayN, sum: money(c.today) }) + (c.dayLimit ? " / " + money(c.dayLimit) : "") + "</small></span>" +
        sw(c.active !== false, "pcon", c.id, t("pc.on")) + '<button type="button" class="iconbtn" data-act="pcdel" data-id="' + c.id + '" aria-label="' + t("btn.delete") + '">' + I("trash", 16) + "</button></div>"; }).join("") : '<p class="note warn">' + I("info", 16) + "<span>" + t("pc.none") + "</span></p>") +
      /* only the phone number the card is linked to (and which bank): people pay by phone number */
      '<form class="stack pcnew" data-form="pcnew"><h4>' + t("pc.add") + "</h4><div class=\"grid2\">" + inp("phone", t("pc.phone"), "9XX XXX XXX", " inputmode=\"tel\" required") + inp("bank", t("pc.bank"), "Алиф, ДС, Эсхата…") + "</div><button class=\"btn primary\">" + t("pc.addBtn") + "</button></form></section>"; }
  SF.forms.pcnew = function (fd) { return api().post("/admin/pay-cards", fd).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }, function (e) { SF.toast(SF.err(e), "err"); }); };
  SF.actions.pcon = function (el) { return api().patch("/admin/pay-cards/" + el.dataset.id, { active: el.getAttribute("aria-checked") !== "true" }).then(function () { SF.render({ quiet: true }); }); };
  SF.actions.pcdel = function (el) { return api().del("/admin/pay-cards/" + el.dataset.id).then(function () { SF.render({ quiet: true }); }, function (e) { SF.toast(SF.err(e), "err"); }); };
  /* villages of the town */
  function areasCard(list) {
    return '<section class="card stack"><h3>' + I("pin", 20) + " " + t("ar.title") + '</h3><p class="muted sm">' + t("ar.adminLead") + "</p>" +
      list.map(function (a) { return '<div class="arrow"><form class="grow" data-form="areaname" data-id="' + a.id + '"><input name="name" value="' + esc(tx(a.name)) + '" aria-label="' + t("ar.village") + '"></form><small class="muted num">' + a.ads + " + " + a.places + '</small>' + sw(a.active !== false, "areaon", a.id, t("ar.village")) + '<button type="button" class="iconbtn" data-act="areadel" data-id="' + a.id + '" aria-label="' + t("btn.delete") + '">' + I("trash", 16) + "</button></div>"; }).join("") +
      '<form class="arnew" data-form="areanew"><input name="name" placeholder="' + t("ar.newPh") + '" required><button class="btn primary">' + t("ar.add") + "</button></form></section>"; }
  function reloadAreas() { return SF.api.get("/areas").then(function (a) { SF.state.areas = a; SF.render({ quiet: true }); }); }
  SF.forms.areanew = function (fd) { return api().post("/admin/areas", { name: fd.name, cityId: SF.state.cityId }).then(reloadAreas); };
  SF.forms.areaname = function (fd, f) { return api().patch("/admin/areas/" + f.dataset.id, { name: fd.name }).then(function () { SF.toast(t("btn.saved")); return reloadAreas(); }); };
  SF.actions.areaon = function (el) { return api().patch("/admin/areas/" + el.dataset.id, { active: el.getAttribute("aria-checked") !== "true" }).then(reloadAreas); };
  SF.actions.areadel = function (el) { return api().del("/admin/areas/" + el.dataset.id).then(reloadAreas); };
  SF.inputs.svphoto = function (v, el) { var f = el.files && el.files[0], k = el.dataset.k; if (!f) return;
    return SF.shrinkImage(f, 700, 0.82).then(function (d) { return api().post("/admin/services/" + k + "/photo", { photo: d }); }, function () { SF.toast(t("tr.notImage"), "err"); })
      .then(function (ph) { if (ph) { SF.state.pub.svcPhotos = ph; SF.toast(t("btn.saved")); SF.render({ quiet: true }); } }); };
  SF.actions.asvphdel = function (el) { return api().post("/admin/services/" + el.dataset.k + "/photo", { photo: null }).then(function (ph) { SF.state.pub.svcPhotos = ph; SF.render({ quiet: true }); }); };
  SF.actions.asvc = function (el) { var on = el.getAttribute("aria-checked") !== "true";
    return api().patch("/admin/services/" + el.dataset.id, { on: on }).then(function (m) { SF.state.pub.services = m; SF.toast(t(on ? "asv.onDone" : "asv.offDone")); SF.render({ quiet: true }); }); };
  /* the «one button»: free ↔ paid classifieds, prices kept ready in advance */
  function adsCfgCard(c) {
    return '<form class="card stack adcfg" data-form="adcfg"><div class="row between"><h3>' + I("megaphone", 20) + " " + t("acfg.title") + '</h3></div>' +
      '<div class="paybig' + (c.paid ? " on" : "") + '"><span class="grow"><b>' + t(c.paid ? "acfg.paidOn" : "acfg.freeOn") + "</b><small>" + t(c.paid ? "acfg.paidSub" : "acfg.freeSub") + "</small></span>" + sw(c.paid, "adpaid", "1", t("acfg.switch")) + "</div>" +
      '<p class="muted sm">' + t("acfg.prices") + '</p><div class="grid2"><label class="f">' + t("acfg.fee") + '<input name="fee" inputmode="numeric" value="' + c.fee + '"><small class="muted">' + t("acfg.feeHint") + "</small></label>" +
      '<label class="f">' + t("acfg.days") + '<input name="days" inputmode="numeric" value="' + c.days + '"></label><label class="f">' + t("ads.p.top") + '<input name="top" inputmode="numeric" value="' + c.top + '"></label>' +
      '<label class="f">' + t("ads.p.color") + '<input name="color" inputmode="numeric" value="' + c.color + '"></label><label class="f">' + t("ads.p.vip") + '<input name="vip" inputmode="numeric" value="' + c.vip + '"></label><label class="f">' + t("ads.p.combo") + '<input name="combo" inputmode="numeric" value="' + c.combo + '"></label></div>' +
      '<label class="checkrow"><input type="checkbox" name="moderation"' + (c.moderation ? " checked" : "") + "><span>" + t("acfg.moder") + '<small class="muted">' + t("acfg.moderHint") + "</small></span></label>" +
      '<button class="btn primary">' + t("btn.save") + "</button></form>"; }
  SF.forms.adcfg = function (fd) { return api().patch("/admin/ads-settings", { fee: fd.fee || 0, days: fd.days || 30, top: fd.top || 0, color: fd.color || 0, vip: fd.vip || 0, combo: fd.combo || 0, moderation: !!fd.moderation }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.adpaid = function (el) { var on = el.getAttribute("aria-checked") !== "true";
    SF.modal('<div class="confirm"><span class="cic">' + I("wallet", 26) + '</span><h2 class="h2">' + t(on ? "acfg.toPaidQ" : "acfg.toFreeQ") + '</h2><p class="muted">' + t(on ? "acfg.toPaidSub" : "acfg.toFreeSub") + '</p><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn primary" data-act="adpaidok" data-v="' + (on ? 1 : 0) + '">' + t("btn.yes") + "</button></div></div>"); };
  SF.actions.adpaidok = function (el) { return api().patch("/admin/ads-settings", { paid: el.dataset.v === "1" }).then(function (c) { SF.state.pub.adsPaid = c.paid; SF.closeModal(); SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };

  /* ---------- classifieds: checking, blocking, payments ---------- */
  var AST = [["", "aads.all"], ["pending", "ads.st.pending"], ["active", "ads.st.active"], ["rejected", "ads.st.rejected"], ["blocked", "ads.st.blocked"], ["archived", "ads.st.archived"], ["draft", "ads.st.draft"]];
  function apill(s) { var c = { draft: "mut", pending: "warn", active: "ok", rejected: "bad", archived: "mut", blocked: "bad" }[s] || "mut"; return '<span class="pill p-' + c + '">' + t("ads.st." + s) + "</span>"; }
  R("/admin/ads", { title: "adm.ads", live: true, render: function (p, q) { var st = q.status === undefined ? "pending" : q.status, f = SF.state.aadf || {};
    var qs = "?status=" + st + (f.svc ? "&svc=" + f.svc : "") + (f.cat ? "&cat=" + f.cat : "") + (f.cityId ? "&cityId=" + f.cityId : "") + (f.q ? "&q=" + encodeURIComponent(f.q) : "");
    return api().get("/admin/ads" + qs).then(function (d) { SF.state.aads = d.list; var on = SF.svcOn ? SF.svcOn("ads") : true, pub = SF.state.pub || {};
      return (on ? "" : '<div class="note warn">' + I("info", 16) + "<span>" + t("aads.offNote") + ' <a class="link" href="#/admin/services">' + t("adm.services") + "</a></span></div>") +
        '<div class="row between wrap"><p class="muted">' + t(pub.adsPaid ? "acfg.paidOn" : "acfg.freeOn") + ' · <a class="link" href="#/admin/services">' + t("acfg.title") + "</a></p></div>" +
        (d.pays.length ? '<div class="card stack"><h3>' + I("wallet", 18) + " " + t("aads.pays", { n: d.pays.length }) + "</h3>" + d.pays.map(function (x) {
          return '<div class="payrow"><span class="grow"><b>' + esc(x.title) + "</b><small>" + t("aads.k." + x.kind) + (x.cardTail ? " · " + I("wallet", 12) + " …" + esc(x.cardTail) + (x.cardLabel ? " (" + esc(x.cardLabel) + ")" : "") : "") + (x.claimed ? ' · <b class="claimed">' + t("aads.claimed") + "</b>" : "") + " · " + esc(x.userName) + ' · <span class="num">' + esc(SF.phone(x.userPhone)) + '</span></small></span><b class="num">' + money(x.amount) + '</b><button class="btn sm ok" data-act="apay" data-id="' + x.id + '" data-ok="1">' + t("aads.paid") + '</button><button class="btn sm ghost" data-act="apay" data-id="' + x.id + '">' + t("aads.notPaid") + "</button></div>"; }).join("") + "</div>" : "") +
        (d.counts.pending ? '<div class="card approveall"><span class="grow"><b>' + t("aads.pendingN", { n: d.counts.pending }) + '</b><small class="muted">' + t("aads.approveHint") + '</small></span><button class="btn ok" data-act="aadall">' + I("check", 16) + t("aads.approveAll") + "</button></div>" : "") +
        '<div class="chips aadtabs" role="tablist">' + AST.map(function (x) { var n = x[0] ? d.counts[x[0]] : d.counts.all, cur = x[0] === st;
          return '<a role="tab" aria-selected="' + cur + '" class="chip' + (cur ? " on" : "") + '" href="#/admin/ads?status=' + x[0] + '">' + t(x[1]) + ' <i class="num">' + (n || 0) + "</i></a>"; }).join("") + "</div>" +
        '<form class="filters" data-form="aadf"><select name="svc" aria-label="' + t("adm.services") + '"><option value="">' + t("aads.allSvc") + "</option>" + Object.keys(SF.LISTINGS || {}).map(function (k) { return '<option value="' + k + '"' + (f.svc === k ? " selected" : "") + ">" + t("sv." + k) + "</option>"; }).join("") + "</select>" +
          '<select name="cat" aria-label="' + t("ads.cat") + '"><option value="">' + t("aads.allCats") + "</option>" + (f.svc && SF.LISTINGS ? SF.LISTINGS[f.svc].cats : SF.allListCats ? SF.allListCats() : []).map(function (c) { return '<option value="' + c[0] + '"' + (f.cat === c[0] ? " selected" : "") + ">" + t("adc." + c[0]) + "</option>"; }).join("") + "</select>" +
          '<input name="q" value="' + esc(f.q || "") + '" placeholder="' + t("aads.search") + '" aria-label="' + t("aads.search") + '"><button class="btn sm">' + I("search", 16) + t("btn.find") + "</button></form>" +
        (d.list.length ? table(["", t("ads.title"), t("ads.cat"), t("ads.price"), t("aads.status"), t("aads.actions")], d.list.map(function (a) {
          return "<tr><td>" + (a.photos[0] ? '<img class="athumb" src="' + esc(a.photos[0]) + '" alt="">' : '<span class="athumb">' + I("image", 18) + "</span>") + "</td><td><b>" + esc(a.title) + '</b><small class="muted"> ' + esc(tx(a.city)) + " · " + SF.dt(a.updatedAt || a.createdAt) + "</small>" + (a.reason ? '<small class="adwhy">' + esc(a.reason) + "</small>" : "") + "</td><td>" + t("sv." + (a.svc || "ads")) + " · " + t("adc." + a.cat) + '</td><td class="num">' + (a.price == null ? t("ad.deal") : money(a.price)) + "</td><td>" + apill(a.status) + (a.feeDue ? ' <span class="pill p-warn">' + t("aads.unpaid") + "</span>" : "") + "</td>" +
            '<td class="acts"><button class="iconbtn" data-act="aadview" data-id="' + a.id + '" aria-label="' + t("ads.view") + '">' + I("eye", 18) + "</button>" +
            (a.status !== "active" && a.status !== "draft" ? '<button class="iconbtn ok" data-act="aadok" data-id="' + a.id + '" aria-label="' + t("aads.approve") + '">' + I("check", 18) + "</button>" : "") +
            (a.status === "pending" || a.status === "active" ? '<button class="iconbtn" data-act="aadno" data-id="' + a.id + '" data-v="rejected" aria-label="' + t("aads.reject") + '">' + I("x", 18) + "</button>" : "") +
            (a.status !== "blocked" ? '<button class="iconbtn" data-act="aadno" data-id="' + a.id + '" data-v="blocked" aria-label="' + t("aads.block") + '">' + I("lock", 18) + "</button>" : "") +
            '<button class="iconbtn danger" data-act="aaddel" data-id="' + a.id + '" aria-label="' + t("ads.delete") + '">' + I("trash", 18) + "</button></td></tr>"; })) : SF.empty("megaphone", t("aads.none"), ""));
    }); } });
  SF.actions.aadall = function () { var f = SF.state.aadf || {}; return api().post("/admin/ads/approve-all", { svc: f.svc || undefined }).then(function (r) { SF.toast(t("aads.approved", { n: r.n })); SF.render({ quiet: true }); }); };
  /* ---------- complaints about listings ---------- */
  R("/admin/complaints", { title: "adm.complaints", live: true, render: function (p, q) { var st = q.status === undefined ? "new" : q.status;
    return api().get("/admin/complaints" + (st ? "?status=" + st : "")).then(function (d) {
      return '<div class="chips" role="tablist">' + [["new", "cp.new"], ["done", "cp.done"], ["dismissed", "cp.dismissed"], ["", "adm.all"]].map(function (x) { return '<a role="tab" class="chip' + (st === x[0] ? " on" : "") + '" aria-selected="' + (st === x[0]) + '" href="#/admin/complaints?status=' + x[0] + '">' + t(x[1]) + (x[0] === "new" ? ' <i class="num">' + d.new + "</i>" : "") + "</a>"; }).join("") + "</div>" +
        (d.list.length ? table([t("ads.title"), t("cp.reason"), t("cp.from"), t("aads.status"), t("aads.actions")], d.list.map(function (c) {
          return "<tr><td><b>" + esc(c.title) + '</b><small class="muted"> ' + esc(c.seller) + " · " + esc(SF.phone(c.sellerPhone)) + '</small></td><td><span class="pill p-warn">' + t("rp." + c.reason) + "</span>" + (c.text ? '<small class="adwhy">' + esc(c.text) + "</small>" : "") + "</td><td>" + esc(c.from) + '<small class="muted num"> ' + SF.dt(c.at) + "</small></td><td>" + t("cp." + c.status) + (c.adStatus !== "active" ? ' <small class="muted">· ' + t("ads.st." + c.adStatus) + "</small>" : "") + "</td>" +
            '<td class="acts">' + (c.status === "new" ? '<button class="btn sm danger" data-act="cpblock" data-id="' + c.id + '">' + I("lock", 14) + t("aads.block") + '</button><button class="btn sm ghost" data-act="cpdismiss" data-id="' + c.id + '">' + t("cp.dismiss") + "</button>" : "") + "</td></tr>"; })) : SF.empty("flag", t("cp.none"), ""));
    }); } });
  SF.actions.cpblock = function (el) { return api().post("/admin/complaints/" + el.dataset.id, { action: "block" }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.cpdismiss = function (el) { return api().post("/admin/complaints/" + el.dataset.id, { action: "dismiss" }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.forms.aadf = function (fd) { SF.state.aadf = { svc: fd.svc, cat: fd.cat, cityId: fd.cityId, q: fd.q }; SF.render({ quiet: true }); };
  function aad(id) { return (SF.state.aads || []).filter(function (x) { return x.id === id; })[0]; }
  SF.actions.aadview = function (el) { var a = aad(el.dataset.id); if (!a) return;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="stack"><h2 class="h2">' + esc(a.title) + "</h2>" + apill(a.status) +
      (a.photos.length ? '<div class="adgal small">' + a.photos.map(function (x) { return '<img src="' + esc(x) + '" alt="">'; }).join("") + "</div>" : "") +
      '<b class="adprice num">' + (a.price == null ? t("ad.deal") : money(a.price)) + "</b><p>" + esc(a.desc || "").replace(/\n/g, "<br>") + '</p><dl class="adattrs"><dt>' + t("ads.cat") + "</dt><dd>" + t("adc." + a.cat) + "</dd><dt>" + t("ads.seller") + "</dt><dd>" + esc(a.seller) + ' · <span class="num">' + esc(SF.phone(a.userPhone)) + "</span></dd><dt>" + t("ads.phone") + '</dt><dd class="num">' + esc(SF.phone(a.phone)) + "</dd><dt>" + t("ads.views") + '</dt><dd class="num">' + a.views + "</dd></dl>" +
      '<div class="row2">' + (a.status !== "active" && a.status !== "draft" ? '<button class="btn ok" data-act="aadok" data-id="' + a.id + '">' + I("check", 16) + t("aads.approve") + "</button>" : "") + (a.status === "pending" || a.status === "active" ? '<button class="btn ghost" data-act="aadno" data-id="' + a.id + '" data-v="rejected">' + I("x", 16) + t("aads.reject") + "</button>" : "") + "</div></div>"); };
  SF.actions.aadok = function (el) { var a = aad(el.dataset.id);
    if (a && a.feeDue) { SF.modal('<div class="confirm"><span class="cic">' + I("wallet", 26) + '</span><h2 class="h2">' + t("aads.feeQ") + '</h2><p class="muted">' + t("aads.feeSub") + '</p><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn ok" data-act="aadokpaid" data-id="' + a.id + '">' + t("aads.paidApprove") + "</button></div></div>"); return; }
    return api().post("/admin/ads/" + el.dataset.id + "/status", { status: "active" }).then(function () { SF.closeModal(); SF.toast(t("aads.approved")); SF.render({ quiet: true }); }); };
  SF.actions.aadokpaid = function (el) { return api().post("/admin/ads/" + el.dataset.id + "/status", { status: "active", paid: true }).then(function () { SF.closeModal(); SF.toast(t("aads.approved")); SF.render({ quiet: true }); }); };
  SF.actions.aadno = function (el) { var v = el.dataset.v, reasons = ["aads.r1", "aads.r2", "aads.r3", "aads.r4"];
    SF.modal('<div class="confirm"><span class="cic bad">' + I(v === "blocked" ? "lock" : "x", 26) + '</span><h2 class="h2">' + t(v === "blocked" ? "aads.blockQ" : "aads.rejectQ") + '</h2><form class="stack" data-form="aadno" data-id="' + el.dataset.id + '" data-v="' + v + '"><div class="tags">' +
      reasons.map(function (k) { return '<button type="button" class="chip" data-act="aadwhy" data-v="' + esc(t(k)) + '">' + t(k) + "</button>"; }).join("") + '</div><label class="f">' + t("aads.reason") + '<textarea name="reason" id="aadreason" rows="3" required minlength="3"></textarea></label>' +
      '<div class="row2"><button type="button" class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn danger">' + t(v === "blocked" ? "aads.block" : "aads.reject") + "</button></div></form></div>"); };
  SF.actions.aadwhy = function (el) { var r = document.getElementById("aadreason"); if (r) r.value = el.dataset.v; };
  SF.forms.aadno = function (fd, f) { return api().post("/admin/ads/" + f.dataset.id + "/status", { status: f.dataset.v, reason: fd.reason }).then(function () { SF.closeModal(); SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.aaddel = function (el) { SF.modal('<div class="confirm"><span class="cic bad">' + I("trash", 26) + '</span><h2 class="h2">' + t("ads.delQ") + '</h2><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn danger" data-act="aaddelok" data-id="' + el.dataset.id + '">' + t("ads.delete") + "</button></div></div>"); };
  SF.actions.aaddelok = function (el) { return api().del("/admin/ads/" + el.dataset.id).then(function () { SF.closeModal(); SF.toast(t("ads.deleted")); SF.render({ quiet: true }); }); };
  SF.actions.apay = function (el) { return api().post("/admin/ad-pays/" + el.dataset.id, { ok: !!el.dataset.ok }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
  SF.actions.rzopen = function () {
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="rzgo"><h2 class="h2">' + t("rz.title") + '</h2><p class="muted">' + t("rz.what") + "</p>" +
      '<ul class="rzlist"><li>' + I("check", 14) + t("rz.keep") + "</li><li>" + I("trash", 14) + t("rz.del") + "</li></ul>" +
      '<label class="checkrow"><input type="checkbox" name="customers"><span>' + t("rz.cust") + '<small class="muted">' + t("rz.custHint") + "</small></span></label>" +
      '<label class="checkrow"><input type="checkbox" name="ratings" checked><span>' + t("rz.rat") + '<small class="muted">' + t("rz.ratHint") + "</small></span></label>" +
      '<label class="f">' + t("rz.type") + '<input name="confirm" inputmode="numeric" maxlength="1" autocomplete="off" required></label>' +
      '<button class="btn danger block lg">' + I("trash", 18) + t("rz.go") + "</button></form>"); };
  SF.forms.rzgo = function (fd) { if (String(fd.confirm).trim() !== "0") { SF.toast(t("e.CONFIRM_ZERO"), "err"); return; }
    return api().post("/admin/reset-stats", { confirm: "0", customers: !!fd.customers, ratings: !!fd.ratings }).then(function (n) { SF.closeModal(); SF.toast(t("rz.done", { n: n.orders })); SF.render({ quiet: true }); }); };
})();
