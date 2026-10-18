/* TEZKOR — the super-app home: one account, many services.
   Which services work comes from the server (/settings/public → services): the admin switches them in his panel,
   nothing in this file changes when a new service starts. Only food delivery works at launch. */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, tx = SF.tx, money = SF.money, api = function () { return SF.api; };

  /* key, picture, tile colour, where it opens when switched on */
  SF.SERVICES = [
    ["food", "🍔", "#FFF1E6", "/food"], ["taxi", "🚕", "#FFF7DB", null], ["shops", "🛒", "#E8F7EE", null], ["ads", "📢", "#E8F0FF", "/ads"],
    ["masters", "🛠️", "#F1EBFF", "/masters"], ["jobs", "💼", "#FFE9EF", "/jobs"], ["grocery", "🥦", "#EAF7E3", null], ["pharmacy", "💊", "#E6F4FB", null], ["realty", "🏠", "#FFECE8", "/realty"]];
  /* the picture of a service: the admin's own photo when he uploaded one, otherwise a clean colour tile with a line icon (no cartoon emoji) */
  var SV_LOOK = { food: ["#FF8A3D", "#D9480F", "bag"], taxi: ["#FFC93C", "#E09A00", "car"], shops: ["#2FBF71", "#0B7A3E", "cart"], ads: ["#4C8DFF", "#1E56C8", "megaphone"], masters: ["#9B6BFF", "#5F35C9", "wrench"],
    jobs: ["#FF6B9A", "#C2255C", "briefcase"], grocery: ["#7BD35A", "#2F8A1F", "store"], pharmacy: ["#3EC5E8", "#0B7FA3", "heart"], realty: ["#FF8A6B", "#D0432A", "house"] };
  SF.svVis = function (k, big) { var ph = ((SF.state.pub || {}).svcPhotos || {})[k] || (k === "food" && SF.PHOTO ? SF.PHOTO.burger : null), L = SV_LOOK[k] || ["#9AA6A1", "#5E6964", "grid"];
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

  SF.actions.soon = function (el) { var k = el.dataset.k, x = SF.SERVICES.filter(function (s) { return s[0] === k; })[0] || ["", "✨"];
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="soonbox">' + SF.svVis(k, true) + '<h2 class="h2">' + t("sa.soonT") + '</h2><p class="muted">' + t("sa.soonSub") + "</p>" +
      (k ? '<span class="pill p-mut">' + t("sv." + k) + " · " + t("sv.soon") + "</span>" : "") + '<a class="btn primary block lg" href="#/food" data-act="closemodal">' + "🍔 " + t("sa.orderFood") + "</a></div>"); };
  /* «+» in the bottom bar is in ads.js: it posts into the listing services the admin switched on */

  /* ---------- Home ---------- */
  function etaMin(r) { return parseInt(String(r.eta || "").split(/[–-]/)[0], 10) || 99; }
  SF.route("/", { title: "nav.home", render: function (p, q) {
    if (q.cat) { setTimeout(function () { SF.go("/food?cat=" + q.cat); }, 0); return ""; }       // old links
    return Promise.all([api().get("/banners"), api().get("/restaurants?cityId=" + encodeURIComponent(SF.state.cityId))]).then(function (res) {
      var banners = res[0], rests = res[1];
      return Promise.all(rests.slice(0, 12).map(function (r) { return api().get("/restaurants/" + r.id).then(function (f) { return Object.assign(f, { orderCount: r.orderCount, hasSale: r.hasSale, isNew: r.isNew }); }); })).then(function (full) {
        full.forEach(function (r) { var ps = (r.products || []).filter(function (x) { return x.available; }), ks = ps.filter(function (x) { return x.popular; }).concat(ps).map(function (x) { return x.kind; }); r.art1 = ks[0]; });
        var u = SF.state.user, h = new Date().getHours(), greet = h < 12 ? "home.morning" : h < 18 ? "home.day" : "home.evening";
        var sale = 0; full.forEach(function (r) { (r.products || []).forEach(function (x) { if (x.available && x.oldPrice > x.price) sale = Math.max(sale, SF.sale(x)); }); });
        var pop = full.slice().sort(function (a, b) { return (b.isOpenNow ? 1 : 0) - (a.isOpenNow ? 1 : 0) || (b.orderCount || 0) - (a.orderCount || 0) || (b.rating || 0) - (a.rating || 0); }).slice(0, 8);
        var open = full.filter(function (r) { return r.isOpenNow; }).map(etaMin), eta = open.length ? Math.min.apply(null, open) : 0;
        /* 1. greeting + search across Tezkor */
        var head = '<section class="sahead"><p class="sahi">' + t(greet) + (u ? ", <b>" + esc(u.name.split(" ")[0]) + "</b>" : "") + ' <span aria-hidden="true">👋</span></p>' +
          '<form class="sasearch" data-form="search" role="search">' + I("search", 20) + '<input name="q" placeholder="' + t("sa.searchPh") + '" aria-label="' + t("sa.searchPh") + '" enterkeyhint="search"><button class="sago" aria-label="' + t("btn.find") + '">' + I("chevR", 18) + "</button></form></section>";
        /* 2. big food banner first, then the restaurants' own ads; they slide by themselves and by finger */
        var hero = '<a class="banner sahero" href="#/food"><span class="shbg" style="background-image:url(' + SF.PHOTO.hero + ')" aria-hidden="true"></span><div><b class="sht">' + t("sa.heroT1") + " <em>" + t("sa.heroT2") + "</em> " + t("sa.heroT3") + "</b>" +
          '<span class="shf"><i>' + I("bolt", 14) + t("sa.fast") + "</i><i>" + I("shield", 14) + t("sa.safe") + "</i>" + (eta ? "<i>" + I("clock", 14) + t("sa.from", { n: eta }) + "</i>" : "") + "</span>" +
          '<em class="shgo">' + t("sa.orderFood") + I("chevR", 16) + "</em></div></a>";
        var slides = [hero].concat(banners.map(function (b) { return SF.bannerHtml(b, "a"); }));
        var ban = '<section class="banners b3 sabanners" id="banners" aria-label="' + t("home.offers") + '">' + slides.join("") + "</section>" + (slides.length > 1 ? '<div class="bdots" aria-hidden="true">' + slides.map(function (b, i) { return '<i class="' + (i ? "" : "on") + '"></i>'; }).join("") + "</div>" : "");
        /* 3. services */
        var svc = '<section class="sasect"><div class="sect2"><div><h2>' + t("sv.title") + '</h2><span class="muted">' + t("sa.oneAcc") + "</span></div></div>" + SF.svcGrid() + "</section>";
        /* 4. a real discount (only when a restaurant really has one) */
        var promo = sale ? '<a class="sapromo" href="#/food"><div><b>' + t("sa.saleT", { n: sale }) + "</b><span>" + t("sa.saleSub") + '</span><em class="shgo">' + t("sa.look") + I("chevR", 16) + '</em></div><img src="' + SF.PHOTO.burger + '" alt=""></a>' : "";
        /* 5. popular restaurants */
        var popH = pop.length ? '<section class="sasect"><div class="sect2"><div><h2>' + t("hs.popRest") + '</h2></div><a class="link" href="#/food">' + t("sa.allR") + "</a></div>" + '<div class="hscroll rrowscroll">' + pop.map(SF.restCard).join("") + "</div></section>" : "";
        return '<div class="sahome">' + head + ban + svc + promo + popH + "</div>";
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
})();
