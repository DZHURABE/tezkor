/* SOMON FOOD — customer app: Home → Restaurant → Food → Cart → Checkout → Payment → Tracking */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, tx = SF.tx, money = SF.money, api = function () { return SF.api; };
  var cache = SF.state.prod = SF.state.prod || {};
  function remember(list) { (list || []).forEach(function (p) { cache[p.id] = p; }); }
  function cartSum() { var c = SF.cart.get(); return Object.keys(c.items).reduce(function (s, k) { return s + (cache[k] ? cache[k].price * c.items[k] : 0); }, 0); }
  SF.cartSum = cartSum;
  function cityQ() { return "cityId=" + encodeURIComponent(SF.state.cityId); }

  /* ---------- cards ---------- */
  function isFav(ty, id) { var u = SF.state.user, f = u && u.favs; return !!(f && (f[ty] || []).indexOf(id) >= 0); }
  function favBtn(ty, id) { var on = isFav(ty, id); return '<button type="button" class="favbtn' + (on ? " on" : "") + '" data-act="fav" data-t="' + ty + '" data-id="' + id + '" aria-pressed="' + on + '" aria-label="' + t(on ? "fav.remove" : "fav.add") + '">' + I("heart", 18) + "</button>"; }
  function etaMin(r) { return parseInt(String(r.eta || "").split(/[–-]/)[0], 10) || 99; }
  function restLogo(r) { return r.logo ? '<span class="rlogo"><img src="' + esc(r.logo) + '" alt="" loading="lazy"></span>' : '<span class="rlogo" style="--tone:' + esc(r.tone) + '"><b>' + esc(tx(r.name).charAt(0)) + "</b></span>"; }
  function restCard(r) {
    return '<article class="rc2' + (r.isOpenNow ? "" : " closed") + '"><a class="rhit" href="#/r/' + r.id + '" aria-label="' + esc(tx(r.name)) + '"></a>' +
      '<div class="rcov hasph" style="--tone:' + esc(r.tone) + '">' + (restPhoto(r) ? '<img' + (r.cover ? "" : ' class="fb"') + ' src="' + esc(restPhoto(r)) + '" alt="" loading="lazy">' : '<span class="a1">' + SF.art(r.art1 || "plate", 118) + "</span>") +
        '<span class="rchips"><span class="rstate ' + (r.isOpenNow ? "on" : "off") + '">' + I("clock", 13) + (r.isOpenNow ? t("rc.openTill", { to: r.hours.to }) : t("rest.closedUntil", { from: r.hours.from })) + "</span>" +
        (r.hasSale ? '<span class="rsale">' + I("percent", 13) + t("rc.sale") + "</span>" : "") + "</span>" + favBtn("r", r.id) + "</div>" +
      '<div class="rbody2">' + restLogo(r) + '<div class="grow"><div class="rrow"><b class="rname">' + esc(tx(r.name)) + "</b>" + (r.isNew ? '<span class="rnew">' + t("rc.new") + "</span>" : "") +
        (r.rating != null ? '<span class="rrate">' + I("star", 14) + "<b>" + Number(r.rating).toFixed(1) + "</b>" + (r.ratingCount ? "<small>(" + r.ratingCount + ")</small>" : "") + "</span>" : "") + '</div><span class="rmeta">' + esc(tx(r.cuisine)) + "</span>" +
        '<div class="rfacts num"><span>' + I("clock", 15) + esc(r.eta) + " " + t("u.min") + "</span><span>" + I("scooter", 15) + money(r.deliveryFrom) + "</span>" + (r.minOrder ? "<span>" + I("bag", 15) + t("rc.from", { sum: money(r.minOrder) }) + "</span>" : "") + "</div></div>" + I("chevR", 18) + "</div></article>";
  }
  function withArt(list, prods) { return list.map(function (r) { var ps = (prods || r.products || []).filter(function (p) { return p.restaurantId === r.id; });
    var ks = ps.filter(function (p) { return p.popular; }).concat(ps).map(function (p) { return p.kind; }); r.art1 = ks[0]; r.art2 = ks.filter(function (k) { return k !== ks[0]; })[0] || ks[1]; return r; }); }
  /* like 92% once at least three people rated the dish */
  function likeChip(p) { var n = (p.likes || 0) + (p.dislikes || 0); return n >= 3 ? ' <span class="likec">' + I("thumbup", 12) + " " + Math.round((p.likes || 0) / n * 100) + "%</span>" : ""; }
  SF.likeChip = likeChip;
  function prodCard(p, compact) {
    var q = SF.cart.qty(p.id), off = SF.sale(p);
    return '<div class="pcard' + (p.available ? "" : " off") + (compact ? " mini" : "") + '">' + favBtn("p", p.id) + '<button class="pimg' + (p.photo ? " hasph" : "") + '" style="--tone:' + esc(p.restaurant ? p.restaurant.tone : SF.state.tone || "#F2EFEA") + '" data-act="prod" data-id="' + p.id + '" aria-label="' + esc(tx(p.name)) + '">' + SF.pic(p, compact ? 92 : 118) +
      (off ? '<span class="chip sale">−' + off + "%</span>" : p.popular ? '<span class="chip hot">' + I("fire", 12) + t("prod.hit") + "</span>" : "") + "</button>" +
      '<div class="pbody">' + (p.brand ? '<small class="pbrand">' + esc(p.brand) + "</small>" : "") + '<b class="pname">' + esc(tx(p.name)) + likeChip(p) + "</b>" + (p.stock != null && p.available && p.stock <= 5 ? '<span class="stockl">' + t("sh.left", { n: p.stock }) + "</span>" : "") + (compact && p.restaurant ? '<span class="pdesc">' + esc(tx(p.restaurant.name)) + "</span>" : '<span class="pdesc">' + esc(tx(p.desc)) + "</span>") +
      '<div class="prow"><span class="price num">' + money(p.price) + (off ? "<s>" + money(p.oldPrice) + "</s>" : "") + (p.weight ? '<small>' + esc(p.weight) + "</small>" : "") + "</span>" + (p.available ? stepper(p, q) : '<span class="pill p-mut">' + t("prod.soldout") + "</span>") + "</div></div></div>";
  }
  SF.prodCard = prodCard; SF.rememberProducts = remember;
  SF.actions.brandf = function (el) { SF.state.brandF = { r: el.dataset.r, b: el.dataset.v }; SF.render({ quiet: true }); };
  SF.actions.fav = function (el) { var u = SF.state.user; if (!u || u.role !== "customer") { SF.toast(t("fav.login"), "info"); SF.state.after = SF.path(); SF.go("/login"); return; }
    var on = !isFav(el.dataset.t, el.dataset.id); el.classList.toggle("on", on); el.setAttribute("aria-pressed", on);
    return api().post("/auth/me/favorites", { type: el.dataset.t, id: el.dataset.id, on: on }).then(function (nu) { SF.state.user = nu; SF.toast(t(on ? "fav.added" : "fav.removed")); }); };
  function stepper(p, q, big) {
    return q ? '<div class="stepper' + (big ? " big" : "") + '"><button data-act="dec" data-id="' + p.id + '" aria-label="' + t("a.less") + '">' + I("minus", 16) + '</button><b class="num">' + q + '</b><button data-act="add" data-id="' + p.id + '" aria-label="' + t("a.more") + '">' + I("plus", 16) + "</button></div>"
      : '<button class="addbtn" data-act="add" data-id="' + p.id + '" aria-label="' + t("a.add") + " " + esc(tx(p.name)) + '">' + I("plus", 18) + "</button>";
  }
  SF.prodCard = prodCard; SF.restCard = restCard;
  /* one banner, the same on the home page, in the restaurant's ad editor (preview) and in admin */
  SF.bannerHtml = function (b, tag, cls) { tag = tag || "div";
    return "<" + tag + ' class="banner' + (b.photo ? " hasph" : "") + (cls ? " " + cls : "") + '" style="--b:' + esc(b.tone) + '"' + (tag === "a" ? ' href="#' + (b.restaurantId ? "/r/" + b.restaurantId : "/") + '"' : "") + ">" +
      (b.photo ? '<img class="bph" src="' + esc(b.photo) + '" alt="">' : "") + "<div><b>" + esc(tx(b.title)) + "</b>" + (b.place ? '<span class="bplace">' + I("pin", 13) + esc(tx(b.place)) + "</span>" : "") + "<span>" + esc(tx(b.sub)) + "</span>" +
        (b.own ? '<em class="bgo">' + t("ad.go") + I("chevR", 14) + "</em>" : b.restaurantId ? '<em class="bgo">' + t("h3.order") + I("chevR", 14) + "</em>" : "") + "</div>" +
        (b.restaurantId && SF.qrSvg && cls !== "small" ? '<span class="bqr" title="' + t("h3.menuQr") + '">' + SF.qrSvg((location.protocol.indexOf("http") === 0 ? location.origin : "https://tezkor.pro") + "/#/r/" + b.restaurantId, { level: "M", pad: 2 }) + "<small>" + t("h3.menuQr") + "</small></span>" : "") +
      (b.photo ? "" : '<span class="bart">' + SF.art(b.art, cls === "small" ? 70 : 110) + "</span>") + '<i class="ornament" aria-hidden="true"></i></' + tag + ">"; };

  /* ---------- Home ---------- */
  var RF = [["all", "rf.all"], ["open", "rf.open"], ["sale", "rf.sale"], ["fast", "rf.fast"], ["top", "rf.top"], ["new", "rf.new"]];
  var RS = [["popular", "rs.popular"], ["rating", "rs.rating"], ["fast", "rs.fast"], ["cheap", "rs.cheap"], ["new", "rs.new"]];
  function filterRests(list, f) { return list.filter(function (r) { return f === "open" ? r.isOpenNow : f === "sale" ? r.hasSale : f === "fast" ? etaMin(r) <= 30 : f === "top" ? (r.rating || 0) >= 4.5 : f === "new" ? r.isNew : true; }); }
  function sortRests(list, k) { var l = list.slice(), byOpen = function (a, b) { return (b.isOpenNow ? 1 : 0) - (a.isOpenNow ? 1 : 0); };
    return l.sort(function (a, b) { return byOpen(a, b) || (k === "rating" ? (b.rating || 0) - (a.rating || 0) : k === "fast" ? etaMin(a) - etaMin(b) : k === "cheap" ? a.deliveryFrom - b.deliveryFrom : k === "new" ? (b.createdAt || 0) - (a.createdAt || 0) : (b.orderCount || 0) - (a.orderCount || 0) || (b.rating || 0) - (a.rating || 0)); }); }
  function sect(title, sub, more) { return '<div class="sect2"><div><h2>' + title + "</h2>" + (sub ? '<span class="muted">' + sub + "</span>" : "") + "</div>" + (more || "") + "</div>"; }
  function rowRests(list) { return '<div class="hscroll rrowscroll">' + list.map(restCard).join("") + "</div>"; }
  function rowProds(list) { return '<div class="hscroll">' + list.map(function (p) { return prodCard(p, true); }).join("") + "</div>"; }
  /* default photos for the main categories until the admin uploads his own */
  var CAT_PH = { k1: "plov", k2: "shashlik", k3: "burger", k4: "pizza", k9: "drinks", k8: "drinks" };
  function catPhoto(c) { return SF.PHOTO && CAT_PH[c.id] ? SF.PHOTO[CAT_PH[c.id]] : null; }
  var KIND_PH = { plov: "bplov", qurutob: "plov", lagman: "plov", mantu: "plov", soup: "plov", samsa: "plov", bread: "plov", plate: "bplov", shashlik: "shashlik", kebab: "shashlik", burger: "burger", fries: "burger", shawarma: "burger", pizza: "pizza", drink: "drinks", juice: "drinks", tea: "drinks", coffee: "drinks", dessert: "drinks", cake: "drinks", icecream: "drinks", ayran: "drinks" };
  function restPhoto(r) { return r.cover || (SF.PHOTO ? SF.PHOTO[KIND_PH[r.art1] || "bplov"] : null); }
  function catTile(c, on, href) { return '<a class="ctile' + (on ? " on" : "") + '" href="' + href + '"' + (on ? ' aria-current="true"' : "") + '><span class="cimg' + (c && (c.photo || catPhoto(c)) ? " hasph" : "") + '">' + (c ? (c.photo || catPhoto(c) ? '<img src="' + esc(c.photo || catPhoto(c)) + '" alt="" loading="lazy">' : SF.art(c.icon, 46)) : I("grid", 24)) + "</span><span>" + (c ? esc(tx(c.name)) : t("home.all")) + "</span></a>"; }
  SF.catRow = function (cur, base) { return '<nav class="ctiles" aria-label="' + t("home.cats") + '">' + catTile(null, !cur, base) + (SF.state.categories || []).map(function (c) { return catTile(c, cur === c.id, base + (base.indexOf("?") >= 0 ? "&" : "?") + "cat=" + c.id); }).join("") + "</nav>"; };
  /* what to eat now: breakfast in the morning, lunch at midday, dinner in the evening, something light at night (local time) */
  SF.mealSlot = function (h) { h = h == null ? new Date().getHours() : h; return h >= 5 && h < 11 ? "b" : h >= 11 && h < 16 ? "l" : h >= 16 && h < 22 ? "d" : "n"; };
  var MEAL_KINDS = { b: ["samsa", "bread", "tea", "coffee", "ayran", "cake", "dessert", "qurutob"], l: ["plov", "lagman", "soup", "mantu", "qurutob", "salad", "shashlik", "kebab", "shawarma", "burger", "plate"],
    d: ["shashlik", "kebab", "plov", "mantu", "pizza", "sushi", "burger", "salad", "lagman", "plate"], n: ["burger", "shawarma", "pizza", "fries", "drink", "juice", "icecream", "dessert", "cake", "tea", "coffee"] };
  function fitsMeal(x, slot) { return x.meals && x.meals.length ? x.meals.indexOf(slot) >= 0 : MEAL_KINDS[slot].indexOf(x.kind) >= 0; }
  function mealPicks(all, rests, slot) { var open = {}; rests.forEach(function (r) { if (r.isOpenNow) open[r.id] = 1; });
    var list = all.filter(function (x) { return open[x.restaurantId] && fitsMeal(x, slot); })
      .sort(function (a, b) { return ((b.meals || []).indexOf(slot) >= 0) - ((a.meals || []).indexOf(slot) >= 0) || (b.popular ? 1 : 0) - (a.popular ? 1 : 0); });
    /* a few from each restaurant, mixed, so one kitchen does not fill the row */
    var by = {}, out = []; list.forEach(function (x) { (by[x.restaurantId] = by[x.restaurantId] || []).push(x); });
    for (var i = 0; i < 3 && out.length < 12; i++) Object.keys(by).forEach(function (k) { if (by[k][i] && out.length < 12) out.push(by[k][i]); });
    return out; }
  SF.route("/food", { title: "sa.food", render: function (p, q) {
    var cat = q.cat || "", f = SF.state.rf || "all", so = SF.state.rs || "popular";
    return Promise.all([api().get("/banners"), api().get("/products/popular?" + cityQ()), api().get("/restaurants?" + cityQ() + (cat ? "&categoryId=" + cat : ""))]).then(function (res) {
      var banners = res[0], pop = res[1], rests = res[2]; remember(pop);
      return Promise.all(rests.map(function (r) { return api().get("/restaurants/" + r.id).then(function (full) { remember(full.products); return Object.assign(full, { orderCount: r.orderCount, hasSale: r.hasSale, isNew: r.isNew }); }); })).then(function (full) {
        withArt(full);
        var u = SF.state.user, hour = new Date().getHours(), greet = hour < 12 ? "home.morning" : hour < 18 ? "home.day" : "home.evening", pub = SF.state.pub || {};
        var cityN = tx(((SF.state.cities || []).filter(function (c) { return c.id === SF.state.cityId; })[0] || {}).name), ad0 = u && (u.addresses || [])[0];
        var all = []; full.forEach(function (r) { (r.products || []).forEach(function (x) { if (x.available) all.push(Object.assign({}, x, { restaurant: { id: r.id, name: r.name, tone: r.tone } })); }); }); remember(all);
        /* hero: greeting + big title over a food photo, three promises; then a glass panel with the address, «on the map» and search */
        var top = '<div class="svhead"><a class="svback" href="#/" aria-label="' + t("btn.back") + '">' + I("chevL", 20) + '</a><h1>' + t("sa.food") + '</h1><span class="svstate on">' + t("sa.works") + "</span></div>" +
          '<section class="gpanel"><div class="gprow"><button class="addrbar" data-act="addrpick"><span class="apin">' + I("pin", 18) + '</span><span class="grow"><small>' + t("home.deliverTo") + "</small><b>" + esc(ad0 ? (ad0.text || t("addr." + (ad0.kind || "other"))) + " · " + cityN : cityN) + "</b></span>" + I("chevD", 16) + "</button>" +
            '<button type="button" class="onmap" data-act="onmap">' + I("map", 18) + "<span>" + t("h3.map") + "</span></button></div>" +
          '<form class="bigsearch" data-form="search" role="search">' + I("search", 20) + '<input name="q" placeholder="' + t("home.search") + '" aria-label="' + t("home.search") + '" enterkeyhint="search"><button class="btn primary">' + t("btn.find") + "</button></form></section>";
        /* ads: restaurant banners (swipe, auto-play) + a card about delivery from the real settings */
        var etas = full.filter(function (r) { return r.isOpenNow; }).map(etaMin).filter(function (x) { return x > 0; }), eLo = etas.length ? Math.min.apply(null, etas) : 30, eHi = etas.length ? Math.max.apply(null, etas) + 15 : 45;
        var dcard = '<a class="banner dcard" href="#/food" data-act="toall"><div><b>' + t("h3.fastT") + '</b><span class="dfrom">' + t("h3.from", { sum: money(pub.deliveryMin || 0) }) + "</span><ul><li>" + I("clock", 14) + eLo + "–" + eHi + " " + t("u.min") + "</li><li>" + I("shield", 14) + t("h3.safe") + "</li><li>" + I("pin", 14) + t("h3.city") + '</li></ul></div><img class="dph" src="' + SF.PHOTO.courier + '" alt=""></a>';
        var slides = banners.map(function (b) { return SF.bannerHtml(b, "a"); }).concat([dcard]);
        var ban = '<section class="banners b3" id="banners" aria-label="' + t("home.offers") + '">' + slides.join("") + "</section>" + (slides.length > 1 ? '<div class="bdots" aria-hidden="true">' + slides.map(function (b, i) { return '<i class="' + (i ? "" : "on") + '"></i>'; }).join("") + "</div>" : "");
        var cats = SF.catRow(cat, "#/food");
        if (!rests.length && !cat) return top + cats + ban + '<section class="emptycity">' + SF.art("scooter", 120) + "<h2>" + t("ec.title", { city: esc(cityN) }) + "</h2><p>" + t("ec.sub") + '</p><div class="row2"><button class="btn primary" data-act="city">' + I("city", 16) + t("ec.city") + '</button><a class="btn ghost" href="#/login">' + I("store", 16) + t("ec.partner") + "</a></div></section>";
        if (cat) { var cp = all.filter(function (x) { return x.categoryId === cat; }), cn = tx(((SF.state.categories || []).filter(function (c) { return c.id === cat; })[0] || {}).name);
          return top + cats + (cp.length ? sect(cn, t("cat.dishes", { n: cp.length })) + '<div class="pgrid">' + cp.map(function (x) { return prodCard(x, true); }).join("") + "</div>" : "") +
            (full.length ? sect(t("home.restaurants"), t("cat.rests", { n: full.length })) + '<div class="rgrid2">' + sortRests(full, so).map(restCard).join("") + "</div>" : SF.empty(SF.art("plate", 90), t("cat.none"), t("cat.noneSub"), '<a class="btn" href="#/food">' + t("home.all") + "</a>")); }
        var sale = all.filter(function (x) { return x.oldPrice > x.price; }).sort(function (a, b) { return SF.sale(b) - SF.sale(a); }).slice(0, 12);
        var popR = sortRests(full, "popular").slice(0, 8), fast = full.filter(function (r) { return r.isOpenNow; }).sort(function (a, b) { return etaMin(a) - etaMin(b); }).slice(0, 8), newR = full.filter(function (r) { return r.isNew; });
        var popIds = pop.map(function (x) { return x.id; }), favR = (u && u.favs && u.favs.r) || [];
        var rec = all.filter(function (x) { return popIds.indexOf(x.id) < 0 && (favR.indexOf(x.restaurantId) >= 0 || x.popular); }).sort(function (a, b) { return (favR.indexOf(b.restaurantId) >= 0) - (favR.indexOf(a.restaurantId) >= 0); }).slice(0, 10);
        var list = sortRests(filterRests(full, f), so), slot = SF.mealSlot(), forNow = mealPicks(all, full, slot);
        return top + cats + ban +
          (forNow.length >= 3 ? sect(t("ml.t." + slot), t("ml.s." + slot)) + rowProds(forNow) : "") +
          (sale.length ? sect(t("hs.sale"), t("hs.saleSub")) + rowProds(sale) : "") +
          (popR.length > 1 ? sect(t("hs.popRest")) + rowRests(popR) : "") +
          (pop.length ? sect(t("home.popular")) + rowProds(pop) : "") +
          (fast.length > 1 ? sect(t("hs.fast"), t("hs.fastSub")) + rowRests(fast) : "") +
          (newR.length ? sect(t("hs.new")) + rowRests(newR) : "") +
          (rec.length ? sect(t("hs.rec"), t(favR.length ? "hs.recFav" : "hs.recSub")) + rowProds(rec) : "") +
          '<section class="allrests" id="allrests">' + sect(t("hs.all"), t("cat.rests", { n: list.length }), '<label class="sortsel">' + I("sort", 16) + '<span class="sr">' + t("rs.label") + '</span><select data-input="rsort" aria-label="' + t("rs.label") + '">' + RS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === so ? " selected" : "") + ">" + t(x[1]) + "</option>"; }).join("") + "</select></label>") +
          '<div class="chips" role="group" aria-label="' + t("rf.label") + '">' + RF.map(function (x) { return '<button type="button" class="fchip' + (x[0] === f ? " on" : "") + '" data-act="rfilter" data-v="' + x[0] + '" aria-pressed="' + (x[0] === f) + '">' + t(x[1]) + "</button>"; }).join("") + "</div>" +
          (list.length ? '<div class="rgrid2">' + list.map(restCard).join("") + "</div>" : SF.empty("sliders", t("rf.none"), t("rf.noneSub"), '<button class="btn" data-act="rfilter" data-v="all">' + t("rf.reset") + "</button>")) + "</section>" +
          (pub.supportPhone ? '<p class="helpline">' + I("help", 16) + t("hs.help") + ' <b class="num">' + esc(pub.supportPhone) + "</b></p>" : "");
      });
    });
  } });
  SF.actions.rfilter = function (el) { SF.state.rf = el.dataset.v; SF.render({ quiet: true }); };
  SF.inputs.rsort = function (v) { SF.state.rs = v; SF.render({ quiet: true }); };
  SF.actions.addrpick = function () { if (SF.state.user && SF.state.user.role === "customer") SF.go("/addresses"); else SF.actions.city(); };
  /* banners slide by themselves every 5 s; a finger on them pauses it */
  SF.after.push(function () { var b = document.getElementById("banners"); clearInterval(SF._bauto); if (!b || b.children.length < 2) return; var hold = 0;
    b.addEventListener("pointerdown", function () { hold = Date.now(); }); b.addEventListener("touchstart", function () { hold = Date.now(); }, { passive: true });
    SF._bauto = setInterval(function () { if (!document.body.contains(b)) { clearInterval(SF._bauto); return; } if (Date.now() - hold < 7000 || document.hidden) return;
      var w = b.firstElementChild.getBoundingClientRect().width + 12, n = Math.round(b.scrollLeft / w) + 1; if (n * w > b.scrollWidth - b.clientWidth + 5) n = 0; b.scrollTo({ left: n * w, behavior: "smooth" }); }, 5000); });
  SF.actions.toall = function () { var el = document.getElementById("allrests"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  SF.actions.onmap = function () { var u = SF.state.user; if (u && u.role === "customer") SF.go("/addresses/new"); else { SF.state.after = "/addresses/new"; SF.go("/login"); } };
  SF.after.push(function () { var b = document.getElementById("banners"), d = document.querySelector(".bdots"); if (!b || !d) return;
    b.onscroll = function () { var w = b.firstElementChild ? b.firstElementChild.getBoundingClientRect().width + 12 : 1, i = Math.round(b.scrollLeft / w);
      Array.prototype.forEach.call(d.children, function (x, k) { x.classList.toggle("on", k === i); }); }; });

  /* ---------- Search: as you type, categories, sort, recent ---------- */
  function recent() { return SF.ls.get("recent", []) || []; }
  function addRecent(s) { s = String(s || "").trim(); if (s.length < 2) return; var r = recent().filter(function (x) { return x.toLowerCase() !== s.toLowerCase(); }); r.unshift(s); SF.ls.set("recent", r.slice(0, 8)); }
  var PS = [["rel", "ps.rel"], ["cheap", "ps.cheap"], ["dear", "ps.dear"], ["rating", "rs.rating"]];
  SF.route("/search", { title: "nav.search", render: function (p, q) {
    var s = q.q || "", cat = q.cat || "", so = q.sort || "rel"; SF.state.q = s;
    var base = "#/search?q=" + encodeURIComponent(s) + (so !== "rel" ? "&sort=" + so : "");
    var head = '<h1 class="h2 pt">' + t("nav.search") + '</h1><form class="bigsearch live" data-form="search" role="search">' + I("search", 20) + '<input id="sq" name="q" data-input="liveq" placeholder="' + t("home.search") + '" aria-label="' + t("home.search") + '" value="' + esc(s) + '" autocomplete="off" enterkeyhint="search">' +
      (s ? '<button type="button" class="iconbtn qx" data-act="qclear" aria-label="' + t("sr.clear") + '">' + I("x", 18) + "</button>" : "") + "</form>";
    if (s.length < 2) { var rc = recent();
      return head + (rc.length ? '<div class="sect2"><h2>' + t("sr.recent") + '</h2><button class="link" data-act="recentclear">' + t("sr.clearAll") + '</button></div><div class="tags">' + rc.map(function (w) { return '<a class="chip" href="#/search?q=' + encodeURIComponent(w) + '">' + I("clock", 14) + esc(w) + "</a>"; }).join("") + "</div>" : "") +
        '<div class="sect2"><h2>' + t("sr.try") + '</h2></div><div class="tags">' + ["палав", "бургер", "шашлик", "питса", "шаурма", "самбӯса"].map(function (w) { return '<a class="chip" href="#/search?q=' + encodeURIComponent(w) + '">' + esc(w) + "</a>"; }).join("") + "</div>" +
        '<div class="sect2"><h2>' + t("home.cats") + "</h2></div>" + SF.catRow("", "#/");
    }
    return api().get("/search?q=" + encodeURIComponent(s) + "&" + cityQ()).then(function (r) { remember(r.products);
      var prods = r.products.filter(function (x) { return !cat || x.categoryId === cat; }), ids = prods.map(function (x) { return x.restaurantId; });
      var rests = withArt(r.restaurants, r.products).filter(function (x) { return !cat || ids.indexOf(x.id) >= 0; });
      prods = prods.slice().sort(function (a, b) { return so === "cheap" ? a.price - b.price : so === "dear" ? b.price - a.price : so === "rating" ? ((b.restaurant || {}).rating || 0) - ((a.restaurant || {}).rating || 0) : 0; });
      if (so === "rating") rests.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
      var catsHit = (SF.state.categories || []).filter(function (c) { return r.products.some(function (x) { return x.categoryId === c.id; }); });
      return head + '<div class="srbar"><div class="chips">' + '<a class="fchip' + (!cat ? " on" : "") + '" href="' + base + '">' + t("home.all") + " · " + r.products.length + "</a>" +
          catsHit.map(function (c) { var n = r.products.filter(function (x) { return x.categoryId === c.id; }).length; return '<a class="fchip' + (cat === c.id ? " on" : "") + '" href="' + base + "&cat=" + c.id + '">' + esc(tx(c.name)) + " · " + n + "</a>"; }).join("") + "</div>" +
        '<label class="sortsel">' + I("sort", 16) + '<select data-input="psort" aria-label="' + t("rs.label") + '">' + PS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === so ? " selected" : "") + ">" + t(x[1]) + "</option>"; }).join("") + "</select></label></div>" +
        (rests.length ? sect(t("home.restaurants"), t("cat.rests", { n: rests.length })) + '<div class="rgrid2">' + rests.map(restCard).join("") + "</div>" : "") +
        (prods.length ? sect(t("search.dishes"), t("cat.dishes", { n: prods.length })) + '<div class="pgrid">' + prods.map(function (x) { return prodCard(x, true); }).join("") + "</div>" : "") +
        (!rests.length && !prods.length ? SF.empty("search", t("search.none"), t("search.noneSub"), '<button class="btn" data-act="qclear">' + t("sr.clear") + "</button>") : ""); });
  } });
  var qT = null;
  SF.inputs.liveq = function (v) { clearTimeout(qT); qT = setTimeout(function () { var h = "#/search?q=" + encodeURIComponent(v.trim());
    if (location.hash !== h) { history.replaceState(null, "", h); SF.state.qfocus = true; SF.render({ quiet: true }); } if (v.trim().length >= 3) addRecent(v.trim()); }, 300); };
  SF.inputs.psort = function (v) { var m = location.hash.replace(/&sort=[^&]*/, ""); history.replaceState(null, "", m + (v !== "rel" ? "&sort=" + v : "")); SF.render({ quiet: true }); };
  SF.actions.qclear = function () { history.replaceState(null, "", "#/search"); SF.state.qfocus = true; SF.render({ quiet: true }); };
  SF.actions.recentclear = function () { SF.ls.set("recent", []); SF.render({ quiet: true }); };
  SF.after.push(function () { if (!SF.state.qfocus) return; SF.state.qfocus = false; var i = document.getElementById("sq"); if (i) { i.focus(); var n = i.value.length; try { i.setSelectionRange(n, n); } catch (e) {} } });
  SF.addRecent = addRecent;

  /* ---------- Restaurant ---------- */
  SF.route("/r/:id", { title: "home.restaurants", render: function (p) {
    return api().get("/restaurants/" + p.id).then(function (r) {
      remember(r.products); SF.state.rest = r; SF.state.tone = r.tone; withArt([r]); SF.state.ctxShop = r.kind === "shop";
      var shop = r.kind === "shop", cats = (SF.state.categories || []).concat(SF.state.shopCats || []).filter(function (c) { return r.products.some(function (x) { return x.categoryId === c.id; }); });
      var c = SF.cart.get(), mine = c.restaurantId === r.id && SF.cart.count();
      return '<a class="backlink" href="#' + (shop ? "/shops" : "/food") + '">' + I("chevL", 18) + t("btn.back") + "</a>" +
        (shop && !r.cover ? '<section class="shcov shhero"><em class="shopen ' + (r.isOpenNow ? "on" : "") + '">' + (r.isOpenNow ? t("rc.openTill", { to: r.hours.to }) : t("rest.closedUntil", { from: r.hours.from })) + "</em><b>" + esc(tx(r.name)) + "</b></section>" : '<section class="rhero' + (r.cover ? " hasph" : "") + '" style="--tone:' + esc(r.tone) + '">' + (r.cover ? '<img class="cover" src="' + esc(r.cover) + '" alt="">' : '<span class="a2">' + SF.art(r.art2, 130) + '</span><span class="a1">' + SF.art(r.art1, 210) + '</span><i class="ornament" aria-hidden="true"></i>') + "</section>") +
        '<section class="rinfo"><div class="rtitle"><h1 class="h1">' + esc(tx(r.name)) + '</h1><span class="muted">' + esc(tx(r.cuisine)) + "</span>" + (r.about && tx(r.about) ? '<p class="about">' + esc(tx(r.about)) + "</p>" : "") + "</div>" +
        '<div class="facts"><span>' + SF.stars(r.rating) + '<small class="num">' + r.ratingCount + "</small></span><span>" + I("clock", 16) + esc(r.eta) + " " + t("u.min") + "</span><span>" + I("scooter", 16) + t("rest.deliveryFrom", { sum: money(r.deliveryFrom) }) + "</span>" + (r.pickup ? "<span>" + I("store", 16) + t("sh.pickupFree") + "</span>" : "") + (shop && r.address && tx(r.address) ? "<span>" + I("pin", 16) + esc(tx(r.address)) + "</span>" : "") + '</div><p class="factsub num">' + t("rest.minOrder", { sum: money(r.minOrder) }) + " · " + esc(r.hours.from) + "–" + esc(r.hours.to) + "</p>" +
        (r.isOpenNow ? "" : '<div class="msg warn">' + I("clock", 16) + t("rest.closedNow", { from: r.hours.from }) + "</div>") + "</section>" +
        '<div class="rlayout"><div><nav class="ctabs" id="ctabs" aria-label="' + t("rest.menu") + '">' + cats.map(function (k, i) { return '<button class="' + (i ? "" : "on") + '" data-act="jump" data-v="' + k.id + '">' + esc(tx(k.name)) + "</button>"; }).join("") + "</nav>" +
        (function () { if (!shop) return ""; var bs = []; r.products.forEach(function (x) { if (x.brand && bs.indexOf(x.brand) < 0) bs.push(x.brand); }); if (bs.length < 2) return "";
          var cur = SF.state.brandF && SF.state.brandF.r === r.id ? SF.state.brandF.b : "";
          return '<div class="chips brandf" role="group" aria-label="' + t("sh.brand") + '"><button type="button" class="fchip' + (cur ? "" : " on") + '" data-act="brandf" data-r="' + r.id + '" data-v="">' + t("sh.allBrands") + "</button>" + bs.sort().map(function (b) { return '<button type="button" class="fchip' + (cur === b ? " on" : "") + '" data-act="brandf" data-r="' + r.id + '" data-v="' + esc(b) + '">' + esc(b) + "</button>"; }).join("") + "</div>"; })() +
        cats.map(function (k) { var bf = shop && SF.state.brandF && SF.state.brandF.r === r.id ? SF.state.brandF.b : ""; var list = r.products.filter(function (x) { return x.categoryId === k.id && (!bf || x.brand === bf); }); if (!list.length) return "";
          return '<section class="msec" id="sec-' + k.id + '" data-sec="' + k.id + '"><h2>' + esc(tx(k.name)) + '</h2><div class="pgrid">' + list.map(function (x) { return prodCard(x); }).join("") + "</div></section>"; }).join("") + "</div>" +
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
  SF.actions.addmq = function (el) { var p = cache[el.dataset.id]; if (tryAdd(p, SF.state.mq)) { SF.state.bump = true; SF.closeModal(); SF.toast(t("cart.added", { name: tx(p.name) })); SF.render({ quiet: true }); } };
  function tryAdd(p, n) {
    if (SF.cart.add(p, n)) { SF.state.cartSum = cartSum(); return true; }
    SF.modal('<div class="confirm"><span class="cic">' + I("cart", 28) + "</span><h2 class=\"h2\">" + t("cart.otherTitle") + "</h2><p class=\"muted\">" + t("cart.otherText") + '</p><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn primary" data-act="replacecart" data-id="' + p.id + '" data-n="' + (n || 1) + '">' + t("cart.replace") + "</button></div></div>");
    return false;
  }
  SF.actions.replacecart = function (el) { SF.cart.clear(); SF.state.promo = null; var p = cache[el.dataset.id]; SF.cart.add(p, +el.dataset.n); SF.state.cartSum = cartSum(); SF.closeModal(); SF.toast(t("cart.added", { name: tx(p.name) })); SF.render({ quiet: true }); };
  SF.actions.add = function (el) { var p = cache[el.dataset.id]; if (!p) return; if (tryAdd(p, 1)) { SF.state.bump = true; SF.render({ quiet: true }); } };
  SF.after.push(function () { if (!SF.state.bump) return; SF.state.bump = false; document.querySelectorAll(".tabbar .badge,#cartBadge,.floatcart i").forEach(function (b) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }); });
  SF.actions.dec = function (el) { SF.cart.dec(el.dataset.id); SF.state.cartSum = cartSum(); SF.render({ quiet: true }); };
  SF.actions.jump = function (el) { var s = document.getElementById("sec-" + el.dataset.v); if (s) { var y = s.getBoundingClientRect().top + window.scrollY - 130; window.scrollTo({ top: y, behavior: SF.reduced ? "auto" : "smooth" }); } };
  SF.after.push(function () { var tabs = document.getElementById("ctabs"); if (!tabs) { window.onscroll = null; return; }
    window.onscroll = function () { var cur = null; document.querySelectorAll("[data-sec]").forEach(function (s) { if (s.getBoundingClientRect().top < 150) cur = s.dataset.sec; });
      Array.prototype.forEach.call(tabs.children, function (b) { var on = b.dataset.v === cur || (!cur && b === tabs.firstChild); b.classList.toggle("on", on); if (on && tabs.scrollTo) tabs.scrollTo({ left: b.offsetLeft - 16, behavior: "auto" }); }); }; });

  /* ---------- Cart ---------- */
  SF.route("/cart", { title: "nav.cart", render: function () {
    var c = SF.cart.get(), ids = Object.keys(c.items);
    if (!ids.length) return '<h1 class="h2 pt">' + t("nav.cart") + "</h1>" + SF.empty(SF.art("plate", 110), t("cart.empty"), t("cart.emptySub"), '<a class="btn primary" href="#/food">' + t("cart.browse") + "</a>");
    return api().get("/restaurants/" + c.restaurantId).then(function (r) {
      remember(r.products); SF.state.ctxShop = r.kind === "shop"; var sum = cartSum(), promo = SF.state.promo, disc = promo ? promo.discount : 0;
      ids.forEach(function (k) { if (!cache[k] || !cache[k].available) { SF.cart.dec(k); } });
      return '<h1 class="h2 pt">' + t("nav.cart") + '</h1><div class="two"><div class="card"><div class="rowhead"><a href="#/r/' + r.id + '" class="rlink"><span class="rav" style="--tone:' + esc(r.tone) + '">' + (r.kind === "shop" ? (r.logo ? '<img src="' + esc(r.logo) + '" alt="">' : I("store", 22)) : SF.art(r.products[0] ? r.products[0].kind : "plate", 36)) + "</span><b>" + esc(tx(r.name)) + "</b></a>" +
        '<button class="link" data-act="clearcart">' + t("cart.clear") + "</button></div>" +
        ids.filter(function (k) { return cache[k]; }).map(function (k) { var p = cache[k]; return '<div class="cline"><span class="cim" style="--tone:' + esc(r.tone) + '">' + SF.pic(p, 52) + '</span><div class="cinfo"><b>' + esc(tx(p.name)) + '</b><span class="muted num">' + money(p.price) + "</span></div>" + stepper(p, c.items[k]) + '<b class="num csum">' + money(p.price * c.items[k]) + '</b><button class="iconbtn rmline" data-act="rmline" data-id="' + p.id + '" aria-label="' + t("cart.remove") + '">' + I("trash", 16) + "</button></div>"; }).join("") +
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
  SF.actions.rmline = function (el) { SF.cart.remove(el.dataset.id); SF.state.cartSum = cartSum(); SF.render({ quiet: true }); };
  SF.actions.clearcart = function () { SF.cart.clear(); SF.state.promo = null; SF.render(); };
  SF.actions.unpromo = function () { SF.state.promo = null; SF.render({ quiet: true }); };
  SF.forms.promo = function (fd) { var code = String(fd.code || "").trim(); if (!code) return;
    return api().post("/promos/validate", { code: code, subtotal: cartSum() }).then(function (r) { SF.state.promo = r; SF.toast(t("cart.promoOk", { code: r.code, sum: money(r.discount) })); SF.render({ quiet: true }); }); };
  SF.actions.tocheckout = function () { if (!SF.state.user) { SF.state.after = "/checkout"; SF.toast(t("auth.needLogin"), "info"); SF.go("/login"); return; }
    if (SF.state.user.role !== "customer") { SF.toast(t("auth.customerOnly"), "err"); return; } SF.go("/checkout"); };

  /* ---------- Checkout ---------- */
  function co() { var u = SF.state.user || {}; SF.state.co = SF.state.co || { name: u.name || "", text: "", landmark: "", lat: null, lng: null, phone: u.phone ? u.phone.slice(4) : "", comment: "", pay: "cash", quote: null }; return SF.state.co; }
  function fixPay(r) { var x = co(), pub = SF.state.pub, ok = { transfer: pub.transferEnabled && r.payCard, cash: pub.cashEnabled, card: pub.cardEnabled };
    if (!ok[x.pay]) x.pay = ok.transfer ? "transfer" : ok.cash ? "cash" : ok.card ? "card" : null; }
  /* «how do I pay?» — three steps, and the admin's number to ask «did you get my money?» */
  SF.payHelp = function (o) {
    var ph = (SF.state.pub || {}).supportPhone, rp = o && o.restaurant && o.restaurant.phone;
    return '<section class="payhelp"><b>' + I("help", 16) + t("ph.title") + '</b><ol><li>' + t("ph.1") + "</li><li>" + t("ph.2") + "</li><li>" + t("ph.3") + "</li></ol>" +
      (ph ? '<p class="phask">' + t("ph.ask") + '</p><button type="button" class="btn ok block" data-act="call" data-name="' + esc(SF.brand() + " · " + t("ph.admin")) + '" data-phone="' + esc(ph) + '" data-sub="' + esc(t("ph.callSub")) + '">' + I("phone", 18) + t("ph.call") + " · " + esc(SF.phone(ph)) + "</button>" : "") +
      (rp ? '<button type="button" class="btn ghost block" data-act="call" data-name="' + esc(tx(o.restaurant.name)) + '" data-phone="' + esc(rp) + '" data-sub="' + esc(t("ph.callSub")) + '">' + I("store", 16) + t("ph.callRest") + "</button>" : "") + "</section>"; };
  /* transfer to the restaurant's card: number to copy, exact amount, receipt photo (required) */
  function acctCards(r) { var pc = r.payCard; return (r.payAccounts && r.payAccounts.length ? r.payAccounts : [pc]).map(function (x, i) { var ph = x.kind === "phone", shown = ph ? SF.phone(x.number) : String(x.number).replace(/(\d{4})(?=\d)/g, "$1 "), raw = ph ? String(x.number).replace(/[^+\d]/g, "") : x.number;
        return '<div class="tcard"><small>' + I(ph ? "phone" : "card", 13) + " " + t(ph ? "pa.phone" : "tr.card") + (x.bank ? " · " + esc(x.bank) : "") + '</small><code class="num"' + (i ? "" : ' id="callnum"') + ">" + esc(shown) + "</code>" + (x.holder ? "<span>" + esc(x.holder) + "</span>" : "") +
          '<button type="button" class="btn sm ghost" data-act="copynum" data-v="' + esc(raw) + '">' + I("copy", 14) + t("cour.copy") + "</button></div>"; }).join(""); }
  function transferBox(r, qt) {
    var x = co(), pc = r.payCard, num = pc.number.replace(/(\d{4})(?=\d)/g, "$1 ");
    return '<div class="transfer"><ol class="tsteps"><li>' + t("tr.s1") + "</li><li>" + t("tr.s2") + "</li><li>" + t("tr.s3") + "</li></ol>" +
      /* every card / wallet number of the restaurant, each with its bank, to copy */
      acctCards(r) +
      '<div class="tsum"><span>' + t("tr.amount") + '</span><b class="num">' + (qt.deliveryFee != null ? money(qt.total) : t("co.pinFirst")) + "</b></div>" +
      '<label class="upload' + (x.receipt ? " done" : "") + '">' + (x.receipt ? '<img src="' + x.receipt + '" alt="' + t("tr.receipt") + '"><span>' + I("check", 16) + t("tr.uploaded") + "</span><small>" + t("tr.change") + "</small>" : I("receipt", 22) + "<b>" + t("tr.upload") + "</b><small>" + t("tr.uploadSub2") + "</small>") +
      '<input type="file" accept="image/*" data-input="receipt" id="receipt-file"></label>' + SF.payHelp({ restaurant: r }) + '</div>';
  }
  /* shrink the photo before upload: long side 1200 px, JPEG */
  function shrinkReceipt(el, done) {
    var f = el.files && el.files[0]; if (!f) return; if (!/^image\//.test(f.type)) { SF.toast(t("tr.notImage"), "err"); return; }
    var rd = new FileReader(); rd.onload = function () { var img = new Image(); img.onload = function () {
      var k = Math.min(1, 1200 / Math.max(img.width, img.height)), cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      done(cv.toDataURL("image/jpeg", 0.75)); };
      img.onerror = function () { SF.toast(t("tr.notImage"), "err"); }; img.src = rd.result; }; rd.readAsDataURL(f);
  }
  SF.inputs.receipt = function (v, el) { shrinkReceipt(el, function (d) { co().receipt = d; SF.render({ quiet: true }); }); };
  SF.inputs.payrc = function (v, el) { shrinkReceipt(el, function (d) { SF.state.payRc = SF.state.payRc || {}; SF.state.payRc[el.dataset.id] = d; SF.render({ quiet: true }); }); };
  SF.route("/checkout", { roles: ["customer"], title: "co.title", render: function () {
    var c = SF.cart.get(), x = co(); if (!SF.cart.count()) { SF.go("/cart"); return ""; }
    return api().get("/restaurants/" + c.restaurantId).then(function (r) {
      remember(r.products); var city = (SF.state.cities || []).filter(function (z) { return z.id === r.cityId; })[0] || { lat: r.lat, lng: r.lng };
      var body = { restaurantId: r.id, items: Object.keys(c.items).map(function (k) { return { productId: k, qty: c.items[k] }; }), promoCode: SF.state.promo ? SF.state.promo.code : null, address: x.lat != null && inZone(x, r.cityId) ? { lat: x.lat, lng: x.lng } : {} };
      if (!r.pickup) x.pickup = false; if (x.pickup) { body.pickup = true; body.address = {}; }
      return api().post("/orders/quote", body).then(function (qt) { x.quote = qt; return [r, city, qt]; });
    }).then(function (a) {
      var r = a[0], city = a[1], qt = a[2], u = SF.state.user, addrs = u.addresses || [], zone = SF.restZone(r), x = co(); SF.state.coRest = r; fixPay(r); SF.state.ctxShop = r.kind === "shop";
      return '<a class="backlink" href="#/cart">' + I("chevL", 18) + t("nav.cart") + '</a><h1 class="h2">' + t("co.title") + '</h1><div class="two"><div class="stack">' +
        '<section class="card"><h3><span class="num stepn">1</span>' + t(x.pickup ? "sh.howGet" : "co.address") + "</h3>" +
        /* a place that allows it: «a courier brings it» or «I pick it up myself» */
        (r.pickup ? '<div class="seg cowho">' + '<button type="button" class="' + (x.pickup ? "" : "on") + '" data-act="copick" data-v="0">' + I("scooter", 16) + t("sh.courier") + '</button><button type="button" class="' + (x.pickup ? "on" : "") + '" data-act="copick" data-v="1">' + I("store", 16) + t("sh.pickup") + "</button></div>" : "") +
        (x.pickup ? '<div class="pickbox">' + I("store", 22) + "<div><b>" + esc(tx(r.name)) + "</b><span>" + esc(tx(r.address) || "") + "</span><small>" + t("sh.pickupHint", { from: r.hours.from, to: r.hours.to }) + "</small></div>" + SF.callBtn(tx(r.name), r.phone, tx(r.address)) + "</div>" +
            '<div class="mapbox">' + SF.tmap({ key: "copk", center: { lat: r.lat, lng: r.lng }, zoom: 16, markers: [{ lat: r.lat, lng: r.lng, type: "rest", label: "R" }], label: t("sh.pickup") }) + "</div>" +
            '<p class="fine">' + I("info", 14) + t("sh.route") + ' <a class="link" target="_blank" rel="noopener" href="' + SF.geo.nav({ lat: r.lat, lng: r.lng }).google + '">Google</a> · <a class="link" target="_blank" rel="noopener" href="' + SF.geo.nav({ lat: r.lat, lng: r.lng }).yandex + '">Yandex</a></p></section>'
        : (addrs.length ? '<div class="tags">' + addrs.map(function (ad, i) { return '<button class="chip" data-act="useaddr" data-i="' + i + '">' + I("pin", 14) + esc(ad.text) + "</button>"; }).join("") + "</div>" : "") +
        SF.mapFind("co") + '<div class="mapbox">' + SF.tmap({ key: "co", picker: true, center: x.lat != null ? x : zone, zoom: x.lat != null ? 17 : 14, zone: zone, markers: [{ lat: r.lat, lng: r.lng, type: "rest", label: "R" }].concat(SF.state.geo ? [{ lat: SF.state.geo.lat, lng: SF.state.geo.lng, acc: SF.state.geo.acc, type: "me" }] : []), label: t("co.pinTitle"), onMove: pinMoved }) + "</div>" +
        '<div class="pinread' + (x.lat == null ? " hint" : !inZone(x, r.cityId) ? " bad" : "") + '" id="pinread">' + (x.lat != null ? pinText(x, r.cityId) : I("pin", 16) + "<span>" + t("co.pinHelp") + "</span>") + "</div>" +
        (SF.state.geo && SF.state.geo.acc > 80 ? '<div class="msg warn">' + I("info", 16) + "<span>" + t("geo.rough", { m: Math.round(SF.state.geo.acc) }) + "</span></div>" : "") +
        '<div class="geotools"><button type="button" class="btn ghost sm" data-act="geoloc">' + I("locate", 16) + t("co.myLoc") + '</button><form class="llform" data-form="coords"><label class="f grow">' + t("co.pasteLL") + '<span class="llrow"><input name="ll" id="co-ll" placeholder="' + t("co.pastePh") + '" autocomplete="off"><button class="btn sm">' + I("link", 16) + t("co.show") + "</button></span></label></form></div>" +
        '<div class="grid2"><label class="f">' + t("co.street") + '<input data-input="co" data-k="text" value="' + esc(x.text) + '" placeholder="' + t("co.streetPh") + '" autocomplete="street-address"></label><label class="f">' + t("co.landmark") + '<input data-input="co" data-k="landmark" value="' + esc(x.landmark) + '" placeholder="' + t("co.landmarkPh") + '"></label></div></section>') +
        '<section class="card"><h3><span class="num stepn">2</span>' + t("co.contact") + '</h3><div class="grid2"><label class="f">' + t("profile.name") + '<input data-input="co" data-k="name" value="' + esc(x.name) + '" autocomplete="name" placeholder="' + t("co.namePh") + '"></label><label class="f">' + t("auth.phone") + '<span class="phonein"><i>+992</i><input data-input="co" data-k="phone" value="' + esc(x.phone) + '" inputmode="tel" placeholder="90 123 45 67" autocomplete="tel-national"></span></label><label class="f full">' + t("co.comment") + '<input data-input="co" data-k="comment" value="' + esc(x.comment) + '" placeholder="' + t("co.commentPh") + '"></label></div></section>' +
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
  SF.actions.copick = function (el) { co().pickup = el.dataset.v === "1"; SF.render({ quiet: true }); };
  SF.actions.paym = function (el) { co().pay = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.useaddr = function (el) { var a = (SF.state.user.addresses || [])[+el.dataset.i]; if (!a) return; Object.assign(co(), { text: a.text, landmark: a.landmark || "", lat: a.lat, lng: a.lng }); delete SF.state.tmv.co; SF.render({ quiet: true }); };
  /* checkout: the restaurant's own area if the admin drew one, else the town's */
  function zoneOf(cityId) { var r = SF.state.coRest; return r ? SF.restZone(r) : SF.zone(cityId || SF.state.cityId); }
  function inZone(p, cityId) { return SF.inZoneOf(p, zoneOf(cityId)); }
  function pinText(p, cityId) { var z = zoneOf(cityId), km = Math.round(SF.geo.km(z, p) * 10) / 10;
    if (z.poly) return inZone(p, cityId) ? I("check", 16) + "<span>" + t("co.inZone", { km: km, city: z.name }) + "</span>" : I("info", 16) + "<span>" + t("e.OUT_OF_AREA") + "</span>";
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
    return new Promise(function (done) { navigator.geolocation.getCurrentPosition(function (pos) { var acc = pos.coords.accuracy || 0;
        SF.state.geo = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: acc, at: Date.now() }; SF.tmapCenter("co", SF.state.geo, acc > 300 ? 15 : 17);
        SF.toast(acc > 80 ? t("geo.rough", { m: Math.round(acc) }) : t("geo.found"), acc > 80 ? "info" : "ok"); done(); },
      function () { SF.toast(t("geo.denied"), "err"); done(); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }); });
  };
  /* checkout opened without a pin: if the phone already allows location, find it at once (no question asked) */
  SF.after.push(function () { if (!/^\/checkout/.test(SF.path()) || !document.querySelector('[data-tmap="co"]')) return; var x = SF.state.co;
    if (!x || x.lat != null || SF.state.geoTried || !navigator.permissions || !navigator.geolocation) return; SF.state.geoTried = true;
    navigator.permissions.query({ name: "geolocation" }).then(function (st) { if (st.state === "granted") SF.actions.geoloc(); }).catch(function () {}); });
  SF.forms.coords = function (fd) { var p = SF.geo.parse(fd.ll); if (!p) { SF.toast(t("geo.bad"), "err"); return; } SF.tmapCenter("co", p, 17); SF.toast(t("geo.found")); };
  SF.actions.placeorder = function () {
    var x = co(), c = SF.cart.get(); if (SF.state.placing) return;
    if (String(x.name || "").trim().length < 2) { SF.toast(t("e.BAD_NAME"), "err"); return; }
    var pick = !!(x.pickup && SF.state.coRest && SF.state.coRest.pickup);
    if (!pick && x.lat == null) { SF.toast(t("e.ADDRESS_PIN_REQUIRED"), "err"); return; }
    if (!pick && !inZone(x, x.cityId)) { var z = zoneOf(x.cityId); if (z.poly) { SF.toast(t("e.OUT_OF_AREA"), "err"); return; } SF.toast(t("e.OUT_OF_ZONE", { km: Math.round(SF.geo.km(z, x) * 10) / 10, max: z.km }), "err"); return; }
    if (!x.pay) { SF.toast(t("e.PAY_METHOD_OFF"), "err"); return; }
    var body = { restaurantId: c.restaurantId, items: Object.keys(c.items).map(function (k) { return { productId: k, qty: c.items[k] }; }), address: pick ? {} : { text: x.text, landmark: x.landmark, lat: x.lat, lng: x.lng }, pickup: pick || undefined,
      name: String(x.name || "").trim(), phone: x.phone, comment: x.comment, paymentMethod: x.pay, receipt: x.pay === "transfer" ? x.receipt : undefined, promoCode: SF.state.promo ? SF.state.promo.code : null };
    SF.state.placing = true; document.querySelectorAll("[data-act=placeorder]").forEach(function (b) { b.disabled = true; });
    return api().post("/orders", body).then(function (o) { SF.cart.clear(); SF.state.promo = null; x.comment = ""; x.receipt = null; SF.state.cartSum = 0; SF.state.justPlaced = o.id;
      return SF.api.get("/auth/me").then(function (u) { SF.state.user = u; SF.go(o.status === "awaiting_payment" ? "/pay/" + o.id : "/o/" + o.id); }); })
      .then(function () { SF.state.placing = false; }, function (e) { SF.state.placing = false; document.querySelectorAll("[data-act=placeorder]").forEach(function (b) { b.disabled = false; }); throw e; });
  };

  /* ---------- Payment (mock provider; see apps/api/src/payments) ---------- */
  SF.route("/pay/:id", { roles: ["customer"], title: "pay.title", render: function (p) {
    return api().get("/orders/" + p.id).then(function (o) {
      if (o.status !== "awaiting_payment") { SF.go("/o/" + o.id); return ""; }
      if (o.payment.method === "transfer") return api().get("/restaurants/" + o.restaurantId).then(function (r) { return payTransfer(o, r); });
      var cd = SF.state.card || (SF.state.card = { num: "", exp: "", cvc: "", name: "" });
      return '<div class="paywrap"><h1 class="h2">' + t("pay.title") + '</h1><p class="muted">' + t("pay.sub", { n: o.number, sum: money(o.total) }) + "</p>" +
        '<div class="ccard"><div class="ccchip"></div><span class="ccnum num" id="ccnum">' + esc(fmtCard(cd.num) || "•••• •••• •••• ••••") + '</span><div class="ccrow"><span>' + esc(cd.name || t("pay.holder")) + '</span><span class="num">' + esc(cd.exp || "MM/YY") + '</span></div><span class="ccbrand">' + SF.mark(30) + "</span></div>" +
        '<form class="card stack" data-form="pay" data-id="' + o.id + '"><div class="provs">' + [["mock", t("pay.provCard")], ["korti", t("pay.provKorti")], ["wallet", t("pay.provWallet")]].map(function (x, i) { return '<span class="chip' + (i ? " dis" : " on") + '">' + x[1] + (i ? " · " + t("pay.soon") : "") + "</span>"; }).join("") + "</div>" +
        '<label class="f">' + t("pay.number") + '<input name="cardNumber" data-input="card" data-k="num" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" value="' + esc(fmtCard(cd.num)) + '" required></label>' +
        '<div class="grid2"><label class="f">' + t("pay.exp") + '<input name="exp" data-input="card" data-k="exp" placeholder="12/28" autocomplete="cc-exp" value="' + esc(cd.exp) + '" required></label><label class="f">CVC<input name="cvc" data-input="card" data-k="cvc" inputmode="numeric" maxlength="3" placeholder="123" autocomplete="cc-csc" required></label></div>' +
        '<button class="btn primary block lg">' + I("shield", 18) + t("pay.payBtn", { sum: money(o.total) }) + '</button><p class="fine">' + t("pay.test") + '</p><button type="button" class="link" data-act="paycancel" data-id="' + o.id + '">' + t("pay.cancel") + "</button></form></div>";
    });
  } });
  /* «Оплата» for a transfer order: numbers to copy, the exact amount, the receipt photo → the restaurant is told */
  function payTransfer(o, r) { var rc = (SF.state.payRc || {})[o.id], shop = r.kind === "shop"; SF.state.ctxShop = shop;
    return '<div class="paywrap"><a class="backlink" href="#/o/' + o.id + '">' + I("chevL", 18) + "№" + o.number + "</a><h1 class=\"h2\">" + t("pay.title") + '</h1><p class="muted">' + esc(tx(r.name)) + '</p>' +
      '<section class="card stack"><div class="paybig"><small>' + t("tr.amount") + '</small><b class="num">' + money(o.total) + "</b></div><ol class=\"tsteps\"><li>" + t("tr.s1") + "</li><li>" + t("tr.s2") + "</li><li>" + t("tr.s3") + "</li></ol>" + acctCards(r) +
      '<label class="upload' + (rc ? " done" : "") + '">' + (rc ? '<img src="' + rc + '" alt="' + t("tr.receipt") + '"><span>' + I("check", 16) + t("tr.uploaded") + "</span><small>" + t("tr.change") + "</small>" : I("receipt", 22) + "<b>" + t("tr.upload") + "</b><small>" + t("tr.uploadSub") + "</small>") +
      '<input type="file" accept="image/*" data-input="payrc" data-id="' + o.id + '"></label>' +
      '<button type="button" class="btn primary block lg" data-act="paysend" data-id="' + o.id + '"' + (rc ? "" : " disabled") + ">" + I("check", 18) + t("pay.sent") + "</button>" +
      SF.payHelp({ restaurant: o.restaurant }) +
      '<button type="button" class="link" data-act="paycancel" data-id="' + o.id + '">' + t("pay.cancel") + "</button></section></div>"; }
  SF.actions.paysend = function (el) { var rc = (SF.state.payRc || {})[el.dataset.id]; if (!rc) { SF.toast(t("e.RECEIPT_REQUIRED"), "err"); return; }
    return api().post("/orders/" + el.dataset.id + "/receipt", { receipt: rc }).then(function () { delete SF.state.payRc[el.dataset.id]; SF.toast(t("pay.sentOk")); SF.go("/o/" + el.dataset.id); }); };
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
      var r = o.restaurant, city = (SF.state.cities || []).filter(function (c) { return c.id === o.cityId; })[0] || r; SF.state.ctxShop = !!(r && r.kind === "shop");
      var fin = ["rejected", "cancelled"].indexOf(o.status) >= 0, done = o.status === "delivered", moving = !fin && !done && !!o.courier;
      var steps = [["trk.1", "receipt"], ["trk.2", "fire"], ["trk.3", "bag"], ["trk.4", "box"], ["trk.5", "scooter"], ["trk.6", "home"]], cur = { pending: 0, cooking: 1, ready: 2, picked_up: 4, delivered: 5 }[o.status];
      var cp = o.courierPos, markers = [{ lat: r.lat, lng: r.lng, type: "rest", label: "R" }, { lat: o.address.lat, lng: o.address.lng, type: "home", label: "" }];
      var gps = cp && cp.live; if (gps && !done) markers.push({ lat: cp.lat, lng: cp.lng, type: "courier" });
      var map = fin || done ? "" : '<section class="card mapcard live-map">' + SF.tmap({ key: "o-" + o.id + "-" + (cp ? cp.leg : "none"), center: city, zone: SF.zone(o.cityId), fit: [gps && cp.leg === "to_customer" ? cp : r, o.address].concat(gps && cp.leg !== "to_customer" ? [cp] : []), markers: markers, route: [gps ? cp : r, gps && cp.leg !== "to_customer" ? r : o.address], label: t("track.map") }) +
        (gps ? '<div class="mapchip"><span class="dotlive on"></span><b>' + t("cr.chip." + cp.leg, { km: cp.km, min: cp.etaMin }) + "</b></div>" : o.courier ? '<div class="mapchip"><span class="dotlive"></span><b>' + t("trk.noGps") + "</b></div>" : "") +
        '<div class="legend"><span><i class="lg-r"></i>' + esc(tx(r.name)) + '</span><span><i class="lg-h"></i>' + t("track.you") + "</span>" + (gps ? '<span><i class="lg-c"></i>' + t("track.courier") + "</span>" : "") + "</div></section>";
      var status = '<section class="card live"><div class="lhero s-' + o.status + (moving ? " small" : "") + '">' + (HERO[o.status] || "") + (!fin && !done ? '<span class="eta num">≈ ' + etaOf(o) + " " + t("u.min") + "</span>" : "") + (done && Date.now() - (o.updatedAt || o.createdAt) < 15 * 60000 ? confetti() : "") + "</div>" +
        '<div class="lbody"><span class="muted num">№' + o.number + " · " + esc(tx(r.name)) + "</span><h1 class=\"h2\">" + t("track.h." + o.status) + "</h1><p class=\"muted\">" + t("track.p." + o.status, { min: o.prepMin, sum: money(o.total) }) + "</p>" +
        (o.payment.method === "transfer" && o.payment.status === "review" ? '<div class="msg info">' + I("receipt", 16) + t("tr.checking") + "</div>" + SF.payHelp(o) : "") +
        (o.status === "rejected" && o.rejectReason ? '<div class="msg err">' + I("info", 16) + esc(o.rejectReason) + "</div>" : "") +
        (fin ? "" : '<ol class="steps">' + steps.map(function (s, i) { var st = i < cur || done ? "done" : i === cur ? "now" : ""; return '<li class="' + st + '"><span>' + I(st === "done" ? "check" : s[1], 16) + "</span><small>" + t(s[0]) + "</small></li>"; }).join("") + "</ol>") +
        (o.status === "awaiting_payment" ? '<div class="msg warn">' + I("wallet", 16) + t(o.payment.method === "transfer" ? "pay.waitRc" : "pay.waitCard") + '</div><a class="btn primary block lg paybtn" href="#/pay/' + o.id + '">' + I("wallet", 18) + t("pay.payBtn", { sum: money(o.total) }) + "</a>" : "") +
        (["pending", "awaiting_payment"].indexOf(o.status) >= 0 ? '<button class="btn ghost" data-act="cancelorder" data-id="' + o.id + '">' + t("track.cancel") + "</button>" : "") + "</div></section>";
      var fresh = SF.state.justPlaced === o.id && !fin && !done;
      var conf = fresh ? '<section class="card confirm2"><span class="okmark">' + I("check", 34) + '</span><div class="grow"><h1 class="h2">' + t("ok.title") + '</h1><p class="muted">' + t("ok.sub", { name: esc(tx(r.name)) }) + '</p></div><div class="onum"><small>' + t("ok.number") + '</small><b class="num">№' + o.number + "</b></div></section>" : "";
      var html = '<a class="backlink" href="#/orders">' + I("chevL", 18) + t("nav.orders") + "</a>" + conf + '<div class="two track"><div class="stack">' +
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
    /* «I pick it up myself»: where to come, when it is ready */
    if (o.pickup) { var rr = o.restaurant || {}, ready = o.status === "ready" || o.status === "picked_up", done = o.status === "delivered";
      return '<section class="card ccard2 pickcard' + (ready ? " ready" : "") + '"><span class="pic">' + I("store", 22) + '</span><div class="grow"><b>' + t(done ? "sh.taken" : ready ? "sh.readyCome" : "sh.prepWait") + "</b><span>" + esc(tx(rr.name || "")) + (o.address && o.address.text ? " · " + esc(o.address.text) : "") + "</span></div>" +
        (o.address && o.address.lat != null && !done ? '<a class="btn sm ghost" target="_blank" rel="noopener" href="' + SF.geo.nav(o.address).google + '">' + I("route", 14) + t("sh.go") + "</a>" : "") + SF.callBtn(tx(rr.name || ""), rr.phone, "") + "</section>"; }
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
      '<div class="cstage leg-' + leg + '"><span class="cst-ic">' + I({ to_restaurant: "store", at_restaurant: "bag", to_customer: "scooter", done: "check" }[leg], 18) + '</span><div class="grow"><b>' + t("cr.leg." + leg) + "</b>" + (cp && cp.live && leg !== "done" && leg !== "at_restaurant" ? '<small class="num">' + t("cr.dist", { km: cp.km, min: cp.etaMin }) + "</small>" : "") + "</div></div>" +
      '<div class="cbadges">' + (leg === "done" ? "" : '<span class="pill ' + (has ? "p-ok" : "p-mut") + '">' + I(has ? "check" : "clock", 14) + t(has ? "cr.has" : "cr.hasNot") + "</span>") + (cp && cp.live && leg !== "done" ? '<span class="pill p-mut"><i class="dotlive on"></i>' + t("cr.gps") + "</span>" : "") + "</div></section>";
  }
  function timeline(o) {
    var ev = [{ at: o.createdAt, k: "tl.created" }];
    o.history.forEach(function (h) { var k = { cooking: "tl.accepted", ready: "tl.ready", picked_up: "tl.picked", delivered: "tl.delivered", rejected: "tl.rejected", cancelled: "tl.cancelled" }[h.status]; if (k) ev.push({ at: h.at, k: k }); });
    if (o.assignedAt && o.courier) ev.push({ at: o.assignedAt, k: "tl.assigned", p: { name: o.courier.name } });
    ev.sort(function (a, b) { return a.at - b.at; });
    return '<section class="card tline"><h3>' + t("tl.title") + '</h3><ol>' + ev.map(function (e, i) { return '<li class="' + (i === ev.length - 1 ? "last" : "") + '"><span class="num">' + SF.time(e.at) + "</span><b>" + esc(t(e.k, e.p)) + "</b></li>"; }).join("") + "</ol></section>";
  }
  function confetti() { var c = ["#E8590C", "#F7C948", "#1F7A4D", "#1F5FA8", "#fff"], h = '<div class="confetti" aria-hidden="true">'; for (var i = 0; i < 18; i++) h += '<i style="left:' + ((i * 37) % 100) + "%;background:" + c[i % 5] + ";animation-delay:" + ((i % 6) * 0.18).toFixed(2) + "s;animation-duration:" + (1.6 + (i % 4) * 0.3).toFixed(1) + 's"></i>'; return h + "</div>"; }
  /* the review card, shared with the table page: stars for the food and the courier / waiter, like / dislike for each dish */
  SF.reviewForm = function (o, act) { return reviewForm(o, act); };
  function reviewForm(o, act) { var rv = SF.state.rv && SF.state.rv.o === o.id ? SF.state.rv : (SF.state.rv = { o: o.id, rating: 0, courierRating: 0, waiterRating: 0, likes: {}, comment: "" });
    function dishes() { var seen = {}; return '<div class="rvdishes"><p class="lbl">' + t("rv.dishes") + "</p>" + o.items.filter(function (it) { if (seen[it.productId]) return false; seen[it.productId] = 1; return true; }).map(function (it) { var v = rv.likes[it.productId] || 0;
      return '<div class="rvdish"><span class="grow">' + esc(tx(it.name)) + '</span><button type="button" class="lk' + (v > 0 ? " on" : "") + '" data-act="rvlike" data-id="' + it.productId + '" data-v="1" aria-pressed="' + (v > 0) + '" aria-label="' + t("rv.like") + '">' + I("thumbup", 20) + '</button><button type="button" class="lk dn' + (v < 0 ? " on" : "") + '" data-act="rvlike" data-id="' + it.productId + '" data-v="-1" aria-pressed="' + (v < 0) + '" aria-label="' + t("rv.dislike") + '">' + I("thumbdown", 20) + '</button></div>'; }).join("") + "</div>"; }
    function row(k, label) { return '<div class="rvrow"><span>' + label + '</span><div class="starbtns" role="radiogroup" aria-label="' + esc(label) + '">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" role="radio" aria-checked="' + (rv[k] === n) + '" class="' + (rv[k] >= n ? "on" : "") + '" data-act="star" data-k="' + k + '" data-v="' + n + '" aria-label="' + n + '">' + I("star", 26) + "</button>"; }).join("") + "</div></div>"; }
    return '<section class="card review"><h3>' + t("rv.title") + "</h3>" + row("rating", t("rv.food")) + (o.courier ? row("courierRating", t("rv.courier")) : "") + (o.waiter ? row("waiterRating", t("rv.waiter", { name: esc(o.waiter.name) })) : "") + dishes() +
      '<label class="f">' + t("rv.comment") + '<input data-input="rv" value="' + esc(rv.comment) + '" placeholder="' + t("rv.commentPh") + '"></label><button class="btn primary" data-act="' + (act || "sendreview") + '" data-id="' + o.id + '">' + t("rv.send") + "</button></section>"; }
  SF.actions.star = function (el) { SF.state.rv[el.dataset.k] = +el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.rvlike = function (el) { var l = SF.state.rv.likes, v = +el.dataset.v; l[el.dataset.id] = l[el.dataset.id] === v ? 0 : v; SF.render({ quiet: true }); };
  SF.rvBody = function () { var rv = SF.state.rv; if (!rv.rating) throw { code: "BAD_RATING" }; var likes = {}; Object.keys(rv.likes).forEach(function (k) { if (rv.likes[k]) likes[k] = rv.likes[k]; });
    return { rating: rv.rating, courierRating: rv.courierRating || null, waiterRating: rv.waiterRating || null, likes: likes, comment: rv.comment }; };
  SF.inputs.rv = function (v) { SF.state.rv.comment = v; };
  SF.actions.sendreview = function (el) { var body; try { body = SF.rvBody(); } catch (e) { SF.toast(SF.err(e), "err"); return; } return api().post("/orders/" + el.dataset.id + "/review", body).then(function () { SF.state.rv = null; SF.toast(t("rv.thanks")); SF.render({ quiet: true }); }); };
  SF.actions.cancelorder = function (el) { return api().post("/orders/" + el.dataset.id + "/cancel").then(function () { SF.toast(t("track.cancelled"), "info"); SF.render({ quiet: true }); }); };

  /* ---------- Orders ---------- */
  SF.route("/orders", { roles: ["customer"], live: true, title: "nav.orders", render: function () {
    return api().get("/orders/my").then(function (list) {
      var act = list.filter(function (o) { return SomonRules.ACTIVE.indexOf(o.status) >= 0; }), past = list.filter(function (o) { return act.indexOf(o) < 0; });
      return '<h1 class="h2 pt">' + t("nav.orders") + "</h1>" + (!list.length ? SF.empty(SF.art("plov", 100), t("orders.none"), t("orders.noneSub"), '<a class="btn primary" href="#/food">' + t("cart.browse") + "</a>") : "") +
        (act.length ? '<div class="sect"><h2>' + t("orders.active") + '</h2></div><div class="olist">' + act.map(function (o) { var pr = { awaiting_payment: 5, pending: 15, cooking: 45, ready: 65, picked_up: 85 }[o.status];
          return '<a class="ocard live" href="#/o/' + o.id + '"><span class="cim" style="--tone:' + esc(o.restaurant.tone) + '">' + SF.pic(o.items[0], 52) + '</span><div class="grow"><div class="rrow"><b>' + esc(tx(o.restaurant.name)) + "</b>" + SF.statusPill(o.status) + '</div><span class="muted num">№' + o.number + " · " + money(o.total) + '</span>' + (o.status === "awaiting_payment" ? '<span class="paychip">' + I("wallet", 13) + t("pay.payNow") + "</span>" : '<span class="bar"><i style="width:' + pr + '%"></i></span>') + '</div>' + I("chevR", 18) + "</a>"; }).join("") + "</div>" : "") +
        (past.length ? '<div class="sect"><h2>' + t("orders.history") + '</h2></div><div class="olist">' + past.map(function (o) {
          return '<div class="ocard past"><a class="ohit" href="#/o/' + o.id + '" aria-label="№' + o.number + '"></a><span class="cim" style="--tone:' + esc(o.restaurant.tone) + '">' + SF.pic(o.items[0], 44) + '</span><div class="grow"><b class="oname">' + esc(tx(o.restaurant.name)) + '</b><span class="muted num">' + SF.dt(o.createdAt) + '</span><span class="ometa">' + SF.statusPill(o.status) + (o.review ? SF.stars(o.review.rating) : "") + "</span></div>" +
            '<div class="oside"><b class="num">' + money(o.total) + "</b>" + (o.status === "delivered" ? '<button class="btn sm ghost" data-act="reorder" data-id="' + o.id + '">' + I("route", 14) + t("orders.repeat") + "</button>" : "") + "</div></div>"; }).join("") + "</div>" : "");
    });
  } });
  SF.actions.reorder = function (el) { return api().get("/orders/" + el.dataset.id).then(function (o) { return api().get("/restaurants/" + o.restaurantId).then(function (r) { remember(r.products); SF.cart.clear();
    o.items.forEach(function (it) { var p = cache[it.productId]; if (p && p.available) SF.cart.add(p, it.qty); }); SF.state.cartSum = cartSum(); SF.toast(t("orders.repeated")); SF.go("/cart"); }); }); };

  /* ---------- Profile ---------- */
  var KIND_IC = { home: "home", work: "briefcase", other: "pin" };
  function prow(icon, label, attrs, right, cls) { var a = attrs.indexOf("href=") >= 0; return "<" + (a ? "a" : 'button type="button"') + ' class="prow' + (cls ? " " + cls : "") + '" ' + attrs + '><span class="pic">' + I(icon, 21) + '</span><span class="grow">' + label + "</span>" + (right || "") + I("chevR", 18) + "</" + (a ? "a" : "button") + ">"; }
  function avatar(u, cls) { return '<span class="pava' + (cls ? " " + cls : "") + '">' + (u.avatar ? '<img src="' + esc(u.avatar) + '" alt="">' : esc(u.name.charAt(0))) + "</span>"; }
  SF.route("/profile", { roles: ["customer"], title: "nav.profile", render: function () {
    var u = SF.state.user, pub = SF.state.pub || {}, city = tx(((SF.state.cities || []).filter(function (c) { return c.id === SF.state.cityId; })[0] || {}).name), fv = u.favs || {};
    return api().get("/orders/my").then(function (list) { var done = list.filter(function (o) { return o.status === "delivered"; }), b = String(window.SOMON_BUILD || ""), nf = (fv.r || []).length + (fv.p || []).length;
      return '<div class="profile2"><section class="phead2"><label class="avup" aria-label="' + t("pf.photo") + '">' + avatar(u) + '<i class="avcam">' + I("camera", 15) + '</i><input type="file" accept="image/*" data-input="avatar"></label>' +
          '<div class="grow"><b>' + esc(u.name) + '</b><span class="num muted">' + esc(SF.phone(u.phone)) + '</span><button type="button" class="link sm" data-act="editname">' + t("pf.editName") + "</button></div></section>" +
        '<div class="pstats"><a href="#/orders"><b class="num">' + list.length + "</b><small>" + t("orders.count") + '</small></a><div><b class="num">' + money(done.reduce(function (s, o) { return s + o.total; }, 0)) + "</b><small>" + t("orders.spent") + '</small></div><a href="#/favorites"><b class="num">' + nf + "</b><small>" + t("pf.favs") + "</small></a></div>" +
        '<nav class="plist card">' +
          prow("pin", t("pf.addresses"), 'href="#/addresses"', (u.addresses || []).length ? '<em class="num">' + u.addresses.length + "</em>" : "") +
          prow("receipt", t("pf.orders"), 'href="#/orders"') +
          (SF.LISTINGS ? Object.keys(SF.LISTINGS).filter(function (k) { return SF.svcOn(k); }).map(function (k) { return prow(SF.LISTINGS[k].icon, t("L.my." + k), 'href="#' + SF.LISTINGS[k].base + '/my"'); }).join("") : "") +
          prow("heart", t("pf.favs"), 'href="#/favorites"', nf ? '<em class="num">' + nf + "</em>" : "") +
          prow("ticket", t("pf.promos"), 'href="#/promos"') +
          prow("bell", t("n.title"), 'data-act="notes"', (SF.state.notes || []).length ? '<em class="num">' + SF.state.notes.length + "</em>" : "") +
          prow("wallet", t("pm.title"), 'data-act="paymethods"') + prow("grid", t("sa.all"), 'href="#/services"') +
        '</nav><nav class="plist card">' +
          prow("city", t("profile.city"), 'data-act="city"', '<i class="pval">' + esc(city) + "</i>") +
          '<label class="prow"><span class="pic">' + I("globe", 21) + '</span><span class="grow">' + t("profile.lang") + "</span>" + SF.langSel() + "</label>" +
          prow("lock", t("pf.password"), 'data-act="pwmodal"') + (SF.installCard() ? prow("download", t("pf.install"), 'href="/download"') : "") + prow("share", t("ib.shareRow"), 'data-act="shareapp"') +
          prow("help", t("pf.support"), 'data-act="call" data-name="' + esc(SF.brand()) + '" data-phone="' + esc(pub.supportPhone || "") + '" data-sub="' + esc(t("foot.support")) + '"') +
          (pub.demo ? prow("users", t("profile.demo"), 'data-act="demo"') : "") +
        '</nav><nav class="plist card">' + prow("logout", t("auth.logout"), 'data-act="logout"', "", "danger") + "</nav>" +
        (b ? '<p class="pver">' + esc(SF.brand()) + " · " + t("pf.version") + " " + b.slice(0, 4) + "." + b.slice(4, 6) + "." + b.slice(6, 8) + "</p>" : "") + "</div>";
    });
  } });
  SF.inputs.avatar = function (v, el) { var f = el.files && el.files[0]; if (!f) return;
    SF.shrinkImage(f, 480, 0.82).then(function (d) { return api().patch("/auth/me", { avatar: d }); }, function () { SF.toast(t("tr.notImage"), "err"); })
      .then(function (u) { if (u) { SF.state.user = u; SF.toast(t("btn.saved")); SF.render({ quiet: true }); } }); };
  SF.actions.editname = function () { var u = SF.state.user;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="name"><h2 class="h2">' + t("pf.editName") + '</h2><label class="f">' + t("profile.name") + '<input name="name" value="' + esc(u.name) + '" autocomplete="name" required minlength="2"></label>' +
      (u.avatar ? '<button type="button" class="btn ghost" data-act="avdel">' + I("trash", 16) + t("pf.photoDel") + "</button>" : "") + '<button class="btn primary block lg">' + t("btn.save") + "</button></form>"); };
  SF.actions.avdel = function () { return api().patch("/auth/me", { avatar: null }).then(function (u) { SF.state.user = u; SF.closeModal(); SF.render({ quiet: true }); }); };
  /* which ways to pay this service accepts — only the ones the admin really switched on */
  SF.actions.paymethods = function () { var p = SF.state.pub || {}, rows = [];
    if (p.cashEnabled) rows.push(["cash", "pm.cash", "pm.cashSub"]); if (p.transferEnabled) rows.push(["wallet", "pm.transfer", "pm.transferSub"]); if (p.cardEnabled) rows.push(["card", "pm.card", "pm.cardSub"]);
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><h2 class="h2">' + t("pm.title") + '</h2><p class="muted">' + t("pm.lead") + '</p><div class="plist card">' +
      rows.map(function (r) { return '<div class="prow"><span class="pic">' + I(r[0], 21) + '</span><span class="grow"><b>' + t(r[1]) + "</b><small>" + t(r[2]) + "</small></span>" + I("check", 18) + "</div>"; }).join("") + "</div>"); };
  SF.actions.pwmodal = function () { SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + "</button>" + SF.pwForm()); };
  SF.forms.name = function (fd) { return api().patch("/auth/me", { name: fd.name }).then(function (u) { SF.state.user = u; SF.closeModal(); SF.toast(t("btn.saved")); SF.render({ quiet: true }); }); };

  /* ---------- Saved addresses ---------- */
  SF.route("/addresses", { roles: ["customer"], title: "pf.addresses", render: function () {
    var list = SF.state.user.addresses || [];
    return '<a class="backlink" href="#/profile">' + I("chevL", 18) + t("nav.profile") + '</a><h1 class="h2 pt">' + t("pf.addresses") + "</h1>" +
      (list.length ? '<div class="alist">' + list.map(function (a, i) { var k = a.kind || "other";
        return '<div class="aitem"><span class="pic">' + I(KIND_IC[k], 21) + '</span><span class="grow"><b>' + t("addr." + k) + "</b><small>" + esc(a.text || "") + (a.landmark ? " · " + esc(a.landmark) : "") + "</small></span>" +
          '<button class="iconbtn" data-act="addrdel" data-i="' + i + '" aria-label="' + t("addr.del") + '">' + I("trash", 18) + "</button></div>"; }).join("") + "</div>"
        : SF.empty("pin", t("addr.none"), t("addr.noneSub"))) +
      '<a class="btn primary block lg addbtnwide" href="#/addresses/new">' + I("plus", 18) + t("addr.add") + "</a>";
  } });
  SF.actions.addrdel = function (el) { return api().del("/auth/me/addresses/" + el.dataset.i).then(function (u) { SF.state.user = u; SF.toast(t("addr.deleted")); SF.render({ quiet: true }); }); };
  function na() { return SF.state.na || (SF.state.na = { kind: "home", text: "", flat: "", landmark: "", lat: null, lng: null }); }
  SF.route("/addresses/new", { roles: ["customer"], title: "addr.new", render: function () {
    var x = na(), zone = SF.zone(SF.state.cityId);
    return '<a class="backlink" href="#/addresses">' + I("chevL", 18) + t("pf.addresses") + '</a><h1 class="h2 pt">' + t("addr.new") + '</h1><div class="newaddr">' +
      '<div class="kinds">' + ["home", "work", "other"].map(function (k) { return '<button type="button" class="kind' + (x.kind === k ? " on" : "") + '" data-act="addrkind" data-v="' + k + '" aria-pressed="' + (x.kind === k) + '">' + I(KIND_IC[k], 18) + t("addr." + k) + "</button>"; }).join("") + "</div>" +
      '<p class="muted sm">' + t("addr.where") + '</p>' + SF.mapFind("na") + '<div class="mapbox">' + SF.tmap({ key: "na", picker: true, center: x.lat != null ? x : zone, zoom: x.lat != null ? 17 : 14, zone: zone, markers: [], label: t("addr.where"), onMove: function (p, fin) { if (fin) { na().lat = p.lat; na().lng = p.lng; } } }) + "</div>" +
      '<button type="button" class="btn ghost sm" data-act="nageo">' + I("locate", 16) + t("co.myLoc") + "</button>" +
      '<div class="afields"><label class="f">' + t("addr.street") + '<input data-input="na" data-k="text" value="' + esc(x.text) + '" placeholder="' + t("co.streetPh") + '" autocomplete="street-address"></label>' +
      '<div class="grid2"><label class="f">' + t("addr.flat") + '<input data-input="na" data-k="flat" value="' + esc(x.flat) + '"></label><label class="f">' + t("co.landmark") + '<input data-input="na" data-k="landmark" value="' + esc(x.landmark) + '" placeholder="' + t("co.landmarkPh") + '"></label></div></div>' +
      '<button class="btn primary block lg" data-act="addrsave">' + t("addr.save") + "</button></div>";
  } });
  SF.inputs.na = function (v, el) { na()[el.dataset.k] = v; };
  SF.actions.addrkind = function (el) { na().kind = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.nageo = function () {
    if (!navigator.geolocation) { SF.toast(t("geo.denied"), "err"); return; } SF.toast(t("geo.wait"), "info");
    return new Promise(function (done) { navigator.geolocation.getCurrentPosition(function (pos) { var p = { lat: pos.coords.latitude, lng: pos.coords.longitude }, acc = pos.coords.accuracy || 0; na().lat = p.lat; na().lng = p.lng; SF.tmapCenter("na", p, acc > 300 ? 15 : 17);
        SF.toast(acc > 80 ? t("geo.rough", { m: Math.round(acc) }) : t("geo.found"), acc > 80 ? "info" : "ok"); done(); },
      function () { SF.toast(t("geo.denied"), "err"); done(); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }); });
  };
  SF.actions.addrsave = function () { var x = na();
    if (x.lat == null) { var v = SF.state.tmv && SF.state.tmv.na; if (v && v.lat != null) { x.lat = v.lat; x.lng = v.lng; } }
    if (x.lat == null) { SF.toast(t("e.ADDRESS_PIN_REQUIRED"), "err"); return; }
    var text = [x.text, x.flat].filter(function (q) { return String(q || "").trim(); }).join(", ");
    return api().post("/auth/me/addresses", { kind: x.kind, text: text, landmark: x.landmark, lat: x.lat, lng: x.lng }).then(function (u) { SF.state.user = u; SF.state.na = null; if (SF.state.tmv) delete SF.state.tmv.na; SF.toast(t("addr.saved")); SF.go("/addresses"); }); };

  /* ---------- Favourites ---------- */
  SF.route("/favorites", { roles: ["customer"], title: "pf.favs", render: function () {
    return api().get("/auth/me/favorites").then(function (f) { remember(f.products); var rs = withArt(f.restaurants, f.products);
      return '<a class="backlink" href="#/profile">' + I("chevL", 18) + t("nav.profile") + '</a><h1 class="h2 pt">' + t("pf.favs") + "</h1>" +
        (f.ads && f.ads.length && SF.adRow ? sect(t("sv.ads"), t("ads.n", { n: f.ads.length })) + '<div class="adlist">' + f.ads.map(function (a) { return SF.adRow(a); }).join("") + "</div>" : "") +
        (!rs.length && !f.products.length && !(f.ads || []).length ? SF.empty("heart", t("fav.none"), t("fav.noneSub"), '<a class="btn primary" href="#/food">' + t("cart.browse") + "</a>") : "") +
        (rs.length ? sect(t("fav.rests"), t("cat.rests", { n: rs.length })) + '<div class="rgrid2">' + rs.map(restCard).join("") + "</div>" : "") +
        (f.products.length ? sect(t("fav.dishes"), t("cat.dishes", { n: f.products.length })) + '<div class="pgrid">' + f.products.map(function (x) { return prodCard(x, true); }).join("") + "</div>" : "");
    });
  } });

  /* ---------- Promo codes ---------- */
  SF.route("/promos", { roles: ["customer"], title: "pf.promos", render: function () {
    return api().get("/promos/public").then(function (list) {
      return '<a class="backlink" href="#/profile">' + I("chevL", 18) + t("nav.profile") + '</a><h1 class="h2 pt">' + t("pf.promos") + "</h1>" +
        (list.length ? '<div class="plist2">' + list.map(function (p) { return '<div class="promo2"><span class="pcut">' + (p.type === "percent" ? "−" + p.value + "%" : "−" + money(p.value)) + '</span><div class="grow"><code class="num">' + esc(p.code) + "</code><small>" +
          (p.minOrder ? t("pr.min", { sum: money(p.minOrder) }) : t("pr.any")) + (p.expiresAt ? " · " + t("pr.until", { d: SF.date(p.expiresAt) }) : "") + '</small></div><button type="button" class="btn sm ghost" data-act="copynum" data-v="' + esc(p.code) + '">' + I("copy", 14) + t("cour.copy") + "</button></div>"; }).join("") + '</div><p class="fine">' + t("pr.how") + "</p>"
          : SF.empty("ticket", t("pr.none"), t("pr.noneSub")));
    });
  } });
  SF.after.push(function (m) { if (SF.state.justPlaced && !(m && m.params && m.params.id === SF.state.justPlaced)) SF.state.justPlaced = null; });
})();
