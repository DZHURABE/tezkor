/* SHOP — catalogue & stock book: search (name, brand, model, article, barcode), sections, pages, receipts and write-offs, CSV import/export */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, tx = SF.tx, money = SF.money, api = function () { return SF.api; };
  var S = SF.state.cat = SF.state.cat || { q: "", cat: "", page: 1, nophoto: false, low: false };
  function catName(id) { var c = (SF.state.shopCats || []).filter(function (x) { return x.id === id; })[0]; return c ? tx(c.name) : ""; }
  function stockOf(p) { if ((p.variants || []).length) { var n = 0, any = false; p.variants.forEach(function (v) { if (v.stock != null) { any = true; n += v.stock; } }); return any ? n : null; } return p.stock; }
  function isLow(p) { var s = stockOf(p); return p.minStock != null && s != null && s <= p.minStock; }
  function row(p) { var st = stockOf(p), unit = p.unit || "";
    return '<div class="crow' + (p.available ? "" : " off") + '"><span class="cim">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="" loading="lazy">' : '<em class="nophoto">' + t("cat.nophoto") + "</em>") + '</span><div class="grow"><b>' + esc(tx(p.name)) + "</b>" +
      '<small class="muted">' + [p.brand, p.model, p.sku && ("№ " + p.sku), p.barcode].filter(Boolean).map(esc).join(" · ") + "</small>" +
      '<span class="cmeta num">' + ((p.variants || []).length ? t("var.from") + " " : "") + money(p.price) + (p.cost != null ? ' <i class="muted">(' + t("cf.cost") + " " + p.cost + ")</i>" : "") + "</span>" +
      '<span class="cstock' + (isLow(p) ? " low" : "") + '">' + (st == null ? t("cat.nocount") : t("cat.left") + ": " + st + " " + esc(unit)) + (isLow(p) ? " · " + t("cat.low") : "") + "</span></div>" +
      '<div class="cact"><button class="iconbtn" data-act="cstock" data-id="' + p.id + '" aria-label="' + t("cat.stock") + '">' + I("box", 18) + '</button><button class="iconbtn" data-act="prodedit" data-id="' + p.id + '" aria-label="' + t("btn.edit") + '">' + I("edit", 18) + "</button></div></div>"; }
  function qs() { return "q=" + encodeURIComponent(S.q) + "&cat=" + encodeURIComponent(S.cat) + "&page=" + S.page + "&limit=30" + (S.nophoto ? "&nophoto=1" : "") + (S.low ? "&low=1" : ""); }
  SF.restRoute("/rest/catalog", { title: "cat.btn", render: function () {
    return api().get("/restaurant/catalog?" + qs()).then(function (c) { SF.state.myProducts = c.items; S.page = c.page; SF.state.catPage = c;
      var cats = (SF.state.shopCats || []).filter(function (k) { return c.catCount[k.id]; });
      return '<div class="catpage"><a class="btn ghost sm" href="#/rest/menu">' + I("chevL", 14) + t("btn.back") + "</a><h2 class=\"h2\">" + t("cat.btn") + ' <small class="muted">(' + c.total + ")</small></h2>" +
        '<div class="csearch">' + I("search", 18) + '<input id="cq" type="search" placeholder="' + t("cat.search") + '" value="' + esc(S.q) + '" data-input="cq" autocomplete="off"></div>' +
        '<div class="cfilters"><select data-input="ccat" aria-label="' + t("menu.category") + '"><option value="">' + t("cat.allcats") + "</option>" + cats.map(function (k) { return '<option value="' + k.id + '"' + (k.id === S.cat ? " selected" : "") + ">" + esc(tx(k.name)) + " (" + c.catCount[k.id] + ")</option>"; }).join("") + "</select>" +
        '<button type="button" class="chip' + (S.nophoto ? " on" : "") + '" data-act="cflt" data-v="nophoto">' + t("cat.nophoto") + " (" + c.noPhoto + ')</button><button type="button" class="chip' + (S.low ? " on" : "") + '" data-act="cflt" data-v="low">' + t("cat.low") + "</button></div>" +
        '<div class="ctools"><button class="btn sm ghost" data-act="cexp">' + t("cat.export") + '</button><label class="btn sm ghost">' + t("cat.import") + '<input type="file" accept=".csv,text/csv,text/plain" data-input="cimp" hidden></label><button class="btn sm ghost" data-act="ctpl">' + t("cat.tpl") + '</button><label class="btn sm ghost">' + t("cat.bulk") + '<input type="file" accept="image/*" multiple data-input="cbulk" hidden></label><a class="btn sm ghost" href="#/rest/moves">' + t("cat.moves") + "</a></div>" +
        (c.items.length ? '<div class="clist">' + c.items.map(row).join("") + "</div>" : SF.empty("grid", t("cat.empty"), t("cat.emptySub"))) +
        (c.pages > 1 ? '<div class="cpager"><button class="btn sm ghost" data-act="cpg" data-v="-1"' + (c.page <= 1 ? " disabled" : "") + ">" + I("chevL", 14) + "</button><b>" + c.page + " / " + c.pages + '</b><button class="btn sm ghost" data-act="cpg" data-v="1"' + (c.page >= c.pages ? " disabled" : "") + ">" + I("chevR", 14) + "</button></div>" : "") + "</div>"; }); } });
  var tmr; SF.inputs.cq = function (v) { clearTimeout(tmr); tmr = setTimeout(function () { S.q = v; S.page = 1; SF.render({ quiet: true }); setTimeout(function () { var i = document.getElementById("cq"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 80); }, 350); };
  SF.inputs.ccat = function (v) { S.cat = v; S.page = 1; SF.render({ quiet: true }); };
  SF.actions.cflt = function (el) { S[el.dataset.v] = !S[el.dataset.v]; S.page = 1; SF.render({ quiet: true }); };
  SF.actions.cpg = function (el) { S.page = Math.max(1, S.page + (+el.dataset.v)); SF.render({ quiet: true }); window.scrollTo(0, 0); };
  /* ---- stock book ---- */
  SF.actions.cstock = function (el) { var p = SF.state.myProducts.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!p) return; var vs = p.variants || [];
    api().get("/restaurant/stock-moves?productId=" + p.id + "&limit=8").then(function (mv) {
      SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="cstock" data-id="' + p.id + '"><h2 class="h2">' + esc(tx(p.name)) + "</h2><p class=\"muted\">" + t("cat.left") + ": " + (stockOf(p) == null ? t("cat.nocount") : stockOf(p)) + "</p>" +
        (vs.length ? '<label class="f">' + t("var.label") + '<select name="variantId">' + vs.map(function (v) { return '<option value="' + v.id + '">' + esc(v.label) + (v.stock != null ? " · " + v.stock : "") + "</option>"; }).join("") + "</select></label>" : "") +
        '<div class="mealpick">' + [["in", "cat.in"], ["out", "cat.out"], ["set", "cat.set"]].map(function (x, i) { return '<label><input type="radio" name="type" value="' + x[0] + '"' + (i === 0 ? " checked" : "") + "><span>" + t(x[1]) + "</span></label>"; }).join("") + "</div>" +
        '<label class="f">' + t("var.stock") + '<input name="qty" inputmode="numeric" required></label><label class="f">' + t("cat.note") + '<input name="note" maxlength="80"></label><button class="btn primary block lg">' + t("btn.save") + "</button>" +
        (mv.length ? '<div class="mvlist"><b>' + t("cat.moves") + "</b>" + mv.map(function (m) { return "<div><span>" + new Date(m.at).toLocaleString() + "</span><span>" + t("cat.t." + m.type) + (m.label ? " " + esc(m.label) : "") + ' <b class="num">' + (m.qty > 0 ? "+" : "") + m.qty + "</b> → " + m.after + "</span></div>"; }).join("") + "</div>" : "") + "</form>"); }); };
  SF.forms.cstock = function (fd, f) { var body = { type: fd.type, qty: Number(String(fd.qty).replace(/\D/g, "")), note: fd.note || "" }; if (fd.variantId) body.variantId = fd.variantId;
    return api().post("/restaurant/products/" + f.dataset.id + "/stock", body).then(function () { SF.closeModal(); SF.toast(t("btn.saved")); SF.render({ quiet: true }); }, function (e) { SF.toast(SF.err(e), "err"); }); };
  SF.restRoute("/rest/moves", { title: "cat.moves", render: function () { return api().get("/restaurant/stock-moves?limit=200").then(function (mv) { var names = {}; (SF.state.myProducts || []).forEach(function (p) { names[p.id] = tx(p.name); });
    return '<div class="catpage"><a class="btn ghost sm" href="#/rest/catalog">' + I("chevL", 14) + t("btn.back") + "</a><h2 class=\"h2\">" + t("cat.moves") + '</h2><div class="mvlist big">' + (mv.length ? mv.map(function (m) { return "<div><span>" + new Date(m.at).toLocaleString() + "</span><span>" + esc(names[m.productId] || m.productId) + (m.label ? " · " + esc(m.label) : "") + " — " + t("cat.t." + m.type) + ' <b class="num">' + (m.qty > 0 ? "+" : "") + m.qty + "</b> → " + m.after + (m.note ? " · " + esc(m.note) : "") + "</span></div>"; }).join("") : SF.empty("box", t("cat.nomoves"), "")) + "</div></div>"; }); } });
  /* many photos at once: the file name (without extension) is the barcode, the article or the exact name of the item */
  function norm(x) { return String(x || "").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9а-яёәғқҳӣӯҷ]+/gi, ""); }
  SF.inputs.cbulk = function (v, el) { var files = Array.prototype.slice.call(el.files || []); if (!files.length) return; SF.toast(t("cat.bulkwait", { n: files.length }));
    api().get("/restaurant/products").then(function (list) { var idx = {}; list.forEach(function (p) { [p.barcode, p.sku, tx(p.name)].forEach(function (k) { if (k) idx[norm(k)] = p; }); });
      var ok = 0, miss = []; return files.reduce(function (pr, f) { return pr.then(function () { var pd = idx[norm(f.name)]; if (!pd) { miss.push(f.name); return; }
        return SF.shrinkImage(f, 900, 0.8).then(function (d) { return api().patch("/restaurant/products/" + pd.id, { photo: d, photoSource: pd.photoSource || "загружено владельцем" }).then(function () { ok++; }); }).catch(function () { miss.push(f.name); }); }); }, Promise.resolve()).then(function () {
        SF.toast(t("cat.bulkdone", { a: ok, b: miss.length }) + (miss.length ? ": " + miss.slice(0, 4).join(", ") : ""), miss.length ? "err" : "ok"); el.value = ""; SF.render({ quiet: true }); }); }); };
  /* ---- CSV ---- */
  var COLS = ["name", "brand", "category", "model", "barcode", "sku", "unit", "cost", "price", "stock", "minStock", "origin", "weight", "desc", "photoSource"];
  function csvCell(v) { v = v == null ? "" : String(v); return /[";,\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function download(name, text) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  SF.actions.cexp = function () { return api().get("/restaurant/products").then(function (list) { var rows = [COLS.join(";")].concat(list.map(function (p) { return COLS.map(function (k) { return csvCell(k === "name" ? tx(p.name) : k === "desc" ? tx(p.desc) : k === "category" ? catName(p.categoryId) : p[k]); }).join(";"); })); download("katalog.csv", rows.join("\r\n")); SF.toast(t("cat.exported", { n: list.length })); }); };
  SF.actions.ctpl = function () { download("shablon.csv", COLS.join(";") + "\r\nМуфта 25;PPR;Қубур ва фитингҳо;M25;;MF-25;шт;2;4;10;5;;;;"); };
  function parseCsv(text) { text = text.replace(/^﻿/, ""); var first = text.split(/\r?\n/)[0] || "", d = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",", rows = [], row = [], cur = "", q = false;
    for (var i = 0; i < text.length; i++) { var c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else if (c === '"') q = true; else if (c === d) { row.push(cur); cur = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some(function (x) { return x !== ""; })) rows.push(row); row = []; } else cur += c; }
    row.push(cur); if (row.some(function (x) { return x !== ""; })) rows.push(row); return rows; }
  SF.inputs.cimp = function (v, el) { var f = el.files && el.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function () { var rows = parseCsv(String(rd.result)), head = (rows.shift() || []).map(function (h) { return h.trim(); });
      if (head.indexOf("name") < 0 && head.indexOf("barcode") < 0) { SF.toast(t("cat.badcsv"), "err"); return; }
      var objs = rows.map(function (r) { var o = {}; head.forEach(function (h, i) { if (COLS.indexOf(h) >= 0) o[h] = (r[i] || "").trim(); }); return o; }), done = { created: 0, updated: 0, errors: [] }, chunks = [];
      for (var i = 0; i < objs.length; i += 200) chunks.push(objs.slice(i, i + 200));
      chunks.reduce(function (p, ch, ci) { return p.then(function () { return api().post("/restaurant/products/import", { rows: ch }).then(function (x) { done.created += x.created; done.updated += x.updated; x.errors.forEach(function (e) { done.errors.push({ row: ci * 200 + e.row, code: e.code }); }); }); }); }, Promise.resolve()).then(function () {
        SF.toast(t("cat.imported", { a: done.created, b: done.updated, c: done.errors.length }) + (done.errors.length ? " · " + done.errors.slice(0, 5).map(function (e) { return "#" + (e.row + 1) + " " + e.code; }).join(", ") : ""), done.errors.length ? "err" : "ok"); el.value = ""; SF.render({ quiet: true }); }, function (e) { SF.toast(SF.err(e), "err"); }); };
    rd.readAsText(f, "utf-8"); };
})();
