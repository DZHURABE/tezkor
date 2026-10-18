/* Тезкор — ordering at the table. A QR sticker on the table opens /t/<code>:
   the menu of that restaurant, a small basket, "Order" — no sign-up, no address, pay the waiter.
   The guest sees the status of their orders and can call the waiter (or ask for the bill). */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, tx = SF.tx, money = SF.money;
  var M = null;   // the table being shown: { code, table, restaurant, open }

  function store(code) { return SF.ls.get("dine." + code, null) || { cart: {}, orders: [], name: "" }; }
  function keep(code, s) { SF.ls.set("dine." + code, s); }
  function count(s) { return Object.keys(s.cart).reduce(function (n, k) { return n + s.cart[k]; }, 0); }
  function sum(s) { return Object.keys(s.cart).reduce(function (n, k) { var p = prod(k); return n + (p ? p.price * s.cart[k] : 0); }, 0); }
  function prod(id) { return M && M.restaurant.products.filter(function (p) { return p.id === id; })[0]; }

  SF.shells.table = function (html) { return '<div class="flag-line" aria-hidden="true"></div>' + html; };

  function card(p, q) {
    var pic = p.photo ? '<img src="' + esc(p.photo) + '" alt="" loading="lazy">' : SF.art(p.kind, 64);
    return '<article class="tprod' + (p.available ? "" : " off") + '"><span class="tpic" style="--tone:' + esc(M.restaurant.tone || "#F2EFEA") + '">' + pic + "</span>" +
      '<div class="grow"><b>' + esc(tx(p.name)) + "</b>" + (tx(p.desc) ? "<small>" + esc(tx(p.desc)) + "</small>" : "") +
      '<div class="tprow"><span class="price num">' + money(p.price) + (p.weight ? " <small>" + esc(p.weight) + "</small>" : "") + "</span>" +
      (!p.available ? '<span class="pill p-mut">' + t("prod.soldout") + "</span>" : q ? '<span class="tstep"><button type="button" data-act="tq" data-id="' + p.id + '" data-d="-1" aria-label="−">' + I("minus", 16) + '</button><b class="num">' + q + '</b><button type="button" data-act="tq" data-id="' + p.id + '" data-d="1" aria-label="+">' + I("plus", 16) + "</button></span>"
        : '<button type="button" class="tadd" data-act="tq" data-id="' + p.id + '" data-d="1">' + I("plus", 16) + t("tb.add") + "</button>") + "</div></div></article>";
  }

  /* a square tile: photo on top, name, price, «+» — the menu reads like a picture grid, one category at a time */
  function tile(p, q) {
    var pic = p.photo ? '<img src="' + esc(p.photo) + '" alt="" loading="lazy">' : SF.art(p.kind, 78);
    return '<article class="tsq' + (p.available ? "" : " off") + (q ? " in" : "") + '"><span class="tsqimg" style="--tone:' + esc(M.restaurant.tone || "#F2EFEA") + '">' + pic + (q ? '<i class="tsqn num">' + q + "</i>" : "") + "</span>" +
      '<b class="tsqname">' + esc(tx(p.name)) + "</b>" + '<div class="tsqrow"><span class="price num">' + money(p.price) + "</span>" +
      (!p.available ? '<span class="pill p-mut">' + t("prod.soldout") + "</span>" : q ? '<span class="tstep"><button type="button" data-act="tq" data-id="' + p.id + '" data-d="-1" aria-label="−">' + I("minus", 14) + '</button><b class="num">' + q + '</b><button type="button" data-act="tq" data-id="' + p.id + '" data-d="1" aria-label="+">' + I("plus", 14) + "</button></span>"
        : '<button type="button" class="tsqadd" data-act="tq" data-id="' + p.id + '" data-d="1" aria-label="' + t("tb.add") + " " + esc(tx(p.name)) + '">' + I("plus", 18) + "</button>") + "</div></article>";
  }
  SF.actions.tcatset = function (el) { SF.state.tcat = el.dataset.v; SF.render({ quiet: true }).then(function () { var n = document.querySelector(".tcats"); if (n) { var y = n.getBoundingClientRect().top + window.scrollY - 8; if (window.scrollY > y) window.scrollTo({ top: y }); } }); };

  function statusLine(o) {
    var k = { pending: "tb.s.pending", cooking: "tb.s.cooking", ready: "tb.s.cooking", picked_up: "tb.s.cooking", delivered: "tb.s.served", rejected: "tb.s.rejected", cancelled: "tb.s.cancelled" }[o.status] || "tb.s.pending";
    var left = o.status === "cooking" && o.prepMin ? Math.max(1, o.prepMin - Math.round((Date.now() - o.history[o.history.length - 1].at) / 60000)) : null;
    return '<div class="tord s-' + o.status + '"><span class="tdot"></span><div class="grow"><b>№' + o.number + " · " + t(k) + "</b><small>" +
      o.items.map(function (i) { return i.qty + "× " + esc(tx(i.name)); }).join(", ") + (left ? " · " + t("tb.left", { n: left }) : "") + "</small></div>" +
      (o.status === "pending" ? '<button type="button" class="link sm" data-act="tcancel" data-k="' + esc(o._key) + '">' + t("btn.cancel") + "</button>" : '<b class="num">' + money(o.total) + "</b>") + "</div>" +
      /* the waiter of this table, and his tip card if he added one (not required) */
      (o.waiter && o.status !== "cancelled" && o.status !== "rejected" ? '<div class="twaiterline">' + I("user", 14) + "<span class=\"grow\">" + t("tb.yourWaiter", { name: esc(o.waiter.name) }) + (o.waiter.rating ? " · ★ " + o.waiter.rating : "") + "</span>" +
        (o.waiter.tipCard ? '<button type="button" class="btn sm ghost" data-act="ttip" data-v="' + esc(o.waiter.tipCard) + '" data-name="' + esc(o.waiter.name) + '">' + I("card", 14) + t("tb.tip") + "</button>" : "") + "</div>" : "");
  }

  SF.route("/t/:code", { shell: SF.shells.table, title: "tb.title", render: function (p) {
    var code = p.code;
    return SF.api.get("/table/" + code).then(function (m) {
      m.code = code; M = m; var s = store(code), r = m.restaurant;
      var cats = (SF.state.categories || []).filter(function (c) { return r.products.some(function (x) { return x.categoryId === c.id; }); });
      var rest = r.products.filter(function (x) { return !cats.some(function (c) { return c.id === x.categoryId; }); });
      var groups = cats.map(function (c) { return { id: c.id, name: tx(c.name), list: r.products.filter(function (x) { return x.categoryId === c.id; }) }; });
      if (rest.length) groups.push({ id: "other", name: t("tb.other"), list: rest });
      /* this guest's orders at this table (the last 12 hours) */
      return Promise.all(s.orders.map(function (k) { return SF.api.get("/dine/" + k).then(function (o) { o._key = k; return o; }).catch(function () { return null; }); })).then(function (os) {
        os = os.filter(function (o) { return o && Date.now() - o.createdAt < 12 * 3600000; });
        s.orders = os.map(function (o) { return o._key; }); keep(code, s); SF.state.dineOrders = os;
        var n = count(s), total = sum(s);
        return '<div class="tpage">' +
          '<header class="thead" style="--tone:' + esc(r.tone || "#F2EFEA") + '">' + (r.cover ? '<img class="tcover" src="' + esc(r.cover) + '" alt="">' : "") +
            '<div class="thtop">' + SF.logo() + SF.langSel() + "</div>" +
            '<div class="thname">' + (r.logo ? '<img class="tlogo" src="' + esc(r.logo) + '" alt="">' : "") + "<div><h1>" + esc(tx(r.name)) + '</h1><span class="tbadge">' + I("grid", 14) + t("tb.table", { n: esc(m.table.name) }) + "</span></div></div></header>" +
          (m.open ? "" : '<div class="msg warn">' + I("clock", 16) + t("tb.closed") + "</div>") +
          (os.length ? '<section class="card tords"><h2>' + t("tb.yours") + "</h2>" + os.map(statusLine).join("") + "</section>" : '<p class="thint">' + I("info", 16) + t("tb.hint") + "</p>") +
          (function () { var d = os.filter(function (o) { return o.status === "delivered" && !o.review; })[0]; if (!d) return ""; SF.state.tRev = d._key; return SF.reviewForm(d, "trev"); })() +
          (function () { var cur = groups.filter(function (g) { return g.id === SF.state.tcat; })[0] || groups[0]; if (!cur) return "";
            return '<nav class="ctabs tcats" aria-label="' + t("rest.menu") + '">' + groups.map(function (g) { var on = g === cur, inCart = g.list.reduce(function (n, x) { return n + (s.cart[x.id] || 0); }, 0);
                return '<button type="button" class="' + (on ? "on" : "") + '" aria-pressed="' + on + '" data-act="tcatset" data-v="' + g.id + '">' + esc(g.name) + ' <i class="num">' + (inCart ? "✓" + inCart : g.list.length) + "</i></button>"; }).join("") + "</nav>" +
              '<section class="msec" id="sec-' + cur.id + '"><h2>' + esc(cur.name) + '</h2><div class="tgrid">' + cur.list.map(function (x) { return tile(x, s.cart[x.id] || 0); }).join("") + "</div></section>"; })() +
          '<div class="twaiter"><button type="button" class="btn ghost" data-act="tcall" data-why="help">' + I("bell", 16) + t("tb.callWaiter") + '</button><button type="button" class="btn ghost" data-act="tcall" data-why="bill">' + I("receipt", 16) + t("tb.bill") + "</button></div>" +
          '<a class="tpromo" href="#/">' + SF.mark(28) + "<span><b>" + t("tb.promoT") + "</b><small>" + t("tb.promoS") + "</small></span>" + I("chevR", 16) + "</a>" +
          (n ? '<button type="button" class="floatcart tbar" data-act="tcart"><span>' + I("bag", 18) + '<i class="num">' + n + "</i></span><b>" + t("tb.review") + '</b><span class="num">' + money(total) + "</span></button>" : "") +
          "</div>";
      });
    });
  } });

  SF.actions.tq = function (el) { if (!M) return; var s = store(M.code), id = el.dataset.id, d = +el.dataset.d;
    s.cart[id] = Math.max(0, Math.min(50, (s.cart[id] || 0) + d)); if (!s.cart[id]) delete s.cart[id]; keep(M.code, s);
    if (document.querySelector("#modal:not([hidden]) .tsheet")) { if (!count(s)) SF.closeModal(); else sheet(); } SF.render({ quiet: true }); };

  function sheet() { var s = store(M.code), ids = Object.keys(s.cart);
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack tsheet" data-form="torder"><h2 class="h2">' + t("tb.sheetT", { n: esc(M.table.name) }) + "</h2>" +
      '<div class="tlines">' + ids.map(function (k) { var p = prod(k); if (!p) return ""; return '<div class="tline"><span class="grow">' + esc(tx(p.name)) + '</span><span class="tstep"><button type="button" data-act="tq" data-id="' + k + '" data-d="-1" aria-label="−">' + I("minus", 14) + '</button><b class="num">' + s.cart[k] + '</b><button type="button" data-act="tq" data-id="' + k + '" data-d="1" aria-label="+">' + I("plus", 14) + '</button></span><b class="num">' + money(p.price * s.cart[k]) + "</b></div>"; }).join("") + "</div>" +
      '<div class="line tot"><span>' + t("cart.total") + '</span><b class="num">' + money(sum(s)) + "</b></div>" +
      '<label class="f">' + t("tb.comment") + '<input name="comment" maxlength="200" placeholder="' + t("tb.commentPh") + '"></label>' +
      '<label class="f">' + t("tb.name") + '<input name="name" maxlength="40" autocomplete="given-name" value="' + esc(s.name || "") + '" placeholder="' + t("tb.namePh") + '"></label>' +
      '<p class="fine">' + I("cash", 14) + " " + t("tb.payNote") + "</p>" +
      '<button class="btn primary block lg">' + I("check", 18) + t("tb.send") + "</button></form>"); }
  SF.actions.tcart = function () { if (M) sheet(); };

  SF.forms.torder = function (fd) { if (!M) return; var s = store(M.code), code = M.code;
    if (SF.state.tSending) return; SF.state.tSending = true;
    var items = Object.keys(s.cart).map(function (k) { return { productId: k, qty: s.cart[k] }; });
    s.guest = s.guest || Math.random().toString(36).slice(2, 12);
    return SF.api.post("/table/" + code + "/orders", { items: items, comment: fd.comment, name: fd.name, guest: s.guest }).then(function (o) {
      s = store(code); s.cart = {}; s.name = fd.name || ""; if (s.orders.indexOf(o.guestKey) < 0) s.orders.unshift(o.guestKey); keep(code, s);
      SF.modal('<div class="confirm"><span class="cic ok">' + I("check", 28) + '</span><h2 class="h2">' + t("tb.sentT") + '</h2><p class="muted">' + t("tb.sentS", { n: o.number }) + '</p><button class="btn primary block" data-act="closemodal">' + t("btn.close") + "</button></div>");
      SF.render({ quiet: true });
    }).then(function () { SF.state.tSending = false; }, function (e) { SF.state.tSending = false; throw e; }); };

  SF.actions.trev = function () { var body; try { body = SF.rvBody(); } catch (e) { SF.toast(SF.err(e), "err"); return; }
    return SF.api.post("/dine/" + SF.state.tRev + "/review", body).then(function () { SF.state.rv = null; SF.toast(t("rv.thanks")); SF.render({ quiet: true }); }); };
  /* tip: show the waiter's card number big, with copy */
  SF.actions.ttip = function (el) { var v = el.dataset.v, nice = v.replace(/(\d{4})(?=\d)/g, "$1 ");
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="callsheet"><span class="avatar xl">' + esc(el.dataset.name.charAt(0)) + "</span><b>" + t("tb.tipT", { name: esc(el.dataset.name) }) + '</b><span class="muted">' + t("tb.tipS") + '</span><code class="callnum num" id="callnum">' + esc(nice) + "</code>" +
      '<button type="button" class="btn primary block" data-act="copynum" data-v="' + esc(v) + '">' + I("copy", 16) + t("tb.tipCopy") + "</button></div>"); };
  SF.actions.tcancel = function (el) { return SF.api.post("/dine/" + el.dataset.k + "/cancel").then(function () { SF.toast(t("tb.cancelled")); SF.render({ quiet: true }); }); };
  SF.actions.tcall = function (el) { if (!M) return; return SF.api.post("/table/" + M.code + "/call", { why: el.dataset.why }).then(function (r) {
    SF.toast(r.again ? t("tb.calledAgain", { s: r.again }) : t(el.dataset.why === "bill" ? "tb.billSent" : "tb.called")); }); };

  /* while the page is open: refresh the status of the guest's orders */
  setInterval(function () { if (!M || document.hidden || !/^#\/t\//.test(location.hash) || document.querySelector("#modal:not([hidden])")) return;
    var os = SF.state.dineOrders || []; if (!os.some(function (o) { return ["pending", "cooking", "ready", "picked_up"].indexOf(o.status) >= 0; })) return;
    Promise.all(os.map(function (o) { return SF.api.get("/dine/" + o._key).catch(function () { return o; }); })).then(function (fresh) {
      if (fresh.some(function (f, i) { return f.status !== os[i].status; })) { if (navigator.vibrate) try { navigator.vibrate(150); } catch (e) {} SF.render({ quiet: true }); } }); }, 6000);
})();
