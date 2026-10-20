/* Тезкор — incoming orders ring like a phone call.
   Restaurant: a full-screen "new order" card with the dishes, total, cooking time and Accept / Decline.
   Courier: a full-screen offer with pay, distance and a countdown — Accept or Skip; when time runs out it is skipped.
   The ringtone is our own: a bright bell arpeggio that repeats until someone answers.
   Browsers only allow sound after the first tap, so partner screens show a one-tap "turn on sound" bar. */
(function () {
  var t = SF.t, I = SF.icon, esc = SF.esc, tx = SF.tx, money = SF.money;
  var KEYS = { restaurant: ["n.newOrder"], courier: ["n.courierNew", "n.courierAuto"] };
  var OFFER_SEC = 40;
  var ac = null, ringTimer = null, ringStop = 0, cur = null, cdTimer = null, wake = null, busy = false;
  /* answered alerts, remembered per person (several roles can share one phone in the demo) */
  function ackKey() { return "acked." + (SF.state.user ? SF.state.user.id : "-"); }
  function acked() { if (SF.state.ackedFor !== ackKey()) { SF.state.ackedFor = ackKey(); SF.state.acked = SF.ls.get(ackKey(), {}) || {}; } return SF.state.acked; }
  function ctx() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (e) { ac = null; } return ac; }
  SF.soundOn = function () { return !!ac && ac.state === "running"; };
  document.addEventListener("pointerdown", function () { if (ac && ac.state !== "running") ac.resume(); }, true);

  /* bell: a sine with a soft overtone and a long decay, like a marimba/bell */
  function bell(a, out, freq, at, len, vol) {
    [[1, 1], [2.01, 0.35], [3.02, 0.12]].forEach(function (h) {
      var o = a.createOscillator(), g = a.createGain(); o.type = "sine"; o.frequency.value = freq * h[0];
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol * h[1], at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g); g.connect(out); o.start(at); o.stop(at + len + 0.05);
    });
  }
  /* restaurant: rising "ta-da-da-DING" twice; courier: quick "ding-ding · ding-ding" like an incoming call */
  var TUNES = {
    restaurant: [[659, 0], [831, 0.14], [988, 0.28], [1319, 0.42, 0.9], [659, 1.1], [831, 1.24], [988, 1.38], [1319, 1.52, 0.9]],
    courier: [[1175, 0], [1568, 0.16], [1175, 0.5], [1568, 0.66], [1175, 1.2], [1568, 1.36], [1175, 1.7], [1568, 1.86]]
  };
  function ring(kind) {
    var a = ctx(); if (!a) return;
    var out = a.createDynamicsCompressor(), master = a.createGain(); master.gain.value = 1.6; master.connect(out); out.connect(a.destination);
    var now = a.currentTime + 0.02;
    (TUNES[kind] || TUNES.restaurant).forEach(function (n) { bell(a, master, n[0], now + n[1], n[2] || 0.45, 0.55); });
    if (navigator.vibrate) try { navigator.vibrate(kind === "courier" ? [300, 120, 300, 500, 300, 120, 300] : [600, 200, 600]); } catch (e) {}
  }
  function startRing(kind) { if (ringTimer) return; ring(kind); ringStop = Date.now() + 3 * 60 * 1000; ringTimer = setInterval(function () { if (Date.now() > ringStop) return stopRing(); ring(kind); }, 3000); }
  function stopRing() { clearInterval(ringTimer); ringTimer = null; if (navigator.vibrate) try { navigator.vibrate(0); } catch (e) {} }
  SF.chime = function () { var a = ctx(); if (!a) return; var g = a.createGain(); g.gain.value = 1.2; g.connect(a.destination); bell(a, g, 988, a.currentTime + 0.02, 0.5, 0.5); bell(a, g, 1319, a.currentTime + 0.18, 0.7, 0.5); };

  function host() { var el = document.getElementById("alarm"); if (!el) { el = document.createElement("div"); el.id = "alarm"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); } return el; }
  function close() { stopRing(); clearInterval(cdTimer); cdTimer = null; cur = null; var el = document.getElementById("alarm"); if (el) { el.hidden = true; el.innerHTML = ""; } }
  function ack(ids) { var a = acked(); ids.forEach(function (id) { a[id] = 1; }); SF.ls.set(ackKey(), a); }

  /* ---------- restaurant: incoming order ---------- */
  function restCard(o, more) {
    var prep = SF.state.inPrep || 20;
    return '<div class="incall rest"><div class="ic-head"><span class="ic-ring">' + I("bell", 30) + '</span><div><small>' + t("al.restTitle") + '</small><b class="num">№' + o.number + "</b></div>" + (more ? '<span class="ic-more num">+' + more + "</span>" : "") + "</div>" +
      (o.dineIn ? '<p class="ic-table">' + I("grid", 16) + t("tb.table", { n: esc(o.tableName) }) + " · " + t("tb.inHall") + "</p>" : "") +
      '<ul class="ic-items">' + o.items.map(function (it) { return '<li><b class="num">' + it.qty + "×</b><span>" + esc(tx(it.name)) + "</span></li>"; }).join("") + "</ul>" +
      (o.comment ? '<p class="ic-note">' + I("info", 14) + esc(o.comment) + "</p>" : "") +
      '<div class="ic-sum"><span>' + (o.dineIn ? t("tb.payTable") : t("pay." + o.payment.method)) + (o.payment.method === "transfer" ? " · " + t("ps." + o.payment.status) : "") + '</span><b class="num">' + money(o.subtotal) + "</b></div>" +
      (!o.dineIn && o.delivery === "mixed" ? '<p class="ic-lbl">' + t("dl.who") + '</p><div class="ic-dl">' + SF.dlChoice(SF.state.inDeliv || "own", "indeliv") + "</div>" : "") +
      '<p class="ic-lbl">' + t("rest.prep") + '</p><div class="ic-prep">' + [10, 15, 20, 30, 45].map(function (m) { return '<button type="button" class="' + (m === prep ? "on" : "") + '" data-act="inprep" data-v="' + m + '">' + m + "</button>"; }).join("") + "</div>" +
      (o.payment.method === "transfer" ? '<button type="button" class="btn ghost block ic-rcpt" data-act="rcpt" data-id="' + o.id + '">' + I("receipt", 16) + t("tr.receipt") + "</button>" : "") +
      '<div class="ic-acts"><button type="button" class="btn ic-no" data-act="indecline" data-id="' + o.id + '">' + I("x", 20) + t("rest.reject") + '</button><button type="button" class="btn ic-yes" data-act="inaccept" data-id="' + o.id + '">' + I("check", 22) + t(o.payment.method === "transfer" ? "tr.acceptPaid" : "rest.accept") + "</button></div>" +
      '<button type="button" class="link ic-later" data-act="inlater">' + t("al.later") + "</button></div>";
  }
  /* ---------- courier: offer with countdown ---------- */
  function courierCard(o, left) {
    var pay = o.courierPay != null ? o.courierPay : Math.round(o.deliveryFee * (SF.state.pub.courierPct || 80) / 100), circ = 2 * Math.PI * 34;
    return '<div class="incall cour"><div class="ic-head"><span class="ic-ring">' + I("scooter", 30) + '</span><div><small>' + t("al.courierTitle") + '</small><b class="num">+' + money(pay) + "</b></div>" +
      '<svg class="ic-cd" viewBox="0 0 80 80" aria-label="' + left + '"><circle cx="40" cy="40" r="34" class="bg"/><circle cx="40" cy="40" r="34" class="fg" style="stroke-dasharray:' + circ.toFixed(1) + ";stroke-dashoffset:" + (circ * (1 - left / OFFER_SEC)).toFixed(1) + '"/><text x="40" y="47" class="num">' + left + "</text></svg></div>" +
      '<div class="ic-route"><div><small>' + t("cour.pickup") + "</small><b>" + esc(tx(o.restaurant.name)) + '</b></div><div><small>' + t("cour.dropoff") + "</small><b>" + esc(o.address.text) + "</b></div></div>" +
      '<div class="ic-facts"><span class="num">' + o.km + " " + t("u.km") + "</span><span>" + (o.payment.method === "cash" ? t("cour.collect", { sum: money(o.total) }) : t("cour.paidOnline")) + "</span><span>" + SF.statusPill(o.status) + "</span></div>" +
      '<div class="ic-acts"><button type="button" class="btn ic-no" data-act="inskip" data-id="' + o.id + '">' + I("x", 20) + t("al.skip") + '</button><button type="button" class="btn ic-yes" data-act="intake" data-id="' + o.id + '">' + I("check", 22) + t("cour.take") + "</button></div></div>";
  }
  function show(kind, o, notes) {
    cur = { kind: kind, order: o, ids: notes.map(function (n) { return n.id; }), noteIds: notes.filter(function (n) { return n.orderId === o.id; }).map(function (n) { return n.id; }), left: OFFER_SEC };
    var el = host(); el.className = "k-" + kind; el.hidden = false;
    var draw = function () { el.innerHTML = kind === "courier" ? courierCard(o, cur.left) : restCard(o, notes.length - 1); };
    draw(); startRing(kind);
    if (kind === "courier") { clearInterval(cdTimer); cdTimer = setInterval(function () { if (!cur) return; cur.left--; if (cur.left <= 0) { SF.actions.inskip({ dataset: { id: o.id } }, true); return; } var c = el.querySelector(".ic-cd"); if (c) { c.querySelector(".fg").style.strokeDashoffset = (2 * Math.PI * 34 * (1 - cur.left / OFFER_SEC)).toFixed(1); c.querySelector("text").textContent = cur.left; } }, 1000); }
    if (document.hidden && window.TezkorApp && window.TezkorApp.notify) { try { window.TezkorApp.notify(t(kind === "courier" ? "al.courierTitle" : "al.restTitle"), t(notes[0].key, notes[0].params)); } catch (e) {} }
    else if (document.hidden && window.Notification && Notification.permission === "granted") {
      var title = t(kind === "courier" ? "al.courierTitle" : "al.restTitle"), body = t(notes[0].key, notes[0].params);
      (navigator.serviceWorker && navigator.serviceWorker.ready ? navigator.serviceWorker.ready.then(function (r) { return r.showNotification(title, { body: body, tag: "tez-order", renotify: true, requireInteraction: true, vibrate: [500, 150, 500], icon: "/icons/icon-192.png" }); }) : Promise.reject())
        .catch(function () { try { new Notification(title, { body: body, tag: "tez-order" }); } catch (e) {} });
    }
  }

  /* called after every notifications poll */
  SF.alarmCheck = function (notes) {
    var u = SF.state.user, keys = u && KEYS[u.role];
    if (u && u.role === "courier") notes.filter(function (n) { return n.key === "n.ready" && !acked()[n.id]; }).forEach(function (n) { ack([n.id]); SF.chime(); });
    /* a guest at a table calls the waiter / asks for the bill */
    if (u && u.role === "restaurant") notes.filter(function (n) { return (n.key === "n.waiter" || n.key === "n.bill") && !acked()[n.id]; }).forEach(function (n) { ack([n.id]); SF.chime(); });
    if (!keys) { if (cur) close(); return; }
    var pending = notes.filter(function (n) { return keys.indexOf(n.key) >= 0 && !acked()[n.id] && n.orderId; });
    if (u.role === "courier" && (!u.courier || !u.courier.online)) pending = [];
    if (!pending.length) { if (cur) close(); return; }
    if (busy || (cur && pending.some(function (n) { return n.orderId === cur.order.id; }))) return;
    busy = true;
    SF.api.get("/orders/" + pending[0].orderId).then(function (o) {
      busy = false; var live = u.role === "courier" ? !o.courierId && (o.status === "cooking" || o.status === "ready") : o.status === "pending";
      if (!live) { ack(pending.filter(function (n) { return n.orderId === o.id; }).map(function (n) { return n.id; })); return; }
      show(u.role, o, pending);
    }).catch(function () { busy = false; ack([pending[0].id]); });
  };

  SF.actions.indeliv = function (el) { SF.state.inDeliv = el.dataset.v; el.parentNode.querySelectorAll("button").forEach(function (b) { var on = b === el; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }); };
  SF.actions.inprep = function (el) { SF.state.inPrep = +el.dataset.v; document.querySelectorAll(".ic-prep button").forEach(function (b) { b.classList.toggle("on", b === el); }); };
  SF.actions.inaccept = function (el) { var id = el.dataset.id, ids = cur ? cur.noteIds : []; var dl = document.querySelector(".ic-dl") ? (SF.state.inDeliv || "own") : undefined; SF.state.inDeliv = null; return SF.api.post("/restaurant/orders/" + id + "/accept", { prepMin: SF.state.inPrep || 20, delivery: dl }).then(function (o) { ack(ids); close(); SF.toast(t(o && o.dineIn ? "tb.accepted" : "rest.accepted")); SF.go("/rest/orders"); SF.render({ quiet: true }); }); };
  SF.actions.indecline = function (el) { var ids = cur ? cur.noteIds : []; ack(ids); close(); SF.go("/rest/orders"); setTimeout(function () { SF.actions.reject({ dataset: { id: el.dataset.id } }); }, 300); };
  SF.actions.inlater = function () { if (cur) ack(cur.ids); close(); SF.go(SF.state.user && SF.state.user.role === "courier" ? "/courier" : "/rest/orders"); };
  SF.actions.intake = function (el) { var ids = cur ? cur.noteIds : []; return SF.api.post("/courier/orders/" + el.dataset.id + "/accept").then(function () { ack(ids); close(); SF.toast(t("cour.taken")); SF.go("/courier"); SF.render({ quiet: true }); }).catch(function (e) { ack(ids); close(); throw e; }); };
  SF.actions.inskip = function (el, auto) { var id = el.dataset.id, ids = cur ? cur.noteIds : []; ack(ids); close(); SF.api.post("/courier/orders/" + id + "/skip").catch(function () {}).then(function () { if (!auto) SF.toast(t("al.skipped"), "info"); SF.render({ quiet: true }); }); };
  /* older screens and tests use this name */
  SF.actions.alarmack = SF.actions.inlater;

  /* one tap turns sound (and notifications) on; the bar shows on partner screens until then */
  SF.soundBar = function () {
    if (SF.soundOn()) return "";
    return '<section class="soundbar"><span class="sb-ic">' + I("bell", 22) + '</span><div class="grow"><b>' + t("al.barTitle") + "</b><small>" + t("al.barSub") + '</small></div><button type="button" class="btn primary" data-act="soundon">' + t("al.barBtn") + "</button></section>";
  };
  SF.actions.soundon = function () {
    if (!ctx()) { SF.toast(t("al.noSound"), "err"); return; }
    ring(SF.state.user && SF.state.user.role === "courier" ? "courier" : "restaurant");
    if (window.Notification && Notification.permission === "default") try { Notification.requestPermission(); } catch (e) {}
    keepAwake(); SF.toast(t("al.on")); setTimeout(function () { SF.render({ quiet: true }); }, 300);
  };
  function keepAwake() {
    if (window.TezkorApp && window.TezkorApp.keepAwake) { try { window.TezkorApp.keepAwake(true); } catch (e) {} return; }
    if (!("wakeLock" in navigator) || wake) return;
    navigator.wakeLock.request("screen").then(function (w) { wake = w; w.addEventListener("release", function () { wake = null; }); }).catch(function () {});
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && SF.state.user && KEYS[SF.state.user.role] && SF.soundOn()) keepAwake(); });
})();
