/* ADMIN — the books of my own deliveries: goods, delivery fee, what I paid for the goods, my costs, profit */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, money = SF.money, api = function () { return SF.api; };
  var days = 7;
  function tile(l, v, cls) { return '<div class="bktile ' + (cls || "") + '"><small>' + l + '</small><b class="num">' + v + "</b></div>"; }
  SF.adminRoute("/admin/books", { title: "bk.nav", render: function () {
    return api().get("/admin/books?days=" + days).then(function (d) { var T = d.totals;
      return '<div class="bkpage"><div class="chips">' + [[1, "bk.today"], [7, "bk.d7"], [30, "bk.d30"]].map(function (x) { return '<button type="button" class="chip' + (days === x[0] ? " on" : "") + '" data-act="bkdays" data-v="' + x[0] + '">' + t(x[1]) + "</button>"; }).join("") + "</div>" +
        '<div class="bktiles">' + tile(t("bk.orders"), T.orders) + tile(t("bk.goods"), money(T.goods)) + tile(t("bk.delivery"), money(T.delivery)) + tile(t("bk.purchase"), money(T.purchase)) + tile(t("bk.extra"), money(T.extra)) + tile(t("bk.profit"), money(T.profit), "big") + tile(t("bk.kg"), T.weightKg + " " + t("bk.kgu")) + "</div>" +
        (T.noCost ? '<div class="msg warn">' + t("bk.nocost", { n: T.noCost }) + "</div>" : "") + '<p class="fine">' + t("bk.hint") + "</p>" +
        (d.rows.length ? '<div class="bklist">' + d.rows.map(function (r) { return '<form class="bkrow" data-form="bkcost" data-id="' + r.id + '"><div class="bkh"><b>№' + r.number + "</b><span class=\"muted\">" + SF.dt(r.at) + (r.km != null ? " · " + r.km + " " + t("u.km") : "") + (r.weightKg ? " · " + r.weightKg + " " + t("bk.kgu") : "") + '</span><b class="num ' + (r.profit != null && r.profit < 0 ? "neg" : "") + '">' + (r.profit == null ? "—" : money(r.profit)) + "</b></div>" +
          '<div class="bkd muted">' + t("bk.goods") + " " + money(r.goods) + " · " + t("bk.delivery") + " " + money(r.delivery) + (r.source ? " · " + esc(r.source) : "") + '</div><div class="bkin"><label class="f">' + t("bk.paid") + '<input name="purchaseCost" inputmode="numeric" value="' + (r.purchaseCost == null ? "" : r.purchaseCost) + '"></label><label class="f">' + t("bk.mycost") + '<input name="extraCost" inputmode="numeric" value="' + (r.extraCost == null ? "" : r.extraCost) + '"></label><button class="btn sm primary">' + t("btn.save") + "</button></div></form>"; }).join("") + "</div>"
          : SF.empty("wallet", t("bk.empty"), t("bk.emptySub"))) + "</div>"; }); } });
  SF.actions.bkdays = function (el) { days = +el.dataset.v; SF.render({ quiet: true }); };
  SF.forms.bkcost = function (fd, f) { function n(v) { v = String(v || "").replace(/\D/g, ""); return v === "" ? null : Number(v); }
    return api().patch("/admin/orders/" + f.dataset.id + "/cost", { purchaseCost: n(fd.purchaseCost), extraCost: n(fd.extraCost) }).then(function () { SF.toast(t("btn.saved")); SF.render({ quiet: true }); }, function (e) { SF.toast(SF.err(e), "err"); }); };
})();
