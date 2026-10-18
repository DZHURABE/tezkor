/* TEZKOR — classifieds (эълонҳо): browse, one ad, create / edit, my ads, promotion.
   The section works only after the admin switches it on. Free at launch: no prices anywhere.
   When the admin turns «paid ads» on, a placement fee and promotions appear; money is never taken here —
   the customer pays the admin and the admin confirms it in his panel. */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, money = SF.money, api = function () { return SF.api; };
  var CATS = [["auto", "car", "#1F2A24"], ["realty", "house", "#E03131"], ["phones", "mobile", "#0B8A4A"], ["electronics", "laptop", "#1F6FB2"], ["furniture", "sofa", "#B7791F"],
    ["clothes", "shirt", "#C2185B"], ["jobs", "briefcase", "#7A3E9D"], ["services", "wrench", "#0E7490"], ["other", "box", "#5E6964"]];
  SF.AD_CATS = CATS;
  function catOf(k) { return CATS.filter(function (c) { return c[0] === k; })[0] || CATS[8]; }
  function price(a) { return a.price == null ? t("ad.deal") : money(a.price); }
  function when(ms) { var d = new Date(ms), n = new Date(), y = new Date(n.getTime() - 86400000), same = function (x) { return x.toDateString() === d.toDateString(); };
    return same(n) ? t("ad.today") + ", " + SF.time(ms) : same(y) ? t("ad.yday") + ", " + SF.time(ms) : SF.date(ms) + "." + d.getFullYear(); }
  function cityName(a) { return SF.tx(a.city) || ""; }
  function back(href, title, extra) { return '<div class="svhead"><a class="svback" href="#' + href + '" aria-label="' + t("btn.back") + '">' + I("chevL", 20) + "</a><h1>" + title + "</h1>" + (extra || "") + "</div>"; }
  function isAdmin() { return SF.state.user && SF.state.user.role === "admin"; }
  /* while the admin keeps the section off, every page of it says «soon» */
  function gate() { return SF.svcOn("ads") || isAdmin() ? null : back("/", t("sv.ads")) + '<div class="soonbox page">' + '<span class="sbig" aria-hidden="true">📢</span><h2 class="h2">' + t("sa.soonT") + '</h2><p class="muted">' + t("sa.soonSub") + '</p><a class="btn primary" href="#/food">🍔 ' + t("sa.orderFood") + "</a></div>"; }
  function stPill(s) { var c = { draft: "mut", pending: "warn", active: "ok", rejected: "bad", archived: "mut", blocked: "bad" }[s] || "mut"; return '<span class="pill p-' + c + '">' + t("ads.st." + s) + "</span>"; }
  function favA(a) { var u = SF.state.user, on = !!(u && u.favs && (u.favs.a || []).indexOf(a.id) >= 0);
    return '<button type="button" class="favbtn adfav' + (on ? " on" : "") + '" data-act="fav" data-t="a" data-id="' + a.id + '" aria-pressed="' + on + '" aria-label="' + t(on ? "fav.remove" : "fav.add") + '">' + I("heart", 18) + "</button>"; }
  function thumb(a, s) { var c = catOf(a.cat); return a.photos && a.photos[0] ? '<img src="' + esc(a.photos[0]) + '" alt="" loading="lazy">' : '<i style="color:' + c[2] + '">' + I(c[1], s || 30) + "</i>"; }
  SF.adRow = function (a, mine) {
    return '<article class="adrow' + (a.color ? " hl" : "") + '"><a class="rhit" href="#/ads/' + a.id + '" aria-label="' + esc(a.title) + '"></a><span class="adph">' + thumb(a) + (a.vip ? '<em class="advip">VIP</em>' : "") + "</span>" +
      '<div class="adtx"><b class="adt">' + esc(a.title) + '</b><span class="adp num">' + price(a) + "</span><small>" + esc(cityName(a)) + " · " + when(a.publishedAt || a.createdAt) + "</small>" +
      (mine ? '<span class="adst">' + stPill(a.status) + '<small class="num">' + I("eye", 13) + a.views + "</small></span>" : "") + "</div>" +
      (mine ? '<button type="button" class="iconbtn admore" data-act="admenu" data-id="' + a.id + '" aria-label="' + t("ads.actions") + '">' + I("dots", 20) + "</button>" : favA(a)) + "</article>"; };

  /* ---------- list ---------- */
  SF.route("/ads", { title: "sv.ads", render: function (p, q) { var g = gate(); if (g) return g;
    var cat = q.cat || "", s = q.q || "";
    return api().get("/ads?cityId=" + encodeURIComponent(SF.state.cityId) + (cat ? "&cat=" + cat : "") + (s ? "&q=" + encodeURIComponent(s) : "")).then(function (list) {
      return back("/", t("sv.ads"), '<a class="iconbtn" href="#/ads/my" aria-label="' + t("ads.my") + '">' + I("list", 20) + "</a>") +
        '<form class="sasearch slim" data-form="adsearch" role="search">' + I("search", 20) + '<input name="q" value="' + esc(s) + '" placeholder="' + t("ads.searchPh") + '" aria-label="' + t("ads.searchPh") + '" enterkeyhint="search"><input type="hidden" name="cat" value="' + esc(cat) + '"><button class="sago" aria-label="' + t("btn.find") + '">' + I("chevR", 18) + "</button></form>" +
        '<div class="chips adchips" role="group" aria-label="' + t("ads.cats") + '"><a class="fchip' + (cat ? "" : " on") + '" href="#/ads">' + t("home.all") + "</a>" + CATS.map(function (c) { return '<a class="fchip' + (cat === c[0] ? " on" : "") + '" href="#/ads?cat=' + c[0] + '">' + t("adc." + c[0]) + "</a>"; }).join("") + "</div>" +
        (list.length ? '<div class="adlist">' + list.map(function (a) { return SF.adRow(a); }).join("") + "</div>" : SF.empty("megaphone", t(s || cat ? "ads.noneFound" : "ads.none"), t("ads.noneSub"))) +
        '<button type="button" class="adfab" data-act="create">' + I("plus", 20) + t("ads.place") + "</button>";
    });
  } });
  SF.forms.adsearch = function (fd) { SF.go("/ads?" + (fd.cat ? "cat=" + fd.cat + "&" : "") + "q=" + encodeURIComponent(fd.q || "")); };

  SF.after.push(function () { var g = document.getElementById("adgal"), c = document.getElementById("gcount"); if (!g || !c) return;
    g.onscroll = function () { c.textContent = (Math.round(g.scrollLeft / Math.max(1, g.clientWidth)) + 1) + "/" + g.children.length; }; });
  SF.actions.adshare = function (el) { var url = location.href, title = el.dataset.title;
    if (navigator.share) return navigator.share({ title: title, url: url }).catch(function () {});
    try { navigator.clipboard.writeText(url).then(function () { SF.toast(t("ads.copied")); }); } catch (e) { SF.toast(url, "info"); } };

  /* ---------- create / edit ---------- */
  function draft() { return SF.state.adf; }
  function formPage(a) {
    var d = draft(), cities = SF.state.cities || [];
    return back(a ? "/ads/" + a.id : "/ads", t(a ? "ads.edit" : "ads.new")) +
      '<div class="adform">' + (a && a.status === "active" ? '<p class="note">' + I("info", 16) + t("ads.recheck") + "</p>" : "") +
      '<p class="adlbl">' + t("ads.pickCat") + '</p><div class="adcats" role="radiogroup" aria-label="' + t("ads.cat") + '">' + CATS.map(function (c) { var on = d.cat === c[0];
        return '<button type="button" role="radio" aria-checked="' + on + '" class="adcat' + (on ? " on" : "") + '" data-act="adcat" data-v="' + c[0] + '" style="--cc:' + c[2] + '">' + I(c[1], 24) + "<span>" + t("adc." + c[0]) + "</span></button>"; }).join("") + "</div>" +
      '<p class="adlbl">' + t("ads.photos") + ' <small class="muted">' + t("ads.photosMax", { n: d.photos.length }) + '</small></p><div class="adphotos">' +
        (d.photos.length < 10 ? '<label class="adadd">' + I("camera", 26) + "<span>" + t("ads.addPhoto") + "</span><small>" + t("ads.upTo") + '</small><input type="file" accept="image/*" multiple data-input="adph"></label>' : "") +
        d.photos.map(function (x, i) { return '<span class="adpic"><img src="' + esc(x) + '" alt="">' + (i ? "" : '<em class="adcov">' + t("ads.cover") + "</em>") + '<button type="button" class="adpicx" data-act="adphdel" data-i="' + i + '" aria-label="' + t("ads.delPhoto") + '">' + I("x", 14) + "</button></span>"; }).join("") + "</div>" +
      '<label class="f">' + t("ads.title") + '<input data-input="adf" data-k="title" value="' + esc(d.title) + '" maxlength="80" placeholder="' + t("ads.titlePh") + '"></label>' +
      '<label class="f">' + t("ads.desc") + '<textarea data-input="adf" data-k="desc" rows="4" maxlength="3000" placeholder="' + t("ads.descPh") + '">' + esc(d.desc) + "</textarea></label>" +
      '<div class="grid2"><label class="f">' + t("ads.price") + '<input data-input="adf" data-k="price" inputmode="numeric" value="' + esc(d.price) + '" placeholder="0"><small class="muted">' + t("ads.priceHint") + "</small></label>" +
      '<label class="f">' + t("profile.city") + '<select data-input="adf" data-k="cityId">' + cities.map(function (c) { return '<option value="' + c.id + '"' + (c.id === d.cityId ? " selected" : "") + ">" + esc(SF.tx(c.name)) + "</option>"; }).join("") + "</select></label></div>" +
      '<label class="f">' + t("ads.phone") + '<span class="phonein"><span class="cc">+992</span><input data-input="adf" data-k="phone" inputmode="tel" value="' + esc(d.phone) + '" placeholder="9X XXX XX XX"></span></label>' +
      '<button type="button" class="btn ok block lg" data-act="adsave">' + t("ads.continue") + "</button>" +
      ((!a || a.status === "draft") ? '<button type="button" class="btn ghost block" data-act="adsave" data-draft="1">' + t("ads.saveDraft") + "</button>" : "") +
      '<p class="fine">' + I("shield", 14) + t(((SF.state.adcfg || {}).moderation === false) ? "ads.rulesNoMod" : "ads.rules") + "</p></div>";
  }
  function fresh() { var u = SF.state.user; return { id: null, cat: "", title: "", desc: "", price: "", cityId: SF.state.cityId, phone: String(u.phone || "").replace(/\D/g, "").slice(-9), photos: [] }; }
  function loadCfg() { return api().get("/ads/config").then(function (c) { SF.state.adcfg = c; return c; }); }
  SF.route("/ads/new", { roles: ["customer"], title: "ads.new", render: function () { var g = gate(); if (g) return g;
    if (!draft() || draft().id) SF.state.adf = fresh(); return loadCfg().then(function () { return formPage(null); }); } });
  SF.route("/ads/:id/edit", { roles: ["customer"], title: "ads.edit", render: function (p) { var g = gate(); if (g) return g;
    return Promise.all([api().get("/ads/" + p.id), loadCfg()]).then(function (r) { var a = r[0];
      if (!draft() || draft().id !== a.id) SF.state.adf = { id: a.id, cat: a.cat, title: a.title, desc: a.desc || "", price: a.price == null ? "" : String(a.price), cityId: a.cityId, phone: String(a.phone || "").replace(/\D/g, "").slice(-9), photos: (a.photos || []).slice() };
      return formPage(a); }); } });
  SF.inputs.adf = function (v, el) { draft()[el.dataset.k] = v; };
  SF.actions.adcat = function (el) { draft().cat = el.dataset.v; document.querySelectorAll(".adcat").forEach(function (b) { var on = b === el; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }); };
  SF.inputs.adph = function (v, el) { var fs = Array.prototype.slice.call(el.files || []), d = draft(); if (!fs.length) return;
    fs = fs.slice(0, 10 - d.photos.length); SF.toast(t("ads.photoWait"), "info");
    return fs.reduce(function (pr, f) { return pr.then(function () { return SF.shrinkImage(f, 1100, 0.78).then(function (x) { d.photos.push(x); }, function () { SF.toast(t("tr.notImage"), "err"); }); }); }, Promise.resolve())
      .then(function () { SF.render({ quiet: true }); }); };
  SF.actions.adphdel = function (el) { draft().photos.splice(+el.dataset.i, 1); SF.render({ quiet: true }); };
  SF.actions.adsave = function (el) { var d = draft(), isDraft = !!el.dataset.draft;
    if (!d.cat) { SF.toast(t("ads.needCat"), "err"); return; } if (String(d.title).trim().length < 3) { SF.toast(t("e.BAD_AD_TITLE"), "err"); return; }
    var body = { cat: d.cat, title: d.title, desc: d.desc, price: String(d.price).replace(/\D/g, ""), cityId: d.cityId, phone: d.phone, photos: d.photos, draft: isDraft };
    return (d.id ? api().patch("/ads/" + d.id, body) : api().post("/ads", body)).then(function (a) { SF.state.adf = null;
      if (isDraft) { SF.toast(t("ads.draftSaved")); SF.go("/ads/my?tab=draft"); return; }
      if ((SF.state.adcfg || {}).paid && ["active", "pending"].indexOf(a.status) >= 0) { SF.go("/ads/" + a.id + "/promote"); return; }
      SF.toast(t(a.status === "active" ? "ads.published" : "ads.sent")); SF.go("/ads/my?tab=" + (a.status === "active" ? "active" : "pending")); }); };

  /* ---------- promotion (only while paid ads are on) ---------- */
  SF.route("/ads/:id/promote", { roles: ["customer"], title: "ads.promoT", render: function (p) { var g = gate(); if (g) return g;
    return Promise.all([api().get("/ads/" + p.id), loadCfg()]).then(function (r) { var a = r[0], c = r[1], sel = SF.state.adpk || "";
      if (!c.paid) { setTimeout(function () { SF.go("/ads/my"); }, 0); return ""; }
      var opts = [["top", "up", "#F06A1F"], ["color", "palette", "#7C3AED"], ["vip", "crown", "#F2A20C"]];
      return back("/ads/my", t("ads.promoT")) + '<div class="adprom">' + '<div class="adrow mini"><span class="adph">' + thumb(a) + '</span><div class="adtx"><b class="adt">' + esc(a.title) + '</b><span class="adp num">' + price(a) + "</span><small>" + esc(cityName(a)) + "</small></div></div>" +
        '<div class="promlist" role="radiogroup" aria-label="' + t("ads.promoT") + '">' +
          '<button type="button" role="radio" aria-checked="' + !sel + '" class="prom' + (sel ? "" : " on") + '" data-act="adpk" data-v=""><span class="pmi" style="--pc:#0B8A4A">' + I("image", 22) + '</span><span class="grow"><b>' + t("ads.p.basic") + "</b><small>" + t("ads.p.basicSub", { n: c.days }) + '</small></span><em class="num">' + (c.fee ? money(c.fee) : t("ads.free")) + "</em></button>" +
          opts.map(function (o) { var on = sel === o[0]; return '<button type="button" role="radio" aria-checked="' + on + '" class="prom' + (on ? " on" : "") + '" data-act="adpk" data-v="' + o[0] + '"><span class="pmi" style="--pc:' + o[2] + '">' + I(o[1], 22) + '</span><span class="grow"><b>' + t("ads.p." + o[0]) + "</b><small>" + t("ads.p." + o[0] + "Sub") + '</small></span><em class="num">' + money(c[o[0]]) + "</em></button>"; }).join("") + "</div>" +
        '<button type="button" class="btn ok block lg" data-act="adpublish">' + t(c.fee ? "ads.publish" : "ads.publishFree") + "</button>" +
        '<button type="button" class="btn ghost block lg" data-act="adpay" data-id="' + a.id + '"' + (sel ? "" : " disabled") + ">" + t("ads.choosePay") + "</button>" +
        '<p class="fine">' + I("info", 14) + t("ads.payNote") + "</p></div>";
    }); } });
  SF.actions.adpk = function (el) { SF.state.adpk = el.dataset.v; SF.render({ quiet: true }); };
  SF.actions.adpublish = function () { SF.state.adpk = ""; SF.toast(t("ads.sent")); SF.go("/ads/my?tab=pending"); };
  SF.actions.adpay = function (el) { var k = SF.state.adpk; if (!k) return;
    return api().post("/ads/" + el.dataset.id + "/promote", { kind: k }).then(function (x) { SF.state.adpk = ""; var pub = SF.state.pub || {};
      SF.modal('<div class="confirm"><span class="cic">' + I("wallet", 26) + '</span><h2 class="h2">' + t("ads.payAskT") + '</h2><p class="muted">' + t("ads.payAsk", { sum: money(x.amount), phone: esc(pub.supportPhone || "") }) + '</p><a class="btn primary block" href="#/ads/my" data-act="closemodal">' + t("ads.my") + "</a></div>"); }); };

  /* ---------- my ads ---------- */
  var TABS = [["active", ["active"]], ["pending", ["pending", "rejected"]], ["draft", ["draft"]], ["archived", ["archived", "blocked"]]];
  SF.route("/ads/my", { roles: ["customer"], title: "ads.my", render: function (p, q) { var g = gate(); if (g) return g;
    return api().get("/ads/my").then(function (all) { var tab = q.tab || "active", cur = TABS.filter(function (x) { return x[0] === tab; })[0] || TABS[0];
      SF.state.myads = all; var list = all.filter(function (a) { return cur[1].indexOf(a.status) >= 0; });
      return back("/profile", t("ads.my")) + '<div class="segtabs" role="tablist">' + TABS.map(function (x) { var n = all.filter(function (a) { return x[1].indexOf(a.status) >= 0; }).length, on = x === cur;
          return '<a role="tab" aria-selected="' + on + '" class="segt' + (on ? " on" : "") + '" href="#/ads/my?tab=' + x[0] + '">' + t("ads.tab." + x[0]) + (n ? ' <i class="num">' + n + "</i>" : "") + "</a>"; }).join("") + "</div>" +
        (list.length ? '<div class="adlist">' + list.map(function (a) { return SF.adRow(a, true) + (a.reason && (a.status === "rejected" || a.status === "blocked") ? '<p class="adwhy">' + I("info", 15) + esc(a.reason) + "</p>" : ""); }).join("") + "</div>"
          : SF.empty("megaphone", t("ads.myNone." + cur[0]), t("ads.myNoneSub"))) +
        '<button type="button" class="adfab" data-act="create">' + I("plus", 20) + t("ads.place") + "</button>";
    }); } });
  SF.actions.admenu = function (el) { var a = (SF.state.myads || []).filter(function (x) { return x.id === el.dataset.id; })[0]; if (!a) { SF.go("/ads/my"); return; }
    var paid = (SF.state.pub || {}).adsPaid, b = function (act, ic, key, cls) { return '<button type="button" class="prow' + (cls ? " " + cls : "") + '" data-act="' + act + '" data-id="' + a.id + '"><span class="pic">' + I(ic, 20) + '</span><span class="grow">' + t(key) + "</span></button>"; };
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><h2 class="h2">' + esc(a.title) + '</h2><nav class="plist card">' +
      '<a class="prow" href="#/ads/' + a.id + '" data-act="closemodal"><span class="pic">' + I("eye", 20) + '</span><span class="grow">' + t("ads.view") + "</span></a>" +
      (a.status !== "blocked" ? '<a class="prow" href="#/ads/' + a.id + '/edit" data-act="closemodal"><span class="pic">' + I("edit", 20) + '</span><span class="grow">' + t("btn.edit") + "</span></a>" : "") +
      (a.status === "draft" ? b("adsend", "send", "ads.send") : "") +
      (paid && ["active", "pending"].indexOf(a.status) >= 0 ? '<a class="prow" href="#/ads/' + a.id + '/promote" data-act="closemodal"><span class="pic">' + I("up", 20) + '</span><span class="grow">' + t("ads.promote") + "</span></a>" : "") +
      (["active", "pending", "rejected"].indexOf(a.status) >= 0 ? b("adarch", "box", "ads.archive") : "") + (a.status === "archived" ? b("adrestore", "route", "ads.restore") : "") +
      b("addel", "trash", "ads.delete", "danger") + "</nav>"); };
  function reload(msg) { return function () { SF.closeModal(); if (msg) SF.toast(t(msg)); SF.render({ quiet: true }); }; }
  SF.actions.adsend = function (el) { return api().patch("/ads/" + el.dataset.id, {}).then(reload("ads.sent")); };
  SF.actions.adarch = function (el) { return api().post("/ads/" + el.dataset.id + "/archive").then(reload("ads.archived")); };
  SF.actions.adrestore = function (el) { return api().post("/ads/" + el.dataset.id + "/restore").then(reload("ads.sent")); };
  SF.actions.addel = function (el) { SF.modal('<div class="confirm"><span class="cic bad">' + I("trash", 26) + '</span><h2 class="h2">' + t("ads.delQ") + '</h2><p class="muted">' + t("ads.delSub") + '</p><div class="row2"><button class="btn ghost" data-act="closemodal">' + t("btn.cancel") + '</button><button class="btn danger" data-act="addelok" data-id="' + el.dataset.id + '">' + t("ads.delete") + "</button></div></div>"); };
  SF.actions.addelok = function (el) { return api().del("/ads/" + el.dataset.id).then(function () { SF.closeModal(); SF.toast(t("ads.deleted")); if (/^\/ads\/[^/]+$/.test(SF.path()) && SF.path() !== "/ads/my") SF.go("/ads/my"); else SF.render({ quiet: true }); }); };
  /* ---------- one ad (registered last: /ads/new and /ads/my come first) ---------- */
  SF.route("/ads/:id", { title: "sv.ads", render: function (p) { var g = gate(); if (g) return g;
    return api().get("/ads/" + p.id).then(function (a) { var ph = a.photos || [], c = catOf(a.cat), u = SF.state.user, mine = a.mine;
      var digits = String(a.phone || "").replace(/\D/g, ""); if (digits.length === 9) digits = "992" + digits;
      var gal = '<div class="adgalw"><div class="adgal" id="adgal">' + (ph.length ? ph.map(function (x) { return '<img src="' + esc(x) + '" alt="">'; }).join("") : '<span class="adnoph" style="color:' + c[2] + '">' + I(c[1], 64) + "</span>") + "</div>" +
        '<a class="gbtn gl" href="#/ads" aria-label="' + t("btn.back") + '">' + I("chevL", 20) + '</a><span class="gbtns"><button type="button" class="gbtn" data-act="adshare" data-title="' + esc(a.title) + '" aria-label="' + t("ads.share") + '">' + I("share", 18) + "</button>" + (mine ? "" : favA(a).replace("favbtn adfav", "favbtn adfav gbtn")) + "</span>" +
        (ph.length > 1 ? '<span class="gcount num" id="gcount">1/' + ph.length + "</span>" : "") + "</div>";
      var info = '<section class="adinfo">' + (mine ? '<div class="adown">' + stPill(a.status) + (a.reason ? '<p class="adwhy">' + I("info", 16) + esc(a.reason) + "</p>" : "") + (a.awaiting ? '<p class="adwhy warn">' + I("wallet", 16) + t("ads.awaiting") + "</p>" : "") + "</div>" : "") +
        "<h1>" + esc(a.title) + '</h1><b class="adprice num">' + price(a) + '</b><p class="adwhere">' + I("pin", 15) + esc(cityName(a)) + " · " + when(a.publishedAt || a.createdAt) + "</p>" +
        (a.desc ? '<p class="addesc">' + esc(a.desc).replace(/\n/g, "<br>") + "</p>" : "") +
        '<dl class="adattrs"><dt>' + t("ads.cat") + "</dt><dd>" + t("adc." + a.cat) + "</dd><dt>" + t("profile.city") + "</dt><dd>" + esc(cityName(a)) + "</dd><dt>" + t("ads.views") + '</dt><dd class="num">' + a.views + "</dd>" + (mine ? "" : "<dt>" + t("ads.seller") + "</dt><dd>" + esc(a.seller) + "</dd>") + "</dl>" +
        (mine ? "" : '<p class="fine adsafe">' + I("shield", 14) + t("ads.safety") + "</p>") + "</section>";
      var bar = mine ? '<div class="adbar">' + (a.status !== "blocked" ? '<a class="btn ghost" href="#/ads/' + a.id + '/edit">' + I("edit", 18) + t("btn.edit") + "</a>" : "") + '<button type="button" class="btn primary" data-act="admenu" data-id="' + a.id + '">' + I("dots", 18) + t("ads.actions") + "</button></div>"
        : '<div class="adbar"><button type="button" class="btn ghost adcall" data-act="call" data-name="' + esc(a.seller) + '" data-phone="' + esc(a.phone) + '" data-sub="' + esc(a.title) + '">' + I("phone", 18) + t("ads.call") + '</button><a class="btn ok adwrite" target="_blank" rel="noopener" href="https://wa.me/' + digits + "?text=" + encodeURIComponent(t("ads.waText", { title: a.title })) + '">' + I("chat", 18) + t("ads.write") + "</a></div>";
      return '<div class="adview">' + gal + info + bar + "</div>";
    });
  } });
})();
