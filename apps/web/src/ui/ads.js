/* TEZKOR — listings: one engine for four services — classifieds (эълонҳо), pros & services (устоҳо), jobs (кор), real estate (амвол).
   Each works only after the admin switches it on. Browse, one listing, create / edit, my listings, promotion.
   Free at launch: no prices anywhere. When the admin turns «paid» on, a placement fee and promotions appear;
   money is never taken here — the customer pays the admin and the admin confirms it in his panel. */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, money = SF.money, api = function () { return SF.api; };
  var CFG = {
    ads: { base: "/ads", icon: "megaphone", cats: [["auto", "car", "#1F2A24"], ["realty", "house", "#E03131"], ["phones", "mobile", "#0B8A4A"], ["electronics", "laptop", "#1F6FB2"], ["furniture", "sofa", "#B7791F"],
      ["clothes", "shirt", "#C2185B"], ["jobs", "briefcase", "#7A3E9D"], ["services", "wrench", "#0E7490"], ["other", "box", "#5E6964"]] },
    masters: { base: "/masters", icon: "wrench", cats: [["m_repair", "house", "#B7791F"], ["m_plumb", "wrench", "#1F6FB2"], ["m_electric", "bolt", "#E8A300"], ["m_clean", "home", "#0E8A4A"], ["m_beauty", "heart", "#C2185B"],
      ["m_auto", "car", "#1F2A24"], ["m_tutor", "users", "#7A3E9D"], ["m_move", "box", "#0E7490"], ["m_it", "laptop", "#2563EB"], ["m_other", "grid", "#5E6964"]] },
    jobs: { base: "/jobs", icon: "briefcase", cats: [["j_sales", "store", "#0E8A4A"], ["j_food", "fire", "#E8590C"], ["j_driver", "car", "#1F2A24"], ["j_build", "wrench", "#B7791F"], ["j_office", "briefcase", "#7A3E9D"],
      ["j_it", "laptop", "#2563EB"], ["j_edu", "users", "#0E7490"], ["j_med", "heart", "#C2185B"], ["j_other", "grid", "#5E6964"]] },
    realty: { base: "/realty", icon: "house", cats: [["r_flatsale", "city", "#E03131"], ["r_flatrent", "house", "#1F6FB2"], ["r_housesale", "home", "#B7791F"], ["r_houserent", "house", "#0E8A4A"], ["r_land", "map", "#5E8A0E"],
      ["r_commerce", "store", "#7A3E9D"], ["r_other", "grid", "#5E6964"]] }
  };
  var KEYS = Object.keys(CFG);
  SF.LISTINGS = CFG; SF.AD_CATS = CFG.ads.cats;
  SF.allListCats = function () { var o = []; KEYS.forEach(function (k) { o = o.concat(CFG[k].cats); }); return o; };
  /* a text for this service if it has its own, otherwise the classifieds one */
  function T(sv, key, p) { var k = "L." + sv + "." + key; return SF.I18N[k] ? t(k, p) : t("ads." + key, p); }
  function svOf(a) { return a && CFG[a.svc] ? a.svc : "ads"; }
  function catOf(a) { var c = CFG[svOf(a)].cats; return c.filter(function (x) { return x[0] === a.cat; })[0] || c[c.length - 1]; }
  function price(a) { return a.price == null ? T(svOf(a), "deal") : money(a.price); }
  function when(ms) { var d = new Date(ms), n = new Date(), y = new Date(n.getTime() - 86400000), same = function (x) { return x.toDateString() === d.toDateString(); };
    return same(n) ? t("ad.today") + ", " + SF.time(ms) : same(y) ? t("ad.yday") + ", " + SF.time(ms) : SF.date(ms) + "." + d.getFullYear(); }
  function cityName(a) { return SF.tx(a.city) || ""; }
  function back(href, title, extra) { return '<div class="svhead"><a class="svback" href="#' + href + '" aria-label="' + t("btn.back") + '">' + I("chevL", 20) + "</a><h1>" + title + "</h1>" + (extra || "") + "</div>"; }
  function isAdmin() { return SF.state.user && SF.state.user.role === "admin"; }
  /* while the admin keeps a service off, every page of it says «soon» */
  function gate(sv) { SF.state.L = sv; return SF.svcOn(sv) || isAdmin() ? null : back("/", t("sv." + sv)) + '<div class="soonbox page">' + SF.svVis(sv, true) + '<h2 class="h2">' + t("sa.soonT") + '</h2><p class="muted">' + t("sa.soonSub") + '</p><a class="btn primary" href="#/food">' + t("sa.orderFood") + "</a></div>"; }
  function stPill(s, a) { if (a && a.sold && s === "archived") return '<span class="pill p-ok">' + t("ads.sold") + "</span>"; var c = { draft: "mut", pending: "warn", active: "ok", rejected: "bad", archived: "mut", blocked: "bad" }[s] || "mut"; return '<span class="pill p-' + c + '">' + t("ads.st." + s) + "</span>"; }
  function favA(a) { var u = SF.state.user, on = !!(u && u.favs && (u.favs.a || []).indexOf(a.id) >= 0);
    return '<button type="button" class="favbtn adfav' + (on ? " on" : "") + '" data-act="fav" data-t="a" data-id="' + a.id + '" aria-pressed="' + on + '" aria-label="' + t(on ? "fav.remove" : "fav.add") + '">' + I("heart", 18) + "</button>"; }
  function thumb(a, s) { var c = catOf(a); return a.photos && a.photos[0] ? '<img src="' + esc(a.photos[0]) + '" alt="" loading="lazy">' : '<i style="color:' + c[2] + '">' + I(c[1], s || 30) + "</i>"; }
  SF.adRow = function (a, mine) { var B = CFG[svOf(a)].base;
    return '<article class="adrow' + (a.color ? " hl" : "") + '"><a class="rhit" href="#' + B + "/" + a.id + '" aria-label="' + esc(a.title) + '"></a><span class="adph">' + thumb(a) + (a.vip ? '<em class="advip">VIP</em>' : "") + "</span>" +
      '<div class="adtx"><b class="adt">' + esc(a.title) + '</b><span class="adp num">' + price(a) + "</span><small>" + t("adc." + a.cat) + " · " + esc(cityName(a)) + " · " + when(a.publishedAt || a.createdAt) + "</small>" +
      (mine ? '<span class="adst">' + stPill(a.status, a) + '<small class="num">' + I("eye", 13) + a.views + "</small></span>" : "") + "</div>" +
      (mine ? '<button type="button" class="iconbtn admore" data-act="admenu" data-id="' + a.id + '" aria-label="' + t("ads.actions") + '">' + I("dots", 20) + "</button>" : favA(a)) + "</article>"; };

  /* «+» in the bottom bar: post into one of the listing services the admin switched on */
  SF.actions.create = function () { var on = KEYS.filter(function (k) { return SF.svcOn(k); });
    if (!on.length) { SF.actions.soon({ dataset: { k: "ads" } }); return; }
    if (on.length === 1) { SF.state.adf = null; SF.go(CFG[on[0]].base + "/new"); return; }
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><h2 class="h2">' + t("sa.createQ") + '</h2><div class="svlist">' + on.map(function (k, i) {
      return '<a class="svrowi" href="#' + CFG[k].base + '/new" data-act="closemodal" style="--sb:#F2F4F3;--i:' + i + '">' + SF.svVis(k) + '<span class="grow"><b>' + T(k, "new") + "</b><small>" + t("svd." + k) + "</small></span>" + I("chevR", 18) + "</a>"; }).join("") + "</div>"); };

  function draft() { return SF.state.adf; }
  function loadCfg() { return api().get("/ads/config").then(function (c) { SF.state.adcfg = c; return c; }); }
  var TABS = [["active", ["active"]], ["pending", ["pending", "rejected"]], ["draft", ["draft"]], ["archived", ["archived", "blocked"]]];

  /* filters live in the address (cat, q, min, max, cond, photo, sort, all) so a search can be shared */
  var FK = ["cat", "q", "min", "max", "cond", "photo", "sort", "all"];
  function qsOf(o) { return FK.filter(function (k) { return o[k]; }).map(function (k) { return k + "=" + encodeURIComponent(o[k]); }).join("&"); }
  function nFilters(q) { return ["min", "max", "cond", "photo"].filter(function (k) { return q[k]; }).length; }
  function cityOfView() { var c = (SF.state.cities || []).filter(function (x) { return x.id === SF.state.cityId; })[0]; return c ? SF.tx(c.name) : ""; }
  function searchQs(sv, q, off) { return "svc=" + sv + (q.all ? "" : "&cityId=" + encodeURIComponent(SF.state.cityId)) + (q.cat ? "&cat=" + q.cat : "") + (q.q ? "&q=" + encodeURIComponent(q.q) : "") + (q.min ? "&priceMin=" + encodeURIComponent(q.min) : "") + (q.max ? "&priceMax=" + encodeURIComponent(q.max) : "") + (q.cond ? "&cond=" + q.cond : "") + (q.photo ? "&photo=1" : "") + (q.sort ? "&sort=" + q.sort : "") + "&offset=" + off + "&limit=20"; }
  function curQ() { return SF.match(SF.path()).query || {}; }
  SF.actions.admorelist = function (el) { var off = +el.dataset.off, qs = el.dataset.qs.replace(/offset=\d+/, "offset=" + off);
    return api().get("/ads/search?" + qs).then(function (r) { var box = document.getElementById("adlist"); if (!box) return;
      box.insertAdjacentHTML("beforeend", r.list.map(function (a) { return SF.adRow(a); }).join("")); off += r.list.length; el.dataset.off = off; if (off >= r.total || !r.list.length) el.remove(); }); };
  SF.inputs.adsort = function (v) { var q = curQ(); q.sort = v; SF.go(CFG[SF.state.L || "ads"].base + "?" + qsOf(q)); };
  SF.actions.adfilters = function () { var q = curQ(), sv = SF.state.L || "ads";
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="adfilter"><h2 class="h2">' + t("af.title") + "</h2>" +
      '<div class="grid2"><label class="f">' + t("af.min") + '<input name="min" inputmode="numeric" value="' + esc(q.min || "") + '" placeholder="0"></label><label class="f">' + t("af.max") + '<input name="max" inputmode="numeric" value="' + esc(q.max || "") + '" placeholder="∞"></label></div>' +
      (sv === "ads" ? '<p class="adlbl">' + t("af.cond") + '</p><div class="seg" role="group">' + [["", "af.c.any"], ["new", "af.c.new"], ["used", "af.c.used"]].map(function (o) { return '<label class="segr' + ((q.cond || "") === o[0] ? " on" : "") + '"><input type="radio" name="cond" value="' + o[0] + '"' + ((q.cond || "") === o[0] ? " checked" : "") + ">" + t(o[1]) + "</label>"; }).join("") + "</div>" : "") +
      '<label class="checkrow"><input type="checkbox" name="photo"' + (q.photo ? " checked" : "") + "><span>" + t("af.photo") + '</span></label><label class="checkrow"><input type="checkbox" name="all"' + (q.all ? " checked" : "") + "><span>" + t("af.allTj") + "</span></label>" +
      '<div class="row2"><a class="btn ghost" href="#' + CFG[sv].base + (q.q || q.cat ? "?" + qsOf({ q: q.q, cat: q.cat }) : "") + '" data-act="closemodal">' + t("af.reset") + '</a><button class="btn primary">' + t("af.apply") + "</button></div></form>"); };
  SF.forms.adfilter = function (fd) { var q = curQ(), o = { cat: q.cat, q: q.q, sort: q.sort, min: String(fd.min || "").replace(/\D/g, ""), max: String(fd.max || "").replace(/\D/g, ""), cond: fd.cond || "", photo: fd.photo ? "1" : "", all: fd.all ? "1" : "" };
    SF.closeModal(); SF.go(CFG[SF.state.L || "ads"].base + "?" + qsOf(o)); };

  KEYS.forEach(function (sv) { var C = CFG[sv], B = C.base;
    /* ---------- list: search, filters, sort, category counts, pages ---------- */
    SF.route(B, { title: "sv." + sv, render: function (p, q) { var g = gate(sv); if (g) return g;
      var cat = q.cat || "", s = q.q || "";
      return api().get("/ads/search?" + searchQs(sv, q, 0)).then(function (r) { var n = nFilters(q), city = cityOfView(q);
        return back("/", t("sv." + sv), '<a class="iconbtn" href="#' + B + '/my" aria-label="' + T(sv, "my") + '">' + I("list", 20) + "</a>") +
          '<form class="sasearch slim" data-form="adsearch" role="search">' + I("search", 20) + '<input name="q" value="' + esc(s) + '" placeholder="' + T(sv, "searchPh") + '" aria-label="' + T(sv, "searchPh") + '" enterkeyhint="search"><button class="sago" aria-label="' + t("btn.find") + '">' + I("chevR", 18) + "</button></form>" +
          '<div class="adtools"><button type="button" class="btn ghost sm" data-act="adfilters">' + I("sliders", 16) + t("af.title") + (n ? ' <i class="num fbadge">' + n + "</i>" : "") + '</button>' +
            '<label class="adsort"><span class="sr">' + t("af.sort") + '</span><select data-input="adsort" aria-label="' + t("af.sort") + '">' + [["", "af.s.rel"], ["new", "af.s.new"], ["cheap", "ps.cheap"], ["dear", "ps.dear"]].map(function (o) { return '<option value="' + o[0] + '"' + ((q.sort || "") === o[0] ? " selected" : "") + ">" + t(o[1]) + "</option>"; }).join("") + "</select></label>" +
            '<a class="fchip cityc' + (q.all ? "" : " on") + '" href="#' + B + "?" + qsOf(Object.assign({}, q, { all: q.all ? "" : "1" })) + '">' + I("pin", 14) + (q.all ? t("af.allTj") : esc(city)) + "</a></div>" +
          '<div class="chips adchips" role="group" aria-label="' + t("ads.cats") + '"><a class="fchip' + (cat ? "" : " on") + '" href="#' + B + "?" + qsOf(Object.assign({}, q, { cat: "" })) + '">' + t("home.all") + ' <i class="num">' + r.all + "</i></a>" + C.cats.map(function (c) { return '<a class="fchip' + (cat === c[0] ? " on" : "") + '" href="#' + B + "?" + qsOf(Object.assign({}, q, { cat: c[0] })) + '">' + t("adc." + c[0]) + (r.counts[c[0]] ? ' <i class="num">' + r.counts[c[0]] + "</i>" : "") + "</a>"; }).join("") + "</div>" +
          '<p class="adtotal num">' + t("af.found", { n: r.total }) + "</p>" +
          (r.list.length ? '<div class="adlist" id="adlist">' + r.list.map(function (a) { return SF.adRow(a); }).join("") + "</div>" + (r.total > r.list.length ? '<button type="button" class="btn ghost block admore2" data-act="admorelist" data-sv="' + sv + '" data-off="' + r.list.length + '" data-total="' + r.total + '" data-qs="' + esc(searchQs(sv, q, 0)) + '">' + t("af.more") + "</button>" : "")
            : SF.empty(C.icon, t(s || cat || n ? "ads.noneFound" : "ads.none"), T(sv, "noneSub"), n || cat || s ? '<a class="btn ghost" href="#' + B + '">' + t("af.reset") + "</a>" : "")) +
          '<a class="adfab" href="#' + B + '/new">' + I("plus", 20) + T(sv, "place") + "</a>";
      });
    } });

    /* ---------- create ---------- */
    SF.route(B + "/new", { roles: ["customer"], title: "ads.new", render: function () { var g = gate(sv); if (g) return g;
      if (!draft() || draft().id || draft().svc !== sv) SF.state.adf = fresh(sv); return loadCfg().then(function () { return formPage(sv, null); }); } });

    /* ---------- my listings ---------- */
    SF.route(B + "/my", { roles: ["customer"], title: "ads.my", render: function (p, q) { var g = gate(sv); if (g) return g;
      return api().get("/ads/my?svc=" + sv).then(function (all) { var tab = q.tab || "active", cur = TABS.filter(function (x) { return x[0] === tab; })[0] || TABS[0];
        SF.state.myads = all; var list = all.filter(function (a) { return cur[1].indexOf(a.status) >= 0; }), others = KEYS.filter(function (k) { return k !== sv && SF.svcOn(k); });
        return back("/profile", T(sv, "my")) +
          (others.length ? '<div class="chips adchips">' + [sv].concat(others).map(function (k) { return '<a class="fchip' + (k === sv ? " on" : "") + '" href="#' + CFG[k].base + '/my">' + t("sv." + k) + "</a>"; }).join("") + "</div>" : "") +
          '<div class="segtabs" role="tablist">' + TABS.map(function (x) { var n = all.filter(function (a) { return x[1].indexOf(a.status) >= 0; }).length, on = x === cur;
            return '<a role="tab" aria-selected="' + on + '" class="segt' + (on ? " on" : "") + '" href="#' + B + "/my?tab=" + x[0] + '">' + t("ads.tab." + x[0]) + (n ? ' <i class="num">' + n + "</i>" : "") + "</a>"; }).join("") + "</div>" +
          (list.length ? '<div class="adlist">' + list.map(function (a) { return SF.adRow(a, true) + (a.reason && (a.status === "rejected" || a.status === "blocked") ? '<p class="adwhy">' + I("info", 15) + esc(a.reason) + "</p>" : ""); }).join("") + "</div>"
            : SF.empty(C.icon, t("ads.myNone." + cur[0]), t("ads.myNoneSub"))) +
          '<a class="adfab" href="#' + B + '/new">' + I("plus", 20) + T(sv, "place") + "</a>";
      }); } });

    /* ---------- edit ---------- */
    SF.route(B + "/:id/edit", { roles: ["customer"], title: "ads.edit", render: function (p) { var g = gate(sv); if (g) return g;
      return Promise.all([api().get("/ads/" + p.id), loadCfg()]).then(function (r) { var a = r[0];
        if (!draft() || draft().id !== a.id) SF.state.adf = { id: a.id, svc: sv, cat: a.cat, title: a.title, desc: a.desc || "", price: a.price == null ? "" : String(a.price), cityId: a.cityId, phone: String(a.phone || "").replace(/\D/g, "").slice(-9), photos: (a.photos || []).slice(), cond: a.cond || "" };
        return formPage(sv, a); }); } });

    /* ---------- promotion (only while paid listings are on) ---------- */
    SF.route(B + "/:id/promote", { roles: ["customer"], title: "ads.promoT", render: function (p) { var g = gate(sv); if (g) return g;
      return Promise.all([api().get("/ads/" + p.id), loadCfg()]).then(function (r) { var a = r[0], c = r[1], sel = SF.state.adpk || "";
        if (!c.paid) { setTimeout(function () { SF.go(B + "/my"); }, 0); return ""; }
        var opts = [["top", "up", "#F06A1F"], ["color", "palette", "#7C3AED"], ["vip", "crown", "#F2A20C"]];
        return back(B + "/my", t("ads.promoT")) + '<div class="adprom">' + '<div class="adrow mini"><span class="adph">' + thumb(a) + '</span><div class="adtx"><b class="adt">' + esc(a.title) + '</b><span class="adp num">' + price(a) + "</span><small>" + esc(cityName(a)) + "</small></div></div>" +
          '<div class="promlist" role="radiogroup" aria-label="' + t("ads.promoT") + '">' +
            '<button type="button" role="radio" aria-checked="' + !sel + '" class="prom' + (sel ? "" : " on") + '" data-act="adpk" data-v=""><span class="pmi" style="--pc:#0B8A4A">' + I("image", 22) + '</span><span class="grow"><b>' + t("ads.p.basic") + "</b><small>" + t("ads.p.basicSub", { n: c.days }) + '</small></span><em class="num">' + (c.fee ? money(c.fee) : t("ads.free")) + "</em></button>" +
            opts.map(function (o) { var on = sel === o[0]; return '<button type="button" role="radio" aria-checked="' + on + '" class="prom' + (on ? " on" : "") + '" data-act="adpk" data-v="' + o[0] + '"><span class="pmi" style="--pc:' + o[2] + '">' + I(o[1], 22) + '</span><span class="grow"><b>' + t("ads.p." + o[0]) + "</b><small>" + t("ads.p." + o[0] + "Sub") + '</small></span><em class="num">' + money(c[o[0]]) + "</em></button>"; }).join("") + "</div>" +
          '<button type="button" class="btn ok block lg" data-act="adpublish">' + t(c.fee ? "ads.publish" : "ads.publishFree") + "</button>" +
          '<button type="button" class="btn ghost block lg" data-act="adpay" data-id="' + a.id + '"' + (sel ? "" : " disabled") + ">" + t("ads.choosePay") + "</button>" +
          '<p class="fine">' + I("info", 14) + t("ads.payNote") + "</p></div>";
      }); } });

    /* ---------- one listing (last: /new and /my come first) ---------- */
    SF.route(B + "/:id", { title: "sv." + sv, render: function (p) { var g = gate(sv); if (g) return g;
      return api().get("/ads/" + p.id).then(function (a) { return (a.status === "active" ? api().get("/ads/" + p.id + "/more").catch(function () { return null; }) : Promise.resolve(null)).then(function (more) { return [a, more]; }); }).then(function (rr) { var a = rr[0], more = rr[1]; var ph = a.photos || [], c = catOf(a), mine = a.mine;
        var digits = String(a.phone || "").replace(/\D/g, ""); if (digits.length === 9) digits = "992" + digits;
        var gal = '<div class="adgalw"><div class="adgal" id="adgal">' + (ph.length ? ph.map(function (x) { return '<img src="' + esc(x) + '" alt="">'; }).join("") : '<span class="adnoph" style="color:' + c[2] + '">' + I(c[1], 64) + "</span>") + "</div>" +
          '<a class="gbtn gl" href="#' + B + '" aria-label="' + t("btn.back") + '">' + I("chevL", 20) + '</a><span class="gbtns"><button type="button" class="gbtn" data-act="adshare" data-title="' + esc(a.title) + '" aria-label="' + t("ads.share") + '">' + I("share", 18) + "</button>" + (mine ? "" : favA(a).replace("favbtn adfav", "favbtn adfav gbtn")) + "</span>" +
          (ph.length > 1 ? '<span class="gcount num" id="gcount">1/' + ph.length + "</span>" : "") + "</div>";
        var info = '<section class="adinfo">' + (mine ? '<div class="adown">' + stPill(a.status, a) + (a.reason ? '<p class="adwhy">' + I("info", 16) + esc(a.reason) + "</p>" : "") + (a.awaiting ? '<p class="adwhy warn">' + I("wallet", 16) + t("ads.awaiting") + "</p>" : "") + "</div>" : "") +
          "<h1>" + esc(a.title) + '</h1><b class="adprice num">' + price(a) + '</b><p class="adwhere">' + I("pin", 15) + esc(cityName(a)) + " · " + when(a.publishedAt || a.createdAt) + "</p>" +
          (a.desc ? '<p class="addesc">' + esc(a.desc).replace(/\n/g, "<br>") + "</p>" : "") +
          '<dl class="adattrs"><dt>' + t("ads.cat") + "</dt><dd>" + t("adc." + a.cat) + "</dd>" + (a.cond ? "<dt>" + t("af.cond") + "</dt><dd>" + t("af.c." + a.cond) + "</dd>" : "") + "<dt>" + t("profile.city") + "</dt><dd>" + esc(cityName(a)) + "</dd><dt>" + t("ads.views") + '</dt><dd class="num">' + a.views + "</dd>" + (mine ? "" : "<dt>" + T(sv, "seller") + "</dt><dd>" + esc(a.seller) + "</dd>") + "</dl>" +
          (mine || !more ? "" : sellerCard(a, more.sellerInfo)) +
          (mine ? "" : '<p class="fine adsafe">' + I("shield", 14) + T(sv, "safety") + '</p><button type="button" class="link sm adrep" data-act="adreport" data-id="' + a.id + '">' + I("flag", 14) + " " + t("rp.btn") + "</button>") + "</section>" +
          (more && more.seller.length ? '<section class="admore"><h3>' + t("sc2.other") + '</h3><div class="adlist">' + more.seller.map(function (x) { return SF.adRow(x); }).join("") + "</div></section>" : "") +
          (more && more.similar.length ? '<section class="admore"><h3>' + t("sc2.similar") + '</h3><div class="adlist">' + more.similar.map(function (x) { return SF.adRow(x); }).join("") + "</div></section>" : "");
        var bar = mine ? '<div class="adbar">' + (a.status !== "blocked" ? '<a class="btn ghost" href="#' + B + "/" + a.id + '/edit">' + I("edit", 18) + t("btn.edit") + "</a>" : "") + '<button type="button" class="btn primary" data-act="admenu" data-id="' + a.id + '">' + I("dots", 18) + t("ads.actions") + "</button></div>"
          : '<div class="adbar"><button type="button" class="btn ghost adcall" data-act="call" data-name="' + esc(a.seller) + '" data-phone="' + esc(a.phone) + '" data-sub="' + esc(a.title) + '">' + I("phone", 18) + t("ads.call") + '</button><a class="btn ok adwrite" target="_blank" rel="noopener" href="https://wa.me/' + digits + "?text=" + encodeURIComponent(t("ads.waText", { title: a.title })) + '">' + I("chat", 18) + t("ads.write") + "</a></div>";
        if (mine) SF.state.myads = [a];
        return '<div class="adview">' + gal + info + bar + "</div>";
      });
    } });
  });

  function sellerCard(a, si) { if (!si) return "";
    return '<div class="adseller"><span class="avatar">' + esc((si.name || "?").charAt(0)) + '</span><div class="grow"><b>' + esc(si.name) + (si.verified ? ' <span class="vok" title="' + t("vfa.verified") + '">' + I("check", 12) + "</span>" : "") + "</b><small>" + t("sc2.since", { d: si.since ? new Date(si.since).getFullYear() + "" : "—" }) + " · " + t("sc2.n", { n: si.active }) + "</small></div></div>"; }
  /* report a listing */
  SF.actions.adreport = function (el) { if (!SF.state.user) { SF.go("/login"); return; }
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="adreport" data-id="' + el.dataset.id + '"><h2 class="h2">' + t("rp.t") + "</h2>" +
      ["spam", "fraud", "wrong", "sold", "other"].map(function (k, i) { return '<label class="checkrow"><input type="radio" name="reason" value="' + k + '"' + (i ? "" : " checked") + "><span>" + t("rp." + k) + "</span></label>"; }).join("") +
      '<label class="f">' + t("rp.text") + '<textarea name="text" rows="3" maxlength="300"></textarea></label><button class="btn danger block">' + t("rp.send") + "</button></form>"); };
  SF.forms.adreport = function (fd, f) { return api().post("/ads/" + f.dataset.id + "/report", { reason: fd.reason, text: fd.text }).then(function () { SF.closeModal(); SF.toast(t("rp.done")); }); };
  SF.forms.adsearch = function (fd) { var q = curQ(); q.q = fd.q || ""; SF.go(CFG[SF.state.L || "ads"].base + "?" + qsOf(q)); };
  SF.after.push(function () { var g = document.getElementById("adgal"), c = document.getElementById("gcount"); if (!g || !c) return;
    g.onscroll = function () { c.textContent = (Math.round(g.scrollLeft / Math.max(1, g.clientWidth)) + 1) + "/" + g.children.length; }; });
  SF.actions.adshare = function (el) { var url = location.href, title = el.dataset.title;
    if (navigator.share) return navigator.share({ title: title, url: url }).catch(function () {});
    try { navigator.clipboard.writeText(url).then(function () { SF.toast(t("ads.copied")); }); } catch (e) { SF.toast(url, "info"); } };

  /* ---------- the form (create / edit) ---------- */
  function fresh(sv) { var u = SF.state.user; return { id: null, svc: sv, cat: "", title: "", desc: "", price: "", cityId: SF.state.cityId, phone: String(u.phone || "").replace(/\D/g, "").slice(-9), photos: [], cond: "" }; }
  function formPage(sv, a) {
    var d = draft(), cities = SF.state.cities || [], B = CFG[sv].base;
    return back(a ? B + "/" + a.id : B, T(sv, a ? "edit" : "new")) +
      '<div class="adform">' + (a && a.status === "active" ? '<p class="note">' + I("info", 16) + t("ads.recheck") + "</p>" : "") +
      '<p class="adlbl">' + t("ads.pickCat") + '</p><div class="adcats" role="radiogroup" aria-label="' + t("ads.cat") + '">' + CFG[sv].cats.map(function (c) { var on = d.cat === c[0];
        return '<button type="button" role="radio" aria-checked="' + on + '" class="adcat' + (on ? " on" : "") + '" data-act="adcat" data-v="' + c[0] + '" style="--cc:' + c[2] + '">' + I(c[1], 24) + "<span>" + t("adc." + c[0]) + "</span></button>"; }).join("") + "</div>" +
      '<p class="adlbl">' + t("ads.photos") + ' <small class="muted">' + t("ads.photosMax", { n: d.photos.length }) + '</small></p><div class="adphotos">' +
        (d.photos.length < 10 ? '<label class="adadd">' + I("camera", 26) + "<span>" + t("ads.addPhoto") + "</span><small>" + t("ads.upTo") + '</small><input type="file" accept="image/*" multiple data-input="adph"></label>' : "") +
        d.photos.map(function (x, i) { return '<span class="adpic"><img src="' + esc(x) + '" alt="">' + (i ? "" : '<em class="adcov">' + t("ads.cover") + "</em>") + '<button type="button" class="adpicx" data-act="adphdel" data-i="' + i + '" aria-label="' + t("ads.delPhoto") + '">' + I("x", 14) + "</button></span>"; }).join("") + "</div>" +
      '<label class="f">' + t("ads.title") + '<input data-input="adf" data-k="title" value="' + esc(d.title) + '" maxlength="80" placeholder="' + T(sv, "titlePh") + '"></label>' +
      '<label class="f">' + t("ads.desc") + '<textarea data-input="adf" data-k="desc" rows="4" maxlength="3000" placeholder="' + T(sv, "descPh") + '">' + esc(d.desc) + "</textarea></label>" +
      '<div class="grid2"><label class="f">' + T(sv, "price") + '<input data-input="adf" data-k="price" inputmode="numeric" value="' + esc(d.price) + '" placeholder="0"><small class="muted">' + T(sv, "priceHint") + "</small></label>" +
      '<label class="f">' + t("profile.city") + '<select data-input="adf" data-k="cityId">' + cities.map(function (c) { return '<option value="' + c.id + '"' + (c.id === d.cityId ? " selected" : "") + ">" + esc(SF.tx(c.name)) + "</option>"; }).join("") + "</select></label></div>" +
      (sv === "ads" && ["jobs", "services", "realty"].indexOf(d.cat) < 0 ? '<p class="adlbl">' + t("af.cond") + '</p><div class="seg" role="group">' + [["", "af.c.na"], ["new", "af.c.new"], ["used", "af.c.used"]].map(function (o) { var on = (d.cond || "") === o[0]; return '<button type="button" class="' + (on ? "on" : "") + '" aria-pressed="' + on + '" data-act="adcond" data-v="' + o[0] + '">' + t(o[1]) + "</button>"; }).join("") + "</div>" : "") +
      '<label class="f">' + t("ads.phone") + '<span class="phonein"><span class="cc">+992</span><input data-input="adf" data-k="phone" inputmode="tel" value="' + esc(d.phone) + '" placeholder="9X XXX XX XX"></span></label>' +
      '<button type="button" class="btn ok block lg" data-act="adsave">' + t("ads.continue") + "</button>" +
      ((!a || a.status === "draft") ? '<button type="button" class="btn ghost block" data-act="adsave" data-draft="1">' + t("ads.saveDraft") + "</button>" : "") +
      '<p class="fine">' + I("shield", 14) + t(((SF.state.adcfg || {}).moderation === false) ? "ads.rulesNoMod" : "ads.rules") + "</p></div>";
  }
  SF.inputs.adf = function (v, el) { draft()[el.dataset.k] = v; };
  SF.actions.adcond = function (el) { draft().cond = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.adcat = function (el) { draft().cat = el.dataset.v; document.querySelectorAll(".adcat").forEach(function (b) { var on = b === el; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }); };
  SF.inputs.adph = function (v, el) { var fs = Array.prototype.slice.call(el.files || []), d = draft(); if (!fs.length) return;
    fs = fs.slice(0, 10 - d.photos.length); SF.toast(t("ads.photoWait"), "info");
    return fs.reduce(function (pr, f) { return pr.then(function () { return SF.shrinkImage(f, 1100, 0.78).then(function (x) { d.photos.push(x); }, function () { SF.toast(t("tr.notImage"), "err"); }); }); }, Promise.resolve())
      .then(function () { SF.render({ quiet: true }); }); };
  SF.actions.adphdel = function (el) { draft().photos.splice(+el.dataset.i, 1); SF.render({ quiet: true }); };
  SF.actions.adsave = function (el) { var d = draft(), isDraft = !!el.dataset.draft, B = CFG[d.svc || "ads"].base;
    if (!d.cat) { SF.toast(t("ads.needCat"), "err"); return; } if (String(d.title).trim().length < 3) { SF.toast(t("e.BAD_AD_TITLE"), "err"); return; }
    var body = { svc: d.svc, cat: d.cat, title: d.title, desc: d.desc, price: String(d.price).replace(/\D/g, ""), cityId: d.cityId, phone: d.phone, photos: d.photos, cond: d.cond || "", draft: isDraft };
    return (d.id ? api().patch("/ads/" + d.id, body) : api().post("/ads", body)).then(function (a) { SF.state.adf = null;
      if (isDraft) { SF.toast(t("ads.draftSaved")); SF.go(B + "/my?tab=draft"); return; }
      if ((SF.state.adcfg || {}).paid && ["active", "pending"].indexOf(a.status) >= 0) { SF.go(B + "/" + a.id + "/promote"); return; }
      SF.toast(t(a.status === "active" ? "ads.published" : "ads.sent")); SF.go(B + "/my?tab=" + (a.status === "active" ? "active" : "pending")); }); };
  SF.actions.adpk = function (el) { SF.state.adpk = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.adpublish = function () { SF.state.adpk = ""; SF.toast(t("ads.sent")); SF.go(CFG[SF.state.L || "ads"].base + "/my?tab=pending"); };
  SF.actions.adpay = function (el) { var k = SF.state.adpk; if (!k) return;
    return api().post("/ads/" + el.dataset.id + "/promote", { kind: k }).then(function (x) { SF.state.adpk = ""; var pub = SF.state.pub || {};
      SF.modal('<div class="confirm"><span class="cic">' + I("wallet", 26) + '</span><h2 class="h2">' + t("ads.payAskT") + '</h2><p class="muted">' + t("ads.payAsk", { sum: money(x.amount), phone: esc(pub.supportPhone || "") }) + '</p><a class="btn primary block" href="#' + CFG[SF.state.L || "ads"].base + '/my" data-act="closemodal">' + T(SF.state.L || "ads", "my") + "</a></div>"); }); };

  /* ---------- actions on my listing ---------- */
  SF.actions.admenu = function (el) { var a = (SF.state.myads || []).filter(function (x) { return x.id === el.dataset.id; })[0]; if (!a) return; var B = CFG[svOf(a)].base;
    var paid = (SF.state.pub || {}).adsPaid, b = function (act, ic, key, cls) { return '<button type="button" class="prow' + (cls ? " " + cls : "") + '" data-act="' + act + '" data-id="' + a.id + '"><span class="pic">' + I(ic, 20) + '</span><span class="grow">' + t(key) + "</span></button>"; };
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><h2 class="h2">' + esc(a.title) + '</h2><nav class="plist card">' +
      '<a class="prow" href="#' + B + "/" + a.id + '" data-act="closemodal"><span class="pic">' + I("eye", 20) + '</span><span class="grow">' + t("ads.view") + "</span></a>" +
      (a.status !== "blocked" ? '<a class="prow" href="#' + B + "/" + a.id + '/edit" data-act="closemodal"><span class="pic">' + I("edit", 20) + '</span><span class="grow">' + t("btn.edit") + "</span></a>" : "") +
      (a.status === "draft" ? b("adsend", "send", "ads.send") : "") +
      (paid && ["active", "pending"].indexOf(a.status) >= 0 ? '<a class="prow" href="#' + B + "/" + a.id + '/promote" data-act="closemodal"><span class="pic">' + I("up", 20) + '</span><span class="grow">' + t("ads.promote") + "</span></a>" : "") +
      (a.status === "active" ? b("adbump", "up", "ads.bump") + b("adsold", "check", "ads.markSold") : "") + (["active", "pending", "rejected"].indexOf(a.status) >= 0 ? b("adarch", "box", "ads.archive") : "") + (a.status === "archived" ? b("adrestore", "route", "ads.restore") : "") +
      b("addel", "trash", "ads.delete", "danger") + "</nav>"); };
  function reload(msg) { return function () { SF.closeModal(); if (msg) SF.toast(t(msg)); SF.render({ quiet: true }); }; }
  SF.actions.adsend = function (el) { return api().patch("/ads/" + el.dataset.id, {}).then(reload("ads.sent")); };
  SF.actions.adbump = function (el) { return api().post("/ads/" + el.dataset.id + "/bump").then(reload("ads.bumped")); };
  SF.actions.adsold = function (el) { return api().post("/ads/" + el.dataset.id + "/sold").then(reload("ads.soldToast")); };
  SF.actions.adarch = function (el) { return api().post("/ads/" + el.dataset.id + "/archive").then(reload("ads.archived")); };
  SF.actions.adrestore = function (el) { return api().post("/ads/" + el.dataset.id + "/restore").then(reload("ads.sent")); };
  SF.actions.addel = function (el) { SF.modal('<div class="confirm"><span class="cic bad">' + I("trash", 26) + '</span><h2 class="h2">' + t("ads.delQ") + '</h2><p class="muted">' + t("ads.delSub") + '</p><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn danger" data-act="addelok" data-id="' + el.dataset.id + '">' + t("ads.delete") + "</button></div></div>"); };
  SF.actions.addelok = function (el) { return api().del("/ads/" + el.dataset.id).then(function () { SF.closeModal(); SF.toast(t("ads.deleted")); var B = CFG[SF.state.L || "ads"].base;
    if (SF.path().split("?")[0] !== B + "/my") SF.go(B + "/my"); else SF.render({ quiet: true }); }); };
})();
