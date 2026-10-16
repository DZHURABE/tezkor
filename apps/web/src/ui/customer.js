/* SOMON FOOD — customer app: Home → Restaurant → Food → Cart → Checkout → Payment → Tracking */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, tx = SF.tx, money = SF.money, api = function () { return SF.api; };
  var cache = SF.state.prod = SF.state.prod || {};
  function remember(list) { (list || []).forEach(function (p) { cache[p.id] = p; }); }
  function cartSum() { var c = SF.cart.get(); return Object.keys(c.items).reduce(function (s, k) { return s + (cache[k] ? cache[k].price * c.items[k] : 0); }, 0); }
  SF.cartSum = cartSum;
  function cityQ() { return "cityId=" + encodeURIComponent(SF.state.cityId); }

  /* ---------- cards ---------- */
  function restCard(r) {
    var k = (r.cuisineArt || []).length ? r.cuisineArt : null;
    return '<a class="rcard' + (r.isOpenNow ? "" : " closed") + '" href="#/r/' + r.id + '">' +
      '<div class="rcover' + (r.cover ? " hasph" : "") + '" style="--tone:' + esc(r.tone) + '">' + (r.cover ? '<img class="cover" src="' + esc(r.cover) + '" alt="" loading="lazy">' : '<span class="a2">' + SF.art(r.art2 || "plate", 74) + '</span><span class="a1">' + SF.art(r.art1 || "plate", 128) + "</span>") +
      '<span class="chip glass eta">' + I("clock", 14) + esc(r.eta) + " " + t("u.min") + "</span>" + (r.isOpenNow ? "" : '<span class="closedlbl">' + t("rest.closedUntil", { from: r.hours.from }) + "</span>") + "</div>" +
      '<div class="rbody"><div class="rrow"><b class="rname">' + esc(tx(r.name)) + "</b>" + SF.stars(r.rating) + '</div><span class="rmeta">' + esc(tx(r.cuisine)) + '</span><span class="rmeta">' + I("scooter", 14) + t("rest.deliveryFrom", { sum: money(r.deliveryFrom) }) + "</span></div></a>";
  }
  function withArt(list, prods) { return list.map(function (r) { var ps = (prods || r.products || []).filter(function (p) { return p.restaurantId === r.id; });
    var ks = ps.filter(function (p) { return p.popular; }).concat(ps).map(function (p) { return p.kind; }); r.art1 = ks[0]; r.art2 = ks.filter(function (k) { return k !== ks[0]; })[0] || ks[1]; return r; }); }
  function prodCard(p, compact) {
    var q = SF.cart.qty(p.id), off = SF.sale(p);
    return '<div class="pcard' + (p.available ? "" : " off") + (compact ? " mini" : "") + '"><button class="pimg' + (p.photo ? " hasph" : "") + '" style="--tone:' + esc(p.restaurant ? p.restaurant.tone : SF.state.tone || "#F2EFEA") + '" data-act="prod" data-id="' + p.id + '" aria-label="' + esc(tx(p.name)) + '">' + SF.pic(p, compact ? 92 : 118) +
      (off ? '<span class="chip sale">−' + off + "%</span>" : p.popular ? '<span class="chip hot">' + I("fire", 12) + t("prod.hit") + "</span>" : "") + "</button>" +
      '<div class="pbody"><b class="pname">' + esc(tx(p.name)) + "</b>" + (compact && p.restaurant ? '<span class="pdesc">' + esc(tx(p.restaurant.name)) + "</span>" : '<span class="pdesc">' + esc(tx(p.desc)) + "</span>") +
      '<div class="prow"><span class="price num">' + money(p.price) + (off ? "<s>" + money(p.oldPrice) + "</s>" : "") + (p.weight ? '<small>' + esc(p.weight) + "</small>" : "") + "</span>" + (p.available ? stepper(p, q) : '<span class="pill p-mut">' + t("prod.soldout") + "</span>") + "</div></div></div>";
  }
  function stepper(p, q, big) {
    return q ? '<div class="stepper' + (big ? " big" : "") + '"><button data-act="dec" data-id="' + p.id + '" aria-label="' + t("a.less") + '">' + I("minus", 16) + '</button><b class="num">' + q + '</b><button data-act="add" data-id="' + p.id + '" aria-label="' + t("a.more") + '">' + I("plus", 16) + "</button></div>"
      : '<button class="addbtn" data-act="add" data-id="' + p.id + '" aria-label="' + t("a.add") + " " + esc(tx(p.name)) + '">' + I("plus", 18) + "</button>";
  }
  SF.prodCard = prodCard; SF.restCard = restCard;
  /* one banner, the same on the home page, in the restaurant's ad editor (preview) and in admin */
  SF.bannerHtml = function (b, tag, cls) { tag = tag || "div";
    return "<" + tag + ' class="banner' + (b.photo ? " hasph" : "") + (cls ? " " + cls : "") + '" style="--b:' + esc(b.tone) + '"' + (tag === "a" ? ' href="#' + (b.restaurantId ? "/r/" + b.restaurantId : "/") + '"' : "") + ">" +
      (b.photo ? '<img class="bph" src="' + esc(b.photo) + '" alt="">' : "") + "<div><b>" + esc(tx(b.title)) + "</b><span>" + esc(tx(b.sub)) + "</span>" + (b.own ? '<em class="bgo">' + t("ad.go") + I("chevR", 14) + "</em>" : "") + "</div>" +
      (b.photo ? "" : '<span class="bart">' + SF.art(b.art, cls === "small" ? 70 : 110) + "</span>") + '<i class="ornament" aria-hidden="true"></i></' + tag + ">"; };

  /* ---------- Home ---------- */
  SF.route("/", { title: "nav.home", render: function (p, q) {
    var cat = q.cat || "";
    return Promise.all([api().get("/banners"), api().get("/products/popular?" + cityQ()), api().get("/restaurants?" + cityQ() + (cat ? "&categoryId=" + cat : ""))]).then(function (res) {
      var banners = res[0], pop = res[1], rests = res[2]; remember(pop);
      return Promise.all(rests.map(function (r) { return api().get("/restaurants/" + r.id).then(function (full) { remember(full.products); return full; }); })).then(function (full) {
        withArt(full);
        var u = SF.state.user, hour = new Date().getHours(), greet = hour < 12 ? "home.morning" : hour < 18 ? "home.day" : "home.evening";
        return '<section class="hero"><div><p class="eyebrow">' + t(greet) + (u ? ", " + esc(u.name.split(" ")[0]) : "") + '</p><h1 class="h1">' + t("home.title") + '</h1><form class="bigsearch" data-form="search" role="search">' + I("search", 20) +
          '<input name="q" placeholder="' + t("home.search") + '" aria-label="' + t("home.search") + '"><button class="btn primary">' + t("btn.find") + "</button></form></div></section>" +
          SF.installCard() + '<section class="banners" aria-label="' + t("home.offers") + '">' + banners.map(function (b) { return SF.bannerHtml(b, "a"); }).join("") + "</section>" +
          '<section class="cats" aria-label="' + t("home.cats") + '"><a class="cat' + (!cat ? " on" : "") + '" href="#/">' + '<span class="ci">' + I("grid", 22) + "</span>" + t("home.all") + "</a>" +
          (SF.state.categories || []).map(function (c) { return '<a class="cat' + (cat === c.id ? " on" : "") + '" href="#/?cat=' + c.id + '"><span class="ci">' + SF.art(c.icon, 40) + "</span>" + esc(tx(c.name)) + "</a>"; }).join("") + "</section>" +
          (pop.length && !cat ? '<div class="sect"><h2>' + t("home.popular") + '</h2></div><div class="hscroll">' + pop.map(function (p) { return prodCard(p, true); }).join("") + "</div>" : "") +
          '<div class="sect"><h2>' + (cat ? esc(tx((SF.state.categories.filter(function (c) { return c.id === cat; })[0] || {}).name)) : t("home.restaurants")) + '</h2><span class="muted num">' + full.length + "</span></div>" +
          (full.length ? '<div class="rgrid">' + full.map(restCard).join("") + "</div>" : SF.empty("store", t("home.noRest"), t("home.noRestSub"), '<a class="btn" href="#/">' + t("home.all") + "</a>"));
      });
    });
  } });

  /* ---------- Search ---------- */
  SF.route("/search", { title: "nav.search", render: function (p, q) {
    var s = q.q || ""; SF.state.q = s;
    var head = '<h1 class="h2 pt">' + t("nav.search") + '</h1><form class="bigsearch" data-form="search" role="search">' + I("search", 20) + '<input name="q" placeholder="' + t("home.search") + '" aria-label="' + t("home.search") + '" value="' + esc(s) + '" autofocus><button class="btn primary">' + t("btn.find") + "</button></form>";
    if (s.length < 2) return head + '<div class="tags">' + ["плов", "бургер", "шашлык", "самбӯса", "pizza"].map(function (w) { return '<a class="chip" href="#/search?q=' + encodeURIComponent(w) + '">' + esc(w) + "</a>"; }).join("") + "</div>";
    return api().get("/search?q=" + encodeURIComponent(s) + "&" + cityQ()).then(function (r) { remember(r.products);
      return head + (r.restaurants.length ? '<div class="sect"><h2>' + t("home.restaurants") + '</h2></div><div class="rgrid">' + withArt(r.restaurants, r.products).map(restCard).join("") + "</div>" : "") +
        (r.products.length ? '<div class="sect"><h2>' + t("search.dishes") + '</h2></div><div class="pgrid">' + r.products.map(function (p) { return prodCard(p, true); }).join("") + "</div>" : "") +
        (!r.restaurants.length && !r.products.length ? SF.empty("search", t("search.none"), t("search.noneSub")) : ""); });
  } });

  /* ---------- Restaurant ---------- */
  SF.route("/r/:id", { title: "home.restaurants", render: function (p) {
    return api().get("/restaurants/" + p.id).then(function (r) {
      remember(r.products); SF.state.rest = r; SF.state.tone = r.tone; withArt([r]);
      var cats = (SF.state.categories || []).filter(function (c) { return r.products.some(function (x) { return x.categoryId === c.id; }); });
      var c = SF.cart.get(), mine = c.restaurantId === r.id && SF.cart.count();
      return '<a class="backlink" href="#/">' + I("chevL", 18) + t("btn.back") + "</a>" +
        '<section class="rhero' + (r.cover ? " hasph" : "") + '" style="--tone:' + esc(r.tone) + '">' + (r.cover ? '<img class="cover" src="' + esc(r.cover) + '" alt="">' : '<span class="a2">' + SF.art(r.art2, 130) + '</span><span class="a1">' + SF.art(r.art1, 210) + '</span><i class="ornament" aria-hidden="true"></i>') + "</section>" +
        '<section class="rinfo"><div class="rtitle"><h1 class="h1">' + esc(tx(r.name)) + '</h1><span class="muted">' + esc(tx(r.cuisine)) + "</span>" + (r.about && tx(r.about) ? '<p class="about">' + esc(tx(r.about)) + "</p>" : "") + "</div>" +
        '<div class="facts"><span>' + SF.stars(r.rating) + '<small class="num">' + r.ratingCount + "</small></span><span>" + I("clock", 16) + esc(r.eta) + " " + t("u.min") + "</span><span>" + I("scooter", 16) + t("rest.deliveryFrom", { sum: money(r.deliveryFrom) }) + '</span></div><p class="factsub num">' + t("rest.minOrder", { sum: money(r.minOrder) }) + " · " + esc(r.hours.from) + "–" + esc(r.hours.to) + "</p>" +
        (r.isOpenNow ? "" : '<div class="msg warn">' + I("clock", 16) + t("rest.closedNow", { from: r.hours.from }) + "</div>") + "</section>" +
        '<div class="rlayout"><div><nav class="ctabs" id="ctabs" aria-label="' + t("rest.menu") + '">' + cats.map(function (k, i) { return '<button class="' + (i ? "" : "on") + '" data-act="jump" data-v="' + k.id + '">' + esc(tx(k.name)) + "</button>"; }).join("") + "</nav>" +
        cats.map(function (k) { return '<section class="msec" id="sec-' + k.id + '" data-sec="' + k.id + '"><h2>' + esc(tx(k.name)) + '</h2><div class="pgrid">' + r.products.filter(function (x) { return x.categoryId === k.id; }).map(function (x) { return prodCard(x); }).join("") + "</div></section>"; }).join("") + "</div>" +
        '<aside class="sidecart">' + miniCart(r) + "</aside></div>" +
        (mine ? '<a class="floatcart" href="#/cart"><span>' + I("cart", 18) + '<i class="num">' + SF.cart.count() + "</i></span><b>" + t("cart.go") + '</b><span class="num">' + money(cartSum()) + "</span></a>" : "");
    });
  } });
  function miniCart(r) {
    var c = SF.cart.get(), ids = Object.keys(c.items);
    if (!ids.length || c.restaurantId !== r.id) return '<div class="mc"><h3>' + t("nav.cart") + "</h3>" + SF.empty(SF.art("plate", 70), t("cart.empty"), t("cart.emptySub")) + "</div>";
    var sum = cartSum();
    return '<div class="mc"><h3>' + t("nav.cart") + "</h3>" + ids.map(function (k) { var p = cache[k]; return '<div class="mcl"><span>' + esc(tx(p.name)) + '</span><div class="mcr">' + stepper(p, c.items[k]) + '<b class="num">' + money(p.price * c.items[k]) + "</b></div></div>"; }).join("") +
      (sum < r.minOrder ? '<div class="msg info">' + t("cart.addMore", { sum: money(r.minOrder - sum) }) + "</div>" : "") +
      '<div class="line tot"><span>' + t("cart.subtotal") + '</span><b class="num">' + money(sum) + '</b></div><a class="btn primary block' + (sum < r.minOrder ? " disabled" : "") + '" href="#/cart">' + t("cart.go") + "</a></div>";
  }

  /* product sheet */
  SF.actions.prod = function (el) {
    var p = cache[el.dataset.id]; if (!p) return; SF.state.mq = 1; openProd(p);
  };
  function openProd(p) {
    var tone = p.restaurant ? p.restaurant.tone : SF.state.tone || "#F2EFEA";
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="phero' + (p.photo ? " hasph" : "") + '" style="--tone:' + esc(tone) + '">' + SF.pic(p, 220) + "</div>" +
      '<div class="pinfo"><h2 class="h2">' + esc(tx(p.name)) + '</h2><p class="muted">' + esc(tx(p.desc)) + "</p>" + (p.weight ? '<span class="chip">' + esc(p.weight) + "</span>" : "") +
      (p.available ? '<div class="pbuy"><div class="stepper big"><button data-act="mq" data-v="-1" aria-label="' + t("a.less") + '">' + I("minus", 18) + '</button><b class="num" id="mqv">' + SF.state.mq + '</b><button data-act="mq" data-v="1" aria-label="' + t("a.more") + '">' + I("plus", 18) + "</button></div>" +
        '<button class="btn primary grow" data-act="addmq" data-id="' + p.id + '">' + t("prod.add") + ' · <span class="num" id="mqs">' + money(p.price * SF.state.mq) + "</span></button></div>" : '<div class="msg err">' + t("prod.soldout") + "</div>") + "</div>", "prod");
  }
  SF.actions.mq = function (el) { var p = cache[(document.querySelector("[data-act=addmq]") || {}).dataset.id]; SF.state.mq = Math.max(1, Math.min(50, SF.state.mq + (+el.dataset.v)));
    document.getElementById("mqv").textContent = SF.state.mq; if (p) document.getElementById("mqs").textContent = money(p.price * SF.state.mq); };
  SF.actions.addmq = function (el) { var p = cache[el.dataset.id]; if (tryAdd(p, SF.state.mq)) { SF.closeModal(); SF.toast(t("cart.added", { name: tx(p.name) })); SF.render({ quiet: true }); } };
  function tryAdd(p, n) {
    if (SF.cart.add(p, n)) { SF.state.cartSum = cartSum(); return true; }
    SF.modal('<div class="confirm"><span class="cic">' + I("cart", 28) + "</span><h2 class=\"h2\">" + t("cart.otherTitle") + "</h2><p class=\"muted\">" + t("cart.otherText") + '</p><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn primary" data-act="replacecart" data-id="' + p.id + '" data-n="' + (n || 1) + '">' + t("cart.replace") + "</button></div></div>");
    return false;
  }
  SF.actions.replacecart = function (el) { SF.cart.clear(); SF.state.promo = null; var p = cache[el.dataset.id]; SF.cart.add(p, +el.dataset.n); SF.state.cartSum = cartSum(); SF.closeModal(); SF.toast(t("cart.added", { name: tx(p.name) })); SF.render({ quiet: true }); };
  SF.actions.add = function (el) { var p = cache[el.dataset.id]; if (!p) return; if (tryAdd(p, 1)) { SF.render({ quiet: true }); } };
  SF.actions.dec = function (el) { SF.cart.dec(el.dataset.id); SF.state.cartSum = cartSum(); SF.render({ quiet: true }); };
  SF.actions.jump = function (el) { var s = document.getElementById("sec-" + el.dataset.v); if (s) { var y = s.getBoundingClientRect().top + window.scrollY - 130; window.scrollTo({ top: y, behavior: SF.reduced ? "auto" : "smooth" }); } };
  SF.after.push(function () { var tabs = document.getElementById("ctabs"); if (!tabs) { window.onscroll = null; return; }
    window.onscroll = function () { var cur = null; document.querySelectorAll("[data-sec]").forEach(function (s) { if (s.getBoundingClientRect().top < 150) cur = s.dataset.sec; });
      Array.prototype.forEach.call(tabs.children, function (b) { var on = b.dataset.v === cur || (!cur && b === tabs.firstChild); b.classList.toggle("on", on); if (on && tabs.scrollTo) tabs.scrollTo({ left: b.offsetLeft - 16, behavior: "auto" }); }); }; });

  /* ---------- Cart ---------- */
  SF.route("/cart", { title: "nav.cart", render: function () {
    var c = SF.cart.get(), ids = Object.keys(c.items);
    if (!ids.length) return '<h1 class="h2 pt">' + t("nav.cart") + "</h1>" + SF.empty(SF.art("plate", 110), t("cart.empty"), t("cart.emptySub"), '<a class="btn primary" href="#/">' + t("cart.browse") + "</a>");
    return api().get("/restaurants/" + c.restaurantId).then(function (r) {
      remember(r.products); var sum = cartSum(), promo = SF.state.promo, disc = promo ? promo.discount : 0;
      ids.forEach(function (k) { if (!cache[k] || !cache[k].available) { SF.cart.dec(k); } });
      return '<h1 class="h2 pt">' + t("nav.cart") + '</h1><div class="two"><div class="card"><div class="rowhead"><a href="#/r/' + r.id + '" class="rlink"><span class="rav" style="--tone:' + esc(r.tone) + '">' + SF.art(r.products[0] ? r.products[0].kind : "plate", 36) + "</span><b>" + esc(tx(r.name)) + "</b></a>" +
        '<button class="link" data-act="clearcart">' + t("cart.clear") + "</button></div>" +
        ids.filter(function (k) { return cache[k]; }).map(function (k) { var p = cache[k]; return '<div class="cline"><span class="cim" style="--tone:' + esc(r.tone) + '">' + SF.pic(p, 52) + '</span><div class="cinfo"><b>' + esc(tx(p.name)) + '</b><span class="muted num">' + money(p.price) + "</span></div>" + stepper(p, c.items[k]) + '<b class="num csum">' + money(p.price * c.items[k]) + "</b></div>"; }).join("") +
        '<a class="addmore" href="#/r/' + r.id + '">' + I("plus", 16) + t("cart.addMoreItems") + "</a>" +
        (r.isOpenNow ? "" : '<div class="msg warn">' + t("rest.closedNow", { from: r.hours.from }) + "</div>") + "</div>" +
        '<div class="card sum"><h3>' + t("cart.summary") + '</h3><form class="promo" data-form="promo"><input name="code" placeholder="' + t("cart.promo") + '" aria-label="' + t("cart.promo") + '" value="' + esc(promo ? promo.code : "") + '"><button class="btn ghost sm">' + t("btn.apply") + "</button></form>" +
        (promo ? '<div class="msg ok">' + I("percent", 14) + t("cart.promoOk", { code: promo.code, sum: money(disc) }) + ' <button class="link" data-act="unpromo">' + t("btn.remove") + "</button></div>" : "") +
        '<div class="line"><span>' + t("cart.subtotal") + '</span><span class="num">' + money(sum) + "</span></div>" + (disc ? '<div class="line ok"><span>' + t("cart.discount") + '</span><span class="num">−' + money(disc) + "</span></div>" : "") +
        '<div class="line muted"><span>' + t("cart.delivery") + '</span><span class="num">' + t("cart.deliveryFrom", { sum: money(r.deliveryFrom) }) + "</span></div>" +
        '<div class="line tot"><span>' + t("cart.total") + '</span><b class="num">' + money(sum - disc) + '</b></div><p class="fine">' + t("cart.deliveryLater") + "</p>" +
        (sum < r.minOrder ? '<div class="msg info">' + t("cart.addMore", { sum: money(r.minOrder - sum) }) + "</div>" : "") +
        '<button class="btn primary block lg" data-act="tocheckout"' + (sum < r.minOrder || !r.isOpenNow ? " disabled" : "") + ">" + t("cart.checkout") + "</button></div></div>";
    });
  } });
  SF.actions.clearcart = function () { SF.cart.clear(); SF.state.promo = null; SF.render(); };
  SF.actions.unpromo = function () { SF.state.promo = null; SF.render({ quiet: true }); };
  SF.forms.promo = function (fd) { var code = String(fd.code || "").trim(); if (!code) return;
    return api().post("/promos/validate", { code: code, subtotal: cartSum() }).then(function (r) { SF.state.promo = r; SF.toast(t("cart.promoOk", { code: r.code, sum: money(r.discount) })); SF.render({ quiet: true }); }); };
  SF.actions.tocheckout = function () { if (!SF.state.user) { SF.state.after = "/checkout"; SF.toast(t("auth.needLogin"), "info"); SF.go("/login"); return; }
    if (SF.state.user.role !== "customer") { SF.toast(t("auth.customerOnly"), "err"); return; } SF.go("/checkout"); };

  /* ---------- Checkout ---------- */
  function co() { var u = SF.state.user || {}; SF.state.co = SF.state.co || { text: "", landmark: "", lat: null, lng: null, phone: u.phone ? u.phone.slice(4) : "", comment: "", pay: "cash", quote: null }; return SF.state.co; }
  function fixPay(r) { var x = co(), pub = SF.state.pub, ok = { transfer: pub.transferEnabled && r.payCard, cash: pub.cashEnabled, card: pub.cardEnabled };
    if (!ok[x.pay]) x.pay = ok.transfer ? "transfer" : ok.cash ? "cash" : ok.card ? "card" : null; }
  /* transfer to the restaurant's card: number to copy, exact amount, receipt photo (required) */
  function transferBox(r, qt) {
    var x = co(), pc = r.payCard, num = pc.number.replace(/(\d{4})(?=\d)/g, "$1 ");
    return '<div class="transfer"><ol class="tsteps"><li>' + t("tr.s1") + "</li><li>" + t("tr.s2") + "</li><li>" + t("tr.s3") + "</li></ol>" +
      '<div class="tcard"><small>' + t("tr.card") + (pc.bank ? " · " + esc(pc.bank) : "") + '</small><code class="num" id="callnum">' + esc(num) + "</code>" + (pc.holder ? "<span>" + esc(pc.holder) + "</span>" : "") +
      '<button type="button" class="btn sm ghost" data-act="copynum" data-v="' + esc(pc.number) + '">' + I("copy", 14) + t("cour.copy") + "</button></div>" +
      '<div class="tsum"><span>' + t("tr.amount") + '</span><b class="num">' + (qt.deliveryFee != null ? money(qt.total) : t("co.pinFirst")) + "</b></div>" +
      '<label class="upload' + (x.receipt ? " done" : "") + '">' + (x.receipt ? '<img src="' + x.receipt + '" alt="' + t("tr.receipt") + '"><span>' + I("check", 16) + t("tr.uploaded") + "</span><small>" + t("tr.change") + "</small>" : I("receipt", 22) + "<b>" + t("tr.upload") + "</b><small>" + t("tr.uploadSub") + "</small>") +
      '<input type="file" accept="image/*" data-input="receipt" id="receipt-file"></label></div>';
  }
  /* shrink the photo before upload: long side 1200 px, JPEG */
  SF.inputs.receipt = function (v, el) {
    var f = el.files && el.files[0]; if (!f) return; if (!/^image\//.test(f.type)) { SF.toast(t("tr.notImage"), "err"); return; }
    var rd = new FileReader(); rd.onload = function () { var img = new Image(); img.onload = function () {
      var k = Math.min(1, 1200 / Math.max(img.width, img.height)), cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      co().receipt = cv.toDataURL("image/jpeg", 0.75); SF.render({ quiet: true }); };
      img.onerror = function () { SF.toast(t("tr.notImage"), "err"); }; img.src = rd.result; }; rd.readAsDataURL(f);
  };
  SF.route("/checkout", { roles: ["customer"], title: "co.title", render: function () {
    var c = SF.cart.get(), x = co(); if (!SF.cart.count()) { SF.go("/cart"); return ""; }
    return api().get("/restaurants/" + c.restaurantId).then(function (r) {
      remember(r.products); var city = (SF.state.cities || []).filter(function (z) { return z.id === r.cityId; })[0] || { lat: r.lat, lng: r.lng };
      var body = { restaurantId: r.id, items: Object.keys(c.items).map(function (k) { return { productId: k, qty: c.items[k] }; }), promoCode: SF.state.promo ? SF.state.promo.code : null, address: x.lat != null && inZone(x, r.cityId) ? { lat: x.lat, lng: x.lng } : {} };
      return api().post("/orders/quote", body).then(function (qt) { x.quote = qt; return [r, city, qt]; });
    }).then(function (a) {
      var r = a[0], city = a[1], qt = a[2], u = SF.state.user, addrs = u.addresses || [], zone = SF.zone(r.cityId), x = co(); fixPay(r);
      return '<a class="backlink" href="#/cart">' + I("chevL", 18) + t("nav.cart") + '</a><h1 class="h2">' + t("co.title") + '</h1><div class="two"><div class="stack">' +
        '<section class="card"><h3><span class="num stepn">1</span>' + t("co.address") + "</h3>" +
        (addrs.length ? '<div class="tags">' + addrs.map(function (ad, i) { return '<button class="chip" data-act="useaddr" data-i="' + i + '">' + I("pin", 14) + esc(ad.text) + "</button>"; }).join("") + "</div>" : "") +
        '<div class="mapbox">' + SF.tmap({ key: "co", picker: true, center: x.lat != null ? x : zone, zoom: x.lat != null ? 17 : 14, zone: zone, markers: [{ lat: r.lat, lng: r.lng, type: "rest", label: "R" }], label: t("co.pinTitle"), onMove: pinMoved }) + "</div>" +
        '<div class="pinread' + (x.lat == null ? " hint" : !inZone(x, r.cityId) ? " bad" : "") + '" id="pinread">' + (x.lat != null ? pinText(x, r.cityId) : I("pin", 16) + "<span>" + t("co.pinHelp") + "</span>") + "</div>" +
        '<div class="geotools"><button type="button" class="btn ghost sm" data-act="geoloc">' + I("locate", 16) + t("co.myLoc") + '</button><form class="llform" data-form="coords"><label class="f grow">' + t("co.pasteLL") + '<span class="llrow"><input name="ll" id="co-ll" placeholder="' + t("co.pastePh") + '" autocomplete="off"><button class="btn sm">' + I("link", 16) + t("co.show") + "</button></span></label></form></div>" +
        '<div class="grid2"><label class="f">' + t("co.street") + '<input data-input="co" data-k="text" value="' + esc(x.text) + '" placeholder="' + t("co.streetPh") + '" autocomplete="street-address"></label><label class="f">' + t("co.landmark") + '<input data-input="co" data-k="landmark" value="' + esc(x.landmark) + '" placeholder="' + t("co.landmarkPh") + '"></label></div></section>' +
        '<section class="card"><h3><span class="num stepn">2</span>' + t("co.contact") + '</h3><div class="grid2"><label class="f">' + t("auth.phone") + '<span class="phonein"><i>+992</i><input data-input="co" data-k="phone" value="' + esc(x.phone) + '" inputmode="tel" placeholder="90 123 45 67" autocomplete="tel-national"></span></label><label class="f">' + t("co.comment") + '<input data-input="co" data-k="comment" value="' + esc(x.comment) + '" placeholder="' + t("co.commentPh") + '"></label></div></section>' +
        '<section class="card"><h3><span class="num stepn">3</span>' + t("co.payment") + '</h3><div class="payopts">' + (SF.state.pub.transferEnabled && r.payCard ? payOpt("transfer", "card", t("pay.transfer"), t("pay.transferSub")) : "") + (SF.state.pub.cashEnabled ? payOpt("cash", "cash", t("pay.cash"), t("pay.cashSub")) : "") + (SF.state.pub.cardEnabled ? payOpt("card", "card", t("pay.card"), t("pay.cardSub")) : "") + "</div>" +
          (!(SF.state.pub.transferEnabled && r.payCard) && !SF.state.pub.cashEnabled && !SF.state.pub.cardEnabled ? '<div class="msg err">' + I("info", 16) + t("co.noPay") + "</div>" : "") + (x.pay === "transfer" ? transferBox(r, qt) : "") + "</section></div>" +
        '<aside class="card sum sticky"><h3>' + esc(tx(r.name)) + "</h3>" + Object.keys(SF.cart.get().items).map(function (k) { var p = cache[k]; return '<div class="line"><span>' + esc(tx(p.name)) + " × " + SF.cart.get().items[k] + '</span><span class="num">' + money(p.price * SF.cart.get().items[k]) + "</span></div>"; }).join("") +
        '<div class="line muted"><span>' + t("cart.delivery") + (qt.km != null ? " · " + qt.km + " " + t("u.km") : "") + '</span><span class="num">' + (qt.deliveryFee != null ? money(qt.deliveryFee) : t("co.pinFirst")) + "</span></div>" +
        (qt.discount ? '<div class="line ok"><span>' + t("cart.discount") + '</span><span class="num">−' + money(qt.discount) + "</span></div>" : "") +
        '<div class="line tot"><span>' + t("cart.total") + '</span><b class="num">' + money(qt.total) + "</b></div>" +
        '<button class="btn primary block lg" data-act="placeorder">' + (x.pay === "card" ? t("co.payOrder") : t("co.placeOrder")) + "</button><p class=\"fine\">" + t("co.fine") + "</p></aside></div>" +
        '<div class="cobar"><span><small>' + t("cart.total") + '</small><b class="num">' + money(qt.total) + '</b></span><button class="btn primary lg" data-act="placeorder">' + (x.pay === "card" ? t("co.payOrder") : t("co.placeOrder")) + "</button></div>";
    });
    function payOpt(v, icon, title, sub) { var on = co().pay === v; return '<button class="payopt' + (on ? " on" : "") + '" data-act="paym" data-v="' + v + '" aria-pressed="' + on + '"><span class="pic">' + I(icon, 22) + "</span><span><b>" + title + "</b><small>" + sub + "</small></span><i></i></button>"; }
  } });
  SF.inputs.co = function (v, el) { co()[el.dataset.k] = v; };
  SF.actions.paym = function (el) { co().pay = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.useaddr = function (el) { var a = (SF.state.user.addresses || [])[+el.dataset.i]; if (!a) return; Object.assign(co(), { text: a.text, landmark: a.landmark || "", lat: a.lat, lng: a.lng }); delete SF.state.tmv.co; SF.render({ quiet: true }); };
  function inZone(p, cityId) { var z = SF.zone(cityId); return !z || SF.geo.km(z, p) <= z.km + 1e-9; }
  function pinText(p, cityId) { var z = SF.zone(cityId), km = Math.round(SF.geo.km(z, p) * 10) / 10;
    return km <= z.km ? I("check", 16) + "<span>" + t("co.inZone", { km: km, city: z.name }) + "</span>" : I("info", 16) + "<span>" + t("co.outZone", { km: km, max: z.km }) + "</span>"; }
  function pinMoved(p, final) {
    var cid = (SF.state.co && SF.state.co.cityId) || null, el = document.getElementById("pinread");
    if (el && (final || SF.state.co && (SF.state.co.lat != null || el._touched))) { el._touched = 1; el.innerHTML = pinText(p, cid); el.classList.remove("hint"); el.classList.toggle("bad", !inZone(p, cid)); }
    if (!final) return; var x = co(); if (x.lat != null && Math.abs(x.lat - p.lat) < 1e-7 && Math.abs(x.lng - p.lng) < 1e-7) return;
    x.lat = p.lat; x.lng = p.lng; SF.render({ quiet: true });
  }
  SF.actions.geoloc = function () {
    if (!navigator.geolocation) { SF.toast(t("geo.denied"), "err"); return; }
    SF.toast(t("geo.wait"), "info");
    return new Promise(function (done) { navigator.geolocation.getCurrentPosition(function (pos) { SF.tmapCenter("co", { lat: pos.coords.latitude, lng: pos.coords.longitude }, 17); SF.toast(t("geo.found")); done(); },
      function () { SF.toast(t("geo.denied"), "err"); done(); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }); });
  };
  SF.forms.coords = function (fd) { var p = SF.geo.parse(fd.ll); if (!p) { SF.toast(t("geo.bad"), "err"); return; } SF.tmapCenter("co", p, 17); SF.toast(t("geo.found")); };
  SF.actions.placeorder = function () {
    var x = co(), c = SF.cart.get();
    if (x.lat == null) { SF.toast(t("e.ADDRESS_PIN_REQUIRED"), "err"); return; }
    if (!inZone(x, x.cityId)) { var z = SF.zone(x.cityId); SF.toast(t("e.OUT_OF_ZONE", { km: Math.round(SF.geo.km(z, x) * 10) / 10, max: z.km }), "err"); return; }
    if (!x.pay) { SF.toast(t("e.PAY_METHOD_OFF"), "err"); return; }
    if (x.pay === "transfer" && !x.receipt) { SF.toast(t("e.RECEIPT_REQUIRED"), "err"); var up = document.querySelector(".upload"); if (up) { up.scrollIntoView({ block: "center" }); up.classList.remove("shake"); void up.offsetWidth; up.classList.add("shake"); } return; }
    var body = { restaurantId: c.restaurantId, items: Object.keys(c.items).map(function (k) { return { productId: k, qty: c.items[k] }; }), address: { text: x.text, landmark: x.landmark, lat: x.lat, lng: x.lng },
      phone: x.phone, comment: x.comment, paymentMethod: x.pay, receipt: x.pay === "transfer" ? x.receipt : undefined, promoCode: SF.state.promo ? SF.state.promo.code : null };
    return api().post("/orders", body).then(function (o) { SF.cart.clear(); SF.state.promo = null; x.comment = ""; x.receipt = null; SF.state.cartSum = 0;
      return SF.api.get("/auth/me").then(function (u) { SF.state.user = u; SF.go(o.status === "awaiting_payment" ? "/pay/" + o.id : "/o/" + o.id); }); });
  };

  /* ---------- Payment (mock provider; see apps/api/src/payments) ---------- */
  SF.route("/pay/:id", { roles: ["customer"], title: "pay.title", render: function (p) {
    return api().get("/orders/" + p.id).then(function (o) {
      if (o.status !== "awaiting_payment") { SF.go("/o/" + o.id); return ""; }
      var cd = SF.state.card || (SF.state.card = { num: "", exp: "", cvc: "", name: "" });
      return '<div class="paywrap"><h1 class="h2">' + t("pay.title") + '</h1><p class="muted">' + t("pay.sub", { n: o.number, sum: money(o.total) }) + "</p>" +
        '<div class="ccard"><div class="ccchip"></div><span class="ccnum num" id="ccnum">' + esc(fmtCard(cd.num) || "•••• •••• •••• ••••") + '</span><div class="ccrow"><span>' + esc(cd.name || t("pay.holder")) + '</span><span class="num">' + esc(cd.exp || "MM/YY") + '</span></div><span class="ccbrand">' + SF.mark(30) + "</span></div>" +
        '<form class="card stack" data-form="pay" data-id="' + o.id + '"><div class="provs">' + [["mock", t("pay.provCard")], ["korti", t("pay.provKorti")], ["wallet", t("pay.provWallet")]].map(function (x, i) { return '<span class="chip' + (i ? " dis" : " on") + '">' + x[1] + (i ? " · " + t("pay.soon") : "") + "</span>"; }).join("") + "</div>" +
        '<label class="f">' + t("pay.number") + '<input name="cardNumber" data-input="card" data-k="num" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" value="' + esc(fmtCard(cd.num)) + '" required></label>' +
        '<div class="grid2"><label class="f">' + t("pay.exp") + '<input name="exp" data-input="card" data-k="exp" placeholder="12/28" autocomplete="cc-exp" value="' + esc(cd.exp) + '" required></label><label class="f">CVC<input name="cvc" data-input="card" data-k="cvc" inputmode="numeric" maxlength="3" placeholder="123" autocomplete="cc-csc" required></label></div>' +
        '<button class="btn primary block lg">' + I("shield", 18) + t("pay.payBtn", { sum: money(o.total) }) + '</button><p class="fine">' + t("pay.test") + '</p><button type="button" class="link" data-act="paycancel" data-id="' + o.id + '">' + t("pay.cancel") + "</button></form></div>";
    });
  } });
  function fmtCard(n) { return String(n || "").replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "); }
  SF.inputs.card = function (v, el) { var cd = SF.state.card; cd[el.dataset.k] = v; if (el.dataset.k === "num") { var f = fmtCard(v); if (f !== v) el.value = f; var n = document.getElementById("ccnum"); if (n) n.textContent = f || "•••• •••• •••• ••••"; } };
  SF.forms.pay = function (fd, form) { return api().post("/orders/" + form.dataset.id + "/pay", fd).then(function () { SF.state.card = null; SF.toast(t("pay.ok")); SF.go("/o/" + form.dataset.id); }); };
  SF.actions.paycancel = function (el) { return api().post("/orders/" + el.dataset.id + "/cancel").then(function () { SF.go("/orders"); }); };

  /* ---------- Tracking ---------- */
  var HERO = {
    awaiting_payment: '<svg class="ill" viewBox="0 0 300 150" aria-hidden="true"><rect x="96" y="40" width="108" height="70" rx="12" fill="#15171C"/><rect x="108" y="56" width="22" height="16" rx="3" fill="#F7C948"/><rect x="108" y="88" width="80" height="6" rx="3" fill="#fff" opacity=".5"/><circle class="ring" cx="150" cy="75" r="40" fill="none" stroke="#E8590C" stroke-width="3"/></svg>',
    pending: '<svg class="ill" viewBox="0 0 300 150" aria-hidden="true"><circle class="ring" cx="150" cy="78" r="34" fill="none" stroke="#E8590C" stroke-width="3"/><circle class="ring r2" cx="150" cy="78" r="34" fill="none" stroke="#E8590C" stroke-width="3"/><g transform="translate(54 34)"><rect width="50" height="70" rx="6" fill="#fff" stroke="#E9E5DF" stroke-width="2"/><rect x="9" y="12" width="32" height="5" rx="2.5" fill="#E8590C"/><rect x="9" y="25" width="24" height="4" rx="2" fill="#E9E5DF"/><rect x="9" y="35" width="28" height="4" rx="2" fill="#E9E5DF"/><rect x="9" y="57" width="32" height="5" rx="2.5" fill="#15171C"/></g><g class="swing"><rect x="146" y="40" width="8" height="8" rx="2" fill="#15171C"/><path d="M128 96q0-40 22-42q22 2 22 42l7 8h-58z" fill="#E8590C"/><circle cx="150" cy="112" r="6" fill="#15171C"/></g><g transform="translate(204 52)"><circle cx="24" cy="24" r="24" fill="#fff"/><circle class="dt" cx="12" cy="24" r="4" fill="#E8590C"/><circle class="dt d2" cx="24" cy="24" r="4" fill="#E8590C"/><circle class="dt d3" cx="36" cy="24" r="4" fill="#E8590C"/></g></svg>',
    cooking: '<svg class="ill" viewBox="0 0 300 150" aria-hidden="true"><path class="steam" d="M126 40q-7-9 0-18q7-9 0-18" stroke="#B9C3CF" stroke-width="4" fill="none" stroke-linecap="round"/><path class="steam s2" d="M150 36q-7-9 0-18q7-9 0-18" stroke="#B9C3CF" stroke-width="4" fill="none" stroke-linecap="round"/><path class="steam s3" d="M174 40q-7-9 0-18q7-9 0-18" stroke="#B9C3CF" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M92 58q4 50 58 52q54-2 58-52z" fill="#33363D"/><ellipse cx="150" cy="58" rx="58" ry="12" fill="#26292F"/><ellipse cx="150" cy="58" rx="51" ry="9" fill="#F0C467"/><path d="M122 56l7 3M146 52l5 4M168 55l7 2" stroke="#E8590C" stroke-width="3" stroke-linecap="round"/><circle class="bub" cx="134" cy="58" r="3" fill="#FFF3D1"/><circle class="bub b2" cx="160" cy="60" r="2.5" fill="#FFF3D1"/><rect x="104" y="124" width="92" height="14" rx="3" fill="#C97A2C"/><g class="flame"><path d="M118 124q2-16 8-20q6 8 6 20z" fill="#F7C948"/><path d="M142 124q2-20 9-24q7 10 6 24z" fill="#E8590C"/><path d="M168 124q2-15 8-19q6 8 6 19z" fill="#F7C948"/></g></svg>',
    ready: '<svg class="ill" viewBox="0 0 300 150" aria-hidden="true"><g class="bob2"><path d="M134 46q16-26 32 0" stroke="#8A4B2A" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M118 50h64l7 84h-78z" fill="#E8A54E"/><rect x="118" y="46" width="64" height="10" rx="2" fill="#D58A35"/><g transform="translate(132 76) scale(.56)">' + '<rect width="64" height="64" rx="18" fill="#E8590C"/><path d="M14 30h36a18 18 0 01-36 0z" fill="#fff"/>' + '</g></g><g class="popin"><circle cx="192" cy="52" r="17" fill="#0B8A5A"/><path d="M184 52l6 6 10-11" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>',
    picked_up: '<svg class="ill" viewBox="0 0 300 150" aria-hidden="true"><path d="M40 112C100 50 170 150 252 74" stroke="#15171C" stroke-width="16" fill="none" stroke-linecap="round"/><path class="lane" d="M40 112C100 50 170 150 252 74" stroke="#fff" stroke-width="2.5" fill="none" stroke-dasharray="10 9"/><circle cx="40" cy="112" r="15" fill="#fff" stroke="#E8590C" stroke-width="3"/><g transform="translate(236 34)"><path d="M0 28L18 12L36 28V52H0Z" fill="#fff" stroke="#15171C" stroke-width="2.5" stroke-linejoin="round"/><rect x="13" y="36" width="10" height="16" rx="1.5" fill="#0B8A5A"/></g><g><circle r="15" fill="#E8590C" stroke="#fff" stroke-width="3"/><path d="M-7-3h7l3 6" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><animateMotion dur="6s" repeatCount="indefinite" path="M40 112C100 50 170 150 252 74" keyPoints="0;0.86" keyTimes="0;1" calcMode="linear"/></g></svg>'
  };
  HERO.delivered = HERO.ready;
  function etaOf(o) { var travel = Math.round((o.km || 2) * 3 + 6), base = o.history[0].at;
    if (o.status === "picked_up") return Math.max(1, Math.round(travel * (1 - (o.courierPos ? o.courierPos.progress : 0))));
    var prep = o.prepMin || 20, cookStart = (o.history.filter(function (h) { return h.status === "cooking"; })[0] || {}).at || Date.now();
    var left = (cookStart + prep * 60000 - Date.now()) / 60000; return Math.max(travel, Math.round(Math.max(0, left) + travel)); }
  SF.route("/o/:id", { roles: ["customer"], live: true, title: "track.title", render: function (p) {
    return api().get("/orders/" + p.id).then(function (o) {
      var r = o.restaurant, city = (SF.state.cities || []).filter(function (c) { return c.id === o.cityId; })[0] || r;
      var fin = ["rejected", "cancelled"].indexOf(o.status) >= 0, done = o.status === "delivered", moving = !fin && !done && !!o.courier;
      var steps = [["track.s1", "receipt"], ["track.s2", "fire"], ["track.s3", "scooter"], ["track.s4", "home"]], cur = { pending: 0, cooking: 1, ready: 1, picked_up: 2, delivered: 3 }[o.status];
      var cp = o.courierPos, markers = [{ lat: r.lat, lng: r.lng, type: "rest", label: "R" }, { lat: o.address.lat, lng: o.address.lng, type: "home", label: "" }];
      if (cp && !done) markers.push({ lat: cp.lat, lng: cp.lng, type: "courier" });
      var map = fin || done ? "" : '<section class="card mapcard live-map">' + SF.tmap({ key: "o-" + o.id + "-" + (cp ? cp.leg : "none"), center: city, zone: SF.zone(o.cityId), fit: [cp && cp.leg === "to_customer" ? cp : r, o.address].concat(cp && cp.leg !== "to_customer" ? [cp] : []), markers: markers, route: [cp || r, cp && cp.leg !== "to_customer" ? r : o.address], label: t("track.map") }) +
        (cp ? '<div class="mapchip"><span class="dotlive' + (cp.live ? " on" : "") + '"></span><b>' + t("cr.chip." + cp.leg, { km: cp.km, min: cp.etaMin }) + "</b></div>" : "") +
        '<div class="legend"><span><i class="lg-r"></i>' + esc(tx(r.name)) + '</span><span><i class="lg-h"></i>' + t("track.you") + "</span>" + (cp ? '<span><i class="lg-c"></i>' + t("track.courier") + "</span>" : "") + "</div></section>";
      var status = '<section class="card live"><div class="lhero s-' + o.status + (moving ? " small" : "") + '">' + (HERO[o.status] || "") + (!fin && !done ? '<span class="eta num">≈ ' + etaOf(o) + " " + t("u.min") + "</span>" : "") + (done && Date.now() - (o.updatedAt || o.createdAt) < 15 * 60000 ? confetti() : "") + "</div>" +
        '<div class="lbody"><span class="muted num">№' + o.number + " · " + esc(tx(r.name)) + "</span><h1 class=\"h2\">" + t("track.h." + o.status) + "</h1><p class=\"muted\">" + t("track.p." + o.status, { min: o.prepMin, sum: money(o.total) }) + "</p>" +
        (o.payment.method === "transfer" && o.payment.status === "review" ? '<div class="msg info">' + I("receipt", 16) + t("tr.checking") + "</div>" : "") +
        (o.status === "rejected" && o.rejectReason ? '<div class="msg err">' + I("info", 16) + esc(o.rejectReason) + "</div>" : "") +
        (fin ? "" : '<ol class="steps">' + steps.map(function (s, i) { var st = i < cur || done ? "done" : i === cur ? "now" : ""; return '<li class="' + st + '"><span>' + I(st === "done" ? "check" : s[1], 16) + "</span><small>" + t(s[0]) + "</small></li>"; }).join("") + "</ol>") +
        (o.status === "awaiting_payment" ? '<a class="btn primary block" href="#/pay/' + o.id + '">' + t("pay.payBtn", { sum: money(o.total) }) + "</a>" : "") +
        (["pending", "awaiting_payment"].indexOf(o.status) >= 0 ? '<button class="btn ghost" data-act="cancelorder" data-id="' + o.id + '">' + t("track.cancel") + "</button>" : "") + "</div></section>";
      var html = '<a class="backlink" href="#/orders">' + I("chevL", 18) + t("nav.orders") + '</a><div class="two track"><div class="stack">' +
        (moving ? map + courierCard(o) + status : status + (fin ? "" : courierCard(o)) + map) +
        (done && !o.review ? reviewForm(o) : "") + (o.review ? '<section class="card"><h3>' + t("rv.thanks") + "</h3>" + SF.stars(o.review.rating) + (o.review.comment ? '<p class="muted">«' + esc(o.review.comment) + "»</p>" : "") + "</section>" : "") +
        '</div><div class="stack">' + timeline(o) +
        '<section class="card help"><h3>' + t("track.help") + '</h3><div class="hrow"><span class="grow"><b>' + esc(tx(r.name)) + '</b><small class="muted">' + t("track.callRest") + "</small></span>" + (fin || done ? "" : SF.callBtn(tx(r.name), r.phone, t("track.callRest"))) + "</div>" +
        '<div class="hrow"><span class="grow"><b>' + esc(SF.brand()) + '</b><small class="muted">' + t("foot.support") + "</small></span>" + SF.callBtn(SF.brand(), SF.state.pub.supportPhone, t("foot.support")) + "</div>" +
        (done || fin ? '<button class="btn primary block" data-act="reorder" data-id="' + o.id + '">' + I("route", 16) + t("orders.repeat") + "</button>" : "") + "</section>" +
        '<details class="card details"><summary>' + t("track.details") + '<span class="num">' + money(o.total) + "</span></summary>" + o.items.map(function (it) { return '<div class="line"><span>' + esc(tx(it.name)) + " × " + it.qty + '</span><span class="num">' + money(it.price * it.qty) + "</span></div>"; }).join("") +
        '<div class="line muted"><span>' + t("cart.delivery") + '</span><span class="num">' + money(o.deliveryFee) + "</span></div>" + (o.discount ? '<div class="line ok"><span>' + t("cart.discount") + '</span><span class="num">−' + money(o.discount) + "</span></div>" : "") +
        '<div class="line"><span>' + t("co.payment") + "</span><span>" + t("pay." + o.payment.method) + " · " + t("ps." + o.payment.status) + '</span></div><div class="line"><span>' + t("co.address") + "</span><span class=\"right\">" + esc(o.address.text) + (o.address.landmark ? ", " + esc(o.address.landmark) : "") + "</span></div></details></div></div>";
      return html;
    });
  } });
  /* the courier, always answered plainly: is one assigned, where are they, do they have my food */
  function courierCard(o) {
    var c = o.courier, cp = o.courierPos;
    if (o.selfDelivery) { var sd = o.selfDelivery, ph = sd.phone || (o.restaurant && o.restaurant.phone), done0 = o.status === "delivered";
      return '<section class="card courier2"><div class="crow"><span class="avatar">' + I("store", 20) + '</span><div class="grow"><small class="muted">' + t("dl.selfTitle") + "</small><b>" + esc(sd.name || tx(o.restaurant.name)) + '</b><span class="muted">' + esc(tx(o.restaurant.name)) + "</span></div>" + (ph && !done0 ? SF.callBtn(sd.name || tx(o.restaurant.name), ph, t("dl.selfTitle"), t("track.call")) : "") + "</div>" +
        '<div class="cstage leg-' + (done0 ? "done" : "to_customer") + '"><span class="cst-ic">' + I(done0 ? "check" : "scooter", 18) + '</span><div class="grow"><b>' + t(done0 ? "cr.leg.done" : "dl.selfOnWay") + "</b></div></div></section>"; }
    if (!c) {
      if (["awaiting_payment", "pending"].indexOf(o.status) >= 0) return '<section class="card cwait"><span class="cpulse">' + I("scooter", 22) + '</span><div class="grow"><b>' + t("cr.later") + "</b><small>" + t("cr.laterSub") + "</small></div></section>";
      return '<section class="card cwait searching"><span class="cpulse">' + I("scooter", 22) + '</span><div class="grow"><b>' + t(o.delivery === "own" || (o.delivery === "mixed" && !o.handedOff) ? "dl.ownSearch" : "cr.search") + "</b><small>" + t("cr.searchSub") + "</small></div></section>";
    }
    var leg = o.status === "delivered" ? "done" : cp ? cp.leg : "to_restaurant", has = o.status === "picked_up";
    return '<section class="card courier2"><div class="crow"><span class="avatar">' + esc(c.name.charAt(0)) + '</span><div class="grow"><small class="muted">' + t("cr.yours") + "</small><b>" + esc(c.name) + '</b><span class="muted">' + SF.stars(c.rating) + " · " + t("veh." + c.vehicle) + "</span></div>" + SF.callBtn(c.name, c.phone, t("role.courier"), t("track.call")) + "</div>" +
      '<div class="cstage leg-' + leg + '"><span class="cst-ic">' + I({ to_restaurant: "store", at_restaurant: "bag", to_customer: "scooter", done: "check" }[leg], 18) + '</span><div class="grow"><b>' + t("cr.leg." + leg) + "</b>" + (cp && leg !== "done" && leg !== "at_restaurant" ? '<small class="num">' + t("cr.dist", { km: cp.km, min: cp.etaMin }) + "</small>" : "") + "</div></div>" +
      '<div class="cbadges">' + (leg === "done" ? "" : '<span class="pill ' + (has ? "p-ok" : "p-mut") + '">' + I(has ? "check" : "clock", 14) + t(has ? "cr.has" : "cr.hasNot") + "</span>") + (cp && leg !== "done" ? '<span class="pill p-mut"><i class="dotlive' + (cp.live ? " on" : "") + '"></i>' + t(cp.live ? "cr.gps" : "cr.est") + "</span>" : "") + "</div></section>";
  }
  function timeline(o) {
    var ev = [{ at: o.createdAt, k: "tl.created" }];
    o.history.forEach(function (h) { var k = { cooking: "tl.accepted", ready: "tl.ready", picked_up: "tl.picked", delivered: "tl.delivered", rejected: "tl.rejected", cancelled: "tl.cancelled" }[h.status]; if (k) ev.push({ at: h.at, k: k }); });
    if (o.assignedAt && o.courier) ev.push({ at: o.assignedAt, k: "tl.assigned", p: { name: o.courier.name } });
    ev.sort(function (a, b) { return a.at - b.at; });
    return '<section class="card tline"><h3>' + t("tl.title") + '</h3><ol>' + ev.map(function (e, i) { return '<li class="' + (i === ev.length - 1 ? "last" : "") + '"><span class="num">' + SF.time(e.at) + "</span><b>" + esc(t(e.k, e.p)) + "</b></li>"; }).join("") + "</ol></section>";
  }
  function confetti() { var c = ["#E8590C", "#F7C948", "#1F7A4D", "#1F5FA8", "#fff"], h = '<div class="confetti" aria-hidden="true">'; for (var i = 0; i < 18; i++) h += '<i style="left:' + ((i * 37) % 100) + "%;background:" + c[i % 5] + ";animation-delay:" + ((i % 6) * 0.18).toFixed(2) + "s;animation-duration:" + (1.6 + (i % 4) * 0.3).toFixed(1) + 's"></i>'; return h + "</div>"; }
  function reviewForm(o) { var rv = SF.state.rv || (SF.state.rv = { rating: 0, courierRating: 0, comment: "" });
    function row(k, label) { return '<div class="rvrow"><span>' + label + '</span><div class="starbtns" role="radiogroup" aria-label="' + esc(label) + '">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" role="radio" aria-checked="' + (rv[k] === n) + '" class="' + (rv[k] >= n ? "on" : "") + '" data-act="star" data-k="' + k + '" data-v="' + n + '" aria-label="' + n + '">' + I("star", 26) + "</button>"; }).join("") + "</div></div>"; }
    return '<section class="card review"><h3>' + t("rv.title") + "</h3>" + row("rating", t("rv.food")) + (o.courier ? row("courierRating", t("rv.courier")) : "") +
      '<label class="f">' + t("rv.comment") + '<input data-input="rv" value="' + esc(rv.comment) + '" placeholder="' + t("rv.commentPh") + '"></label><button class="btn primary" data-act="sendreview" data-id="' + o.id + '">' + t("rv.send") + "</button></section>"; }
  SF.actions.star = function (el) { SF.state.rv[el.dataset.k] = +el.dataset.v; SF.render({ quiet: true }); };
  SF.inputs.rv = function (v) { SF.state.rv.comment = v; };
  SF.actions.sendreview = function (el) { var rv = SF.state.rv; return api().post("/orders/" + el.dataset.id + "/review", { rating: rv.rating, courierRating: rv.courierRating || null, comment: rv.comment }).then(function () { SF.state.rv = null; SF.toast(t("rv.thanks")); SF.render({ quiet: true }); }); };
  SF.actions.cancelorder = function (el) { return api().post("/orders/" + el.dataset.id + "/cancel").then(function () { SF.toast(t("track.cancelled"), "info"); SF.render({ quiet: true }); }); };

  /* ---------- Orders ---------- */
  SF.route("/orders", { roles: ["customer"], live: true, title: "nav.orders", render: function () {
    return api().get("/orders/my").then(function (list) {
      var act = list.filter(function (o) { return SomonRules.ACTIVE.indexOf(o.status) >= 0; }), past = list.filter(function (o) { return act.indexOf(o) < 0; });
      return '<h1 class="h2 pt">' + t("nav.orders") + "</h1>" + (!list.length ? SF.empty(SF.art("plov", 100), t("orders.none"), t("orders.noneSub"), '<a class="btn primary" href="#/">' + t("cart.browse") + "</a>") : "") +
        (act.length ? '<div class="sect"><h2>' + t("orders.active") + '</h2></div><div class="olist">' + act.map(function (o) { var pr = { awaiting_payment: 5, pending: 15, cooking: 45, ready: 65, picked_up: 85 }[o.status];
          return '<a class="ocard live" href="#/o/' + o.id + '"><span class="cim" style="--tone:' + esc(o.restaurant.tone) + '">' + SF.pic(o.items[0], 52) + '</span><div class="grow"><div class="rrow"><b>' + esc(tx(o.restaurant.name)) + "</b>" + SF.statusPill(o.status) + '</div><span class="muted num">№' + o.number + " · " + money(o.total) + '</span><span class="bar"><i style="width:' + pr + '%"></i></span></div>' + I("chevR", 18) + "</a>"; }).join("") + "</div>" : "") +
        (past.length ? '<div class="sect"><h2>' + t("orders.history") + '</h2></div><div class="olist">' + past.map(function (o) {
          return '<div class="ocard past"><a class="ohit" href="#/o/' + o.id + '" aria-label="№' + o.number + '"></a><span class="cim" style="--tone:' + esc(o.restaurant.tone) + '">' + SF.pic(o.items[0], 44) + '</span><div class="grow"><b class="oname">' + esc(tx(o.restaurant.name)) + '</b><span class="muted num">' + SF.dt(o.createdAt) + '</span><span class="ometa">' + SF.statusPill(o.status) + (o.review ? SF.stars(o.review.rating) : "") + "</span></div>" +
            '<div class="oside"><b class="num">' + money(o.total) + "</b>" + (o.status === "delivered" ? '<button class="btn sm ghost" data-act="reorder" data-id="' + o.id + '">' + I("route", 14) + t("orders.repeat") + "</button>" : "") + "</div></div>"; }).join("") + "</div>" : "");
    });
  } });
  SF.actions.reorder = function (el) { return api().get("/orders/" + el.dataset.id).then(function (o) { return api().get("/restaurants/" + o.restaurantId).then(function (r) { remember(r.products); SF.cart.clear();
    o.items.forEach(function (it) { var p = cache[it.productId]; if (p && p.available) SF.cart.add(p, it.qty); }); SF.state.cartSum = cartSum(); SF.toast(t("orders.repeated")); SF.go("/cart"); }); }); };

  /* ---------- Profile ---------- */
  SF.route("/profile", { roles: ["customer"], title: "nav.profile", render: function () {
    var u = SF.state.user;
    return api().get("/orders/my").then(function (list) { var done = list.filter(function (o) { return o.status === "delivered"; });
      return '<div class="profile"><section class="card phead"><span class="avatar xl">' + esc(u.name.charAt(0)) + '</span><div><h1 class="h2">' + esc(u.name) + '</h1><span class="muted num">' + esc(SF.phone(u.phone)) + "</span></div></section>" +
        '<div class="kpis"><div class="kpi"><small>' + t("orders.count") + '</small><b class="num">' + list.length + '</b></div><div class="kpi"><small>' + t("orders.spent") + '</small><b class="num">' + money(done.reduce(function (s, o) { return s + o.total; }, 0)) + "</b></div></div>" +
        SF.installCard() + '<section class="card menu"><form class="mrow" data-form="name"><label class="f grow">' + t("profile.name") + '<input name="name" value="' + esc(u.name) + '" autocomplete="name"></label><button class="btn sm ghost">' + t("btn.save") + "</button></form>" +
        '<div class="mrow"><span>' + t("profile.lang") + "</span>" + SF.langSel() + '</div><div class="mrow"><span>' + t("profile.city") + '</span><button class="chip" data-act="city">' + I("pin", 14) + esc(tx(((SF.state.cities || []).filter(function (c) { return c.id === SF.state.cityId; })[0] || {}).name)) + "</button></div>" +
        '<div class="mrow vcol"><span>' + t("profile.addresses") + "</span>" + ((u.addresses || []).length ? '<div class="addrs">' + u.addresses.map(function (a) { return '<span class="addr">' + I("pin", 16) + "<span>" + esc(a.text) + (a.landmark ? "<small>" + esc(a.landmark) + "</small>" : "") + "</span></span>"; }).join("") + "</div>" : '<span class="muted sm">' + t("profile.noAddr") + "</span>") + "</div>" +
        '<div class="mrow"><span class="grow"><span>' + t("foot.support") + '</span><br><b class="num">' + esc(SF.state.pub.supportPhone) + "</b></span>" + SF.callBtn(SF.brand(), SF.state.pub.supportPhone, t("foot.support")) + "</div></section>" + SF.pwForm() +
        '<div class="row2">' + (SF.state.pub.demo ? '<button class="btn ghost" data-act="demo">' + I("users", 18) + t("profile.demo") + "</button>" : "") + '<button class="btn ghost" data-act="logout">' + I("logout", 18) + t("auth.logout") + "</button></div></div>";
    });
  } });
  SF.forms.name = function (fd) { return api().patch("/auth/me", { name: fd.name }).then(function (u) { SF.state.user = u; SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };
})();
