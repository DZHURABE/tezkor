/* TEZKOR — the super-app home: one account, many services.
   Which services work comes from the server (/settings/public → services): the admin switches them in his panel,
   nothing in this file changes when a new service starts. Only food delivery works at launch. */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, tx = SF.tx, money = SF.money, api = function () { return SF.api; };

  /* key, picture, tile colour, where it opens when switched on */
  SF.SERVICES = [
    ["food", "", "#FFF1E6", "/food"], ["taxi", "", "#FFF7DB", null], ["shops", "", "#E8F7EE", "/shops"], ["ads", "", "#E8F0FF", "/ads"],
    ["masters", "", "#F1EBFF", "/masters"], ["jobs", "", "#FFE9EF", "/jobs"], ["grocery", "", "#EAF7E3", null], ["pharmacy", "", "#E6F4FB", null], ["realty", "", "#FFECE8", "/realty"]];
  /* the picture of a service: the admin's own photo when he uploaded one, otherwise a clean colour tile with a line icon (no cartoon emoji) */
  var SV_LOOK = { food: ["#FF8A3D", "#D9480F", "bag"], taxi: ["#FFC93C", "#E09A00", "car"], shops: ["#2FBF71", "#0B7A3E", "cart"], ads: ["#4C8DFF", "#1E56C8", "megaphone"], masters: ["#9B6BFF", "#5F35C9", "wrench"],
    jobs: ["#FF6B9A", "#C2255C", "briefcase"], grocery: ["#7BD35A", "#2F8A1F", "store"], pharmacy: ["#3EC5E8", "#0B7FA3", "heart"], realty: ["#FF8A6B", "#D0432A", "house"] };
  SF.svVis = function (k, big) { var ph = ((SF.state.pub || {}).svcPhotos || {})[k] , L = SV_LOOK[k] || ["#9AA6A1", "#5E6964", "grid"];
    return ph ? '<span class="sve svph' + (big ? " big" : "") + '" aria-hidden="true"><img src="' + esc(ph) + '" alt="" loading="lazy"></span>'
      : '<span class="sve svgr' + (big ? " big" : "") + '" style="--g1:' + L[0] + ";--g2:" + L[1] + '" aria-hidden="true">' + I(L[2], big ? 40 : 26) + "</span>"; };
  /* «soon»: a small red flame badge that glows on and off */
  SF.soonBadge = function (short) { return '<span class="soonb">' + I("fire", 12) + t(short ? "sv.soonS" : "sv.soon") + "</span>"; };
  SF.svcOn = function (k) { var s = (SF.state.pub || {}).services; return k === "food" ? !s || s.food !== false : !!(s && s[k]); };
  function svcTile(x, i) { var on = SF.svcOn(x[0]) && x[3];
    return (on ? '<a href="#' + x[3] + '"' : '<button type="button" data-act="soon" data-k="' + x[0] + '"') + ' class="svt' + (on ? " on" : "") + '" style="--sb:' + x[2] + ";--i:" + i + '">' +
      SF.svVis(x[0]) + "<b>" + t("svs." + x[0]) + "</b>" + (on ? '<small class="ok">' + t("sa.live") + "</small>" : SF.soonBadge(true)) + (on ? "</a>" : "</button>"); }
  SF.svcGrid = function (all) { var list = all ? SF.SERVICES : SF.SERVICES.slice(0, 7);
    return '<nav class="svgrid" aria-label="' + t("sv.title") + '">' + list.map(svcTile).join("") +
      (all ? "" : '<a href="#/services" class="svt more" style="--sb:#F2F4F3;--i:7"><span class="sve" aria-hidden="true">' + I("grid", 26) + "</span><b>" + t("sa.all") + "</b><small>" + t("sa.allSub", { n: SF.SERVICES.length }) + "</small></a>") + "</nav>"; };

  /* «coming soon» / closed service: a calm gradient poster (or the admin's own photo) with the name and what it will give — no stickers */
  SF.soonHero = function (k) { var L = SV_LOOK[k] || ["#9AA6A1", "#5E6964"], ph = ((SF.state.pub || {}).svcPhotos || {})[k];
    return '<div class="soonhero" style="--g1:' + L[0] + ";--g2:" + L[1] + '">' + (ph ? '<img src="' + esc(ph) + '" alt="">' : "") + '<div class="sh-in"><span class="sh-badge">' + SF.soonBadge() + '</span><b>' + t("svs." + k) + "</b><small>" + t("svd." + k) + "</small></div></div>"; };
  SF.actions.soon = function (el) { var k = el.dataset.k;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="soonbox">' + SF.soonHero(k) + '<h2 class="h2">' + t("sa.soonT") + '</h2><p class="muted">' + t("sa.soonSub") + '</p><a class="btn primary block lg" href="#/services" data-act="closemodal">' + t("sa.allSv") + "</a></div>"); };
  /* «+» in the bottom bar is in ads.js: it posts into the listing services the admin switched on */

  /* ---------- Home ---------- */
  function etaMin(r) { return parseInt(String(r.eta || "").split(/[–-]/)[0], 10) || 99; }
  SF.route("/", { title: "nav.home", render: function (p, q) {
    if (q.cat) { setTimeout(function () { SF.go("/food?cat=" + q.cat); }, 0); return ""; }       // old links
    var cq = "cityId=" + encodeURIComponent(SF.state.cityId) + SF.areaQ(), soft = function (u) { return api().get(u).catch(function () { return null; }); };
    return Promise.all([api().get("/banners"), api().get("/restaurants?" + cq), SF.svcOn("ads") ? soft("/ads/search?svc=ads&limit=4&" + cq) : null, SF.svcOn("shops") ? soft("/shops/goods?limit=8&" + cq) : null,
      SF.svcOn("shops") ? soft("/restaurants?kind=shop&" + cq).then(function (l) { var o = (l || []).filter(function (x) { return x.own; })[0]; return o ? soft("/restaurants/" + o.id) : null; }) : null]).then(function (res) {
      var banners = res[0], rests = res[1], newAds = res[2], newGoods = res[3], ownShop = res[4];
      return Promise.all(rests.slice(0, 12).map(function (r) { return api().get("/restaurants/" + r.id).then(function (f) { return Object.assign(f, { orderCount: r.orderCount, hasSale: r.hasSale, isNew: r.isNew }); }); })).then(function (full) {
        full.forEach(function (r) { var ps = (r.products || []).filter(function (x) { return x.available; }), ks = ps.filter(function (x) { return x.popular; }).concat(ps).map(function (x) { return x.kind; }); r.art1 = ks[0]; });
        var u = SF.state.user, h = new Date().getHours(), greet = h < 12 ? "home.morning" : h < 18 ? "home.day" : "home.evening";
        var sale = 0; full.forEach(function (r) { (r.products || []).forEach(function (x) { if (x.available && x.oldPrice > x.price) sale = Math.max(sale, SF.sale(x)); }); });
        var pop = full.slice().sort(function (a, b) { return (b.isOpenNow ? 1 : 0) - (a.isOpenNow ? 1 : 0) || (b.orderCount || 0) - (a.orderCount || 0) || (b.rating || 0) - (a.rating || 0); }).slice(0, 8);
        var open = full.filter(function (r) { return r.isOpenNow; }).map(etaMin), eta = open.length ? Math.min.apply(null, open) : 0;
        /* 1. greeting + search across Tezkor */
        var head = '<section class="sahead"><p class="sahi">' + t(greet) + (u ? ", <b>" + esc(u.name.split(" ")[0]) + "</b>" : "") + '</p>' +
          '<form class="sasearch" data-form="search" role="search">' + I("search", 20) + '<input name="q" placeholder="' + t("sa.searchPh") + '" aria-label="' + t("sa.searchPh") + '" enterkeyhint="search"><button class="sago" aria-label="' + t("btn.find") + '">' + I("chevR", 18) + "</button></form></section>";
        /* 2. big food banner first, then the restaurants' own ads; they slide by themselves and by finger */
        var live = SF.SERVICES.filter(function (x) { return SF.svcOn(x[0]) && x[3]; }).slice(0, 4);
        var hero = '<a class="banner sahero gen" href="#/services"><div><b class="sht">' + t("sa.heroG1") + " <em>" + t("sa.heroG2") + "</em></b>" +
          '<span class="shf">' + live.map(function (x) { return "<i>" + t("svs." + x[0]) + "</i>"; }).join("") + "</span>" +
          '<em class="shgo">' + t("sa.allSv") + I("chevR", 16) + "</em></div></a>";
        var slides = [hero].concat(banners.map(function (b) { return SF.bannerHtml(b, "a"); }));
        var ban = '<section class="banners b3 sabanners" id="banners" aria-label="' + t("home.offers") + '">' + slides.join("") + "</section>" + (slides.length > 1 ? '<div class="bdots" aria-hidden="true">' + slides.map(function (b, i) { return '<i class="' + (i ? "" : "on") + '"></i>'; }).join("") + "</div>" : "");
        /* 3. services */
        var svc = '<section class="sasect"><div class="sect2"><div><h2>' + t("sv.title") + '</h2><span class="muted">' + t("sa.oneAcc") + "</span></div></div>" + SF.svcGrid() + "</section>";
        /* 4. a real discount (only when a restaurant really has one) */
        var promo = sale ? '<a class="sapromo" href="#/food"><div><b>' + t("sa.saleT", { n: sale }) + "</b><span>" + t("sa.saleSub") + '</span><em class="shgo">' + t("sa.look") + I("chevR", 16) + '</em></div><img src="' + SF.PHOTO.burger + '" alt=""></a>' : "";
        /* 5. popular restaurants */
        var popH = pop.length ? '<section class="sasect"><div class="sect2"><div><h2>' + t("hs.popRest") + '</h2></div><a class="link" href="#/food">' + t("sa.allR") + "</a></div>" + '<div class="hscroll rrowscroll">' + pop.map(SF.restCard).join("") + "</div></section>" : "";
        var adsH = newAds && newAds.list && newAds.list.length ? '<section class="sasect"><div class="sect2"><div><h2>' + t("sa.newAds") + '</h2></div><a class="link" href="#/ads">' + t("sa.allR") + '</a></div><div class="adlist">' + newAds.list.map(function (x) { return SF.adRow(x); }).join("") + "</div></section>" : "";
        if (newGoods && newGoods.list) SF.rememberProducts(newGoods.list);
        var gdH = newGoods && newGoods.list && newGoods.list.length ? '<section class="sasect"><div class="sect2"><div><h2>' + t("sa.newGoods") + '</h2></div><a class="link" href="#/shops/goods">' + t("sa.allR") + '</a></div><div class="hscroll goodsrow">' + newGoods.list.map(goodCard).join("") + "</div></section>" : "";
        return '<div class="sahome">' + (SF.installBar ? SF.installBar() : "") + head + (SF.ownShopHero ? SF.ownShopHero(ownShop) : "") + svc + ban + (SF.soonBlock ? SF.soonBlock() : "") + adsH + gdH + promo + popH + "</div>";
      });
    });
  } });

  /* all services with a line about each */
  SF.route("/services", { title: "sa.all", render: function () {
    return '<div class="svhead"><a class="svback" href="#/" aria-label="' + t("btn.back") + '">' + I("chevL", 20) + "</a><h1>" + t("sa.all") + "</h1></div>" +
      '<p class="muted svlead">' + t("sa.allLead") + '</p><div class="svlist">' + SF.SERVICES.map(function (x, i) { var on = SF.svcOn(x[0]) && x[3];
        return (on ? '<a href="#' + x[3] + '"' : '<button type="button" data-act="soon" data-k="' + x[0] + '"') + ' class="svrowi" style="--sb:' + x[2] + ";--i:" + i + '">' + SF.svVis(x[0]) + '<span class="grow"><b>' + t("sv." + x[0]) + "</b><small>" + t("svd." + x[0]) + "</small></span>" +
          (on ? '<span class="svstate on">' + t("sa.works") + "</span>" : SF.soonBadge()) + (on ? "</a>" : "</button>"); }).join("") + "</div>";
  } });

  /* ---------- Shops: same engine as restaurants; the admin's «show first» shop on top in a big card ---------- */
  function shopLogo(r, cls) { return r.logo ? '<span class="' + cls + '"><img src="' + esc(r.logo) + '" alt=""></span>' : '<span class="' + cls + '" style="--tone:' + esc(r.tone || "#E3ECFF") + '"><b>' + esc(tx(r.name).slice(0, 2).toUpperCase()) + "</b></span>"; }
  function shopFacts(r) { return '<span class="shfacts"><span>' + esc(tx(r.cuisine)) + "</span>" + (r.rating ? "<span>" + I("star", 13) + Number(r.rating).toFixed(1) + "</span>" : "") + "</span>" +
    '<span class="shfacts"><span>' + I("scooter", 13) + esc(r.eta) + " " + t("u.min") + "</span>" + (r.pickup ? "<span>" + I("store", 13) + t("sh.pickupOk") + "</span>" : "") + "</span>"; }
  function shopTabs(cur) { return '<div class="segtabs shtabs" role="tablist">' + [["shops", "/shops", "sh.tabShops"], ["goods", "/shops/goods", "sh.tabGoods"]].map(function (x) { return '<a role="tab" aria-selected="' + (x[0] === cur) + '" class="segt' + (x[0] === cur ? " on" : "") + '" href="#' + x[1] + '">' + t(x[2]) + "</a>"; }).join("") + "</div>"; }
  /* ---------- all goods of all shops: one feed with filters ---------- */
  var GK = ["q", "cat", "brand", "min", "max", "sale", "sort"];
  /* the big sections of a home & repair shop: one tap shows several categories */
  var GROUPS = [["build", "gr.build", ["b0", "b1", "b5", "b6", "b10", "h3"]], ["electric", "gr.electric", ["b3", "b8", "b9"]], ["plumb", "gr.plumb", ["b2", "b7", "b11", "b12"]], ["tv", "gr.tv", ["b4", "b13"]], ["home", "gr.home", ["h1", "h2", "g10"]], ["drink", "gr.drink", ["g8", "d1", "d2", "d3", "d4", "d5", "d6"]], ["tj", "gr.tj", ["b14"]]];
  function gqs(o) { return GK.filter(function (k) { return o[k]; }).map(function (k) { return k + "=" + encodeURIComponent(o[k]); }).join("&"); }
  function gcurQ() { return SF.match(SF.path()).query || {}; }
  function gapi(q, off) { return "/shops/goods?cityId=" + encodeURIComponent(SF.state.cityId) + SF.areaQ() + (q.q ? "&q=" + encodeURIComponent(q.q) : "") + (q.cat ? "&cat=" + q.cat : "") + (q.brand ? "&brand=" + encodeURIComponent(q.brand) : "") + (q.min ? "&priceMin=" + q.min : "") + (q.max ? "&priceMax=" + q.max : "") + (q.sale ? "&sale=1" : "") + (q.sort ? "&sort=" + q.sort : "") + "&offset=" + off + "&limit=20"; }
  SF.goodCard = function (p) { return goodCard(p); };
  function goodCard(p) { return '<div class="gwrap">' + SF.prodCard(p) + '<a class="gshop" href="#/r/' + p.restaurant.id + '">' + I("store", 12) + esc(tx(p.restaurant.name)) + "</a></div>"; }
  SF.route("/shops/goods", { title: "sv.shops", render: function (p, q) {
    if (!SF.svcOn("shops") && !(SF.state.user && SF.state.user.role === "admin")) { SF.go("/"); return ""; }
    return api().get(gapi(q, 0)).then(function (r) { SF.rememberProducts(r.list); var cats = (SF.state.shopCats || []).filter(function (c) { return r.cats[c.id]; }), nf = ["min", "max", "sale"].filter(function (k) { return q[k]; }).length;
      return '<div class="svhead"><a class="svback" href="#/" aria-label="' + t("btn.back") + '">' + I("chevL", 20) + "</a><h1>" + t("sv.shops") + "</h1></div>" + shopTabs("goods") +
        '<form class="sasearch slim" data-form="gdsearch" role="search">' + I("search", 20) + '<input name="q" value="' + esc(q.q || "") + '" placeholder="' + t("sh.goodsPh") + '" aria-label="' + t("sh.goodsPh") + '" enterkeyhint="search"><button class="sago" aria-label="' + t("btn.find") + '">' + I("chevR", 18) + "</button></form>" +
        '<div class="adtools"><button type="button" class="btn ghost sm" data-act="gdfilters">' + I("sliders", 16) + t("af.title") + (nf ? ' <i class="num fbadge">' + nf + "</i>" : "") + '</button><label class="adsort"><select data-input="gdsort" aria-label="' + t("af.sort") + '">' + [["", "af.s.rel"], ["new", "af.s.new"], ["cheap", "ps.cheap"], ["dear", "ps.dear"]].map(function (o) { return '<option value="' + o[0] + '"' + ((q.sort || "") === o[0] ? " selected" : "") + ">" + t(o[1]) + "</option>"; }).join("") + "</select></label></div>" +
        '<div class="chips adchips grpchips">' + GROUPS.map(function (g) { var n = g[2].reduce(function (a, id) { return a + (r.cats[id] || 0); }, 0), key = g[2].join(","); if (!n) return ""; return '<a class="fchip grp' + (q.cat === key ? " on" : "") + '" href="#/shops/goods?' + gqs(Object.assign({}, q, { cat: q.cat === key ? "" : key, brand: "" })) + '">' + t(g[1]) + ' <i class="num">' + n + "</i></a>"; }).join("") + "</div>" +
        '<div class="chips adchips"><a class="fchip' + (q.cat ? "" : " on") + '" href="#/shops/goods?' + gqs(Object.assign({}, q, { cat: "", brand: "" })) + '">' + t("home.all") + ' <i class="num">' + r.all + "</i></a>" + cats.filter(function (c) { return !q.cat || q.cat.indexOf(",") < 0 || q.cat.split(",").indexOf(c.id) >= 0; }).map(function (c) { return '<a class="fchip' + (q.cat === c.id ? " on" : "") + '" href="#/shops/goods?' + gqs(Object.assign({}, q, { cat: c.id, brand: "" })) + '">' + esc(tx(c.name)) + ' <i class="num">' + r.cats[c.id] + "</i></a>"; }).join("") + "</div>" +
        (r.brands.length > 1 ? '<div class="chips adchips brandrow"><a class="fchip' + (q.brand ? "" : " on") + '" href="#/shops/goods?' + gqs(Object.assign({}, q, { brand: "" })) + '">' + t("sh.allBrands") + "</a>" + r.brands.map(function (b) { return '<a class="fchip' + (q.brand === b.b ? " on" : "") + '" href="#/shops/goods?' + gqs(Object.assign({}, q, { brand: b.b })) + '">' + esc(b.b) + ' <i class="num">' + b.n + "</i></a>"; }).join("") + "</div>" : "") +
        (!q.q && !q.cat && !q.brand && !nf && SF.soonBlock ? SF.soonBlock() : "") + '<p class="adtotal num">' + t("sh.goodsFound", { n: r.total }) + "</p>" +
        (r.list.length ? '<div class="pgrid goodsgrid" id="goodsgrid">' + r.list.map(goodCard).join("") + "</div>" + (r.total > r.list.length ? '<button type="button" class="btn ghost block admore2" data-act="gdmore" data-off="' + r.list.length + '" data-total="' + r.total + '">' + t("af.more") + "</button>" : "")
          : SF.empty("bag", t("sh.goodsNone"), t("sh.goodsNoneSub"), q.q || q.cat || q.brand || nf ? '<a class="btn ghost" href="#/shops/goods">' + t("af.reset") + "</a>" : "")) + (!r.list.length && q.q && SF.missNote ? SF.missNote(q.q) + SF.soonBlock() : "") +
        '<a class="adfab" href="#/shops">' + I("store", 18) + t("sh.tabShops") + "</a>";
    });
  } });
  SF.forms.gdsearch = function (fd) { var q = gcurQ(); q.q = fd.q || ""; SF.go("/shops/goods?" + gqs(q)); };
  SF.inputs.gdsort = function (v) { var q = gcurQ(); q.sort = v; SF.go("/shops/goods?" + gqs(q)); };
  SF.actions.gdmore = function (el) { var q = gcurQ(), off = +el.dataset.off; return api().get(gapi(q, off)).then(function (r) { SF.rememberProducts(r.list); var box = document.getElementById("goodsgrid"); if (!box) return;
    box.insertAdjacentHTML("beforeend", r.list.map(goodCard).join("")); off += r.list.length; el.dataset.off = off; if (off >= r.total || !r.list.length) el.remove(); }); };
  SF.actions.gdfilters = function () { var q = gcurQ();
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="gdfilter"><h2 class="h2">' + t("af.title") + "</h2>" +
      '<div class="grid2"><label class="f">' + t("af.min") + '<input name="min" inputmode="numeric" value="' + esc(q.min || "") + '" placeholder="0"></label><label class="f">' + t("af.max") + '<input name="max" inputmode="numeric" value="' + esc(q.max || "") + '" placeholder="∞"></label></div>' +
      '<label class="checkrow"><input type="checkbox" name="sale"' + (q.sale ? " checked" : "") + "><span>" + t("sh.onSale") + '</span></label><div class="row2"><a class="btn ghost" href="#/shops/goods?' + gqs({ q: q.q, cat: q.cat, brand: q.brand }) + '" data-act="closemodal">' + t("af.reset") + '</a><button class="btn primary">' + t("af.apply") + "</button></div></form>"); };
  SF.forms.gdfilter = function (fd) { var q = gcurQ(); q.min = String(fd.min || "").replace(/\D/g, ""); q.max = String(fd.max || "").replace(/\D/g, ""); q.sale = fd.sale ? "1" : ""; SF.closeModal(); SF.go("/shops/goods?" + gqs(q)); };
  SF.route("/shops", { title: "sv.shops", render: function (p, q) {
    if (!SF.svcOn("shops") && !(SF.state.user && SF.state.user.role === "admin")) { setTimeout(function () { SF.actions.soon({ dataset: { k: "shops" } }); }, 0); SF.go("/"); return ""; }
    return api().get("/restaurants?kind=shop&cityId=" + encodeURIComponent(SF.state.cityId) + SF.areaQ()).then(function (list) { var s = String(q.q || "").toLowerCase();
      var l = list.filter(function (r) { return !s || (tx(r.name) + " " + tx(r.cuisine)).toLowerCase().indexOf(s) >= 0; }), top = l.filter(function (r) { return r.pinned; }), rest = l.filter(function (r) { return !r.pinned; });
      return '<div class="svhead"><a class="svback" href="#/" aria-label="' + t("btn.back") + '">' + I("chevL", 20) + "</a><h1>" + t("sv.shops") + '</h1><span class="muted">' + t("sh.count", { n: list.length }) + "</span></div>" +
        shopTabs("shops") + '<form class="sasearch slim" data-form="shsearch" role="search">' + I("search", 20) + '<input name="q" value="' + esc(q.q || "") + '" placeholder="' + t("sh.searchPh") + '" aria-label="' + t("sh.searchPh") + '"><button class="sago" aria-label="' + t("btn.find") + '">' + I("chevR", 18) + "</button></form>" +
        top.map(function (r) { return '<a class="shbig" href="#/r/' + r.id + '"><span class="shcov" style="' + (r.cover ? "background-image:url(" + esc(r.cover) + ")" : "") + '"><em class="shpin">★ ' + t("sh.first") + '</em><em class="shopen ' + (r.isOpenNow ? "on" : "") + '">' + (r.isOpenNow ? t("rc.openTill", { to: r.hours.to }) : t("rest.closedUntil", { from: r.hours.from })) + "</em><b>" + esc(tx(r.name)) + "</b></span>" +
          '<span class="shbody">' + shopLogo(r, "shlogo") + '<span class="grow"><b>' + esc(tx(r.name)) + "</b>" + shopFacts(r) + "</span>" + I("chevR", 18) + "</span></a>"; }).join("") +
        (rest.length ? '<div class="shlist">' + rest.map(function (r) { return '<a class="shrow' + (r.isOpenNow ? "" : " closed") + '" href="#/r/' + r.id + '">' + shopLogo(r, "shlogo sm") + '<span class="grow"><b>' + esc(tx(r.name)) + "</b>" + shopFacts(r) + "</span>" + I("chevR", 18) + "</a>"; }).join("") + "</div>" : "") +
        (!l.length ? SF.empty("store", t(s ? "ads.noneFound" : "sh.none"), t("sh.noneSub")) : "");
    });
  } });
  SF.forms.shsearch = function (fd) { SF.go("/shops?q=" + encodeURIComponent(fd.q || "")); };
})();
