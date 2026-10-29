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
  /* only the services the owner switched on — nothing «coming soon» */
  SF.svcGrid = function () { var list = SF.SERVICES.filter(function (x) { return SF.svcOn(x[0]) && x[3]; });
    return list.length ? '<nav class="svgrid n' + list.length + '" aria-label="' + t("sv.title") + '">' + list.map(svcTile).join("") + "</nav>" : ""; };

  /* «coming soon» / closed service: a calm gradient poster (or the admin's own photo) with the name and what it will give — no stickers */
  SF.soonHero = function (k) { var L = SV_LOOK[k] || ["#9AA6A1", "#5E6964"], ph = ((SF.state.pub || {}).svcPhotos || {})[k];
    return '<div class="soonhero" style="--g1:' + L[0] + ";--g2:" + L[1] + '">' + (ph ? '<img src="' + esc(ph) + '" alt="">' : "") + '<div class="sh-in"><span class="sh-badge">' + SF.soonBadge() + '</span><b>' + t("svs." + k) + "</b><small>" + t("svd." + k) + "</small></div></div>"; };
  SF.actions.soon = function (el) { var k = el.dataset.k;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="soonbox">' + SF.soonHero(k) + '<h2 class="h2">' + t("sa.soonT") + '</h2><p class="muted">' + t("sa.soonSub") + '</p><a class="btn primary block lg" href="#/services" data-act="closemodal">' + t("sa.allSv") + "</a></div>"); };
  /* «+» in the bottom bar is in ads.js: it posts into the listing services the admin switched on */

  /* ---------- Home ---------- */
  function etaMin(r) { return parseInt(String(r.eta || "").split(/[–-]/)[0], 10) || 99; }
  /* the home page of the last visit is shown at once; the fresh one replaces it as soon as the server answers */
  var homeNext = null;
  function homeKey() { var u = SF.state.user; return [SF.state.lang, u ? u.id : "", (window.SOMON_BUILD || "")].join("|"); }
  SF.route("/", { title: "nav.home", render: function (p, q) {
    if (q.cat) { setTimeout(function () { SF.go("/food?cat=" + q.cat); }, 0); return ""; }       // old links
    if (homeNext) { var ready = homeNext; homeNext = null; return ready; }
    var fresh = homeBuild(), cached = SF.ls.get("home", null), keep = function (h) { if (h && h.length < 450000) SF.ls.set("home", { k: homeKey(), h: h }); return h; };
    if (cached && cached.k === homeKey() && cached.h) {
      fresh.then(function (h) { keep(h); if (SF.path().split("?")[0] === "/" && h !== cached.h) { homeNext = h; SF.render({ quiet: true }); } }, function () {});
      return cached.h; }
    return fresh.then(keep);
  } });
  function homeBuild() { var q = {}, shopList = [];
    var cq = "cityId=" + encodeURIComponent(SF.state.cityId) + SF.areaQ(), soft = function (u) { return api().get(u).catch(function () { return null; }); };
    /* every listing service that is on: the newest ads of all of them go into one grid of squares */
    var listSv = Object.keys(SF.LISTINGS || {}).filter(function (k) { return SF.svcOn(k); });
    var adsAll = Promise.all(listSv.map(function (k) { return soft("/ads/search?svc=" + k + "&sort=new&limit=12"); })).then(function (rs) { var l = []; rs.forEach(function (r) { if (r && r.list) l = l.concat(r.list); });
      return { list: l.sort(function (a, b) { return (b.vip ? 1 : 0) - (a.vip ? 1 : 0) || (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt); }).slice(0, 12) }; });
    return Promise.all([api().get("/banners"), SF.svcOn("food") ? api().get("/restaurants?" + cq) : Promise.resolve([]), adsAll, SF.svcOn("shops") ? soft("/shops/goods?limit=16&sort=new&" + cq) : null,
      soft("/restaurants?kind=shop&" + cq).then(function (l) { shopList = l || []; var o = (l || []).filter(function (x) { return x.own; })[0]; return o ? soft("/restaurants/" + o.id) : null; })]).then(function (res) {
      var banners = res[0], rests = res[1], newAds = res[2], newGoods = res[3], ownShop = res[4];
      /* no extra request per restaurant: the list already says enough for the home screen (it used to ask 12 more times) */
      return Promise.resolve(rests.slice(0, 12)).then(function (full) {
        var u = SF.state.user, greet = SF.greetKey();
        var sale = 0;
        var pop = full.slice().sort(function (a, b) { return (b.isOpenNow ? 1 : 0) - (a.isOpenNow ? 1 : 0) || (b.orderCount || 0) - (a.orderCount || 0) || (b.rating || 0) - (a.rating || 0); }).slice(0, 8);
        var open = full.filter(function (r) { return r.isOpenNow; }).map(etaMin), eta = open.length ? Math.min.apply(null, open) : 0;
        /* 1. greeting + search across Tezkor */
        /* ======== the home page, top to bottom ========
           1. a green hero: greeting, the big search, the services as one row of round icons
           2. the offers (banners) right under it, one card at a time
           3. the owner's «Тезкор» store: one card with its goods
           4. the newest listings as squares · 5. other shops' goods · 6. food */
        var first = u ? esc(u.name.split(" ")[0]) : "";
        var svOn = SF.SERVICES.filter(function (x) { return SF.svcOn(x[0]) && x[3]; });
        var city = (SF.state.cities || []).filter(function (c) { return c.id === SF.state.cityId; })[0];
        /* the top row lives inside the green hero on phones (the empty white header bar is gone): logo · town · day/night · bell */
        var hbar = '<div class="hm-bar"><a href="#/" class="hm-logo" aria-label="' + esc(SF.brand()) + '">' + SF.mark(40) + "</a>" +
          '<button type="button" class="hm-city" data-act="city"><small>' + t("profile.city") + "</small><b>" + I("pin", 15) + "<span>" + esc(city ? tx(city.name) : "") + "</span>" + I("chevD", 14) + "</b></button>" +
          '<span class="hm-acts">' + (SF.appBtn ? SF.appBtn("hm-ib hm-app") : "") + SF.themeBtn("hm-ib") + (u ? SF.bell().replace('class="iconbtn"', 'class="iconbtn hm-ib"') : '<a class="hm-login" href="#/login">' + t("auth.login") + "</a>") + "</span></div>";
        var hero = '<section class="hm-hero"><i class="hm-orn" aria-hidden="true"></i>' + hbar +
          '<div class="hm-hi"><p>' + t(greet) + (first ? ", <b>" + first + "</b>" : "") + "</p><h1>" + t("hm.title") + "</h1></div>" +
          '<form class="hm-search" data-form="search" role="search">' + I("search", 20) + '<input name="q" placeholder="' + t("sa.searchPh") + '" aria-label="' + t("sa.searchPh") + '" enterkeyhint="search"><button class="hm-go" aria-label="' + t("btn.find") + '">' + I("chevR", 18) + "</button></form></section>";
        /* the services: one big card for the first, neat cards with a line about each for the rest (no round stickers) */
        /* services not started yet (taxi, pharmacy…): a short row of «Скоро» tiles under the working ones */
        var svOff = SF.SERVICES.filter(function (x) { return !(SF.svcOn(x[0]) && x[3]); });
        var soonRow = svOff.length ? '<p class="hm-soonh">' + SF.soonBadge(true) + " " + t("sv.soonTitle") + '</p><div class="hm-soon" aria-label="' + t("sv.soonTitle") + '">' + svOff.map(function (x) { return '<button type="button" class="hm-soont" data-act="soon" data-k="' + x[0] + '" style="--sb:' + x[2] + '">' + SF.svVis(x[0], false) + "<b>" + t("svs." + x[0]) + "</b>" + SF.soonBadge(true) + "</button>"; }).join("") + "</div>" : "";
        var svc = !svOn.length && !svOff.length ? "" : '<section class="hm-svc"><div class="hm-h"><div><h2>' + t("sv.title") + '</h2></div><a href="#/services">' + t("sa.allR") + I("chevR", 14) + "</a></div>" +
          '<nav class="svb n' + svOn.length + '" aria-label="' + t("sv.title") + '">' + svOn.map(function (x, i) {
            return '<a href="#' + x[3] + '" class="svb-t svb-' + x[0] + (i === 0 ? " big" : "") + '" style="--i:' + i + ';--sb:' + x[2] + '">' + SF.svVis(x[0], false) +
              '<span class="svb-tx"><b>' + t("svs." + x[0]) + "</b><small>" + t("svd." + x[0]) + "</small>" + (i === 0 ? '<em>' + t("hm.svOpen") + I("chevR", 14) + "</em>" : "") + "</span></a>"; }).join("") + "</nav>" + soonRow + "</section>";
        var slides = banners.map(function (b) { return SF.bannerHtml(b, "a"); });
        var ban = !slides.length ? "" : '<section class="hm-offers"><div class="banners hm-ban" id="banners" aria-label="' + t("home.offers") + '">' + slides.join("") + "</div>" + (slides.length > 1 ? '<div class="bdots" aria-hidden="true">' + slides.map(function (b, i) { return '<i class="' + (i ? "" : "on") + '"></i>'; }).join("") + "</div>" : "") + "</section>";
        function sect(title, sub, href, body, cls) { return '<section class="hm-sect' + (cls ? " " + cls : "") + '"><div class="hm-h"><div><h2>' + title + "</h2>" + (sub ? "<p>" + sub + "</p>" : "") + "</div>" + (href ? '<a href="#' + href + '">' + t("sa.allR") + I("chevR", 14) + "</a>" : "") + "</div>" + body + "</section>"; }
        var promo = sale ? '<a class="sapromo" href="#/food"><div><b>' + t("sa.saleT", { n: sale }) + "</b><span>" + t("sa.saleSub") + '</span><em class="shgo">' + t("sa.look") + I("chevR", 16) + '</em></div><img src="' + SF.PHOTO.burger + '" alt=""></a>' : "";
        var popH = pop.length ? sect(t("hs.popRest"), "", "/food", '<div class="hscroll rrowscroll">' + pop.map(SF.restCard).join("") + "</div>") : "";
        var ads = newAds && newAds.list ? newAds.list.slice(0, 6) : [];
        var adsH = ads.length ? sect(t("sa.newAds"), t("hm.adsSub"), (SF.LISTINGS[listSv[0]] || { base: "/ads" }).base, '<div class="adtiles">' + ads.map(SF.adTile).join("") + "</div>") : "";
        if (newGoods && newGoods.list) SF.rememberProducts(newGoods.list);
        var goods = ((newGoods && newGoods.list) || []).filter(function (x) { return !ownShop || x.restaurantId !== ownShop.id; }).slice(0, 16); SF.rememberProducts(goods);
        var gdH = goods.length ? sect(t("sv.shops"), t("hm.goodsSub"), "/shops/goods", '<div class="hscroll goodsrow onerow">' + goods.map(goodCard).join("") + "</div>") : "";
        var store = SF.ownShopHero ? SF.ownShopHero(ownShop) : "";
        /* ======== home in the «store app» style: black page, round stories, app-icon shops, one big card, 3-column cards ======== */
        var A2 = SF.ART2 || {};
        var top = '<div class="al-top"><a href="#/" class="al-logo" aria-label="' + esc(SF.brand()) + '">' + SF.mark(46) + "</a>" +
          '<div class="al-id"><b>' + esc(SF.brand()) + '</b><button type="button" class="al-city" data-act="city"><i class="al-dot"></i><span>' + esc(city ? tx(city.name) : t("profile.city")) + "</span>" + I("chevD", 13) + "</button></div>" +
          '<span class="al-acts">' + SF.themeBtn("al-ib") + (u ? SF.bell().replace('class="iconbtn"', 'class="iconbtn al-ib"') : '<a class="al-login" href="#/login">' + t("auth.login") + "</a>") + "</span></div>";
        var srch = '<form class="al-search" data-form="search" role="search">' + I("search", 20) + '<input name="q" placeholder="' + t("sa.searchPh") + '" aria-label="' + t("sa.searchPh") + '" enterkeyhint="search"></form>';
        var circ = function (k, href, on) { var pic = A2[k]; return (on ? '<a href="#' + href + '"' : '<button type="button" data-act="soon" data-k="' + k + '"') + ' class="al-c' + (on ? "" : " soon") + '"><span class="al-ring"><span class="al-cin">' + (pic ? '<img src="' + pic + '" alt="" loading="lazy">' : SF.svVis(k, false)) + "</span>" + (on ? "" : '<i class="al-soon">' + t("sv.soonS") + "</i>") + "</span><b>" + t("svs." + k) + "</b>" + (on ? "</a>" : "</button>"); };
        /* stories: round rings like Instagram; each offer (banner) is a story, tap opens it full screen and they run one after another */
        SF._stories = banners.slice();
        var stCirc = banners.map(function (b, i) { return '<button type="button" class="al-c" data-act="story" data-i="' + i + '"><span class="al-ring' + (SF.ls.get("st_" + b.id, 0) ? " seen" : "") + '"><span class="al-cin">' + (b.photo ? '<img src="' + esc(b.photo) + '" alt="" loading="lazy">' : '<span class="al-cart" style="--b:' + esc(b.tone || "#1B2233") + '">' + SF.art(b.art, 50) + "</span>") + "</span></span><b>" + esc(tx(b.title)) + "</b></button>"; });
        var stories = '<nav class="al-st" aria-label="' + t("home.offers") + '"><a href="#/services" class="al-c"><span class="al-ring"><span class="al-cin al-all">' + SF.mark(52) + "</span></span><b>" + t("hm.all") + "</b></a>" + stCirc.join("") +
          (stCirc.length ? "" : svOn.map(function (x) { return circ(x[0], x[3], true); }).join("")) + "</nav>";
        /* a moving row of app icons: the services (3D pictures) and the shops; it runs by itself, stops while touched */
        var shopsS = (shopList || []).slice().sort(function (a, b) { return (b.own ? 1 : 0) - (a.own ? 1 : 0) || (b.isOpenNow ? 1 : 0) - (a.isOpenNow ? 1 : 0) || (b.rating || 0) - (a.rating || 0); }).slice(0, 14);
        var appItems = svOn.map(function (x) { return '<a class="al-app" href="#' + x[3] + '"><span class="al-ai">' + (A2[x[0]] ? '<img src="' + A2[x[0]] + '" alt="">' : SF.svVis(x[0], false)) + "</span><b>" + t("svs." + x[0]) + "</b></a>"; })
          .concat(shopsS.map(function (r) { var pic = r.logo || r.cover;
            return '<a class="al-app" href="#/r/' + r.id + '"><span class="al-ai">' + (pic ? '<img src="' + esc(pic) + '" alt="" loading="lazy">' : "<b>" + esc(tx(r.name).slice(0, 2).toUpperCase()) + "</b>") + (r.isOpenNow === false ? "" : '<i class="al-open"></i>') + "</span><b>" + esc(tx(r.name)) + "</b></a>"; }))
          .concat(svOff.map(function (x) { return '<button type="button" class="al-app soon" data-act="soon" data-k="' + x[0] + '"><span class="al-ai">' + (A2[x[0]] ? '<img src="' + A2[x[0]] + '" alt="">' : SF.svVis(x[0], false)) + '<i class="al-soon">' + t("sv.soonS") + "</i></span><b>" + t("svs." + x[0]) + "</b></button>"; }));
        var apps = appItems.length ? '<div class="al-apps al-run"><div class="al-track" style="--n:' + appItems.length + '">' + appItems.join("") + '<span class="al-dup" aria-hidden="true">' + appItems.join("") + "</span></div></div>" : "";
        var heroC = banners.map(function (b) { var href = b.restaurantId ? "/r/" + b.restaurantId : b.own ? "/shops" : "/";
          return '<a class="al-hero" href="#' + href + '" style="--b:' + esc(b.tone || "#1B2233") + '">' + (b.photo ? '<img class="al-hbg" src="' + esc(b.photo) + '" alt="">' : '<span class="al-hart">' + SF.art(b.art, 120) + "</span>") + '<i class="al-hsh"></i>' +
            '<span class="al-hl">' + SF.mark(40) + "<b>" + esc(tx(b.title)) + "</b></span><small>" + esc(tx(b.sub)) + '</small><span class="al-hb"><em class="al-pill">' + esc(SF.brand()) + '</em><em class="al-btn">' + t(b.restaurantId ? "h3.order" : "ad.go") + "</em></span></a>"; });
        var heroS = heroC.length ? '<section class="al-heros"><div class="banners al-ban" id="banners" aria-label="' + t("home.offers") + '">' + heroC.join("") + "</div>" + (heroC.length > 1 ? '<div class="bdots al-dots" aria-hidden="true">' + heroC.map(function (b, i) { return '<i class="' + (i ? "" : "on") + '"></i>'; }).join("") + "</div>" : "") + "</section>" : "";
        var allG = []; if (ownShop && ownShop.products) ownShop.products.filter(function (x) { return x.available; }).forEach(function (x) { allG.push(Object.assign({}, x, { restaurant: x.restaurant || { id: ownShop.id, name: ownShop.name } })); });
        ((newGoods && newGoods.list) || []).forEach(function (x) { if (!allG.some(function (y) { return y.id === x.id; })) allG.push(x); });
        allG = allG.slice(0, 18); SF.rememberProducts(allG);
        var gCard = function (p) { var off = SF.sale ? SF.sale(p) : 0; return '<button type="button" class="al-g" data-act="prod" data-id="' + p.id + '"><span class="al-gi">' + SF.pic(p, 90) + (off ? '<i class="al-off">−' + off + "%</i>" : "") + '</span><b class="al-gn">' + esc(tx(p.name)) + '</b><em class="al-gp num">' + (p.variants && p.variants.length ? t("var.from") + " " : "") + money(p.price) + "</em></button>"; };
        var head = function (title, n, href) { return '<div class="al-h"><h2>' + title + "</h2>" + (href ? '<a href="#' + href + '">' + (n ? '<span class="num">' + n + "</span>" : "") + I("chevR", 16) + "</a>" : "") + "</div>"; };
        var goodsS = allG.length ? '<section class="al-sec">' + head(t("sv.shops"), allG.length, "/shops/goods") + '<div class="al-grid">' + allG.map(gCard).join("") + "</div></section>" : "";
        var aCard = function (a) { var B = ((SF.LISTINGS || {})[a.svc] || (SF.LISTINGS || {}).ads || { base: "/ads" }).base; return '<a class="al-g" href="#' + B + "/" + a.id + '"><span class="al-gi">' + (a.photos && a.photos[0] ? '<img class="ph" src="' + esc(a.photos[0]) + '" alt="" loading="lazy">' : (A2[a.svc] ? '<img class="ph" src="' + A2[a.svc] + '" alt="">' : I("megaphone", 30))) + (a.vip ? '<i class="al-off">VIP</i>' : "") + '</span><b class="al-gn">' + esc(a.title) + '</b><em class="al-gp num">' + (a.price == null ? "—" : money(a.price)) + "</em></a>"; };
        var adsS = ads.length ? '<section class="al-sec">' + head(t("sa.newAds"), (newAds.list || []).length, (SF.LISTINGS[listSv[0]] || { base: "/ads" }).base) + '<div class="al-grid">' + newAds.list.slice(0, 9).map(aCard).join("") + "</div></section>" : "";
        return '<div class="sahome al">' + (SF.installBar ? SF.installBar() : "") + top + srch + stories + apps + heroS + goodsS + adsS + (SF.svcOn("food") ? popH : "") + "</div>";
      });
    });
  }

  /* ---------- story viewer: full screen, bars on top, 5 s each, tap right = next, left = back, swipe down / × = close ---------- */
  SF.actions.story = function (el) { var L = SF._stories || [], i = +el.dataset.i || 0; if (!L.length) return; var old = document.getElementById("stv"); if (old) old.remove();
    var box = document.createElement("div"); box.id = "stv"; box.className = "stv"; document.body.appendChild(box); var tm = 0, y0 = null;
    function close() { clearTimeout(tm); box.remove(); SF.render({ quiet: true }); }
    function show(k) { if (k < 0) k = 0; if (k >= L.length) { close(); return; } i = k; var b = L[i]; SF.ls.set("st_" + b.id, 1); clearTimeout(tm);
      var href = b.restaurantId ? "/r/" + b.restaurantId : b.own ? "/shops" : "";
      box.innerHTML = '<div class="stv-bars">' + L.map(function (x, j) { return '<i class="' + (j < i ? "done" : j === i ? "run" : "") + '"><b></b></i>'; }).join("") + "</div>" +
        '<div class="stv-top">' + SF.mark(34) + "<b>" + esc(SF.brand()) + '</b><button type="button" class="stv-x" aria-label="×">' + I("x", 24) + "</button></div>" +
        '<div class="stv-pic" style="--b:' + esc(b.tone || "#1B2233") + '">' + (b.photo ? '<img src="' + esc(b.photo) + '" alt="">' : SF.art(b.art, 220)) + "</div>" +
        '<div class="stv-tx"><h2>' + esc(tx(b.title)) + "</h2><p>" + esc(tx(b.sub)) + "</p>" + (href ? '<a class="stv-go" href="#' + href + '">' + t(b.restaurantId ? "h3.order" : "ad.go") + I("chevR", 18) + "</a>" : "") + "</div>";
      box.querySelector(".stv-x").onclick = function (e) { e.stopPropagation(); close(); };
      var go = box.querySelector(".stv-go"); if (go) go.onclick = function () { clearTimeout(tm); box.remove(); };
      tm = setTimeout(function () { show(i + 1); }, 5000); }
    box.addEventListener("click", function (e) { if (e.target.closest(".stv-go,.stv-x")) return; show(e.clientX < window.innerWidth / 3 ? i - 1 : i + 1); });
    box.addEventListener("touchstart", function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    box.addEventListener("touchend", function (e) { if (y0 != null && e.changedTouches[0].clientY - y0 > 90) close(); y0 = null; });
    show(i); };

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
