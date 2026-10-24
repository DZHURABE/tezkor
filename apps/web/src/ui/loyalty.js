/* Ordering for a chosen time and "order again".
   Server side: core/server.js → loyalty() (schedule settings), /admin/loyalty, status "scheduled". */
(function () {
  var SF = window.SF, t = SF.t, esc = SF.esc, I = SF.icon, tx = SF.tx, money = SF.money, api = function () { return SF.api; };
  var TZ = 5 * 3600000, DAY = 86400000;
  function lo() { return (SF.state.pub && SF.state.pub.loyalty) || {}; }
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function hm(at) { var d = new Date(at + TZ); return p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()); }
  function dayOf(at) { return Math.floor((at + TZ) / DAY); }
  /* "Today 13:30" / "Tomorrow 09:00" / "25.10 13:30" — always Tajikistan time, like opening hours */
  SF.whenText = function (at) { var d = dayOf(at) - dayOf(Date.now()), x = new Date(at + TZ);
    return (d === 0 ? t("co.today") : d === 1 ? t("co.tomorrow") : p2(x.getUTCDate()) + "." + p2(x.getUTCMonth() + 1)) + " " + hm(at); };

  /* ---------- ordering for a chosen time ---------- */
  /* half-hour slots of one day when the place is open at that time and when the kitchen gets the order */
  SF.schedSlots = function (r, off) {
    var L = lo(), lead = (L.schedLeadMin || 40) * 60000, now = Date.now(), max = now + (L.schedDays || 3) * DAY, R = window.SomonRules, out = [];
    var d0 = Math.floor((now + TZ) / DAY) * DAY - TZ + off * DAY;
    for (var m = 0; m < 1440; m += 30) { var at = d0 + m * 60000;
      if (at < now + 45 * 60000 || at > max) continue;
      if (R && r.hours && (!R.isOpenAt(r.hours, new Date(at)) || !R.isOpenAt(r.hours, new Date(Math.max(now, at - lead))))) continue;
      out.push(at); }
    return out;
  };
  function schedDays(r) { var L = lo(), out = []; for (var d = 0; d <= (L.schedDays || 3); d++) { var s = SF.schedSlots(r, d); if (s.length) out.push({ d: d, slots: s }); } return out; }
  /* before asking for a price: a place that is closed now gets "at a set time" ready, so the customer can still order */
  SF.schedPrepare = function (r, x) {
    if (!lo().schedOn) { x.when = "now"; return; }
    if (!x.when) x.when = r.isOpenNow === false ? "later" : "now";
    if (x.when !== "later") return;
    var days = schedDays(r); if (!days.length) { x.when = "now"; x.slot = null; return; }
    var cur = days.filter(function (d) { return d.d === x.sday; })[0] || days[0]; x.sday = cur.d;
    if (cur.slots.indexOf(x.slot) < 0) x.slot = cur.slots[0];
  };
  SF.schedBox = function (r, x) {
    if (!lo().schedOn) return ""; var days = schedDays(r); if (!days.length) return "";
    var later = x.when === "later", cur = days.filter(function (d) { return d.d === x.sday; })[0] || days[0];
    return '<section class="card schedcard"><h3>' + I("clock", 18) + t("co.when") + "</h3>" +
      '<div class="seg cowho">' + (r.isOpenNow === false ? "" : '<button type="button" class="' + (later ? "" : "on") + '" data-act="cowhen" data-v="now">' + I("scooter", 16) + t("co.asap") + "</button>") +
      '<button type="button" class="' + (later ? "on" : "") + '" data-act="cowhen" data-v="later">' + I("clock", 16) + t("co.later") + "</button></div>" +
      (r.isOpenNow === false ? '<p class="fine">' + I("info", 14) + t("co.closedNow") + "</p>" : "") +
      (later ? '<div class="daychips" role="group">' + days.map(function (d) { var lbl = d.d === 0 ? t("co.today") : d.d === 1 ? t("co.tomorrow") : SF.whenText(d.slots[0]).split(" ")[0];
          return '<button type="button" class="fchip' + (d.d === cur.d ? " on" : "") + '" data-act="coday" data-v="' + d.d + '">' + lbl + "</button>"; }).join("") + "</div>" +
        '<div class="slots" role="radiogroup">' + cur.slots.map(function (at) { var on = at === x.slot;
          return '<button type="button" class="slot num' + (on ? " on" : "") + '" role="radio" aria-checked="' + on + '" data-act="coslot" data-v="' + at + '">' + hm(at) + "</button>"; }).join("") + "</div>" +
        '<p class="fine">' + I("info", 14) + t("co.schedNote", { lead: lo().schedLeadMin || 40 }) + "</p>" : "") + "</section>";
  };
  function x() { return SF.state.co || (SF.state.co = {}); }
  SF.actions.cowhen = function (el) { x().when = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.coday = function (el) { x().sday = +el.dataset.v; x().slot = null; SF.render({ quiet: true }); };
  SF.actions.coslot = function (el) { x().slot = +el.dataset.v; SF.render({ quiet: true }); };

  /* ---------- "order again" on the home screen ---------- */
  var roCache = null;
  SF.reorderSlot = function () { var u = SF.state.user; return SF.isBuyer(u) ? '<div id="reostrip"></div>' : ""; };
  SF.after.push(function () {
    var box = document.getElementById("reostrip"); if (!box) return;
    var fill = function (list) { var seen = {}, picks = list.filter(function (o) { if (o.status !== "delivered" || !o.restaurant || seen[o.restaurantId]) return false; seen[o.restaurantId] = 1; return true; }).slice(0, 4);
      if (!picks.length) { box.innerHTML = ""; return; }
      box.innerHTML = '<div class="sect2"><div><h2>' + t("ro.title") + '</h2><span class="muted">' + t("ro.sub") + '</span></div></div><div class="hscroll rocards">' + picks.map(function (o) {
        var names = o.items.slice(0, 3).map(function (it) { return esc(tx(it.name)) + (it.qty > 1 ? " ×" + it.qty : ""); }).join(", ") + (o.items.length > 3 ? " …" : "");
        return '<article class="rocard"><span class="cim" style="--tone:' + esc(o.restaurant.tone) + '">' + SF.pic(o.items[0], 48) + '</span><div class="grow"><b>' + esc(tx(o.restaurant.name)) + "</b><small>" + names + '</small><span class="num muted">' + money(o.subtotal) + "</span></div>" +
          '<button type="button" class="btn sm primary" data-act="reorder" data-id="' + o.id + '" aria-label="' + t("orders.repeat") + '">' + I("route", 14) + t("orders.repeat") + "</button></article>"; }).join("") + "</div>"; };
    if (roCache && Date.now() - roCache.at < 60000) return fill(roCache.list);
    api().get("/orders/my").then(function (list) { roCache = { at: Date.now(), list: list }; if (document.body.contains(box)) fill(list); }, function () {});
  });

  /* ---------- the restaurant: orders for later, under the board ---------- */
  SF.soonList = function (list) { if (!list || !list.length) return "";
    return '<section class="card soonlist"><h3>' + I("clock", 18) + t("rest.soon") + '<span class="cnt num">' + list.length + '</span></h3><p class="fine">' + t("rest.soonNote", { lead: lo().schedLeadMin || 40 }) + "</p>" +
      list.map(function (o) { return '<div class="soonrow"><b class="num when">' + SF.whenText(o.scheduledAt) + '</b><span class="grow"><b class="num">№' + o.number + "</b> · " + o.items.map(function (it) { return esc(tx(it.name)) + " ×" + it.qty; }).join(", ") + '</span><b class="num">' + money(o.subtotal) + "</b></div>"; }).join("") + "</section>"; };

  /* ---------- admin: orders for a chosen time ---------- */
  SF.schedCard = function (l) { if (!l) return "";
    var num = function (name, v) { return '<input name="' + name + '" inputmode="numeric" value="' + v + '">'; };
    return '<form class="card stack lycard" data-form="aloyal"><h3>' + I("clock", 18) + " " + t("adm.schedOn") + '</h3>' +
      '<div class="grid3"><label class="f">' + t("adm.schedOn") + '<select name="schedOn"><option value="1"' + (l.schedOn ? " selected" : "") + ">" + t("adm.on") + '</option><option value="0"' + (l.schedOn ? "" : " selected") + ">" + t("adm.off") + "</option></select></label>" +
      '<label class="f">' + t("adm.schedLead") + num("schedLeadMin", l.schedLeadMin) + '</label><label class="f">' + t("adm.schedDays") + num("schedDays", l.schedDays) + "</label></div>" +
      '<button class="btn primary">' + t("btn.save") + "</button></form>"; };
  SF.forms.aloyal = function (fd) { return api().patch("/admin/loyalty", fd).then(function () { return api().get("/settings/public"); }).then(function (p) { SF.state.pub = p; SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
})();
