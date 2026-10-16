/* SOMON FOOD — demo data. All restaurants, people and numbers are fictional examples. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./rules.js"));
  else root.SomonSeed = factory(root.SomonRules);
})(typeof self !== "undefined" ? self : this, function (Rules) {
  function L(tg, ru, en) { return { tg: tg, ru: ru, en: en || ru }; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(s) { var h = 2166136261; s = "somon:" + s; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return "fnv$" + (h >>> 0).toString(16); }

  var cities = [
    { id: "c1", name: L("Душанбе", "Душанбе", "Dushanbe"), lat: 38.5598, lng: 68.7870, active: false },
    { id: "c2", name: L("Хуҷанд", "Худжанд", "Khujand"), lat: 40.2826, lng: 69.6222, active: false },
    { id: "c3", name: L("Бохтар", "Бохтар", "Bokhtar"), lat: 37.8364, lng: 68.7803, active: false },
    { id: "c4", name: L("Кӯлоб", "Куляб", "Kulob"), lat: 37.9146, lng: 69.7845, active: false },
    { id: "c5", name: L("Шаҳритус", "Шаартуз", "Shahrituz"), lat: 37.2627, lng: 68.1385, active: true }
  ];

  var categories = [
    { id: "k1", name: L("Миллӣ", "Национальная", "National"), icon: "plov", sort: 1, active: true },
    { id: "k2", name: L("Кабоб ва шашлик", "Шашлык и кебаб", "Grill"), icon: "shashlik", sort: 2, active: true },
    { id: "k3", name: L("Бургер", "Бургеры", "Burgers"), icon: "burger", sort: 3, active: true },
    { id: "k4", name: L("Питса", "Пицца", "Pizza"), icon: "pizza", sort: 4, active: true },
    { id: "k5", name: L("Шаурма", "Шаурма", "Shawarma"), icon: "shawarma", sort: 5, active: true },
    { id: "k6", name: L("Самбӯса ва нон", "Самса и выпечка", "Bakery"), icon: "samsa", sort: 6, active: true },
    { id: "k7", name: L("Шӯрбо ва салат", "Супы и салаты", "Soups & salads"), icon: "salad", sort: 7, active: true },
    { id: "k8", name: L("Ширинӣ", "Десерты", "Desserts"), icon: "dessert", sort: 8, active: true },
    { id: "k9", name: L("Нӯшокӣ", "Напитки", "Drinks"), icon: "drink", sort: 9, active: true }
  ];

  // [id, name, cityId, cuisine, tone, eta, rating, hours, commission, dLat, dLng, products[[cat, name, desc, price, weight, kind, popular]]]
  var R = [
    ["r1", L("Ошхонаи Наврӯз", "Кухня Навруз", "Navruz Kitchen"), "c1", L("Миллӣ · Палав · Қурутоб", "Национальная · Плов · Курутоб", "National · Plov · Qurutob"), "#FFE3CC", "25–35", 4.8, ["08:00", "23:00"], 15, 0.004, -0.006, [
      ["k1", L("Оши палови тӯйона", "Свадебный плов", "Wedding plov"), L("Биринҷи девзира, гӯшти гӯсфанд, сабзӣ, нахӯд", "Рис девзира, баранина, морковь, нут", "Devzira rice, lamb, carrot, chickpeas"), 38, "400 г", "plov", true],
      ["k1", L("Қурутоб", "Курутоб", "Qurutob"), L("Фатир, қурут, пиёз, помидор, кабудӣ", "Фатир, курут, лук, помидоры, зелень", "Fatir bread, qurut, onion, tomato, herbs"), 32, "450 г", "qurutob", true],
      ["k1", L("Лағмон", "Лагман", "Lagman"), L("Угроаи дастӣ, гӯшт, сабзавот", "Ручная лапша, мясо, овощи", "Hand-pulled noodles, beef, vegetables"), 30, "400 г", "lagman", false],
      ["k1", L("Манту", "Манты", "Manti"), L("5 дона, гӯшти гов ва пиёз", "5 шт., говядина и лук", "5 pcs, beef and onion"), 28, "5 дона", "mantu", true],
      ["k7", L("Шӯрбо", "Шурпа", "Shurbo soup"), L("Гӯшти гӯсфанд, картошка, нахӯд", "Баранина, картофель, нут", "Lamb, potato, chickpeas"), 26, "400 мл", "soup", false],
      ["k9", L("Чойи кабуд", "Зелёный чай", "Green tea"), L("Чойник, 2 пиёла", "Чайник, 2 пиалы", "Teapot, 2 cups"), 6, "500 мл", "tea", false]]],
    ["r2", L("Помир Бургер", "Памир Бургер", "Pamir Burger"), "c1", L("Бургер · Картошка · Нӯшокӣ", "Бургеры · Фри · Напитки", "Burgers · Fries · Drinks"), "#FFE9B8", "20–30", 4.6, ["10:00", "02:00"], 18, -0.008, 0.007, [
      ["k3", L("Бургери Помир", "Бургер Памир", "Pamir burger"), L("Котлети гов 150 г, панир, бодиринги шӯр", "Говяжья котлета 150 г, сыр, маринованный огурец", "150 g beef patty, cheese, pickles"), 34, "320 г", "burger", true],
      ["k3", L("Чизбургери дукарата", "Двойной чизбургер", "Double cheeseburger"), L("Ду котлет, ду панир", "Две котлеты, два сыра", "Two patties, two cheese"), 42, "380 г", "burger", false],
      ["k3", L("Бургери мурғ", "Чикенбургер", "Chicken burger"), L("Мурғи бирён, салат, соус", "Курица в панировке, салат, соус", "Crispy chicken, lettuce, sauce"), 29, "300 г", "burger", false],
      ["k3", L("Картошкаи фри", "Картофель фри", "French fries"), L("Бо намак ва кетчуп", "С солью и кетчупом", "Salted, with ketchup"), 12, "150 г", "fries", true],
      ["k9", L("Лимонади хонагӣ", "Домашний лимонад", "Homemade lemonade"), L("Лимӯ, наъно, ях", "Лимон, мята, лёд", "Lemon, mint, ice"), 10, "400 мл", "drink", false]]],
    ["r3", L("Питсаи Варзоб", "Пицца Варзоб", "Varzob Pizza"), "c1", L("Питса · Паста", "Пицца · Паста", "Pizza · Pasta"), "#FFDCD2", "30–45", 4.7, ["11:00", "23:30"], 15, 0.011, 0.012, [
      ["k4", L("Маргарита", "Маргарита", "Margherita"), L("Помидор, моцарелла, райҳон", "Томаты, моцарелла, базилик", "Tomato, mozzarella, basil"), 45, "30 см", "pizza", true],
      ["k4", L("Питсаи гӯштӣ", "Мясная пицца", "Meat pizza"), L("Гӯшти гов, ҳасиб, панир", "Говядина, колбаса, сыр", "Beef, sausage, cheese"), 58, "30 см", "pizza", true],
      ["k4", L("Питсаи мурғ ва занбӯруғ", "Курица с грибами", "Chicken & mushroom"), L("Мурғ, занбӯруғ, панир", "Курица, грибы, сыр", "Chicken, mushrooms, cheese"), 52, "30 см", "pizza", false],
      ["k7", L("Салати Сезар", "Салат Цезарь", "Caesar salad"), L("Мурғ, салат, сухарӣ, соус", "Курица, салат, сухарики, соус", "Chicken, lettuce, croutons, dressing"), 27, "250 г", "salad", false],
      ["k9", L("Афшураи анор", "Гранатовый сок", "Pomegranate juice"), L("Анори тоза", "Свежий гранат", "Fresh pomegranate"), 16, "300 мл", "juice", false]]],
    ["r4", L("Бозори Шашлик", "Шашлычный Базар", "Shashlik Bazaar"), "c1", L("Шашлик · Кабоб · Салат", "Шашлык · Кебаб · Салаты", "Shashlik · Kebab · Salads"), "#FFD6CF", "30–40", 4.9, ["11:00", "23:00"], 15, -0.012, -0.010, [
      ["k2", L("Шашлики гӯсфанд", "Шашлык из баранины", "Lamb shashlik"), L("5 сих, пиёз, нон", "5 шампуров, лук, лепёшка", "5 skewers, onion, bread"), 55, "5 сих", "shashlik", true],
      ["k2", L("Шашлики мурғ", "Шашлык из курицы", "Chicken shashlik"), L("5 сих, соуси сирпиёз", "5 шампуров, чесночный соус", "5 skewers, garlic sauce"), 40, "5 сих", "shashlik", false],
      ["k2", L("Люля-кабоб", "Люля-кебаб", "Lula kebab"), L("Қийма, пиёз, кабудӣ", "Фарш, лук, зелень", "Minced lamb, onion, herbs"), 36, "250 г", "kebab", true],
      ["k7", L("Салати аччиқ-чучук", "Салат ачик-чучук", "Achik-chuchuk salad"), L("Помидор, бодиринг, пиёз", "Помидоры, огурцы, лук", "Tomato, cucumber, onion"), 12, "200 г", "salad", false],
      ["k6", L("Нони тануриӣ", "Тандырная лепёшка", "Tandoor bread"), L("Гарм аз танӯр", "Горячая из тандыра", "Hot from the tandoor"), 5, "1 дона", "bread", false]]],
    ["r5", L("Самбӯсаи Танӯр", "Самса из Тандыра", "Sambusa Tandoor"), "c1", L("Самбӯса · Нон · Чой", "Самса · Лепёшки · Чай", "Samsa · Bread · Tea"), "#F6E3C0", "15–25", 4.7, ["06:00", "20:00"], 12, 0.015, -0.014, [
      ["k6", L("Самбӯсаи гӯштӣ", "Самса с мясом", "Meat sambusa"), L("Гӯшти гӯсфанд, пиёз, зира", "Баранина, лук, зира", "Lamb, onion, cumin"), 9, "1 дона", "samsa", true],
      ["k6", L("Самбӯсаи қаду", "Самса с тыквой", "Pumpkin sambusa"), L("Қаду, пиёз", "Тыква, лук", "Pumpkin, onion"), 7, "1 дона", "samsa", false],
      ["k6", L("Нони патир", "Лепёшка патир", "Patir bread"), L("Бо кунҷид", "С кунжутом", "With sesame"), 6, "1 дона", "bread", true],
      ["k9", L("Чойи сиёҳ", "Чёрный чай", "Black tea"), L("Бо лимӯ", "С лимоном", "With lemon"), 5, "500 мл", "tea", false]]],
    ["r6", L("Ширинии Ширин", "Десерты Ширин", "Shirin Desserts"), "c1", L("Ширинӣ · Торт · Яхмос", "Десерты · Торты · Мороженое", "Desserts · Cakes · Ice cream"), "#FBE0EC", "25–35", 4.8, ["09:00", "22:00"], 15, -0.003, 0.016, [
      ["k8", L("Пахлава", "Пахлава", "Baklava"), L("Чормағз, асал", "Грецкий орех, мёд", "Walnut, honey"), 22, "200 г", "dessert", true],
      ["k8", L("Торти Наполеон", "Торт Наполеон", "Napoleon cake"), L("Як бурида", "Один кусок", "One slice"), 18, "180 г", "cake", true],
      ["k8", L("Яхмоси пистагӣ", "Фисташковое мороженое", "Pistachio ice cream"), L("3 кура", "3 шарика", "3 scoops"), 16, "150 г", "icecream", false],
      ["k9", L("Капучино", "Капучино", "Cappuccino"), L("Эспрессо ва шир", "Эспрессо и молоко", "Espresso and milk"), 14, "300 мл", "coffee", false]]],
    ["r7", L("Шаурма Экспресс", "Шаурма Экспресс", "Shawarma Express"), "c1", L("Шаурма · Донар", "Шаурма · Донер", "Shawarma · Doner"), "#E3F1E4", "15–25", 4.5, ["09:00", "03:00"], 18, 0.007, 0.003, [
      ["k5", L("Шаурмаи мурғ", "Шаурма с курицей", "Chicken shawarma"), L("Лаваш, мурғ, сабзавот, соус", "Лаваш, курица, овощи, соус", "Lavash, chicken, vegetables, sauce"), 22, "350 г", "shawarma", true],
      ["k5", L("Шаурмаи гов", "Шаурма с говядиной", "Beef shawarma"), L("Лаваш, гӯшти гов, сабзавот", "Лаваш, говядина, овощи", "Lavash, beef, vegetables"), 26, "350 г", "shawarma", false],
      ["k3", L("Картошкаи фри", "Картофель фри", "French fries"), L("Порсияи калон", "Большая порция", "Large portion"), 11, "150 г", "fries", false],
      ["k9", L("Дӯғ", "Айран", "Ayran"), L("Сард", "Холодный", "Chilled"), 6, "400 мл", "ayran", false]]],
    ["r8", L("Ошхонаи Хуҷанд", "Худжанд Ошхона", "Khujand Oshkhona"), "c2", L("Миллӣ · Палав", "Национальная · Плов", "National · Plov"), "#FFE3CC", "25–40", 4.7, ["08:00", "22:00"], 15, 0.003, 0.004, [
      ["k1", L("Оши палови Хуҷанд", "Худжандский плов", "Khujand plov"), L("Биринҷи сурх, гӯшт, сабзии зард", "Красный рис, мясо, жёлтая морковь", "Red rice, meat, yellow carrot"), 34, "400 г", "plov", true],
      ["k1", L("Манту", "Манты", "Manti"), L("5 дона", "5 шт.", "5 pcs"), 25, "5 дона", "mantu", false],
      ["k6", L("Самбӯсаи гӯштӣ", "Самса с мясом", "Meat sambusa"), L("Аз танӯр", "Из тандыра", "From the tandoor"), 8, "1 дона", "samsa", false]]],
    ["r9", L("Гриль Бохтар", "Бохтар Гриль", "Bokhtar Grill"), "c3", L("Кабоб · Бургер", "Кебаб · Бургеры", "Kebab · Burgers"), "#FFD6CF", "25–35", 4.6, ["10:00", "23:00"], 15, -0.004, 0.005, [
      ["k2", L("Шашлики гӯсфанд", "Шашлык из баранины", "Lamb shashlik"), L("5 сих", "5 шампуров", "5 skewers"), 48, "5 сих", "shashlik", true],
      ["k3", L("Бургери классикӣ", "Классический бургер", "Classic burger"), L("Котлети гов, панир", "Говяжья котлета, сыр", "Beef patty, cheese"), 28, "300 г", "burger", false]]],
    ["r10", L("Чойхонаи Кӯлоб", "Чайхана Куляб", "Kulob Choykhona"), "c4", L("Миллӣ · Чой", "Национальная · Чай", "National · Tea"), "#F6E3C0", "20–35", 4.7, ["07:00", "22:00"], 12, 0.002, -0.003, [
      ["k1", L("Оши палов", "Плов", "Plov"), L("Бо гӯшти гӯсфанд", "С бараниной", "With lamb"), 30, "400 г", "plov", true],
      ["k1", L("Қурутоб", "Курутоб", "Qurutob"), L("Фатир ва қурут", "Фатир и курут", "Fatir and qurut"), 28, "450 г", "qurutob", true],
      ["k9", L("Чойи кабуд", "Зелёный чай", "Green tea"), L("Чойник", "Чайник", "Teapot"), 5, "500 мл", "tea", false]]]
  ];

  var SCHEMA = 5;     // bump when demo data changes shape; old saved data is then replaced
  var HOME = "c5";   // launch city: Shahrituz. Other cities are kept for later expansion (inactive).
  var STREETS = ["кӯчаи Ленин", "кӯчаи Рӯдакӣ", "кӯчаи Сомонӣ", "кӯчаи Айнӣ", "кӯчаи Фирдавсӣ", "кӯчаи Истиқлол", "маҳаллаи Навобод", "маҳаллаи Гулистон"];
  function build(nowMs, opts) {
    opts = opts || {};
    var now = nowMs || Date.now(), DAY = 86400000, rnd = rng(20261015);
    var db = { meta: { version: 1, schema: SCHEMA, seededAt: now, seq: 1000 }, settings: { deliveryBase: 8, deliveryPerKm: 2, deliveryMin: 10, courierPct: 80, payTransfer: true, payCash: opts.demo !== false, currency: "TJS", defaultCityId: HOME, zoneKm: 5, supportPhone: "+992 900 00 00 00" },
      cities: cities.map(function (c) { return Object.assign({}, c); }),
      categories: categories.map(function (c) { return Object.assign({}, c); }),
      users: [], restaurants: [], products: [], orders: [], payments: [], notifications: [], sessions: {},
      promos: [
        { id: "pr1", code: "TEZ10", type: "percent", value: 10, minOrder: 50, maxUses: 0, uses: 12, active: true, expiresAt: null },
        { id: "pr2", code: "NAVRUZ", type: "fixed", value: 15, minOrder: 100, maxUses: 500, uses: 41, active: true, expiresAt: null },
        { id: "pr3", code: "WELCOME20", type: "percent", value: 20, minOrder: 60, maxUses: 100, uses: 100, active: true, expiresAt: null }
      ],
      banners: [
        { id: "b1", title: L("Ҳафтаи палав", "Неделя плова", "Plov week"), sub: L("−10% бо рамзи TEZ10", "−10% по коду TEZ10", "−10% with code TEZ10"), restaurantId: "r1", art: "plov", tone: "#E8590C", active: true },
        { id: "b2", title: L("Расонидан аз 10 сомонӣ", "Доставка от 10 сомони", "Delivery from 10 TJS"), sub: L("Дар тамоми Шаҳритус · то 5 км", "По всему Шаартузу · до 5 км", "All over Shahrituz · up to 5 km"), restaurantId: null, art: "scooter", tone: "#0B8A5A", active: true },
        { id: "b3", title: L("Ширинӣ барои шом", "Сладкое на вечер", "Sweet evening"), sub: L("Пахлава ва торт", "Пахлава и торты", "Baklava and cakes"), restaurantId: "r6", art: "dessert", tone: "#7A3E9D", active: true }
      ] };
    function uid(p) { db.meta.seq++; return p + db.meta.seq; }
    function user(id, role, name, phone, extra) { var u = Object.assign({ id: id, role: role, name: name, phone: phone, pass: hash("1234"), active: true, cityId: HOME, createdAt: now - 90 * DAY, lang: "tg" }, extra || {}); db.users.push(u); return u; }

    if (opts.demo === false) {   // real launch: one admin, no example restaurants, people or orders
      if (!opts.admin || !opts.admin.phone || !opts.admin.pass) throw new Error("ADMIN_PHONE and ADMIN_PASSWORD are required for the first start");
      db.users.push({ id: "u_admin", role: "admin", name: opts.admin.name, phone: opts.admin.phone, pass: opts.admin.pass, active: true, cityId: HOME, createdAt: now, lang: "tg" });
      db.promos = []; db.banners = [db.banners[1]]; db.banners[0].restaurantId = null; db.meta.seq = 6000; return db;
    }
    user("u_admin", "admin", "Фирдавс Раҳимов", "+992900000001");
    var customers = [["u_c1", "Ҷамшед Каримов", "+992900000301"], ["u_c2", "Мадина Сафарова", "+992900000302"], ["u_c3", "Фарид Назаров", "+992900000303"], ["u_c4", "Нилуфар Ҳасанова", "+992900000304"], ["u_c5", "Алишер Юсупов", "+992900000305"], ["u_c6", "Зарина Мирзоева", "+992900000306"]]
      .map(function (c, i) { return user(c[0], "customer", c[1], c[2], { createdAt: now - (60 - i * 7) * DAY, addresses: [] }); });
    var couriers = [["u_k1", "Фаррух Аҳмадов", "+992900000201", 4.9], ["u_k2", "Беҳрӯз Исмоилов", "+992900000202", 4.7], ["u_k3", "Сино Раҷабов", "+992900000203", 4.8], ["u_k4", "Комрон Шарипов", "+992900000204", 4.6]]
      .map(function (c, i) { return user(c[0], "courier", c[1], c[2], { courier: { online: i < 2, vehicle: i % 2 ? "bike" : "scooter", rating: c[3], ratingCount: 30 + i * 11, lat: 37.2627 + (i - 1.5) * 0.006, lng: 68.1385 + (i - 1.5) * 0.007 } }); });

    R.forEach(function (r, i) {
      var city = cities.filter(function (c) { return c.id === HOME; })[0]; r[2] = HOME; var spread = [[0.004, -0.006], [-0.006, 0.008], [0.009, 0.005], [-0.003, -0.011], [0.012, -0.002], [-0.010, -0.004], [0.002, 0.012], [-0.013, 0.006], [0.007, -0.013], [-0.002, 0.003]][i]; r[9] = spread[0]; r[10] = spread[1];
      var owner = user("u_r" + (i + 1), "restaurant", "Менеҷери " + r[1].tg, "+9929000001" + String(i + 1).padStart(2, "0"), { restaurantId: r[0], cityId: r[2] });
      db.restaurants.push({ id: r[0], name: r[1], cityId: r[2], ownerId: owner.id, cuisine: r[3], tone: r[4], eta: r[5], rating: r[6], ratingCount: 120 + Math.round(rnd() * 400),
        hours: { from: r[7][0], to: r[7][1] }, open: true, active: true, commissionPct: r[8], minOrder: 20, lat: city.lat + r[9], lng: city.lng + r[10],
        address: L("Маркази шаҳр", "Центр города", "City centre"), phone: owner.phone, payCard: { number: "111122223333" + String(4400 + i), holder: "НАМУНА " + (i + 1), bank: "Намуна" }, createdAt: now - (120 - i * 5) * DAY });
      r[11].forEach(function (p, j) {
        db.products.push({ id: r[0] + "p" + (j + 1), restaurantId: r[0], categoryId: p[0], name: p[1], desc: p[2], price: p[3], weight: p[4], kind: p[5], popular: p[6], available: true, createdAt: now - 100 * DAY });
      });
    });

    // order history for statistics (last 30 days, Shahrituz)
    /* demo subscriptions: each place paid a month; the first one ends in 3 days so the warning is visible */
    db.subs = [];
    db.restaurants.forEach(function (r, i) { var left = i === 0 ? 3 : 12 + i * 4, until = now + left * DAY, from = until - 30 * DAY; r.paidUntil = until; r.trial = false;
      db.subs.push({ id: "s" + (i + 1), restaurantId: r.id, kind: "paid", months: 1, amount: 300, note: "нақд", from: from, until: until, at: from, by: "u_admin" }); });
    var dus = db.restaurants.filter(function (r) { return r.cityId === HOME; });
    for (var n = 0; n < 160; n++) {
      var day = Math.floor(rnd() * 30) + 1, t = now - day * DAY + Math.floor(rnd() * 12 + 9) * 3600000;
      var rest = dus[Math.floor(rnd() * dus.length)], prods = db.products.filter(function (p) { return p.restaurantId === rest.id; });
      var items = [], cnt = 1 + Math.floor(rnd() * 3);
      for (var k = 0; k < cnt; k++) { var p = prods[Math.floor(rnd() * prods.length)], ex = items.filter(function (x) { return x.productId === p.id; })[0];
        if (ex) ex.qty++; else items.push({ productId: p.id, name: p.name, price: p.price, qty: 1 + Math.floor(rnd() * 2), kind: p.kind }); }
      var sub = items.reduce(function (s, x) { return s + x.price * x.qty; }, 0), km = 1 + rnd() * 4, fee = Rules.deliveryFee(db.settings, km);
      var cust = customers[Math.floor(rnd() * customers.length)], cour = couriers[Math.floor(rnd() * couriers.length)];
      var cancelled = rnd() < 0.07, card = rnd() < 0.35;
      var o = { id: "o" + (5000 + n), number: 5000 + n, customerId: cust.id, restaurantId: rest.id, courierId: cancelled ? null : cour.id, cityId: HOME, items: items, subtotal: sub, deliveryFee: fee, discount: 0, total: sub + fee, km: Math.round(km * 10) / 10,
        address: { text: STREETS[Math.floor(rnd() * STREETS.length)] + ", " + (1 + Math.floor(rnd() * 60)), landmark: "", lat: 37.2627 + (rnd() - 0.5) * 0.05, lng: 68.1385 + (rnd() - 0.5) * 0.06 }, payment: { method: card ? "card" : "cash", status: cancelled ? (card ? "refunded" : "none") : "paid", provider: card ? "mock" : "cash" },
        status: cancelled ? "cancelled" : "delivered", prepMin: 20, comment: "", createdAt: t, updatedAt: t + 50 * 60000,
        history: [{ status: "pending", at: t, by: cust.id }, { status: cancelled ? "cancelled" : "delivered", at: t + 50 * 60000, by: cancelled ? cust.id : cour.id }] };
      if (!cancelled && rnd() < 0.6) o.review = { rating: rnd() < 0.8 ? 5 : 4, courierRating: rnd() < 0.85 ? 5 : 4, comment: "", at: t + 70 * 60000 };
      Object.assign(o, Rules.split(o, rest, db.settings));
      db.orders.push(o);
      if (card) db.payments.push({ id: "pay" + o.number, orderId: o.id, amount: o.total, method: "card", provider: "mock", status: o.payment.status, createdAt: t });
    }
    db.orders.sort(function (a, b) { return b.createdAt - a.createdAt; });
    db.meta.seq = 6000;
    return db;
  }
  return { build: build, hash: hash, L: L, SCHEMA: SCHEMA };
});
