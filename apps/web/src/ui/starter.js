/* SHOP — ready list of everyday goods: the owner types only prices (names and sizes are already there), then adds all in one tap.
   No prices and no photos are invented here: an item without a price is skipped; photos are added from the phone later. */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, api = function () { return SF.api; };
  var W5 = ["0,5 л", "1 л", "1,5 л"], W6 = ["0,5 л", "1 л", "1,5 л", "2 л"], KG = ["5 кг", "10 кг", "25 кг", "50 кг"];
  var DATA = [
    ["g8", [["Оби Тоҷикистон", W5.concat(["5 л"])], ["Оби Онор", W5.concat(["5 л"])], ["Энергетик Adrenaline", ["0,25 л", "0,5 л"]], ["Нӯшокии газдор (кола, фанта)", W6], ["Оби маъданӣ", W5], ["Шарбат", ["0,2 л", "1 л"]]]],
    ["g1", [["Орди гандум", ["5 кг", "10 кг", "25 кг", "30 кг", "50 кг"]], ["Биринҷ", ["1 кг", "5 кг", "10 кг", "25 кг"]], ["Макарон", ["0,4 кг", "0,9 кг"]]]],
    ["g2", [["Равғани офтобпараст", ["1 л", "2 л", "5 л"]]]],
    ["g3", [["Қанд", ["1 кг", "5 кг", "25 кг", "50 кг"]], ["Чой", ["100 г", "250 г", "500 г"]]]],
    ["b1", [["Ранги обӣ (водоэмульсионный)", ["3 кг", "5 кг", "10 кг", "25 кг"]], ["Ранги равғанӣ", ["1 кг", "2,5 кг", "5 кг"]], ["Лак", ["0,75 л", "2,5 л"]], ["Ротбон (Rotband)", ["5 кг", "10 кг", "25 кг", "30 кг"]], ["Шпаклёвка", ["5 кг", "10 кг", "25 кг"]], ["Грунтовка", ["5 л", "10 л"]], ["Елими плитка", ["5 кг", "25 кг"]], ["Семент", ["25 кг", "50 кг"]], ["Гипс", ["5 кг", "25 кг"]]]],
    ["b2", [["Қубури полипропилен", ["20 мм", "25 мм", "32 мм"]], ["Фитинг (угол, тройник, муфта)", ["20 мм", "25 мм", "32 мм"]], ["Крани шарӣ", ["1/2″", "3/4″", "1″"]], ["Смеситель (аралашмакунак)", []], ["Раковина", []], ["Унитаз", []], ["Шланг", ["0,5 м", "1 м", "1,5 м"]], ["Лента ФУМ", []]]],
    ["b3", [["Лампочкаи LED", ["5 Вт", "9 Вт", "12 Вт", "15 Вт"]], ["Кабели барқ (ВВГ)", ["2×1,5 мм", "2×2,5 мм", "3×2,5 мм"]], ["Розетка", []], ["Выключатель", []], ["Удлинитель", ["3 м", "5 м", "10 м"]], ["Автомат (предохранитель)", ["16 А", "25 А", "32 А"]]]],
    ["b4", [["Кронштейни телевизор", ["14–42″", "32–55″", "37–70″"]], ["Кабели HDMI", ["1 м", "1,5 м", "3 м", "5 м"]], ["Тарелкаи сунъӣ (антенна)", ["0,6 м", "0,9 м"]], ["Кабели антенна (коаксиал)", ["1 м", "10 м", "50 м"]], ["Конвертор (LNB)", []], ["Ресивер", []], ["Пульт", []]]],
    ["b5", [["Дрель", []], ["Шуруповёрт", []], ["Болға (молоток)", []], ["Мӯйқалам ва валик", []], ["Шпатель", ["10 см", "20 см", "40 см"]], ["Рулетка", ["3 м", "5 м", "10 м"]], ["Дастпушак", []], ["Отвёртка", []]]],
    ["d1", [["Оби Зулол", ["0,33 л", "0,5 л", "1 л", "1,5 л", "5 л"]]]], ["d2", [["Сиёма", ["0,5 л", "1 л", "1,5 л"]]]], ["d3", [["RC Cola", ["0,33 л", "0,5 л", "1 л", "1,5 л", "2 л"]]]], ["d4", [["555 Cola", ["0,33 л", "0,5 л", "1 л", "1,5 л", "2 л"]]]], ["d5", [["Adrenaline Rush", ["0,25 л", "0,5 л"]]]],
    ["b0", [["Семент", ["25 кг", "50 кг"]], ["Гипс", ["5 кг", "25 кг"]], ["Кирпич", []], ["Рег (песок)", []], ["Арматура", ["8 мм", "10 мм", "12 мм"]]]],
    ["b7", [["Қубури полипропилен", ["20 мм", "25 мм", "32 мм"]], ["Муфта", ["20 мм", "25 мм", "32 мм"]], ["Тройник", ["20 мм", "25 мм", "32 мм"]], ["Прокладка", []]]],
    ["b8", [["Розетка", []], ["Выключатель", []], ["Розеткаи ТВ", []]]], ["b9", [["Лампочкаи LED", ["5 Вт", "9 Вт", "12 Вт", "15 Вт"]], ["Прожектор", ["10 Вт", "30 Вт", "50 Вт"]], ["Фонар", []], ["Батарейка", ["AA", "AAA"]]]],
    ["b10", [["Дрель", []], ["Перфоратор", []], ["Шуруповёрт", []], ["Болгарка", ["125 мм", "180 мм"]]]], ["b11", [["Насоси об", []]]], ["b12", [["Обгармкунак (бойлер)", ["30 л", "50 л", "80 л", "100 л"]]]],
    ["b13", [["Кронштейни телевизор", ["14–42″", "32–55″", "37–70″"]], ["Кабели HDMI", ["1 м", "1,5 м", "3 м", "5 м"]], ["Пульт", []]]],
    ["b6", [["Саморез", ["3,5×25", "3,5×35", "4,2×70"]], ["Дюбел", ["6×40", "8×50", "10×60"]], ["Мех (гвоздь)", ["50 мм", "70 мм", "100 мм"]]]]
  ];
  function catName(id) { var c = (SF.state.shopCats || []).filter(function (x) { return x.id === id; })[0]; return c ? SF.tx(c.name) : id; }
  /* only the sections that this kind of shop may use (admin sets the kind: «general» sees all) */
  function allowed() { var u = SF.state.user, ty = (u && u.shopType) || "general", ok = (SF.state.shopCats || []).filter(function (c) { return ty === "general" || !c.types || c.types.indexOf(ty) >= 0; }).map(function (c) { return c.id; });
    return DATA.map(function (g) { return g[0]; }).filter(function (id) { return ok.indexOf(id) >= 0; }); }
  function row(g, i, it) { var vs = it[1];
    return '<div class="strow" data-cat="' + g[0] + '"><input class="stn" data-sn maxlength="60" value="' + esc(it[0]) + '" aria-label="' + t("menu.name") + '">' +
      (vs.length ? '<div class="stv">' + vs.map(function (v) { return '<label class="stz"><span>' + esc(v) + '</span><input data-sl="' + esc(v) + '" inputmode="numeric" placeholder="' + t("menu.price") + '"></label>'; }).join("") + "</div>"
        : '<div class="stv"><label class="stz"><span>' + t("st.one") + '</span><input data-sl="" inputmode="numeric" placeholder="' + t("menu.price") + '"></label></div>') + "</div>"; }
  SF.restRoute("/rest/starter", { title: "st.btn", render: function () {
    return api().get("/restaurant/products").then(function (list) { SF.state.myProducts = list;
      return '<div class="stpage"><a class="btn ghost sm" href="#/rest/menu">' + I("chevL", 14) + t("btn.back") + '</a><h2 class="h2">' + t("st.title") + '</h2><p class="muted">' + t("st.hint") + "</p>" +
        (allowed().length < DATA.length ? '<div class="msg info">' + t("st.type") + "</div>" : "") +
        DATA.filter(function (g) { return allowed().indexOf(g[0]) >= 0; }).map(function (g) { return '<details class="stcat"' + (g[0] === allowed()[0] ? " open" : "") + "><summary>" + esc(catName(g[0])) + " <small>" + g[1].length + "</small></summary>" + g[1].map(function (it, i) { return row(g, i, it); }).join("") + "</details>"; }).join("") +
        '<div class="stbar"><button class="btn primary block lg" data-act="stadd">' + t("st.add") + '</button></div></div>'; }); } });
  SF.actions.stadd = function (btn) {
    var have = {}; (SF.state.myProducts || []).forEach(function (p) { have[SF.tx(p.name).toLowerCase()] = 1; });
    var jobs = [], n = Number;
    Array.prototype.forEach.call(document.querySelectorAll(".strow"), function (r) { var name = r.querySelector("[data-sn]").value.trim(); if (!name || have[name.toLowerCase()]) return;
      var ps = Array.prototype.map.call(r.querySelectorAll("[data-sl]"), function (i) { return { label: i.dataset.sl, price: n(i.value.replace(/\D/g, "")) }; }).filter(function (x) { return x.price > 0; });
      if (!ps.length) return; var b = { name: name, categoryId: r.dataset.cat, kind: "box" };
      if (ps.length === 1) { b.price = ps[0].price; if (ps[0].label) b.weight = ps[0].label; } else b.variants = ps;
      jobs.push(b); });
    if (!jobs.length) { SF.toast(t("st.none"), "err"); return; }
    btn.disabled = true; var ok = 0, bad = 0;
    return jobs.reduce(function (p, b) { return p.then(function () { return api().post("/restaurant/products", b).then(function () { ok++; }, function () { bad++; }); }); }, Promise.resolve()).then(function () {
      SF.toast(t("st.done", { n: ok }) + (bad ? " · " + t("st.bad", { n: bad }) : ""), bad ? "err" : "ok"); SF.go("/rest/menu"); }); };
})();
